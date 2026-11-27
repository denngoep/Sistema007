import { UpdateInventoryReceiptDto } from '../dto/update-inventory-receipt.dto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { CreateInventoryProductDto } from '../dto/create-inventory-product.dto';
import { CreateInventorySupplierDto } from '../dto/create-inventory-supplier.dto';
import {
  CreateInventoryReceiptDto,
  EstadoVerificacionInvimaDto,
  ResultadoVerificacionIngresoDto,
} from '../dto/create-inventory-receipt.dto';
import { CreateWarehouseDto } from '../dto/create-warehouse.dto';
import { UpdateWarehouseDto } from '../dto/update-warehouse.dto';
import {
  ReviewInventoryReceiptDto,
  ResultadoRevisionRecepcionDto,
} from '../dto/review-inventory-receipt.dto';
import { ManageExpiredInventoryDto } from '../dto/manage-expired-inventory.dto';
import {
  AdjustInventoryDto,
  AdjustInventoryBatchDto,
  TransferInventoryDto,
  TransferInventoryBatchDto,
} from '../dto/update-inventory.dto';
import {
  TipoMovimientoInventario,
  TipoProductoInventario,
  TipoBodega,
  ResultadoVerificacionIngreso,
} from '../generated/prisma/client';
import { InventoryRepository } from '../repositories/inventory.repository';
import { NonConformingRepository } from '../repositories/non-conforming.repository';
import {
  InventoryVerificationRepository,
  type EditReceiptVerificationData,
} from '../repositories/inventory-verification.repository';
import {
  InventoryReceiptCorrectionRepository,
  type CorrectInventoryReceiptDetailData,
} from '../repositories/inventory-receipt-correction.repository';

@Injectable()
export class InventoryService {
  constructor(
    private readonly inventoryRepository: InventoryRepository,
    private readonly nonConformingRepository: NonConformingRepository,
    private readonly inventoryVerificationRepository: InventoryVerificationRepository,
    private readonly inventoryReceiptCorrectionRepository: InventoryReceiptCorrectionRepository,
  ) {}

  // =====================================================
  // PROVEEDORES
  // =====================================================

  async getActiveSuppliers() {
    return this.inventoryRepository.findActiveSuppliers();
  }

  async createSupplier(createInventorySupplierDto: CreateInventorySupplierDto) {
    const nit = createInventorySupplierDto.nit.trim();
    const razonSocial = createInventorySupplierDto.razonSocial.trim();

    if (!nit) {
      throw new BadRequestException('El NIT es obligatorio');
    }

    if (!razonSocial) {
      throw new BadRequestException('La razón social es obligatoria');
    }

    const existingSupplier =
      await this.inventoryRepository.findSupplierByNit(nit);

    if (existingSupplier) {
      throw new ConflictException(
        'Ya existe un proveedor registrado con este NIT',
      );
    }

    return this.inventoryRepository.createSupplier({
      nit,
      razonSocial,
      nombreComercial: createInventorySupplierDto.nombreComercial?.trim(),
      telefono: createInventorySupplierDto.telefono?.trim(),
      correo: createInventorySupplierDto.correo?.trim(),
      direccion: createInventorySupplierDto.direccion?.trim(),
      contacto: createInventorySupplierDto.contacto?.trim(),
    });
  }

  // =====================================================
  // BODEGAS
  // =====================================================

  async getActiveWarehouses() {
    return this.inventoryRepository.findActiveWarehouses();
  }

  async getWarehousesForAdministration() {
    return this.inventoryRepository.findWarehousesForAdministration();
  }

  async getActiveSites() {
    return this.inventoryRepository.findActiveSites();
  }

  private normalizeWarehouseCode(value: string) {
    const codigo = value.trim().toUpperCase();
    if (!/^[A-Z0-9][A-Z0-9_-]{1,31}$/.test(codigo)) {
      throw new BadRequestException(
        'El código debe tener entre 2 y 32 caracteres alfanuméricos, guiones o guiones bajos',
      );
    }
    return codigo;
  }

  private validateWarehouseConfiguration(
    tipo: TipoBodega,
    permiteDispensacion: boolean,
  ) {
    if (tipo === TipoBodega.NO_CONFORMES && permiteDispensacion) {
      throw new BadRequestException(
        'Una bodega de no conformes no puede permitir dispensación',
      );
    }
  }

  async createWarehouse(
    createWarehouseDto: CreateWarehouseDto,
    usuarioId: number,
  ) {
    const nombre = createWarehouseDto.nombre.trim();
    if (!nombre) throw new BadRequestException('El nombre es obligatorio');
    const codigo = this.normalizeWarehouseCode(createWarehouseDto.codigo);
    const tipo = createWarehouseDto.tipo ?? TipoBodega.GENERAL;
    const permiteDispensacion = createWarehouseDto.permiteDispensacion ?? false;
    this.validateWarehouseConfiguration(tipo, permiteDispensacion);

    const sede = await this.inventoryRepository.findSiteById(
      createWarehouseDto.sedeId,
    );

    if (!sede) {
      throw new NotFoundException('La sede indicada no existe');
    }

    if (!sede.activa) {
      throw new BadRequestException('La sede indicada está inactiva');
    }

    const existingWarehouse =
      await this.inventoryRepository.findWarehouseByNameInSite(
        createWarehouseDto.sedeId,
        nombre,
      );

    if (existingWarehouse) {
      throw new ConflictException(
        'Ya existe una bodega con este nombre en la sede indicada',
      );
    }

    if (await this.inventoryRepository.findWarehouseByCode(codigo)) {
      throw new ConflictException('Ya existe una bodega con este código');
    }

    return this.inventoryRepository.createWarehouse({
      sedeId: createWarehouseDto.sedeId,
      codigo,
      nombre,
      tipo,
      descripcion: createWarehouseDto.descripcion?.trim(),
      permiteDispensacion,
      creadoPorId: usuarioId,
    });
  }

