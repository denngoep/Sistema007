import { createHash } from 'node:crypto';

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { CreateDispensationDto } from '../dto/create-dispensation.dto';

import { RegisterDispensationSignatureDto } from '../dto/register-dispensation-signature.dto';

import { ValidateDispensationDto } from '../dto/validate-dispensation.dto';

import { DispensationsRepository } from '../repositories/dispensations.repository';

@Injectable()
export class DispensationsService {
  constructor(
    private readonly dispensationsRepository: DispensationsRepository,
  ) {}

  private fechaFinVigencia(fecha: Date, vigenciaMeses: number) {
    const inicio = new Date(fecha);

    const fin = new Date(inicio);

    fin.setMonth(fin.getMonth() + vigenciaMeses);

    return fin;
  }

  async getMedicationsToDispense(numeroDocumento: string) {
    const documento = numeroDocumento?.trim();

    if (!documento) {
      throw new BadRequestException(
        'El número de documento del paciente es obligatorio',
      );
    }

    const paciente =
      await this.dispensationsRepository.findPatientByDocument(documento);

    if (!paciente) {
      throw new NotFoundException(
        'No se encontró un paciente con el número de documento indicado',
      );
    }

    if (!paciente.activo) {
      throw new BadRequestException('El paciente se encuentra inactivo');
    }

    if (!paciente.historiaClinica) {
      throw new NotFoundException(
        'El paciente no tiene historia clínica registrada',
      );
    }

    const ahora = new Date();

    const formulaciones = paciente.historiaClinica.atenciones.flatMap(
      (atencion) =>
        atencion.formulaciones

          .filter(
            (formulacion) =>
              formulacion.estado === 'VIGENTE' &&
              ahora <
                this.fechaFinVigencia(
                  formulacion.fechaFormulacion,

                  formulacion.vigenciaMeses,
                ),
          )

          .map((formulacion) => ({
            atencion,

            formulacion,
          })),
    );

    const formulacionesVigentes = await Promise.all(
      formulaciones.map(async ({ atencion, formulacion }) => {
        const medicamentos = await Promise.all(
          formulacion.medicamentos.map(async (detalle) => {
            const cantidadEntregada =
              await this.dispensationsRepository.getDeliveredQuantity(
                detalle.id,
              );

            return {
              detalleFormulacionId: detalle.id,

              medicamento: detalle.medicamento,

              concentracion: detalle.concentracion,

              formaFarmaceutica: detalle.formaFarmaceutica,

              dosis: detalle.dosis,

              frecuencia: detalle.frecuencia,

              duracion: detalle.duracion,

              cantidad: detalle.cantidad,

              cantidadFormulada: detalle.cantidad,

              cantidadEntregada,

              cantidadPendiente: Math.max(
                0,

                detalle.cantidad - cantidadEntregada,
              ),

              viaAdministracion: detalle.viaAdministracion,

              observaciones: detalle.observaciones,
            };
          }),
        );

        return {
          formulacionId: formulacion.id,

          fechaFormulacion: formulacion.fechaFormulacion,

          vigenciaMeses: formulacion.vigenciaMeses,

          fechaFinVigencia: this.fechaFinVigencia(
            formulacion.fechaFormulacion,

            formulacion.vigenciaMeses,
          ),

          indicaciones: formulacion.indicaciones,

          estado: formulacion.estado,

          atencion: {
            atencionClinicaId: atencion.id,

            numeroIngreso: atencion.numeroIngreso,

            fechaAtencion: atencion.fechaAtencion,

            profesional: atencion.profesional,
          },

          diagnostico: formulacion.diagnosticoPaciente
            ? {
                id: formulacion.diagnosticoPaciente.id,

                nombre: formulacion.diagnosticoPaciente.nombre,

                codigoCie10: formulacion.diagnosticoPaciente.codigoCie10,

                tipo: formulacion.diagnosticoPaciente.tipo,

                requiereEsquema:
                  formulacion.diagnosticoPaciente.requiereEsquema,
              }
            : null,

          medicamentos,
        };
      }),
    );

    return {
      paciente: {
        id: paciente.id,

        tipoDocumento: paciente.tipoDocumento,

        numeroDocumento: paciente.numeroDocumento,

        nombres: paciente.nombres,

        apellidos: paciente.apellidos,

        fechaNacimiento: paciente.fechaNacimiento,
      },

      informacionClinica: {
        historiaClinicaId: paciente.historiaClinica.id,

        grupoSanguineo: paciente.historiaClinica.grupoSanguineo,

        alergias: paciente.historiaClinica.alergias,

        diagnosticosActivos: paciente.historiaClinica.diagnosticosPaciente.map(
          (diagnostico) => ({
            id: diagnostico.id,

            nombre: diagnostico.nombre,

            codigoCie10: diagnostico.codigoCie10,

            tipo: diagnostico.tipo,

            requiereEsquema: diagnostico.requiereEsquema,

            fechaDiagnostico: diagnostico.fechaDiagnostico,
          }),
        ),
      },

      totalFormulacionesVigentes: formulacionesVigentes.length,

      totalMedicamentos: formulacionesVigentes.reduce(
        (total, formulacion) => total + formulacion.medicamentos.length,

        0,
      ),

      formulacionesVigentes,
    };
  }

