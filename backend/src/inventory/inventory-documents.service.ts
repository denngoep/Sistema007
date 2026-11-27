import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Prisma } from '../generated/prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { InventoryPrivateDocumentStore } from './inventory-private-document.store';
import {
  createInventoryMovementPdf,
  type InventoryMovementReceiptSnapshot,
} from './inventory-movement-pdf';

type UploadedDocument = {
  buffer: Buffer;
  mimetype: string;
  size: number;
};

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ACCEPTED_MIME = new Set(['application/pdf', 'image/png', 'image/jpeg']);

@Injectable()
export class InventoryDocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly store: InventoryPrivateDocumentStore,
  ) {}

  private assertEnabled() {
    if (process.env.INVENTORY_DOCUMENTS_ENABLED !== 'true') {
      throw new ServiceUnavailableException(
        'La gestión documental de inventario estará disponible cuando se aplique la migración autorizada',
      );
    }
  }

  isEnabled() {
    return process.env.INVENTORY_DOCUMENTS_ENABLED === 'true';
  }

  private validateFile(file: UploadedDocument) {
    if (!file?.buffer?.length || file.size !== file.buffer.length) {
      throw new BadRequestException('Debes adjuntar un archivo válido');
    }
    if (file.size > MAX_FILE_BYTES) {
      throw new BadRequestException('El archivo no puede superar 10 MB');
    }
    if (!ACCEPTED_MIME.has(file.mimetype)) {
      throw new BadRequestException(
        'Solo se permiten archivos PDF, PNG o JPEG',
      );
    }
    const bytes = file.buffer;
    const isPdf = bytes.subarray(0, 5).toString('ascii') === '%PDF-';
    const isPng = bytes
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    const mimeMatchesContent =
      (file.mimetype === 'application/pdf' && isPdf) ||
      (file.mimetype === 'image/png' && isPng) ||
      (file.mimetype === 'image/jpeg' && isJpeg);
    if (!mimeMatchesContent) {
      throw new BadRequestException(
        'El tipo declarado no corresponde al contenido del archivo',
      );
    }
  }

  private async movementSnapshot(
    client: Prisma.TransactionClient | PrismaService,
    id: number,
  ): Promise<InventoryMovementReceiptSnapshot> {
    const movement = await client.movimientoInventario.findUnique({
      where: { id },
      include: {
        lote: { include: { productoInventario: true } },
        usuario: { select: { nombre: true } },
        bodegaOrigen: { include: { sede: true } },
        bodegaDestino: { include: { sede: true } },
      },
    });
    if (!movement)
      throw new NotFoundException('El movimiento de inventario no existe');
    if (movement.tipo === 'DISPENSACION') {
      throw new ConflictException(
        'La dispensación ya tiene su comprobante propio',
      );
    }
    return {
      numero: `MOV-${String(movement.id).padStart(8, '0')}`,
      tipo: movement.tipo,
      fecha: new Intl.DateTimeFormat('es-CO', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'America/Bogota',
      }).format(movement.fechaMovimiento),
      sedeOrigen: movement.bodegaOrigen?.sede.nombre,
      bodegaOrigen: movement.bodegaOrigen?.nombre,
      sedeDestino: movement.bodegaDestino?.sede.nombre,
      bodegaDestino: movement.bodegaDestino?.nombre,
      producto: movement.lote.productoInventario.descripcion,
      codigoInterno:
        movement.lote.productoInventario.codigoInterno ?? 'No registrado',
      lote: movement.lote.numeroLote,
      vencimiento: new Intl.DateTimeFormat('es-CO', {
        dateStyle: 'medium',
        timeZone: 'America/Bogota',
      }).format(movement.lote.fechaVencimiento),
      cantidad: movement.cantidad,
      responsable: movement.usuario.nombre,
      motivo: movement.motivo,
      referencia: movement.referencia,
    };
  }

  async createMovementReceipt(movimientoId: number, usuarioId: number) {
    this.assertEnabled();
    const existing = await this.prisma.documentoMovimientoInventario.findFirst({
      where: { movimientoInventarioId: movimientoId, proposito: 'COMPROBANTE' },
      orderBy: { version: 'desc' },
    });
    if (existing)
      return { documentoId: existing.documentoInventarioId, existente: true };

    const snapshot = await this.movementSnapshot(this.prisma, movimientoId);
    const bytes = await createInventoryMovementPdf(snapshot);
    const stored = await this.store.put(bytes, 'application/pdf');
    try {
      const document = await this.prisma.$transaction(async (tx) => {
        const created = await tx.documentoInventario.create({
          data: {
            ...stored,
            creadoPorId: usuarioId,
            versionPlantilla: 'inventario-v1',
          },
        });
        await tx.documentoMovimientoInventario.create({
          data: {
            movimientoInventarioId: movimientoId,
            documentoInventarioId: created.id,
            proposito: 'COMPROBANTE',
            version: 1,
            datosComprobante: snapshot,
            registradoPorId: usuarioId,
          },
        });
        return created;
      });
      return { documentoId: document.id, existente: false };
    } catch (error) {
      // El archivo previo queda inaccesible si falla la transacción; nunca se vincula parcialmente.
      if (
        error instanceof Error &&
        error.message.includes('Unique constraint')
      ) {
        const current =
          await this.prisma.documentoMovimientoInventario.findFirst({
            where: {
              movimientoInventarioId: movimientoId,
              proposito: 'COMPROBANTE',
            },
          });
        if (current)
          return {
            documentoId: current.documentoInventarioId,
            existente: true,
          };
      }
      throw error;
    }
  }

  /** Vincula el PDF al movimiento dentro de la transacción que lo confirma. */
  async persistAutomaticMovementReceipt(
    tx: Prisma.TransactionClient,
    movimientoId: number,
    usuarioId: number,
  ) {
    if (!this.isEnabled()) return;
    const movement = await tx.movimientoInventario.findUnique({
      where: { id: movimientoId },
      select: { tipo: true },
    });
    if (!movement || movement.tipo === 'DISPENSACION') return;

    const existing = await tx.documentoMovimientoInventario.findFirst({
      where: { movimientoInventarioId: movimientoId, proposito: 'COMPROBANTE' },
      select: { id: true },
    });
    if (existing) return;

    const snapshot = await this.movementSnapshot(tx, movimientoId);
    const bytes = await createInventoryMovementPdf(snapshot);
    const stored = await this.store.put(bytes, 'application/pdf');
    const document = await tx.documentoInventario.create({
      data: {
        ...stored,
        creadoPorId: usuarioId,
        versionPlantilla: 'inventario-v1',
      },
    });
    await tx.documentoMovimientoInventario.create({
      data: {
        movimientoInventarioId: movimientoId,
        documentoInventarioId: document.id,
        proposito: 'COMPROBANTE',
        version: 1,
        datosComprobante: snapshot,
        registradoPorId: usuarioId,
      },
    });
  }

  async attachReceiptInvoice(
    actaRecepcionId: number,
    usuarioId: number,
    file: UploadedDocument,
  ) {
    this.assertEnabled();
    this.validateFile(file);
    const acta = await this.prisma.actaRecepcion.findUnique({
      where: { id: actaRecepcionId },
      select: { id: true },
    });
    if (!acta) throw new NotFoundException('La recepción no existe');
    const stored = await this.store.put(
      file.buffer,
      file.mimetype as 'application/pdf' | 'image/png' | 'image/jpeg',
    );
    return this.prisma.$transaction(async (tx) => {
      const version =
        (await tx.documentoActaRecepcion.count({
          where: { actaRecepcionId, proposito: 'FACTURA' },
        })) + 1;
      const document = await tx.documentoInventario.create({
        data: { ...stored, creadoPorId: usuarioId },
      });
      return tx.documentoActaRecepcion.create({
        data: {
          actaRecepcionId,
          documentoInventarioId: document.id,
          proposito: 'FACTURA',
          version,
          registradoPorId: usuarioId,
        },
      });
    });
  }

  /**
   * Adjunta una evidencia privada a una corrección ya registrada. Cada carga
   * crea una versión inmutable; la referencia textual de la corrección se
   * conserva independientemente para no alterar el historial clínico-técnico.
   */
  async attachReceiptCorrectionSupport(
    correccionDetalleRecepcionId: number,
    usuarioId: number,
    file: UploadedDocument,
  ) {
    this.assertEnabled();
    this.validateFile(file);
    const correction = await this.prisma.correccionDetalleRecepcion.findUnique({
      where: { id: correccionDetalleRecepcionId },
      select: { id: true },
    });
    if (!correction) {
      throw new NotFoundException('La corrección de recepción no existe');
    }

    const stored = await this.store.put(
      file.buffer,
      file.mimetype as 'application/pdf' | 'image/png' | 'image/jpeg',
    );
    try {
      return await this.prisma.$transaction(async (tx) => {
        const version =
          (await tx.documentoCorreccionDetalleRecepcion.count({
            where: {
              correccionDetalleRecepcionId,
              proposito: 'SOPORTE_CORRECCION',
            },
          })) + 1;
        const document = await tx.documentoInventario.create({
          data: { ...stored, creadoPorId: usuarioId },
        });
        return tx.documentoCorreccionDetalleRecepcion.create({
          data: {
            correccionDetalleRecepcionId,
            documentoInventarioId: document.id,
            proposito: 'SOPORTE_CORRECCION',
            version,
            registradoPorId: usuarioId,
          },
          include: {
            documentoInventario: {
              select: {
                id: true,
                mime: true,
                tamano: true,
                creadoAt: true,
                sha256: true,
              },
            },
            registradoPor: { select: { nombre: true } },
          },
        });
      });
    } catch (error) {
      // El archivo no queda asociado si falla MySQL; el mantenimiento seguro
      // solo elimina candidatos huérfanos y nunca documentos vinculados.
      throw error;
    }
  }

  async prepareAdjustmentSupport(file: UploadedDocument) {
    this.assertEnabled();
    this.validateFile(file);
    return this.store.put(
      file.buffer,
      file.mimetype as 'application/pdf' | 'image/png' | 'image/jpeg',
    );
  }

  async listMovementDocuments(movimientoId: number) {
    this.assertEnabled();
    return this.prisma.documentoMovimientoInventario.findMany({
      where: { movimientoInventarioId: movimientoId },
      include: {
        documentoInventario: {
          select: {
            id: true,
            mime: true,
            tamano: true,
            creadoAt: true,
            sha256: true,
          },
        },
        registradoPor: { select: { nombre: true } },
      },
      orderBy: [{ proposito: 'asc' }, { version: 'desc' }],
    });
  }

  async listReceiptDocuments(actaRecepcionId: number) {
    this.assertEnabled();
    return this.prisma.documentoActaRecepcion.findMany({
      where: { actaRecepcionId },
      include: {
        documentoInventario: {
          select: {
            id: true,
            mime: true,
            tamano: true,
            creadoAt: true,
            sha256: true,
          },
        },
        registradoPor: { select: { nombre: true } },
      },
      orderBy: [{ proposito: 'asc' }, { version: 'desc' }],
    });
  }

  async listReceiptCorrectionDocuments(correccionDetalleRecepcionId: number) {
    this.assertEnabled();
    return this.prisma.documentoCorreccionDetalleRecepcion.findMany({
      where: { correccionDetalleRecepcionId },
      include: {
        documentoInventario: {
          select: {
            id: true,
            mime: true,
            tamano: true,
            creadoAt: true,
            sha256: true,
          },
        },
        registradoPor: { select: { nombre: true } },
      },
      orderBy: [{ proposito: 'asc' }, { version: 'desc' }],
    });
  }

  async download(documentoId: number) {
    this.assertEnabled();
    const doc = await this.prisma.documentoInventario.findUnique({
      where: { id: documentoId },
    });
    if (!doc) throw new NotFoundException('El documento no existe');
    return {
      bytes: await this.store.get(doc),
      mime: doc.mime,
      filename: `Sistema007_inventario_${documentoId}.${doc.mime === 'application/pdf' ? 'pdf' : doc.mime === 'image/png' ? 'png' : 'jpg'}`,
      sha256: doc.sha256,
    };
  }

  /** Auditoría explícita; nunca borra archivos vinculados ni recientes. */
  async auditOrphanFiles(cleanup = false) {
    this.assertEnabled();
    const documents = await this.prisma.documentoInventario.findMany({
      select: { claveAlmacenamiento: true },
    });
    const candidates = await this.store.findUnlinkedCandidates(
      new Set(documents.map((document) => document.claveAlmacenamiento)),
      60 * 60 * 1000,
    );
    if (cleanup) {
      await Promise.all(
        candidates.map((candidate) => this.store.removeCandidate(candidate)),
      );
    }
    return { candidates, removed: cleanup ? candidates.length : 0 };
  }

  // Se expone para pruebas de integridad sin revelar contenido.
  static sha256(bytes: Buffer) {
    return createHash('sha256').update(bytes).digest('hex');
  }
}