  async updateWarehouse(id: number, dto: UpdateWarehouseDto) {
    const warehouse = await this.inventoryRepository.findWarehouseById(id);
    if (!warehouse) throw new NotFoundException('La bodega no existe');

    const nombre = dto.nombre?.trim();
    if (dto.nombre !== undefined && !nombre) {
      throw new BadRequestException('El nombre es obligatorio');
    }
    if (nombre && nombre !== warehouse.nombre) {
      const duplicate =
        await this.inventoryRepository.findWarehouseByNameInSite(
          warehouse.sedeId,
          nombre,
        );
      if (duplicate && duplicate.id !== id) {
        throw new ConflictException(
          'Ya existe una bodega con este nombre en la sede indicada',
        );
      }
    }

    const codigo =
      dto.codigo === undefined
        ? undefined
        : this.normalizeWarehouseCode(dto.codigo);
    if (codigo && codigo !== warehouse.codigo) {
      const duplicate =
        await this.inventoryRepository.findWarehouseByCode(codigo);
      if (duplicate && duplicate.id !== id) {
        throw new ConflictException('Ya existe una bodega con este código');
      }
    }

    const tipo = dto.tipo ?? warehouse.tipo;
    const permiteDispensacion =
      dto.permiteDispensacion ?? warehouse.permiteDispensacion;
    this.validateWarehouseConfiguration(tipo, permiteDispensacion);

    return this.inventoryRepository.updateWarehouse(id, {
      ...(codigo !== undefined ? { codigo } : {}),
      ...(nombre !== undefined ? { nombre } : {}),
      ...(dto.descripcion !== undefined
        ? { descripcion: dto.descripcion?.trim() || null }
        : {}),
      ...(dto.tipo !== undefined ? { tipo } : {}),
      ...(dto.permiteDispensacion !== undefined ? { permiteDispensacion } : {}),
      ...(dto.activa !== undefined ? { activa: dto.activa } : {}),
    });
  }

  // =====================================================
  // PRODUCTOS
  // =====================================================

  async createProduct(createInventoryProductDto: CreateInventoryProductDto) {
    let medicamentoId: number | undefined;

    if (createInventoryProductDto.tipo === TipoProductoInventario.MEDICAMENTO) {
      if (!createInventoryProductDto.medicamento) {
        throw new BadRequestException(
          'Los datos del medicamento son obligatorios',
        );
      }

      const medicationData = createInventoryProductDto.medicamento;

      let medication = await this.inventoryRepository.findMedication(
        medicationData.nombre,
        medicationData.concentracion,
        medicationData.formaFarmaceutica,
      );

      if (!medication) {
        medication = await this.inventoryRepository.createMedication({
          nombre: medicationData.nombre,
          concentracion: medicationData.concentracion,
          formaFarmaceutica: medicationData.formaFarmaceutica,
          viaAdministracion: medicationData.viaAdministracion,
        });
      }

      medicamentoId = medication.id;
    }

    const lastProduct = await this.inventoryRepository.getLastProduct();

    const codigoInterno =
      lastProduct?.codigoInterno != null ? lastProduct.codigoInterno + 1 : 1000;

    if (codigoInterno > 9999) {
      throw new BadRequestException(
        'Se agotó el rango disponible de códigos internos de 4 dígitos',
      );
    }

    const existingCode =
      await this.inventoryRepository.findProductByCode(codigoInterno);

    if (existingCode) {
      throw new ConflictException(
        'El código interno generado ya se encuentra registrado',
      );
    }

    const temperaturaMinima = createInventoryProductDto.temperaturaMinima;

    const temperaturaMaxima = createInventoryProductDto.temperaturaMaxima;

    if (
      temperaturaMinima !== undefined &&
      temperaturaMaxima !== undefined &&
      temperaturaMinima > temperaturaMaxima
    ) {
      throw new BadRequestException(
        'La temperatura mínima no puede superar la temperatura máxima',
      );
    }

    return this.inventoryRepository.createProduct({
      medicamentoId,
      codigoInterno,
      tipo: createInventoryProductDto.tipo,
      descripcion: createInventoryProductDto.descripcion.trim(),
      marca: createInventoryProductDto.marca?.trim(),
      laboratorio: createInventoryProductDto.laboratorio?.trim(),
      registroInvima: createInventoryProductDto.registroInvima?.trim(),
      condicionConservacion: createInventoryProductDto.condicionConservacion,
      temperaturaMinima,
      temperaturaMaxima,
      humedadMaxima: createInventoryProductDto.humedadMaxima,
      claseRiesgo: createInventoryProductDto.claseRiesgo?.trim(),
    });
  }

  async getAllProducts() {
    const products = await this.inventoryRepository.findAllProducts();

    return {
      totalProductos: products.length,
      productos: products,
    };
  }

  // =====================================================
  // HISTORIAL DE RECEPCIONES
  // =====================================================

  async getAllReceipts() {
    const receipts = await this.inventoryRepository.findAllReceipts();

    const recepciones = receipts.map((receipt) => ({
      id: receipt.id,
      numeroActa: receipt.numeroActa,
      numeroFactura: receipt.numeroFactura,
      fechaFactura: receipt.fechaFactura,
      fechaRecepcion: receipt.fechaRecepcion,
      estado: receipt.estado,
      observaciones: receipt.observaciones,
      proveedor: receipt.proveedor,
      sede: receipt.sede,
      elaboradoPor: receipt.elaboradoPor,
      revisadoPor: receipt.revisadoPor,
      fechaRevision: receipt.fechaRevision,
      ingresoInventario: receipt.ingresoInventario,
      totalProductos: receipt.detalles.length,
      totalConformes: receipt.detalles.filter(
        (detalle) => detalle.resultadoVerificacion === 'CONFORME',
      ).length,
      totalPendientes: receipt.detalles.filter(
        (detalle) => detalle.resultadoVerificacion === 'PENDIENTE',
      ).length,
      totalNoConformes: receipt.detalles.filter(
        (detalle) => detalle.resultadoVerificacion === 'NO_CONFORME',
      ).length,
    }));

    return {
      totalRecepciones: recepciones.length,
      recepciones,
    };
  }

  // =====================================================
  // DETALLE DE UNA RECEPCIÓN
  // =====================================================

  async getReceiptById(actaId: number) {
    if (!Number.isInteger(actaId) || actaId <= 0) {
      throw new BadRequestException('Debes indicar un ID de recepción válido');
    }

    const receipt = await this.inventoryRepository.findReceiptById(actaId);

    if (!receipt) {
      throw new NotFoundException(
        `No existe una recepción registrada con el ID ${actaId}`,
      );
    }

    const totalConformes = receipt.detalles.filter(
      (detalle) => detalle.resultadoVerificacion === 'CONFORME',
    ).length;

    const totalPendientes = receipt.detalles.filter(
      (detalle) => detalle.resultadoVerificacion === 'PENDIENTE',
    ).length;

    const totalNoConformes = receipt.detalles.filter(
      (detalle) => detalle.resultadoVerificacion === 'NO_CONFORME',
    ).length;

    return {
      ...receipt,
      totalProductos: receipt.detalles.length,
      totalConformes,
      totalPendientes,
      totalNoConformes,
    };
  }