  async validateDispensation(dto: ValidateDispensationDto) {
    const documento = dto.numeroDocumento?.trim();

    if (!documento) {
      throw new BadRequestException(
        'El número de documento del paciente es obligatorio',
      );
    }

    if (!Number.isInteger(dto.cantidad) || dto.cantidad <= 0) {
      throw new BadRequestException(
        'La cantidad debe ser un entero mayor que cero',
      );
    }

    const paciente =
      await this.dispensationsRepository.findPatientByDocument(documento);

    if (!paciente) {
      throw new NotFoundException(
        'No se encontró un paciente con el número de documento indicado',
      );
    }

    if (!paciente.activo) {
      throw new BadRequestException('El paciente se encuentra inactivo');
    }

    const detalle = await this.dispensationsRepository.findFormulationDetail(
      dto.formulacionId,

      dto.detalleFormulacionId,
    );

    if (!detalle) {
      throw new NotFoundException(
        'El medicamento indicado no pertenece a la formulación seleccionada',
      );
    }

    const pacienteFormulacion =
      detalle.formulacion.atencionClinica.historiaClinica.paciente;

    if (pacienteFormulacion.id !== paciente.id) {
      throw new BadRequestException(
        'La formulación seleccionada no pertenece al paciente indicado',
      );
    }

    if (detalle.formulacion.estado !== 'VIGENTE') {
      throw new BadRequestException('La formulación no se encuentra vigente');
    }

    const fechaFinVigencia = this.fechaFinVigencia(
      detalle.formulacion.fechaFormulacion,

      detalle.formulacion.vigenciaMeses,
    );

    const ahora = new Date();

    if (ahora >= fechaFinVigencia) {
      throw new BadRequestException(
        'La vigencia de la formulación ya finalizó',
      );
    }

    // Calcular todas las entregas confirmadas.

    const cantidadEntregada =
      await this.dispensationsRepository.getDeliveredQuantity(detalle.id);

    const cantidadPendienteFormulada = Math.max(
      0,

      detalle.cantidad - cantidadEntregada,
    );

    if (cantidadPendienteFormulada <= 0) {
      throw new ConflictException({
        codigo: 'FORMULACION_COMPLETAMENTE_DISPENSADA',

        mensaje: 'Este medicamento ya fue entregado completamente',

        cantidadFormulada: detalle.cantidad,

        cantidadEntregada,

        cantidadPendiente: 0,
      });
    }

    if (dto.cantidad > cantidadPendienteFormulada) {
      throw new BadRequestException({
        codigo: 'CANTIDAD_SUPERA_PENDIENTE',

        mensaje: `Solo quedan ${cantidadPendienteFormulada} unidades pendientes`,

        cantidadFormulada: detalle.cantidad,

        cantidadEntregada,

        cantidadPendiente: cantidadPendienteFormulada,
      });
    }

    const medicamento =
      await this.dispensationsRepository.findClinicalMedication(
        detalle.medicamento,

        detalle.concentracion,

        detalle.formaFarmaceutica,
      );

    if (!medicamento) {
      throw new NotFoundException(
        'El medicamento formulado no se encuentra asociado al catálogo clínico',
      );
    }

    const periodoAnio = ahora.getFullYear();

    const periodoMes = ahora.getMonth() + 1;

    const existencias = await this.dispensationsRepository.findDispensableStock(
      medicamento.id,

      dto.bodegaId,

      ahora,
    );

    const stockDisponible = existencias.reduce(
      (total, existencia) => total + existencia.cantidad,

      0,
    );

    if (stockDisponible <= 0) {
      throw new BadRequestException(
        'No existe stock dispensable para este medicamento en la bodega seleccionada',
      );
    }

    if (stockDisponible < dto.cantidad) {
      throw new BadRequestException(
        `Stock insuficiente. Disponible: ${stockDisponible}, solicitado: ${dto.cantidad}`,
      );
    }

    let cantidadPendiente = dto.cantidad;

    const lotesSugeridos = existencias

      .map((existencia) => {
        if (cantidadPendiente <= 0) {
          return null;
        }

        const cantidadTomar = Math.min(existencia.cantidad, cantidadPendiente);

        cantidadPendiente -= cantidadTomar;

        return {
          existenciaId: existencia.id,

          loteId: existencia.lote.id,

          numeroLote: existencia.lote.numeroLote,

          fechaVencimiento: existencia.lote.fechaVencimiento,

          productoInventarioId: existencia.lote.productoInventario.id,

          codigoInterno: existencia.lote.productoInventario.codigoInterno,

          codigoBarras: existencia.lote.productoInventario.codigoBarras,

          descripcion: existencia.lote.productoInventario.descripcion,

          cantidadDisponible: existencia.cantidad,

          cantidadSugerida: cantidadTomar,
        };
      })

      .filter((lote) => lote !== null);

    const primeraExistencia = existencias[0];

    return {
      valida: true,

      mensaje:
        'La entrega cumple las condiciones para continuar con la dispensación',

      periodoDispensacion: {
        anio: periodoAnio,

        mes: periodoMes,
      },

      paciente: {
        id: paciente.id,

        tipoDocumento: paciente.tipoDocumento,

        numeroDocumento: paciente.numeroDocumento,

        nombres: paciente.nombres,

        apellidos: paciente.apellidos,
      },

      formulacion: {
        id: detalle.formulacion.id,

        fechaFormulacion: detalle.formulacion.fechaFormulacion,

        vigenciaMeses: detalle.formulacion.vigenciaMeses,

        fechaFinVigencia,

        numeroIngreso: detalle.formulacion.atencionClinica.numeroIngreso,
      },

      medicamento: {
        detalleFormulacionId: detalle.id,

        medicamentoId: medicamento.id,

        nombre: detalle.medicamento,

        concentracion: detalle.concentracion,

        formaFarmaceutica: detalle.formaFarmaceutica,

        dosis: detalle.dosis,

        frecuencia: detalle.frecuencia,

        viaAdministracion: detalle.viaAdministracion,

        cantidadFormulada: detalle.cantidad,

        cantidadEntregada,

        cantidadPendiente: cantidadPendienteFormulada,

        cantidadAValidar: dto.cantidad,
      },

      inventario: {
        bodegaId: dto.bodegaId,

        bodega: primeraExistencia.bodega.nombre,

        sede: primeraExistencia.bodega.sede.nombre,

        stockDisponible,

        estrategiaSeleccion: 'FEFO',

        lotesSugeridos,
      },
    };
  }

