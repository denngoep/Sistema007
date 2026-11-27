import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Workbook, type Worksheet } from 'exceljs';

import type { Prisma } from '../generated/prisma/client';
import { EstadoDispensacion } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { DispensationsRepository } from '../repositories/dispensations.repository';
import { DispensationSupportDto } from '../dto/dispensation-support.dto';

import { PrivateDocumentStore } from './private-document.store';
import {
  attachSignature,
  createDispensationReportPdf,
  createReceiptPdf,
  normalizeSignature,
  validateManualEvidence,
} from './dispensation-pdf';
import { receiptSnapshot } from './receipt-snapshot';

const roles = ['QUIMICO_FARMACEUTICO', 'REGENTE_FARMACIA', 'AUXILIAR_FARMACIA'];

const metadata = {
  id: true,
  proposito: true,
  sha256: true,
  mime: true,
  tamano: true,
  creadoAt: true,
  creadoPorId: true,
} as const;

@Injectable()
export class DispensationDocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repository: DispensationsRepository,
    private readonly store: PrivateDocumentStore,
  ) {}

  private async actor(id: number, tx: Prisma.TransactionClient = this.prisma) {
    const actor = await tx.usuario.findUnique({
      where: { id },
      select: { activo: true, rol: true },
    });

    if (!actor?.activo || !roles.includes(actor.rol)) {
      throw new ForbiddenException('Acceso farmacéutico requerido');
    }
  }

  private async mutate<T>(
    actorId: number,
    work: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          await this.actor(actorId, tx);
          return work(tx);
        },
        { isolationLevel: 'Serializable' },
      );
    } catch (error: unknown) {
      if (typeof error === 'object' && error !== null && 'code' in error) {
        const code = error.code;

        if (typeof code === 'string' && ['P2034', 'P2002'].includes(code)) {
          throw new ConflictException(
            'La documentación cambió; actualiza la consulta antes de continuar',
          );
        }
      }

      throw error;
    }
  }

  private legacy(d: {
    tipoFirma: unknown;
    firmaPaciente: unknown;
    soporteFirmado: unknown;
    fechaFirma: unknown;
  }) {
    return Boolean(
      d.tipoFirma || d.firmaPaciente || d.soporteFirmado || d.fechaFirma,
    );
  }

  async history(document: string, page: number) {
    if (
      !Number.isSafeInteger(page) ||
      page < 1 ||
      page > 10000 ||
      document.length > 191
    ) {
      throw new BadRequestException('Filtro no válido');
    }

    const rows = await this.prisma.dispensacion.findMany({
      where: document ? { paciente: { numeroDocumento: document.trim() } } : {},
      orderBy: [{ fechaDispensacion: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * 20,
      take: 20,
      select: {
        id: true,
        numeroDispensacion: true,
        fechaDispensacion: true,
        estado: true,
        tipoFirma: true,
        fechaFirma: true,
        firmaPaciente: true,
        soporteFirmado: true,
        paciente: {
          select: {
            nombres: true,
            apellidos: true,
            numeroDocumento: true,
          },
        },
        soportes: {
          select: { id: true },
          take: 1,
        },
        detalles: {
          select: {
            cantidadEntregada: true,
            detalleFormulacion: {
              select: {
                medicamento: true,
                formulacion: {
                  select: {
                    atencionClinica: {
                      select: {
                        numeroIngreso: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    return rows.map(({ firmaPaciente, soporteFirmado, soportes, ...d }) => ({
      ...d,
      estadoDocumental: soportes.length
        ? 'REGISTRADO'
        : this.legacy({
              ...d,
              firmaPaciente,
              soporteFirmado,
            })
          ? 'LEGADO_POR_VERIFICAR'
          : 'PENDIENTE',
    }));
  }

  private reportFilters(query: Record<string, string | undefined>) {
    const estado = query.estado ?? 'CONFIRMADA';

    if (
      !Object.values(EstadoDispensacion).includes(estado as EstadoDispensacion)
    ) {
      throw new BadRequestException('Estado de dispensación no válido');
    }

    const where: Prisma.DispensacionWhereInput = {
      estado: estado as EstadoDispensacion,
    };

    if (query.desde || query.hasta) {
      const fecha: Prisma.DateTimeFilter = {};

      if (query.desde) {
        const desde = new Date(`${query.desde}T00:00:00.000-05:00`);

        if (Number.isNaN(desde.getTime())) {
          throw new BadRequestException('Fecha inicial no válida');
        }

        fecha.gte = desde;
      }

      if (query.hasta) {
        const hasta = new Date(`${query.hasta}T23:59:59.999-05:00`);

        if (Number.isNaN(hasta.getTime())) {
          throw new BadRequestException('Fecha final no válida');
        }

        fecha.lte = hasta;
      }

      where.fechaDispensacion = fecha;
    }

    if (query.sedeId) {
      const sedeId = Number(query.sedeId);

      if (!Number.isInteger(sedeId) || sedeId < 1) {
        throw new BadRequestException('Sede no válida');
      }

      where.bodega = { sedeId };
    }

    if (query.medicamento?.trim()) {
      where.detalles = {
        some: {
          detalleFormulacion: {
            medicamento: {
              contains: query.medicamento.trim(),
            },
          },
        },
      };
    }

    return where;
  }

  async report(query: Record<string, string | undefined>) {
    const deliveries = await this.prisma.dispensacion.findMany({
      where: this.reportFilters(query),
      orderBy: [{ fechaDispensacion: 'desc' }, { id: 'desc' }],
      take: 10000,
      include: {
        paciente: {
          select: {
            nombres: true,
            apellidos: true,
            numeroDocumento: true,
          },
        },
        bodega: {
          include: { sede: true },
        },
        dispensadoPor: {
          select: { nombre: true },
        },
        soportes: {
          select: { id: true },
          take: 1,
        },
        detalles: {
          include: {
            lote: true,
            detalleFormulacion: {
              include: {
                formulacion: {
                  include: {
                    atencionClinica: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    const rows = deliveries.flatMap((delivery) =>
      delivery.detalles.map((detail) => ({
        dispensacion: delivery.numeroDispensacion,
        fecha: delivery.fechaDispensacion,
        paciente: `${delivery.paciente.nombres} ${delivery.paciente.apellidos}`,
        documento: delivery.paciente.numeroDocumento,
        ingreso:
          detail.detalleFormulacion.formulacion.atencionClinica.numeroIngreso,
        medicamento: detail.detalleFormulacion.medicamento,
        concentracion: detail.detalleFormulacion.concentracion ?? '',
        lote: detail.lote.numeroLote,
        vencimiento: detail.lote.fechaVencimiento,
        cantidad: detail.cantidadEntregada,
        sede: delivery.bodega.sede.nombre,
        bodega: delivery.bodega.nombre,
        responsable: delivery.dispensadoPor.nombre,
        estadoEntrega: delivery.estado,
        estadoSoporte: delivery.soportes.length
          ? 'REGISTRADO'
          : this.legacy(delivery)
            ? 'LEGADO_POR_VERIFICAR'
            : 'PENDIENTE',
      })),
    );

    const filtered =
      query.soporte === 'PENDIENTE'
        ? rows.filter((row) => row.estadoSoporte === 'PENDIENTE')
        : rows;

    return {
      rows: filtered,
      totalEntregas: new Set(filtered.map((row) => row.dispensacion)).size,
      totalUnidades: filtered.reduce((total, row) => total + row.cantidad, 0),
    };
  }

  async reportOptions() {
    return this.prisma.sede.findMany({
      where: {
        activa: true,
        bodegas: {
          some: {
            activa: true,
            permiteDispensacion: true,
          },
        },
      },
      select: {
        id: true,
        codigo: true,
        nombre: true,
      },
      orderBy: { nombre: 'asc' },
    });
  }

  private styleReportWorksheet(sheet: Worksheet, headers: string[]) {
    const end = sheet.getColumn(headers.length).letter;
    const navy = 'FF062B55';
    const teal = 'FF00AEBC';
    const pale = 'FFF1F7FA';
    sheet.getRow(1).height = 42;
    sheet.getRow(2).height = 30;
    sheet.getRow(3).height = 26;
    sheet.getRow(4).height = 34;
    for (let row = 1; row <= 2; row++)
      for (let column = 1; column <= headers.length; column++)
        sheet.getRow(row).getCell(column).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: navy },
        };
    sheet.mergeCells(`A1:${end}1`);
    sheet.getCell('A1').value = 'REPORTE DE DISPENSACIONES';
    sheet.getCell('A1').font = {
      name: 'Arial',
      size: 22,
      bold: true,
      color: { argb: 'FFFFFFFF' },
    };
    sheet.getCell('A1').alignment = {
      horizontal: 'center',
      vertical: 'middle',
    };
    sheet.mergeCells(`A2:${end}2`);
    sheet.getCell('A2').value =
      'Sistema de Gestión y Dispensación de Medicamentos';
    sheet.getCell('A2').font = {
      name: 'Arial',
      size: 12,
      color: { argb: 'FFFFFFFF' },
    };
    sheet.getCell('A2').alignment = {
      horizontal: 'center',
      vertical: 'middle',
    };
    sheet.mergeCells(`A3:${end}3`);
    sheet.getCell('A3').value =
      `Origen: Sistema 007 · Generado: ${new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', dateStyle: 'short', timeStyle: 'short' }).format(new Date())}`;
    sheet.getCell('A3').font = {
      name: 'Arial',
      size: 10,
      bold: true,
      color: { argb: navy },
    };
    sheet.getCell('A3').fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: pale },
    };
    sheet.getCell('A3').alignment = {
      horizontal: 'center',
      vertical: 'middle',
    };
    const header = sheet.getRow(4);
    header.values = headers;
    header.eachCell((cell) => {
      cell.font = {
        name: 'Arial',
        size: 10,
        bold: true,
        color: { argb: 'FFFFFFFF' },
      };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: teal },
      };
      cell.alignment = {
        horizontal: 'center',
        vertical: 'middle',
        wrapText: true,
      };
    });
  }

  async reportExcel(query: Record<string, string | undefined>) {
    const report = await this.report(query);
    const workbook = new Workbook();

    workbook.creator = 'Sistema 007';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Dispensaciones');

    const headers = [
      'Fecha',
      'Dispensación',
      'Paciente',
      'Documento',
      'Ingreso',
      'Medicamento',
      'Concentración',
      'Lote',
      'Vencimiento',
      'Cantidad',
      'Sede',
      'Bodega',
      'Responsable',
      'Entrega',
      'Soporte',
    ];

    this.styleReportWorksheet(sheet, headers);

    for (const row of report.rows) {
      const dataRow = sheet.addRow([
        row.fecha,
        row.dispensacion,
        row.paciente,
        row.documento,
        row.ingreso,
        row.medicamento,
        row.concentracion,
        row.lote,
        row.vencimiento,
        row.cantidad,
        row.sede,
        row.bodega,
        row.responsable,
        row.estadoEntrega,
        row.estadoSoporte,
      ]);
      dataRow.eachCell({ includeEmpty: true }, (cell) => {
        cell.font = { name: 'Arial', size: 10, color: { argb: 'FF263445' } };
        cell.border = {
          bottom: { style: 'hair', color: { argb: 'FFD8E4EA' } },
        };
        if (dataRow.number % 2 === 1)
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF1F7FA' },
          };
      });
    }

    sheet.columns.forEach((column, index) => {
      column.width = index === 5 ? 32 : index === 2 ? 28 : 18;
    });

    sheet.getColumn(1).numFmt = 'dd/mm/yyyy hh:mm';

    sheet.getColumn(9).numFmt = 'dd/mm/yyyy';

    sheet.getColumn(10).numFmt = '#,##0';

    sheet.views = [{ state: 'frozen', ySplit: 4 }];

    sheet.autoFilter = {
      from: 'A4',
      to: 'O3',
    };

    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  async reportPdf(query: Record<string, string | undefined>) {
    const report = await this.report(query);

    return createDispensationReportPdf(
      report.rows.map((row) => ({
        Fecha: row.fecha.toISOString(),
        Paciente: row.paciente,
        Ingreso: row.ingreso,
        Medicamento: `${row.medicamento} ${row.concentracion}`,
        Lote: row.lote,
        Cantidad: row.cantidad,
        Sede: row.sede,
        Responsable: row.responsable,
        Soporte: row.estadoSoporte,
      })),
      'REPORTE DE DISPENSACIONES',
    );
  }

  async detail(id: number) {
    const d = await this.repository.findDispensationById(id);

    if (!d) {
      throw new NotFoundException('Dispensación no encontrada');
    }

    const documents = await this.prisma.documentoDispensacion.findMany({
      where: { dispensacionId: id },
      select: metadata,
      orderBy: { id: 'asc' },
    });

    const supports = await this.prisma.soporteDispensacion.findMany({
      where: { dispensacionId: id },
      orderBy: { version: 'desc' },
      include: {
        registradoPor: {
          select: {
            id: true,
            nombre: true,
          },
        },
      },
    });

    return {
      id,
      numeroDispensacion: d.numeroDispensacion,
      estado: d.estado,
      versionDocumental: d.versionDocumental,
      comprobante: d.datosComprobante ?? receiptSnapshot(d),
      estadoDocumental: supports.length
        ? 'REGISTRADO'
        : this.legacy(d)
          ? 'LEGADO_POR_VERIFICAR'
          : 'PENDIENTE',
      documentos: documents,
      soportes: supports,
      evidenciaLegada: this.legacy(d)
        ? {
            tipoFirma: d.tipoFirma,
            fechaFirma: d.fechaFirma,
            fechaCargaSoporte: d.fechaCargaSoporte,
            requiereVerificacion: true,
          }
        : null,
    };
  }

  async recover(key: string, actorId: number) {
    const d = await this.repository.findByKey(key);

    if (!d || d.dispensadoPorId !== actorId) {
      throw new NotFoundException('Solicitud no encontrada para este usuario');
    }

    return {
      registrada: true,
      dispensacion: {
        id: d.id,
        numeroDispensacion: d.numeroDispensacion,
        fechaDispensacion: d.fechaDispensacion,
        estado: d.estado,
      },
    };
  }

  async receipt(id: number, actorId: number) {
    const d = await this.repository.findDispensationById(id);

    if (!d) {
      throw new NotFoundException('Dispensación no encontrada');
    }

    if (d.estado !== 'CONFIRMADA') {
      throw new BadRequestException('La entrega debe estar confirmada');
    }

    const existing = await this.prisma.documentoDispensacion.findFirst({
      where: {
        dispensacionId: id,
        proposito: 'COMPROBANTE',
      },
      select: metadata,
    });

    if (existing) {
      return {
        generado: true,
        comprobante: d.datosComprobante,
        documento: existing,
      };
    }

    const now = new Date();

    const snapshot = d.datosComprobante ?? {
      ...receiptSnapshot({
        ...d,
        numeroComprobante: d.numeroComprobante ?? `COMP-${id}`,
        fechaComprobante: d.fechaComprobante ?? now,
      }),
      origen: 'Reconstruido desde registro histórico',
      generadoAt: now.toISOString(),
    };

    const file = await this.store.put(
      await createReceiptPdf(snapshot),
      'application/pdf',
    );

    return this.mutate(actorId, async (tx) => {
      const locked = await tx.dispensacion.updateMany({
        where: {
          id,
          versionDocumental: d.versionDocumental,
          estado: 'CONFIRMADA',
        },
        data: {
          versionDocumental: {
            increment: 1,
          },
        },
      });

      if (locked.count !== 1) {
        throw new ConflictException(
          'El documento cambió; vuelve a consultarlo',
        );
      }

      if (
        await tx.documentoDispensacion.findFirst({
          where: {
            dispensacionId: id,
            proposito: 'COMPROBANTE',
          },
        })
      ) {
        throw new ConflictException('El PDF ya fue generado');
      }

      await tx.dispensacion.update({
        where: { id },
        data: {
          datosComprobante: snapshot,
          numeroComprobante: d.numeroComprobante ?? `COMP-${id}`,
          fechaComprobante: d.fechaComprobante ?? now,
        },
      });

      const documento = await tx.documentoDispensacion.create({
        data: {
          ...file,
          dispensacionId: id,
          creadoPorId: actorId,
          proposito: 'COMPROBANTE',
          versionPlantilla: '1',
        },
        select: metadata,
      });

      return {
        generado: true,
        comprobante: snapshot,
        documento,
      };
    });
  }

  async download(id: number, documentId: number) {
    const doc = await this.prisma.documentoDispensacion.findFirst({
      where: {
        id: documentId,
        dispensacionId: id,
      },
    });

    if (!doc) {
      throw new NotFoundException('Documento no encontrado');
    }

    return {
      bytes: await this.store.get(doc),
      mime: doc.mime,
      filename:
        `dispensacion-${id}-documento-${doc.id}.` +
        (doc.mime === 'image/png'
          ? 'png'
          : doc.mime === 'image/jpeg'
            ? 'jpg'
            : 'pdf'),
    };
  }

  async support(
    id: number,
    dto: DispensationSupportDto,
    bytes: Buffer | undefined,
    actorId: number,
    correction: boolean,
  ) {
    if (!bytes) {
      throw new BadRequestException('Adjunta la firma o el PDF firmado');
    }

    for (const value of [
      dto.nombreReceptor,
      dto.tipoDocumentoReceptor,
      dto.numeroDocumentoReceptor,
    ]) {
      if (!value?.trim()) {
        throw new BadRequestException(
          'Identificación del receptor obligatoria',
        );
      }
    }

    if (
      dto.tipoReceptor === 'TERCERO_AUTORIZADO' &&
      (!dto.relacionReceptor?.trim() || !dto.constanciaAutorizacion?.trim())
    ) {
      throw new BadRequestException(
        'El tercero requiere relación y constancia de autorización',
      );
    }

    if (correction && !dto.motivoCorreccion?.trim()) {
      throw new BadRequestException('Indica el motivo de corrección');
    }

    const d = await this.repository.findDispensationById(id);

    if (!d) {
      throw new NotFoundException('Dispensación no encontrada');
    }

    if (
      d.estado !== 'CONFIRMADA' ||
      d.versionDocumental !== dto.versionEsperada
    ) {
      throw new ConflictException(
        'Actualiza la dispensación antes de registrar evidencia',
      );
    }

    const signedAt =
      dto.modalidad === 'DIGITAL' ? new Date() : new Date(dto.fechaFirma);

    if (
      !Number.isFinite(signedAt.getTime()) ||
      signedAt > new Date() ||
      signedAt < d.fechaDispensacion
    ) {
      throw new BadRequestException(
        'La fecha de firma debe estar entre la entrega y el momento actual',
      );
    }

    if (
      dto.tipoReceptor === 'PACIENTE' &&
      (dto.numeroDocumentoReceptor.trim() !== d.paciente.numeroDocumento ||
        dto.tipoDocumentoReceptor !== d.paciente.tipoDocumento)
    ) {
      throw new BadRequestException(
        'El documento del receptor no corresponde al paciente',
      );
    }

    const base = await this.prisma.documentoDispensacion.findFirst({
      where: {
        id: dto.documentoBaseId,
        dispensacionId: id,
        proposito: 'COMPROBANTE',
      },
    });

    if (!base) {
      throw new BadRequestException('Comprobante base no válido');
    }

    const original = await this.store.get(base);

    let imageFile: Awaited<ReturnType<PrivateDocumentStore['put']>> | undefined;

    let evidence: Buffer;
    let evidenceMime: 'application/pdf' | 'image/png' | 'image/jpeg';

    if (dto.modalidad === 'DIGITAL') {
      const image = await normalizeSignature(bytes);

      imageFile = await this.store.put(image, 'image/png');

      evidence = await attachSignature(original, image, [
        `Receptor: ${dto.nombreReceptor}`,
        `${dto.tipoDocumentoReceptor}: ${dto.numeroDocumentoReceptor}`,
        `Tipo: ${dto.tipoReceptor}`,
        `Fecha: ${signedAt.toISOString()}`,
        `Documento base SHA-256: ${base.sha256}`,
        `Registrado por usuario: ${actorId}`,
        ...(dto.tipoReceptor === 'TERCERO_AUTORIZADO'
          ? [
              `Relación: ${dto.relacionReceptor}`,
              `Autorización: ${dto.constanciaAutorizacion}`,
            ]
          : []),
      ]);
      evidenceMime = 'application/pdf';
    } else {
      const manualEvidence = await validateManualEvidence(bytes);
      evidence = manualEvidence.bytes;
      evidenceMime = manualEvidence.mime;
    }

    const file = await this.store.put(evidence, evidenceMime);

    return this.mutate(actorId, async (tx) => {
      const lock = await tx.dispensacion.updateMany({
        where: {
          id,
          versionDocumental: dto.versionEsperada,
          estado: 'CONFIRMADA',
        },
        data: {
          versionDocumental: {
            increment: 1,
          },
        },
      });

      if (lock.count !== 1) {
        throw new ConflictException(
          'Otro usuario registró documentación; vuelve a consultar',
        );
      }

      const latest = await tx.soporteDispensacion.findFirst({
        where: {
          dispensacionId: id,
        },
        orderBy: {
          version: 'desc',
        },
      });

      if (!correction && (latest || this.legacy(d))) {
        throw new ConflictException(
          'Ya existe evidencia: utiliza corrección con motivo',
        );
      }

      if (correction && !latest && !this.legacy(d)) {
        throw new BadRequestException('No hay evidencia anterior que corregir');
      }

      const signed = await tx.documentoDispensacion.create({
        data: {
          ...file,
          dispensacionId: id,
          creadoPorId: actorId,
          proposito: 'SOPORTE_FIRMADO',
        },
      });

      const image = imageFile
        ? await tx.documentoDispensacion.create({
            data: {
              ...imageFile,
              dispensacionId: id,
              creadoPorId: actorId,
              proposito: 'FIRMA_CAPTURADA',
            },
          })
        : null;

      return tx.soporteDispensacion.create({
        data: {
          dispensacionId: id,
          version: (latest?.version ?? 0) + 1,
          modalidad: dto.modalidad,
          tipoReceptor: dto.tipoReceptor,
          nombreReceptor: dto.nombreReceptor.trim(),
          tipoDocumentoReceptor: dto.tipoDocumentoReceptor,
          numeroDocumentoReceptor: dto.numeroDocumentoReceptor.trim(),
          relacionReceptor:
            dto.tipoReceptor === 'TERCERO_AUTORIZADO'
              ? dto.relacionReceptor?.trim()
              : null,
          constanciaAutorizacion:
            dto.tipoReceptor === 'TERCERO_AUTORIZADO'
              ? dto.constanciaAutorizacion?.trim()
              : null,
          fechaFirma: signedAt,
          registradoPorId: actorId,
          motivoCorreccion: correction ? dto.motivoCorreccion?.trim() : null,
          documentoBaseId: base.id,
          documentoFirmadoId: signed.id,
          imagenFirmaId: image?.id,
        },
      });
    });
  }
}