  // =====================================================
  // REGISTRO DE RECEPCIÓN POR FACTURA
  // =====================================================

  async registerReceipt(
    createInventoryReceiptDto: CreateInventoryReceiptDto,
    usuarioId: number,
  ) {
    const {
      numeroFactura,
      fechaFactura,
      proveedorId,
      bodegaDestinoId,
      observaciones,
      productos,
    } = createInventoryReceiptDto;

    if (!numeroFactura?.trim()) {
      throw new BadRequestException('El número de factura es obligatorio');
    }

    const fechaFacturaConvertida = new Date(fechaFactura);

    if (Number.isNaN(fechaFacturaConvertida.getTime())) {
      throw new BadRequestException('La fecha de la factura no es válida');
    }

    if (!Number.isInteger(proveedorId) || proveedorId <= 0) {
      throw new BadRequestException('Debes seleccionar un proveedor válido');
    }

    if (!Number.isInteger(bodegaDestinoId) || bodegaDestinoId <= 0) {
      throw new BadRequestException(
        'Debes seleccionar una bodega de destino válida',
      );
    }

    const bodegaDestino =
      await this.inventoryRepository.findWarehouseById(bodegaDestinoId);
    if (!bodegaDestino || !bodegaDestino.activa || !bodegaDestino.sede.activa) {
      throw new BadRequestException(
        'La bodega de destino no existe o se encuentra inactiva',
      );
    }

    if (!Array.isArray(productos) || productos.length === 0) {
      throw new BadRequestException(
        'Debes agregar al menos un producto a la factura',
      );
    }

    const productosConvertidos = productos.map((producto, indice) => {
      const posicion = indice + 1;

      if (!Number.isInteger(producto.productoId) || producto.productoId <= 0) {
        throw new BadRequestException(
          `El producto de la posición ${posicion} no es válido`,
        );
      }

      if (!producto.numeroLote?.trim()) {
        throw new BadRequestException(
          `El producto de la posición ${posicion} debe tener un número de lote`,
        );
      }

      if (!Number.isInteger(producto.cantidad) || producto.cantidad <= 0) {
        throw new BadRequestException(
          `La cantidad del producto ${posicion} debe ser mayor que cero`,
        );
      }

      const fechaVencimiento = new Date(producto.fechaVencimiento);

      if (Number.isNaN(fechaVencimiento.getTime())) {
        throw new BadRequestException(
          `La fecha de vencimiento del producto ${posicion} no es válida`,
        );
      }

      if (
        producto.costoUnitario !== undefined &&
        (!Number.isFinite(producto.costoUnitario) || producto.costoUnitario < 0)
      ) {
        throw new BadRequestException(
          `El costo unitario del producto ${posicion} no es válido`,
        );
      }

      if (
        !Object.values(EstadoVerificacionInvimaDto).includes(
          producto.estadoVerificacionInvima,
        )
      ) {
        throw new BadRequestException(
          `Debes indicar un estado de verificación INVIMA válido para el producto ${posicion}`,
        );
      }

      if (
        !Object.values(ResultadoVerificacionIngresoDto).includes(
          producto.resultadoVerificacion,
        )
      ) {
        throw new BadRequestException(
          `Debes indicar un resultado de verificación válido para el producto ${posicion}`,
        );
      }

      if (
        producto.temperaturaRegistrada !== undefined &&
        !Number.isFinite(producto.temperaturaRegistrada)
      ) {
        throw new BadRequestException(
          `La temperatura registrada del producto ${posicion} no es válida`,
        );
      }

      if (
        producto.humedadRegistrada !== undefined &&
        (!Number.isFinite(producto.humedadRegistrada) ||
          producto.humedadRegistrada < 0 ||
          producto.humedadRegistrada > 100)
      ) {
        throw new BadRequestException(
          `La humedad registrada del producto ${posicion} debe estar entre 0 y 100 %`,
        );
      }

      if (
        producto.resultadoVerificacion ===
          ResultadoVerificacionIngresoDto.CONFORME &&
        producto.estadoVerificacionInvima ===
          EstadoVerificacionInvimaDto.PENDIENTE
      ) {
        throw new BadRequestException(
          `El producto ${posicion} no puede marcarse conforme mientras su verificación INVIMA esté pendiente`,
        );
      }

      if (
        producto.resultadoVerificacion ===
          ResultadoVerificacionIngresoDto.CONFORME &&
        producto.estadoVerificacionInvima ===
          EstadoVerificacionInvimaDto.NO_VIGENTE
      ) {
        throw new BadRequestException(
          `El producto ${posicion} no puede marcarse conforme porque su registro INVIMA figura como no vigente`,
        );
      }

      return {
        productoId: producto.productoId,
        numeroLote: producto.numeroLote.trim(),
        fechaVencimiento,
        cantidad: producto.cantidad,
        costoUnitario: producto.costoUnitario,
        estadoVerificacionInvima: producto.estadoVerificacionInvima,
        temperaturaRegistrada: producto.temperaturaRegistrada,
        humedadRegistrada: producto.humedadRegistrada,
        resultadoVerificacion: producto.resultadoVerificacion,
        observacionesVerificacion: producto.observacionesVerificacion?.trim(),
      };
    });

    return this.inventoryRepository.registerReceipt({
      numeroFactura: numeroFactura.trim(),
      fechaFactura: fechaFacturaConvertida,
      proveedorId,
      bodegaDestinoId,
      usuarioId,
      observaciones: observaciones?.trim(),
      productos: productosConvertidos,
    });
  }

  // =====================================================
  // REVISIÓN DE PRODUCTOS PENDIENTES
  // =====================================================