  async createDispensation(
    dto: CreateDispensationDto,
    usuarioId: number,
    key?: string,
  ) {
    if (!key || !/^[a-zA-Z0-9_-]{16,64}$/.test(key))
      throw new BadRequestException('Idempotency-Key v?lida requerida');

    const hash = createHash('sha256')
      .update(
        JSON.stringify({
          usuarioId,
          documento: dto.numeroDocumento.trim(),
          formulacionId: dto.formulacionId,

          detalleFormulacionId: dto.detalleFormulacionId,
          cantidad: dto.cantidad,

          bodegaId: dto.bodegaId,
          observaciones: dto.observaciones?.trim() || '',
        }),
      )
      .digest('hex');

    const replay = async () => {
      const prior = await this.dispensationsRepository.findByKey(key);

      if (!prior) return null;

      if (prior.hashSolicitud !== hash || prior.dispensadoPorId !== usuarioId)
        throw new ConflictException(
          'La clave corresponde a otra intenci?n de entrega',
        );

      return {
        registrada: true,
        mensaje: 'Entrega recuperada sin nuevo descuento',
        dispensacion: prior,
      };
    };

    const existing = await replay();

    if (existing) return existing;

    try {
      return await this.createNewDispensation(dto, usuarioId, key, hash);
    } catch (error) {
      const recovered = await replay();

      if (recovered) return recovered;

      throw error;
    }
  }