  async reviewReceipt(
    actaId: number,
    reviewInventoryReceiptDto: ReviewInventoryReceiptDto,
    usuarioId: number,
  ) {
    if (!Number.isInteger(actaId) || actaId <= 0) {
      throw new BadRequestException('Debes indicar un ID de recepción válido');
    }

    if (
      !Number.isInteger(reviewInventoryReceiptDto.detalleActaId) ||
      reviewInventoryReceiptDto.detalleActaId <= 0
    ) {
      throw new BadRequestException(
        'Debes seleccionar un producto pendiente válido',
      );
    }

    if (
      !Object.values(ResultadoRevisionRecepcionDto).includes(
        reviewInventoryReceiptDto.resultado,
      )
    ) {
      throw new BadRequestException(
        'El resultado de revisión debe ser CONFORME o NO_CONFORME',
      );
    }

    if (
      !Object.values(EstadoVerificacionInvimaDto).includes(
        reviewInventoryReceiptDto.estadoVerificacionInvima,
      )
    ) {
      throw new BadRequestException(
        'Debes indicar un estado de verificación INVIMA válido',
      );
    }

    if (
      reviewInventoryReceiptDto.temperaturaRegistrada !== undefined &&
      !Number.isFinite(reviewInventoryReceiptDto.temperaturaRegistrada)
    ) {
      throw new BadRequestException('La temperatura registrada no es válida');
    }

    if (
      reviewInventoryReceiptDto.humedadRegistrada !== undefined &&
      (!Number.isFinite(reviewInventoryReceiptDto.humedadRegistrada) ||
        reviewInventoryReceiptDto.humedadRegistrada < 0 ||
        reviewInventoryReceiptDto.humedadRegistrada > 100)
    ) {
      throw new BadRequestException(
        'La humedad registrada debe estar entre 0 y 100 %',
      );
    }

    const resultado =
      reviewInventoryReceiptDto.resultado ===
      ResultadoRevisionRecepcionDto.CONFORME
        ? ResultadoVerificacionIngreso.CONFORME
        : ResultadoVerificacionIngreso.NO_CONFORME;

    return this.inventoryRepository.reviewReceipt({
      actaId,
      usuarioId,
      observaciones: reviewInventoryReceiptDto.observaciones?.trim(),
      productos: [
        {
          detalleActaId: reviewInventoryReceiptDto.detalleActaId,
          resultadoVerificacion: resultado,
          estadoVerificacionInvima:
            reviewInventoryReceiptDto.estadoVerificacionInvima,
          temperaturaRegistrada:
            reviewInventoryReceiptDto.temperaturaRegistrada,
          humedadRegistrada: reviewInventoryReceiptDto.humedadRegistrada,
          observaciones: reviewInventoryReceiptDto.observaciones?.trim(),
        },
      ],
    });
  }

  // =====================================================
  // EDICIÓN ADMINISTRATIVA DE RECEPCIONES
  // =====================================================

  async updateReceipt(actaId: number, dto: UpdateInventoryReceiptDto) {
    if (!Number.isInteger(actaId) || actaId <= 0) {
      throw new BadRequestException('El ID de recepción no es válido');
    }

    const receipt = await this.inventoryRepository.findReceiptById(actaId);

    if (!receipt) {
      throw new NotFoundException('La recepción no existe');
    }

    if (receipt.estado === 'ANULADA') {
      throw new BadRequestException(
        'No se puede modificar una recepción anulada',
      );
    }

    if (dto.numeroFactura !== undefined && !dto.numeroFactura.trim()) {
      throw new BadRequestException(
        'El número de factura no puede estar vacío',
      );
    }

    return this.inventoryRepository.updateReceipt(actaId, {
      ...(dto.numeroFactura !== undefined && {
        numeroFactura: dto.numeroFactura.trim(),
      }),
      ...(dto.fechaFactura !== undefined && {
        fechaFactura: new Date(dto.fechaFactura),
      }),
      ...(dto.numeroOrdenCompra !== undefined && {
        numeroOrdenCompra: dto.numeroOrdenCompra.trim(),
      }),
      ...(dto.numeroRemision !== undefined && {
        numeroRemision: dto.numeroRemision.trim(),
      }),
      ...(dto.observaciones !== undefined && {
        observaciones: dto.observaciones.trim(),
      }),
    });
  }

  // =====================================================
  // CONSULTA DE VENCIMIENTOS
  // =====================================================

  async getExpirations(dias = 90) {
    if (dias < 1 || dias > 365) {
      throw new BadRequestException(
        'Los días para consultar vencimientos deben estar entre 1 y 365',
      );
    }

    const ahora = new Date();

    const hoy = new Date(
      ahora.getFullYear(),
      ahora.getMonth(),
      ahora.getDate(),
    );

    const fechaLimite = new Date(hoy);
    fechaLimite.setDate(fechaLimite.getDate() + dias);
    fechaLimite.setHours(23, 59, 59, 999);

    const lotes =
      await this.inventoryRepository.findBatchesByExpiration(fechaLimite);

    const lotesConExistencia = lotes.filter((lote) =>
      lote.existencias.some((existencia) => existencia.cantidad > 0),
    );

    const resultados = lotesConExistencia.map((lote) => {
      const fechaVencimiento = new Date(lote.fechaVencimiento);

      const fechaVencimientoDia = new Date(
        fechaVencimiento.getFullYear(),
        fechaVencimiento.getMonth(),
        fechaVencimiento.getDate(),
      );

      const diferenciaMilisegundos =
        fechaVencimientoDia.getTime() - hoy.getTime();

      const diasParaVencer = Math.ceil(
        diferenciaMilisegundos / (1000 * 60 * 60 * 24),
      );

      const estadoVencimiento =
        diasParaVencer < 0 ? 'VENCIDO' : 'PROXIMO_A_VENCER';

      const cantidadTotal = lote.existencias.reduce(
        (total, existencia) => total + existencia.cantidad,
        0,
      );

      return {
        loteId: lote.id,
        numeroLote: lote.numeroLote,
        fechaVencimiento: lote.fechaVencimiento,
        diasParaVencer,
        estadoVencimiento,
        cantidadTotal,
        existencias: lote.existencias.map((existencia) => ({
          bodegaId: existencia.bodegaId,
          bodega: existencia.bodega.nombre,
          tipoBodega: existencia.bodega.tipo,
          permiteDispensacion: existencia.bodega.permiteDispensacion,
          sedeId: existencia.bodega.sede.id,
          sede: existencia.bodega.sede.nombre,
          cantidad: existencia.cantidad,
        })),
      };
    });

    return {
      diasConsultados: dias,
      fechaConsulta: hoy,
      fechaLimite,
      totalLotes: resultados.length,
      vencidos: resultados.filter(
        (lote) => lote.estadoVencimiento === 'VENCIDO',
      ).length,
      proximosAVencer: resultados.filter(
        (lote) => lote.estadoVencimiento === 'PROXIMO_A_VENCER',
      ).length,
      lotes: resultados,
    };
  }

  // =====================================================
  // TRASLADO INDIVIDUAL DE INVENTARIO
  // =====================================================

  async transferInventory(
    transferInventoryDto: TransferInventoryDto,
    usuarioId: number,
  ) {
    if (
      transferInventoryDto.bodegaOrigenId ===
      transferInventoryDto.bodegaDestinoId
    ) {
      throw new BadRequestException(
        'La bodega de origen y la bodega de destino deben ser diferentes',
      );
    }

    if (
      !Number.isInteger(transferInventoryDto.cantidad) ||
      transferInventoryDto.cantidad <= 0
    ) {
      throw new BadRequestException(
        'La cantidad del traslado debe ser mayor que cero',
      );
    }

    if (!transferInventoryDto.motivo?.trim()) {
      throw new BadRequestException('El motivo del traslado es obligatorio');
    }

    const lote = await this.inventoryRepository.findBatchById(
      transferInventoryDto.loteId,
    );

    if (!lote) {
      throw new NotFoundException('El lote indicado no existe');
    }

    if (lote.estado !== 'DISPONIBLE') {
      throw new BadRequestException(
        `El lote ${lote.numeroLote} no está disponible para traslado`,
      );
    }

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const vencimiento = new Date(lote.fechaVencimiento);
    vencimiento.setHours(0, 0, 0, 0);

    if (vencimiento < hoy) {
      throw new BadRequestException(
        `El lote ${lote.numeroLote} está vencido y no puede trasladarse mediante un traslado normal`,
      );
    }

    const bodegaOrigen = await this.inventoryRepository.findWarehouseById(
      transferInventoryDto.bodegaOrigenId,
    );

    if (!bodegaOrigen) {
      throw new NotFoundException('La bodega de origen no existe');
    }

    if (!bodegaOrigen.activa || !bodegaOrigen.sede.activa) {
      throw new BadRequestException(
        'La bodega de origen o su sede están inactivas',
      );
    }

    if (
      bodegaOrigen.tipo === 'NO_CONFORMES' ||
      !bodegaOrigen.permiteDispensacion
    ) {
      throw new BadRequestException(
        'No se permiten traslados normales desde una bodega de productos no conformes o bloqueada para dispensación',
      );
    }

    const bodegaDestino = await this.inventoryRepository.findWarehouseById(
      transferInventoryDto.bodegaDestinoId,
    );

    if (!bodegaDestino) {
      throw new NotFoundException('La bodega de destino no existe');
    }

    if (!bodegaDestino.activa || !bodegaDestino.sede.activa) {
      throw new BadRequestException(
        'La bodega de destino o su sede están inactivas',
      );
    }

    if (bodegaDestino.tipo === 'NO_CONFORMES') {
      throw new BadRequestException(
        'Los traslados normales no pueden dirigirse a una bodega de productos no conformes',
      );
    }

    if (bodegaOrigen.sedeId !== bodegaDestino.sedeId) {
      throw new BadRequestException(
        'Los traslados normales deben realizarse entre bodegas de la misma sede',
      );
    }

    const existencia = await this.inventoryRepository.findStock(
      transferInventoryDto.loteId,
      transferInventoryDto.bodegaOrigenId,
    );

    if (!existencia) {
      throw new NotFoundException(
        'El lote no tiene existencia registrada en la bodega de origen',
      );
    }

    if (existencia.cantidad < transferInventoryDto.cantidad) {
      throw new BadRequestException(
        'No hay existencias suficientes para realizar el traslado',
      );
    }

    try {
      return await this.inventoryRepository.transferStock({
        loteId: transferInventoryDto.loteId,
        bodegaOrigenId: transferInventoryDto.bodegaOrigenId,
        bodegaDestinoId: transferInventoryDto.bodegaDestinoId,
        cantidad: transferInventoryDto.cantidad,
        usuarioId,
        motivo: transferInventoryDto.motivo.trim(),
        referencia: transferInventoryDto.referencia?.trim(),
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'EXISTENCIA_ORIGEN_NO_ENCONTRADA') {
          throw new NotFoundException(
            'El lote no tiene existencia registrada en la bodega de origen',
          );
        }

        if (error.message === 'STOCK_INSUFICIENTE') {
          throw new BadRequestException(
            'No hay existencias suficientes para realizar el traslado',
          );
        }
      }

      throw error;
    }
  }

  // =====================================================
  // TRASLADO MÚLTIPLE DE INVENTARIO
  // =====================================================