  private async createNewDispensation(
    dto: CreateDispensationDto,
    usuarioId: number,
    key: string,
    hash: string,
  ) {
    await this.validateDispensation({
      numeroDocumento: dto.numeroDocumento,

      formulacionId: dto.formulacionId,

      detalleFormulacionId: dto.detalleFormulacionId,

      cantidad: dto.cantidad,

      bodegaId: dto.bodegaId,
    });

    const documento = dto.numeroDocumento.trim();

    const paciente =
      await this.dispensationsRepository.findPatientByDocument(documento);

    if (!paciente) {
      throw new NotFoundException('No se encontró el paciente indicado');
    }

    const detalle = await this.dispensationsRepository.findFormulationDetail(
      dto.formulacionId,

      dto.detalleFormulacionId,
    );

    if (!detalle) {
      throw new NotFoundException(
        'No se encontró el medicamento de la formulación',
      );
    }

    const medicamento =
      await this.dispensationsRepository.findClinicalMedication(
        detalle.medicamento,

        detalle.concentracion,

        detalle.formaFarmaceutica,
      );

    if (!medicamento) {
      throw new NotFoundException(
        'El medicamento no se encuentra asociado al catálogo clínico',
      );
    }

    const usuario = await this.dispensationsRepository.findUserById(usuarioId);

    if (!usuario) {
      throw new NotFoundException(
        'No se encontró el usuario que realiza la dispensación',
      );
    }

    if (!usuario.activo) {
      throw new BadRequestException(
        'El usuario que realiza la dispensación se encuentra inactivo',
      );
    }

    const rolesFarmacia = [
      'REGENTE_FARMACIA',

      'AUXILIAR_FARMACIA',

      'QUIMICO_FARMACEUTICO',
    ];

    if (!rolesFarmacia.includes(usuario.rol)) {
      throw new BadRequestException(
        'El usuario no tiene un rol autorizado para realizar dispensaciones',
      );
    }

    const ahora = new Date();

    const periodoAnio = ahora.getFullYear();

    const periodoMes = ahora.getMonth() + 1;

    try {
      const dispensacion =
        await this.dispensationsRepository.createDispensation(
          paciente.id,

          detalle.id,

          medicamento.id,

          dto.cantidad,

          dto.bodegaId,

          usuarioId,

          periodoAnio,

          periodoMes,

          dto.observaciones?.trim(),

          key,

          hash,
        );

      return {
        registrada: true,

        mensaje: 'Dispensación registrada correctamente',

        dispensacion,
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof ConflictException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      const mensaje =
        error instanceof Error
          ? error.message
          : 'No fue posible registrar la dispensación';

      throw new BadRequestException(mensaje);
    }
  }

  private construirComprobante(
    dispensacion: NonNullable<
      Awaited<ReturnType<DispensationsRepository['findDispensationById']>>
    >,
  ) {
    return {
      numeroComprobante: dispensacion.numeroComprobante,

      fechaComprobante: dispensacion.fechaComprobante,

      numeroDispensacion: dispensacion.numeroDispensacion,

      fechaDispensacion: dispensacion.fechaDispensacion,

      paciente: {
        id: dispensacion.paciente.id,

        tipoDocumento: dispensacion.paciente.tipoDocumento,

        numeroDocumento: dispensacion.paciente.numeroDocumento,

        nombres: dispensacion.paciente.nombres,

        apellidos: dispensacion.paciente.apellidos,
      },

      sede: dispensacion.bodega.sede.nombre,

      bodega: dispensacion.bodega.nombre,

      dispensadoPor: dispensacion.dispensadoPor,

      medicamentos: dispensacion.detalles.map((detalle) => ({
        numeroIngreso:
          detalle.detalleFormulacion.formulacion.atencionClinica.numeroIngreso,

        medicamento: detalle.detalleFormulacion.medicamento,

        concentracion: detalle.detalleFormulacion.concentracion,

        formaFarmaceutica: detalle.detalleFormulacion.formaFarmaceutica,

        cantidadEntregada: detalle.cantidadEntregada,

        numeroLote: detalle.lote.numeroLote,

        fechaVencimiento: detalle.lote.fechaVencimiento,

        codigoInterno: detalle.lote.productoInventario.codigoInterno,

        codigoBarras: detalle.lote.productoInventario.codigoBarras,

        producto: detalle.lote.productoInventario.descripcion,

        marca: detalle.lote.productoInventario.marca,

        laboratorio: detalle.lote.productoInventario.laboratorio,
      })),
    };
  }

  async generateReceipt(dispensacionId: number) {
    if (!Number.isInteger(dispensacionId) || dispensacionId <= 0) {
      throw new BadRequestException(
        'El identificador de la dispensación no es válido',
      );
    }

    const dispensacion =
      await this.dispensationsRepository.findDispensationById(dispensacionId);

    if (!dispensacion) {
      throw new NotFoundException('No se encontró la dispensación indicada');
    }

    if (dispensacion.estado !== 'CONFIRMADA') {
      throw new BadRequestException(
        'Solo se puede generar comprobante para una dispensación confirmada',
      );
    }

    if (dispensacion.numeroComprobante && dispensacion.fechaComprobante) {
      return {
        generado: true,

        mensaje: 'La dispensación ya cuenta con un comprobante generado',

        comprobante: this.construirComprobante(dispensacion),
      };
    }

    const ahora = new Date();

    const numeroComprobante =
      `COMP-${ahora.getFullYear()}` +
      `${String(ahora.getMonth() + 1).padStart(2, '0')}` +
      `${String(ahora.getDate()).padStart(2, '0')}` +
      `-${dispensacion.id}-${Date.now()}`;

    const actualizada = await this.dispensationsRepository.generateReceipt(
      dispensacion.id,

      numeroComprobante,

      ahora,
    );

    return {
      generado: true,

      mensaje: 'Comprobante generado correctamente',

      comprobante: this.construirComprobante(actualizada),
    };
  }

  async registerSignature(
    dispensacionId: number,

    dto: RegisterDispensationSignatureDto,
  ) {
    if (!Number.isInteger(dispensacionId) || dispensacionId <= 0) {
      throw new BadRequestException(
        'El identificador de la dispensación no es válido',
      );
    }

    const dispensacion =
      await this.dispensationsRepository.findDispensationById(dispensacionId);

    if (!dispensacion) {
      throw new NotFoundException('No se encontró la dispensación indicada');
    }

    if (dispensacion.estado !== 'CONFIRMADA') {
      throw new BadRequestException(
        'Solo se puede registrar la firma de una dispensación confirmada',
      );
    }

    if (!dispensacion.numeroComprobante || !dispensacion.fechaComprobante) {
      throw new BadRequestException(
        'La dispensación debe tener un comprobante generado antes de registrar la firma del paciente',
      );
    }

    if (
      dispensacion.tipoFirma ||
      dispensacion.firmaPaciente ||
      dispensacion.soporteFirmado ||
      dispensacion.fechaFirma
    ) {
      throw new ConflictException({
        codigo: 'EVIDENCIA_DISPENSACION_YA_REGISTRADA',

        mensaje: 'La dispensación ya cuenta con evidencia de firma registrada',

        evidencia: {
          tipoFirma: dispensacion.tipoFirma,

          fechaFirma: dispensacion.fechaFirma,

          fechaCargaSoporte: dispensacion.fechaCargaSoporte,
        },
      });
    }

    if (dto.tipoFirma === 'DIGITAL') {
      const firmaPaciente = dto.firmaPaciente?.trim();

      if (!firmaPaciente) {
        throw new BadRequestException(
          'La firma digital del paciente es obligatoria',
        );
      }

      if (dto.soporteFirmado?.trim()) {
        throw new BadRequestException(
          'Una firma digital no debe incluir soporte manual',
        );
      }

      const actualizada =
        await this.dispensationsRepository.registerDigitalSignature(
          dispensacion.id,

          firmaPaciente,

          new Date(),
        );

      return {
        registrada: true,

        mensaje: 'Firma digital del paciente registrada correctamente',

        evidenciaDispensacion: {
          dispensacionId: actualizada.id,

          numeroDispensacion: actualizada.numeroDispensacion,

          numeroComprobante: actualizada.numeroComprobante,

          tipoFirma: actualizada.tipoFirma,

          fechaFirma: actualizada.fechaFirma,

          fechaCargaSoporte: actualizada.fechaCargaSoporte,

          paciente: {
            id: actualizada.paciente.id,

            tipoDocumento: actualizada.paciente.tipoDocumento,

            numeroDocumento: actualizada.paciente.numeroDocumento,

            nombres: actualizada.paciente.nombres,

            apellidos: actualizada.paciente.apellidos,
          },

          sede: actualizada.bodega.sede.nombre,

          bodega: actualizada.bodega.nombre,

          dispensadoPor: actualizada.dispensadoPor,
        },
      };
    }

    if (dto.tipoFirma === 'MANUAL') {
      const soporteFirmado = dto.soporteFirmado?.trim();

      if (!soporteFirmado) {
        throw new BadRequestException(
          'El soporte firmado por el paciente es obligatorio para una firma manual',
        );
      }

      if (dto.firmaPaciente?.trim()) {
        throw new BadRequestException(
          'Una firma manual no debe incluir una firma digital',
        );
      }

      if (!dto.fechaFirma) {
        throw new BadRequestException(
          'La fecha real de la firma es obligatoria cuando el soporte fue firmado manualmente',
        );
      }

      const fechaFirma = new Date(dto.fechaFirma);

      if (Number.isNaN(fechaFirma.getTime())) {
        throw new BadRequestException(
          'La fecha de firma indicada no es válida',
        );
      }

      const fechaCargaSoporte = new Date();

      if (fechaFirma > fechaCargaSoporte) {
        throw new BadRequestException(
          'La fecha de firma no puede ser posterior a la fecha de carga del soporte',
        );
      }

      const actualizada =
        await this.dispensationsRepository.registerManualSignatureSupport(
          dispensacion.id,

          soporteFirmado,

          fechaFirma,

          fechaCargaSoporte,
        );

      return {
        registrada: true,

        mensaje: 'Soporte firmado manualmente registrado correctamente',

        evidenciaDispensacion: {
          dispensacionId: actualizada.id,

          numeroDispensacion: actualizada.numeroDispensacion,

          numeroComprobante: actualizada.numeroComprobante,

          tipoFirma: actualizada.tipoFirma,

          soporteFirmado: actualizada.soporteFirmado,

          fechaFirma: actualizada.fechaFirma,

          fechaCargaSoporte: actualizada.fechaCargaSoporte,

          paciente: {
            id: actualizada.paciente.id,

            tipoDocumento: actualizada.paciente.tipoDocumento,

            numeroDocumento: actualizada.paciente.numeroDocumento,

            nombres: actualizada.paciente.nombres,

            apellidos: actualizada.paciente.apellidos,
          },

          sede: actualizada.bodega.sede.nombre,

          bodega: actualizada.bodega.nombre,

          dispensadoPor: actualizada.dispensadoPor,
        },
      };
    }

    throw new BadRequestException('El tipo de firma debe ser DIGITAL o MANUAL');
  }
}