  async transferInventoryBatch(
    dto: TransferInventoryBatchDto,
    usuarioId: number,
  ) {
    if (
      !Number.isInteger(dto.bodegaOrigenId) ||
      dto.bodegaOrigenId <= 0 ||
      !Number.isInteger(dto.bodegaDestinoId) ||
      dto.bodegaDestinoId <= 0
    ) {
      throw new BadRequestException('Debes seleccionar bodegas válidas');
    }

    if (dto.bodegaOrigenId === dto.bodegaDestinoId) {
      throw new BadRequestException(
        'La bodega de origen y la bodega de destino deben ser diferentes',
      );
    }

    if (!dto.motivo?.trim()) {
      throw new BadRequestException('El motivo del traslado es obligatorio');
    }

    if (!Array.isArray(dto.productos) || dto.productos.length === 0) {
      throw new BadRequestException(
        'Debes seleccionar al menos un lote para trasladar',
      );
    }

    const bodegaOrigen = await this.inventoryRepository.findWarehouseById(
      dto.bodegaOrigenId,
    );

    if (!bodegaOrigen) {
      throw new NotFoundException('La bodega de origen no existe');
    }

    if (!bodegaOrigen.activa || !bodegaOrigen.sede.activa) {
      throw new BadRequestException(
        'La bodega de origen o su sede están inactivas',
      );
    }

    if (
      bodegaOrigen.tipo === 'NO_CONFORMES' ||
      !bodegaOrigen.permiteDispensacion
    ) {
      throw new BadRequestException(
        'No se permiten traslados normales desde una bodega de productos no conformes o bloqueada para dispensación',
      );
    }

    const bodegaDestino = await this.inventoryRepository.findWarehouseById(
      dto.bodegaDestinoId,
    );

    if (!bodegaDestino) {
      throw new NotFoundException('La bodega de destino no existe');
    }

    if (!bodegaDestino.activa || !bodegaDestino.sede.activa) {
      throw new BadRequestException(
        'La bodega de destino o su sede están inactivas',
      );
    }

    if (bodegaDestino.tipo === 'NO_CONFORMES') {
      throw new BadRequestException(
        'Los traslados normales no pueden dirigirse a una bodega de productos no conformes',
      );
    }

    if (bodegaOrigen.sedeId !== bodegaDestino.sedeId) {
      throw new BadRequestException(
        'Los traslados normales deben realizarse entre bodegas de la misma sede',
      );
    }

    const lotesSeleccionados = new Set<number>();

    for (const item of dto.productos) {
      if (
        !Number.isInteger(item.loteId) ||
        item.loteId <= 0 ||
        !Number.isInteger(item.cantidad) ||
        item.cantidad <= 0
      ) {
        throw new BadRequestException(
          'Todos los lotes deben tener un identificador y una cantidad válidos',
        );
      }

      if (lotesSeleccionados.has(item.loteId)) {
        throw new BadRequestException(
          `El lote ${item.loteId} está repetido en el traslado`,
        );
      }

      lotesSeleccionados.add(item.loteId);

      const lote = await this.inventoryRepository.findBatchById(item.loteId);

      if (!lote) {
        throw new NotFoundException(`El lote ${item.loteId} no existe`);
      }

      if (lote.estado !== 'DISPONIBLE') {
        throw new BadRequestException(
          `El lote ${lote.numeroLote} no está disponible para traslado`,
        );
      }

      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);

      const vencimiento = new Date(lote.fechaVencimiento);
      vencimiento.setHours(0, 0, 0, 0);

      if (vencimiento < hoy) {
        throw new BadRequestException(
          `El lote ${lote.numeroLote} está vencido y no puede trasladarse mediante un traslado normal`,
        );
      }

      const existencia = await this.inventoryRepository.findStock(
        item.loteId,
        dto.bodegaOrigenId,
      );

      if (!existencia || existencia.cantidad < item.cantidad) {
        throw new BadRequestException(
          `No hay existencias suficientes del lote ${lote.numeroLote}`,
        );
      }
    }

    try {
      return await this.inventoryRepository.transferStockBatch({
        bodegaOrigenId: dto.bodegaOrigenId,
        bodegaDestinoId: dto.bodegaDestinoId,
        usuarioId,
        motivo: dto.motivo.trim(),
        productos: dto.productos.map((item) => ({
          loteId: item.loteId,
          cantidad: item.cantidad,
        })),
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'EXISTENCIA_ORIGEN_NO_ENCONTRADA') {
          throw new NotFoundException(
            'Uno de los lotes no tiene existencia registrada en la bodega de origen',
          );
        }

        if (error.message === 'STOCK_INSUFICIENTE') {
          throw new BadRequestException(
            'No hay existencias suficientes para completar el traslado múltiple',
          );
        }
      }

      throw error;
    }
  }

  // =====================================================
  // TRASLADO A PRODUCTOS NO CONFORMES DESDE INVENTARIO
  // =====================================================

  async transferToNonConforming(
    data: {
      loteId: number;
      bodegaOrigenId: number;
      bodegaDestinoId: number;
      cantidad: number;
      motivo: string;
      referencia?: string;
      observaciones?: string;
    },
    usuarioId: number,
  ) {
    if (
      !Number.isInteger(data.loteId) ||
      data.loteId <= 0 ||
      !Number.isInteger(data.bodegaOrigenId) ||
      data.bodegaOrigenId <= 0 ||
      !Number.isInteger(data.bodegaDestinoId) ||
      data.bodegaDestinoId <= 0 ||
      !Number.isInteger(data.cantidad) ||
      data.cantidad <= 0
    ) {
      throw new BadRequestException(
        'Debes indicar lote, bodegas y cantidad válidos',
      );
    }

    if (!data.motivo?.trim()) {
      throw new BadRequestException(
        'Debes registrar el motivo de la no conformidad',
      );
    }

    return this.nonConformingRepository.registerInventoryCustody({
      loteId: data.loteId,
      bodegaOrigenId: data.bodegaOrigenId,
      bodegaDestinoId: data.bodegaDestinoId,
      cantidad: data.cantidad,
      usuarioId,
      motivo: data.motivo.trim(),
      referencia: data.referencia?.trim(),
      observaciones: data.observaciones?.trim(),
      origen: 'ALMACENAMIENTO',
    });
  }

  // =====================================================
  // AJUSTES DE INVENTARIO
  // =====================================================

  async adjustInventory(
    adjustInventoryDto: AdjustInventoryDto,
    usuarioId: number,
    soporte?: {
      claveAlmacenamiento: string;
      sha256: string;
      mime: string;
      tamano: number;
    },
  ) {
    if (
      adjustInventoryDto.tipo !== TipoMovimientoInventario.AJUSTE_ENTRADA &&
      adjustInventoryDto.tipo !== TipoMovimientoInventario.AJUSTE_SALIDA
    ) {
      throw new BadRequestException(
        'Solo se permiten movimientos de AJUSTE_ENTRADA o AJUSTE_SALIDA',
      );
    }

    const lote = await this.inventoryRepository.findBatchById(
      adjustInventoryDto.loteId,
    );

    if (!lote) {
      throw new NotFoundException('El lote indicado no existe');
    }

    const bodega = await this.inventoryRepository.findWarehouseById(
      adjustInventoryDto.bodegaId,
    );

    if (!bodega) {
      throw new NotFoundException('La bodega indicada no existe');
    }

    if (!bodega.activa) {
      throw new BadRequestException('La bodega indicada está inactiva');
    }

    if (adjustInventoryDto.tipo === TipoMovimientoInventario.AJUSTE_SALIDA) {
      const existencia = await this.inventoryRepository.findStock(
        adjustInventoryDto.loteId,
        adjustInventoryDto.bodegaId,
      );

      if (!existencia) {
        throw new NotFoundException(
          'El lote no tiene existencia registrada en esta bodega',
        );
      }

      if (existencia.cantidad < adjustInventoryDto.cantidad) {
        throw new BadRequestException(
          'No hay existencias suficientes para realizar el ajuste de salida',
        );
      }
    }

    try {
      return await this.inventoryRepository.adjustStock({
        loteId: adjustInventoryDto.loteId,
        bodegaId: adjustInventoryDto.bodegaId,
        tipo: adjustInventoryDto.tipo,
        cantidad: adjustInventoryDto.cantidad,
        usuarioId,
        motivo: adjustInventoryDto.motivo,
        referencia: adjustInventoryDto.referencia,
        soporte,
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'EXISTENCIA_NO_ENCONTRADA') {
          throw new NotFoundException(
            'El lote no tiene existencia registrada en esta bodega',
          );
        }

        if (error.message === 'STOCK_INSUFICIENTE') {
          throw new BadRequestException(
            'No hay existencias suficientes para realizar el ajuste',
          );
        }
      }

      throw error;
    }
  }

  // =====================================================
  // AJUSTE MÚLTIPLE POR CONTEO FÍSICO
  // =====================================================

  async adjustInventoryBatch(
    dto: AdjustInventoryBatchDto,
    usuarioId: number,
    soporte?: {
      claveAlmacenamiento: string;
      sha256: string;
      mime: string;
      tamano: number;
    },
  ) {
    if (!Number.isInteger(dto.bodegaId) || dto.bodegaId <= 0) {
      throw new BadRequestException('Debes seleccionar una bodega válida');
    }

    if (!dto.motivo?.trim()) {
      throw new BadRequestException('El motivo del ajuste es obligatorio');
    }

    if (!Array.isArray(dto.productos) || dto.productos.length === 0) {
      throw new BadRequestException(
        'Debes seleccionar al menos un lote para ajustar',
      );
    }

    const lotesSeleccionados = new Set<number>();

    for (const item of dto.productos) {
      if (
        !Number.isInteger(item.loteId) ||
        item.loteId <= 0 ||
        !Number.isInteger(item.cantidadFisica) ||
        item.cantidadFisica < 0
      ) {
        throw new BadRequestException(
          'Todos los lotes deben tener un identificador válido y una cantidad física mayor o igual a cero',
        );
      }

      if (lotesSeleccionados.has(item.loteId)) {
        throw new BadRequestException(
          `El lote ${item.loteId} está repetido en el ajuste`,
        );
      }

      lotesSeleccionados.add(item.loteId);
    }

    return this.inventoryRepository.adjustStockBatch({
      bodegaId: dto.bodegaId,
      usuarioId,
      motivo: dto.motivo.trim(),
      referencia: dto.referencia?.trim(),
      productos: dto.productos.map((item) => ({
        loteId: item.loteId,
        cantidadFisica: item.cantidadFisica,
      })),
      soporte,
    });
  }

  // =====================================================
  // GESTIÓN DE INVENTARIO VENCIDO
  // =====================================================

  async manageExpiredInventory(
    manageExpiredInventoryDto: ManageExpiredInventoryDto,
    usuarioId: number,
  ) {
    const lote = await this.inventoryRepository.findBatchById(
      manageExpiredInventoryDto.loteId,
    );

    if (!lote) {
      throw new NotFoundException('El lote indicado no existe');
    }

    const ahora = new Date();

    const hoy = new Date(
      ahora.getFullYear(),
      ahora.getMonth(),
      ahora.getDate(),
    );

    const fechaVencimiento = new Date(lote.fechaVencimiento);

    const fechaVencimientoDia = new Date(
      fechaVencimiento.getFullYear(),
      fechaVencimiento.getMonth(),
      fechaVencimiento.getDate(),
    );

    if (fechaVencimientoDia >= hoy) {
      throw new BadRequestException('El lote todavía no se encuentra vencido');
    }

    if (
      manageExpiredInventoryDto.bodegaOrigenId ===
      manageExpiredInventoryDto.bodegaDestinoId
    ) {
      throw new BadRequestException(
        'La bodega de origen y la bodega de destino deben ser diferentes',
      );
    }

    const bodegaOrigen = await this.inventoryRepository.findWarehouseById(
      manageExpiredInventoryDto.bodegaOrigenId,
    );

    if (!bodegaOrigen) {
      throw new NotFoundException('La bodega de origen no existe');
    }

    if (!bodegaOrigen.activa || !bodegaOrigen.sede.activa) {
      throw new BadRequestException(
        'La bodega de origen o su sede están inactivas',
      );
    }

    if (bodegaOrigen.tipo === 'NO_CONFORMES') {
      throw new BadRequestException(
        'El lote ya se encuentra en una bodega de productos no conformes',
      );
    }

    const bodegaDestino = await this.inventoryRepository.findWarehouseById(
      manageExpiredInventoryDto.bodegaDestinoId,
    );

    if (!bodegaDestino) {
      throw new NotFoundException('La bodega de destino no existe');
    }

    if (!bodegaDestino.activa || !bodegaDestino.sede.activa) {
      throw new BadRequestException(
        'La bodega de destino o su sede están inactivas',
      );
    }

    if (bodegaOrigen.sedeId !== bodegaDestino.sedeId) {
      throw new BadRequestException(
        'Los medicamentos vencidos solo pueden trasladarse dentro de la misma sede',
      );
    }

    if (
      bodegaDestino.tipo !== 'NO_CONFORMES' ||
      bodegaDestino.permiteDispensacion
    ) {
      throw new BadRequestException(
        'Los medicamentos vencidos únicamente pueden trasladarse a una bodega de Productos No Conformes que no permita dispensación',
      );
    }

    if (!manageExpiredInventoryDto.motivo?.trim()) {
      throw new BadRequestException(
        'El motivo de gestión del medicamento vencido es obligatorio',
      );
    }

    const existencia = await this.inventoryRepository.findStock(
      manageExpiredInventoryDto.loteId,
      manageExpiredInventoryDto.bodegaOrigenId,
    );

    if (!existencia || existencia.cantidad <= 0) {
      throw new BadRequestException(
        'El lote no tiene existencias disponibles en la bodega de origen',
      );
    }

    const resultado =
      await this.nonConformingRepository.registerInventoryCustody({
        loteId: lote.id,
        bodegaOrigenId: manageExpiredInventoryDto.bodegaOrigenId,
        bodegaDestinoId: manageExpiredInventoryDto.bodegaDestinoId,
        cantidad: existencia.cantidad,
        usuarioId,
        motivo: manageExpiredInventoryDto.motivo.trim(),
        referencia:
          manageExpiredInventoryDto.referencia?.trim() ||
          'GESTION_PRODUCTO_VENCIDO',
        origen: 'VENCIMIENTO',
      });

    return {
      mensaje:
        'Medicamento vencido trasladado a Productos No Conformes correctamente',
      loteId: lote.id,
      numeroLote: lote.numeroLote,
      fechaVencimiento: lote.fechaVencimiento,
      cantidadTrasladada: resultado.cantidadTrasladada,
      bodegaOrigen: resultado.bodegaOrigen,
      bodegaDestino: resultado.bodegaDestino,
      movimientoId: resultado.movimientoId,
      gestionId: resultado.gestionId,
    };
  }

  // =====================================================
  // GESTIÓN DE PRODUCTOS NO CONFORMES
  // =====================================================

  async getNonConformingProducts() {
    return this.nonConformingRepository.findAll();
  }

  async getNonConformingManagementById(gestionId: number) {
    if (!Number.isInteger(gestionId) || gestionId <= 0) {
      throw new BadRequestException('El identificador de gestión no es válido');
    }

    return this.nonConformingRepository.findById(gestionId);
  }

  // =====================================================
  // REGISTRAR CUSTODIA DE RECEPCIÓN
  // =====================================================

  async registerNonConformingCustody(
    data: {
      detalleActaRecepcionId: number;
      bodegaId: number;
      motivo: string;
      observaciones?: string;
    },
    usuarioId: number,
  ) {
    if (
      !Number.isInteger(data.detalleActaRecepcionId) ||
      data.detalleActaRecepcionId <= 0
    ) {
      throw new BadRequestException(
        'Debes seleccionar un detalle de recepción válido',
      );
    }

    if (!Number.isInteger(data.bodegaId) || data.bodegaId <= 0) {
      throw new BadRequestException('Debes seleccionar una bodega válida');
    }

    if (!data.motivo?.trim()) {
      throw new BadRequestException(
        'Debes indicar el motivo de la no conformidad',
      );
    }

    return this.nonConformingRepository.registerCustody({
      detalleActaRecepcionId: data.detalleActaRecepcionId,
      bodegaId: data.bodegaId,
      usuarioId,
      motivo: data.motivo.trim(),
      observaciones: data.observaciones?.trim(),
    });
  }

  // =====================================================
  // DEVOLUCIÓN AL PROVEEDOR
  // =====================================================

  async returnNonConformingToSupplier(
    gestionId: number,
    data: {
      motivo: string;
      referencia: string;
      tipoDisposicion?: 'DEVOLUCION_PROVEEDOR' | 'CAMBIO_FISICO';
      observaciones?: string;
    },
    usuarioId: number,
  ) {
    if (!Number.isInteger(gestionId) || gestionId <= 0) {
      throw new BadRequestException('El identificador de gestión no es válido');
    }

    if (!data.motivo?.trim() || !data.referencia?.trim()) {
      throw new BadRequestException(
        'El motivo y la referencia de devolución son obligatorios',
      );
    }

    return this.nonConformingRepository.returnToSupplier({
      gestionId,
      usuarioId,
      motivo: data.motivo.trim(),
      referencia: data.referencia.trim(),
      tipoDisposicion: data.tipoDisposicion,
      observaciones: data.observaciones,
    });
  }

  // =====================================================
  // REINTEGRAR PRODUCTO DESDE CUSTODIA
  // =====================================================

  async reintegrateNonConformingProduct(
    gestionId: number,
    data: {
      bodegaDestinoId: number;
      motivo: string;
      referencia: string;
      observaciones?: string;
    },
    usuarioId: number,
  ) {
    if (!Number.isInteger(gestionId) || gestionId <= 0) {
      throw new BadRequestException('El identificador de gestión no es válido');
    }

    if (
      !Number.isInteger(data.bodegaDestinoId) ||
      data.bodegaDestinoId <= 0 ||
      !data.motivo?.trim() ||
      !data.referencia?.trim()
    ) {
      throw new BadRequestException(
        'Debes indicar la bodega, el motivo y la referencia de autorización',
      );
    }

    return this.nonConformingRepository.reintegrateToInventory({
      gestionId,
      bodegaDestinoId: data.bodegaDestinoId,
      usuarioId,
      motivo: data.motivo.trim(),
      referencia: data.referencia.trim(),
      observaciones: data.observaciones,
    });
  }

  // =====================================================
  // REEVALUACIÓN TÉCNICA DE RECEPCIÓN
  // =====================================================

  async reevaluateReceiptProduct(
    detalleActaId: number,
    data: {
      resultadoNuevo: ResultadoVerificacionIngreso;
      estadoInvimaNuevo: 'PENDIENTE' | 'VIGENTE' | 'NO_VIGENTE' | 'NO_APLICA';
      motivo: string;
      referencia: string;
      observaciones?: string;
    },
    usuarioId: number,
  ) {
    return this.inventoryRepository.reevaluateReceiptProduct({
      detalleActaId,
      usuarioId,
      resultadoNuevo: data.resultadoNuevo,
      estadoInvimaNuevo: data.estadoInvimaNuevo,
      motivo: data.motivo,
      referencia: data.referencia,
      observaciones: data.observaciones,
    });
  }

  // =====================================================
  // CORRECCIÓN DOCUMENTAL DE VERIFICACIÓN
  // =====================================================

  async editReceiptVerification(
    detalleActaId: number,
    data: Omit<EditReceiptVerificationData, 'detalleActaId' | 'usuarioId'>,
    usuarioId: number,
  ) {
    return this.inventoryVerificationRepository.editReceiptVerification({
      detalleActaId,
      usuarioId,
      estadoVerificacionInvima: data.estadoVerificacionInvima,
      temperaturaRegistrada: data.temperaturaRegistrada,
      humedadRegistrada: data.humedadRegistrada,
      observaciones: data.observaciones,
      motivo: data.motivo,
      referencia: data.referencia,
    });
  }

  // =====================================================
  // CORRECCIÓN AUDITADA DE DETALLES DE RECEPCIÓN
  // =====================================================

  async correctReceiptDetail(
    detalleActaId: number,
    data: Omit<
      CorrectInventoryReceiptDetailData,
      'detalleActaId' | 'usuarioId'
    >,
    usuarioId: number,
  ) {
    return this.inventoryReceiptCorrectionRepository.correctReceiptDetail({
      detalleActaId,
      usuarioId,
      numeroLote: data.numeroLote,
      fechaVencimiento: data.fechaVencimiento,
      cantidadRecibida: data.cantidadRecibida,
      motivo: data.motivo,
      referencia: data.referencia,
    });
  }
}
