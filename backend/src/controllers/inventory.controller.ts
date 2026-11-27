import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Optional,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  ServiceUnavailableException,
  UploadedFile,
  UnauthorizedException,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';

import { CreateInventoryProductDto } from '../dto/create-inventory-product.dto';
import { CreateInventorySupplierDto } from '../dto/create-inventory-supplier.dto';
import { CreateInventoryReceiptDto } from '../dto/create-inventory-receipt.dto';
import { CreateWarehouseDto } from '../dto/create-warehouse.dto';
import { UpdateWarehouseDto } from '../dto/update-warehouse.dto';
import { InventoryExpirationQueryDto } from '../dto/inventory-expiration.dto';
import { ManageExpiredInventoryDto } from '../dto/manage-expired-inventory.dto';
import { ReviewInventoryReceiptDto } from '../dto/review-inventory-receipt.dto';
import { UpdateInventoryReceiptDto } from '../dto/update-inventory-receipt.dto';
import { ReevaluateInventoryReceiptDto } from '../dto/reevaluate-inventory-receipt.dto';

import {
  AdjustInventoryDto,
  AdjustInventoryBatchDto,
  TransferInventoryDto,
  TransferInventoryBatchDto,
} from '../dto/update-inventory.dto';

import { EstadoVerificacionInvima } from '../generated/prisma/client';
import { InventoryService } from '../services/inventory.service';
import { InventoryDocumentsService } from '../inventory/inventory-documents.service';
import { hasFunctionalTestAccess } from '../testing/functional-test-access.service';

type AuthenticatedRequest = {
  user?: {
    sub: number;
    email: string;
    nombre: string;
  };
};

type InventoryAuthorizedRole =
  | 'ADMINISTRADOR'
  | 'REGENTE_FARMACIA'
  | 'QUIMICO_FARMACEUTICO'
  | 'AUXILIAR_FARMACIA';

@Controller('inventory')
@UseGuards(JwtAuthGuard)
export class InventoryController {
  constructor(
    private readonly inventoryService: InventoryService,
    private readonly prisma: PrismaService,
    @Optional()
    private readonly inventoryDocumentsService?: InventoryDocumentsService,
  ) {}

  // =====================================================
  // VALIDACIÓN DE IDENTIDAD Y PERMISOS
  // =====================================================

  private async requireUserWithRoles(
    req: AuthenticatedRequest,
    allowedRoles: readonly InventoryAuthorizedRole[],
  ): Promise<number> {
    const usuarioId = req.user?.sub;

    if (!Number.isInteger(usuarioId) || !usuarioId || usuarioId <= 0) {
      throw new UnauthorizedException(
        'No se pudo identificar al usuario autenticado',
      );
    }

    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: {
        id: true,
        activo: true,
        rol: true,
      },
    });

    if (!usuario || !usuario.activo) {
      throw new ForbiddenException(
        'El usuario no existe o se encuentra inactivo',
      );
    }

    if (
      !allowedRoles.some((allowedRole) => allowedRole === usuario.rol) &&
      !(await hasFunctionalTestAccess(this.prisma, usuarioId))
    ) {
      throw new ForbiddenException(
        'No tienes autorización para realizar esta operación de inventario',
      );
    }

    return usuario.id;
  }

  private documents(): InventoryDocumentsService {
    if (!this.inventoryDocumentsService) {
      throw new ServiceUnavailableException(
        'La gestión documental de inventario no está disponible',
      );
    }
    return this.inventoryDocumentsService;
  }

  // Consulta de inventario:
  // Administrador, regente, químico y auxiliar.

  private async requireInventoryReader(
    req: AuthenticatedRequest,
  ): Promise<number> {
    return this.requireUserWithRoles(req, [
      'ADMINISTRADOR',
      'REGENTE_FARMACIA',
      'QUIMICO_FARMACEUTICO',
      'AUXILIAR_FARMACIA',
    ]);
  }

  // Gestión administrativa y operativa de inventario. El administrador
  // conserva trazabilidad mediante su propio usuario, sin alterar los roles
  // profesionales de los demás módulos.

  private async requireAuthorizedUser(
    req: AuthenticatedRequest,
  ): Promise<number> {
    return this.requireUserWithRoles(req, [
      'ADMINISTRADOR',
      'REGENTE_FARMACIA',
      'QUIMICO_FARMACEUTICO',
    ]);
  }

  // La administración de bodegas es una función administrativa; no habilita
  // recepciones, traslados, ajustes ni demás actos farmacéuticos.
  private async requireWarehouseManager(
    req: AuthenticatedRequest,
  ): Promise<number> {
    return this.requireUserWithRoles(req, [
      'ADMINISTRADOR',
      'REGENTE_FARMACIA',
      'QUIMICO_FARMACEUTICO',
    ]);
  }

  // Traslados normales:
  // Regente, químico y auxiliar de farmacia.

  private async requireNormalTransferUser(
    req: AuthenticatedRequest,
  ): Promise<number> {
    return this.requireUserWithRoles(req, [
      'ADMINISTRADOR',
      'REGENTE_FARMACIA',
      'QUIMICO_FARMACEUTICO',
      'AUXILIAR_FARMACIA',
    ]);
  }

  // =====================================================
  // PROVEEDORES
  // =====================================================

  @Get('suppliers')
  async getActiveSuppliers(@Req() req: AuthenticatedRequest) {
    await this.requireInventoryReader(req);

    return this.inventoryService.getActiveSuppliers();
  }

  @Post('suppliers')
  async createSupplier(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateInventorySupplierDto,
  ) {
    await this.requireAuthorizedUser(req);

    return this.inventoryService.createSupplier(dto);
  }

  // =====================================================
  // BODEGAS
  // =====================================================

  @Get('warehouses')
  async getActiveWarehouses(@Req() req: AuthenticatedRequest) {
    await this.requireInventoryReader(req);

    return this.inventoryService.getActiveWarehouses();
  }

  @Get('warehouses/management')
  async getWarehousesForAdministration(@Req() req: AuthenticatedRequest) {
    await this.requireWarehouseManager(req);
    return this.inventoryService.getWarehousesForAdministration();
  }

  @Get('sites')
  async getActiveSites(@Req() req: AuthenticatedRequest) {
    await this.requireWarehouseManager(req);
    return this.inventoryService.getActiveSites();
  }

  @Post('warehouses')
  async createWarehouse(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateWarehouseDto,
  ) {
    const usuarioId = await this.requireWarehouseManager(req);

    return this.inventoryService.createWarehouse(dto, usuarioId);
  }

  @Patch('warehouses/:id')
  async updateWarehouse(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateWarehouseDto,
  ) {
    await this.requireWarehouseManager(req);
    return this.inventoryService.updateWarehouse(id, dto);
  }

  // =====================================================
  // PRODUCTOS
  // =====================================================

  @Post('products')
  async createProduct(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateInventoryProductDto,
  ) {
    await this.requireAuthorizedUser(req);

    return this.inventoryService.createProduct(dto);
  }

  @Get('products')
  async getAllProducts(@Req() req: AuthenticatedRequest) {
    await this.requireInventoryReader(req);

    return this.inventoryService.getAllProducts();
  }

  // =====================================================
  // HISTORIAL DE RECEPCIONES
  // =====================================================

  @Get('receipts')
  async getAllReceipts(@Req() req: AuthenticatedRequest) {
    await this.requireInventoryReader(req);

    return this.inventoryService.getAllReceipts();
  }

  @Get('receipts/:id')
  async getReceiptById(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.requireInventoryReader(req);

    return this.inventoryService.getReceiptById(id);
  }

  // Documentos privados: se habilitan únicamente después de aplicar la
  // migración documental y definir INVENTORY_DOCUMENTS_ENABLED=true.
  @Get('movements/:id/documents')
  async getMovementDocuments(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.requireInventoryReader(req);
    return this.documents().listMovementDocuments(id);
  }

  @Post('movements/:id/receipt')
  async createMovementReceipt(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const usuarioId = await this.requireAuthorizedUser(req);
    return this.documents().createMovementReceipt(id, usuarioId);
  }

  @Get('receipts/:id/documents')
  async getReceiptDocuments(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.requireInventoryReader(req);
    return this.documents().listReceiptDocuments(id);
  }

  @Post('receipts/:id/invoice')
  @UseInterceptors(
    FileInterceptor('archivo', {
      limits: { fileSize: 10 * 1024 * 1024, files: 1 },
    }),
  )
  async attachReceiptInvoice(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() archivo: { buffer: Buffer; mimetype: string; size: number },
  ) {
    const usuarioId = await this.requireAuthorizedUser(req);
    return this.documents().attachReceiptInvoice(id, usuarioId, archivo);
  }

  @Get('receipts/corrections/:id/documents')
  async getReceiptCorrectionDocuments(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.requireInventoryReader(req);
    return this.documents().listReceiptCorrectionDocuments(id);
  }

  @Post('receipts/corrections/:id/documents')
  @UseInterceptors(
    FileInterceptor('archivo', {
      limits: { fileSize: 10 * 1024 * 1024, files: 1 },
    }),
  )
  async attachReceiptCorrectionSupport(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() archivo: { buffer: Buffer; mimetype: string; size: number },
  ) {
    const usuarioId = await this.requireAuthorizedUser(req);
    return this.documents().attachReceiptCorrectionSupport(id, usuarioId, archivo);
  }

  @Get('documents/:id/download')
  async downloadInventoryDocument(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ) {
    await this.requireInventoryReader(req);
    const document = await this.documents().download(id);
    res.setHeader('Content-Type', document.mime);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${document.filename}"`,
    );
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Document-SHA256', document.sha256);
    res.send(document.bytes);
  }

  @Post('documents/maintenance/orphans')
  async auditInventoryDocumentOrphans(
    @Req() req: AuthenticatedRequest,
    @Query('cleanup') cleanup?: string,
  ) {
    await this.requireAuthorizedUser(req);
    if (cleanup !== undefined && cleanup !== 'true' && cleanup !== 'false') {
      throw new ForbiddenException(
        'El parámetro cleanup debe ser true o false',
      );
    }
    return this.documents().auditOrphanFiles(cleanup === 'true');
  }

  // =====================================================
  // REGISTRO DE RECEPCIÓN POR FACTURA
  // =====================================================

  @Post('receipts')
  async registerReceipt(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateInventoryReceiptDto,
  ) {
    const usuarioId = await this.requireAuthorizedUser(req);

    return this.inventoryService.registerReceipt(dto, usuarioId);
  }

  // =====================================================
  // REVISIÓN INICIAL DE PRODUCTOS PENDIENTES
  // =====================================================

  @Patch('receipts/:id/review')
  async reviewReceipt(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReviewInventoryReceiptDto,
  ) {
    const usuarioId = await this.requireAuthorizedUser(req);

    return this.inventoryService.reviewReceipt(id, dto, usuarioId);
  }

  // =====================================================
  // MODIFICAR INFORMACIÓN ADMINISTRATIVA
  // =====================================================

  @Patch('receipts/:id')
  async updateReceipt(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateInventoryReceiptDto,
  ) {
    await this.requireAuthorizedUser(req);

    return this.inventoryService.updateReceipt(id, dto);
  }

  // =====================================================
  // CONSULTA DE VENCIMIENTOS
  // =====================================================

  @Get('expirations')
  async getExpirations(
    @Req() req: AuthenticatedRequest,
    @Query() dto: InventoryExpirationQueryDto,
  ) {
    await this.requireInventoryReader(req);

    return this.inventoryService.getExpirations(dto.dias ?? 90);
  }

  // =====================================================
  // TRASLADO INDIVIDUAL DE INVENTARIO
  // =====================================================

  @Post('transfers')
  async transferInventory(
    @Req() req: AuthenticatedRequest,
    @Body() dto: TransferInventoryDto,
  ) {
    const usuarioId = await this.requireNormalTransferUser(req);

    return this.inventoryService.transferInventory(dto, usuarioId);
  }

  // =====================================================
  // TRASLADO MÚLTIPLE DE INVENTARIO
  // =====================================================

  @Post('transfers/batch')
  async transferInventoryBatch(
    @Req() req: AuthenticatedRequest,
    @Body() dto: TransferInventoryBatchDto,
  ) {
    const usuarioId = await this.requireNormalTransferUser(req);

    return this.inventoryService.transferInventoryBatch(dto, usuarioId);
  }

  // =====================================================
  // TRASLADO A PRODUCTOS NO CONFORMES
  // =====================================================

  @Post('transfers/non-conforming')
  async transferToNonConforming(
    @Req() req: AuthenticatedRequest,
    @Body()
    data: {
      loteId: number;
      bodegaOrigenId: number;
      bodegaDestinoId: number;
      cantidad: number;
      motivo: string;
      referencia?: string;
      observaciones?: string;
    },
  ) {
    const usuarioId = await this.requireAuthorizedUser(req);

    return this.inventoryService.transferToNonConforming(data, usuarioId);
  }

  // =====================================================
  // AJUSTE INDIVIDUAL DE INVENTARIO
  // =====================================================

  @Post('adjustments')
  async adjustInventory(
    @Req() req: AuthenticatedRequest,
    @Body() dto: AdjustInventoryDto,
  ) {
    if (process.env.INVENTORY_DOCUMENTS_ENABLED === 'true') {
      throw new ForbiddenException(
        'Los ajustes documentales deben registrarse mediante el formulario con soporte obligatorio',
      );
    }
    const usuarioId = await this.requireAuthorizedUser(req);

    return this.inventoryService.adjustInventory(dto, usuarioId);
  }

  // =====================================================
  // AJUSTE MÚLTIPLE POR CONTEO FÍSICO
  // =====================================================

  @Post('adjustments/batch')
  async adjustInventoryBatch(
    @Req() req: AuthenticatedRequest,
    @Body() dto: AdjustInventoryBatchDto,
  ) {
    if (process.env.INVENTORY_DOCUMENTS_ENABLED === 'true') {
      throw new ForbiddenException(
        'Los ajustes documentales deben registrarse mediante el formulario con soporte obligatorio',
      );
    }
    const usuarioId = await this.requireAuthorizedUser(req);

    return this.inventoryService.adjustInventoryBatch(dto, usuarioId);
  }

  @Post('adjustments/batch/documented')
  @UseInterceptors(
    FileInterceptor('soporte', {
      limits: { fileSize: 10 * 1024 * 1024, files: 1 },
    }),
  )
  async adjustInventoryBatchDocumented(
    @Req() req: AuthenticatedRequest,
    @Body('datos') datos: string,
    @UploadedFile() soporte: { buffer: Buffer; mimetype: string; size: number },
  ) {
    const usuarioId = await this.requireAuthorizedUser(req);
    let dto: AdjustInventoryBatchDto;
    try {
      dto = JSON.parse(datos) as AdjustInventoryBatchDto;
    } catch {
      throw new ForbiddenException(
        'Los datos del ajuste no tienen un formato válido',
      );
    }
    if (!dto.motivo?.trim() || !soporte) {
      throw new ForbiddenException(
        'Todo ajuste requiere justificación escrita y soporte documental',
      );
    }
    const documento = await this.documents().prepareAdjustmentSupport(soporte);
    return this.inventoryService.adjustInventoryBatch(
      dto,
      usuarioId,
      documento,
    );
  }

  @Post('adjustments/documented')
  @UseInterceptors(
    FileInterceptor('soporte', {
      limits: { fileSize: 10 * 1024 * 1024, files: 1 },
    }),
  )
  async adjustInventoryDocumented(
    @Req() req: AuthenticatedRequest,
    @Body('datos') datos: string,
    @UploadedFile() soporte: { buffer: Buffer; mimetype: string; size: number },
  ) {
    const usuarioId = await this.requireAuthorizedUser(req);
    let dto: AdjustInventoryDto;
    try {
      dto = JSON.parse(datos) as AdjustInventoryDto;
    } catch {
      throw new ForbiddenException(
        'Los datos del ajuste no tienen un formato válido',
      );
    }
    if (!dto.motivo?.trim() || !soporte) {
      throw new ForbiddenException(
        'Todo ajuste requiere justificación escrita y soporte documental',
      );
    }
    const documento = await this.documents().prepareAdjustmentSupport(soporte);
    return this.inventoryService.adjustInventory(dto, usuarioId, documento);
  }

  // =====================================================
  // GESTIÓN DE PRODUCTOS VENCIDOS
  // =====================================================

  @Post('expired/manage')
  async manageExpiredInventory(
    @Req() req: AuthenticatedRequest,
    @Body() dto: ManageExpiredInventoryDto,
  ) {
    const usuarioId = await this.requireAuthorizedUser(req);

    return this.inventoryService.manageExpiredInventory(dto, usuarioId);
  }

  // =====================================================
  // CONSULTA DE PRODUCTOS NO CONFORMES
  // =====================================================

  @Get('non-conforming')
  async getNonConformingProducts(@Req() req: AuthenticatedRequest) {
    await this.requireInventoryReader(req);

    return this.inventoryService.getNonConformingProducts();
  }

  @Get('non-conforming/:id')
  async getNonConformingManagementById(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.requireInventoryReader(req);

    return this.inventoryService.getNonConformingManagementById(id);
  }

  // =====================================================
  // CUSTODIA DE PRODUCTOS NO CONFORMES
  // =====================================================

  @Post('non-conforming/custody')
  async registerNonConformingCustody(
    @Req() req: AuthenticatedRequest,
    @Body()
    data: {
      detalleActaRecepcionId: number;
      bodegaId: number;
      motivo: string;
      observaciones?: string;
    },
  ) {
    const usuarioId = await this.requireAuthorizedUser(req);

    return this.inventoryService.registerNonConformingCustody(data, usuarioId);
  }

  // =====================================================
  // DEVOLUCIÓN AL PROVEEDOR
  // =====================================================

  @Post('non-conforming/:id/return')
  async returnNonConformingToSupplier(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body()
    data: {
      motivo: string;
      referencia: string;
      tipoDisposicion?: 'DEVOLUCION_PROVEEDOR' | 'CAMBIO_FISICO';
      observaciones?: string;
    },
  ) {
    const usuarioId = await this.requireAuthorizedUser(req);

    return this.inventoryService.returnNonConformingToSupplier(
      id,
      data,
      usuarioId,
    );
  }

  // =====================================================
  // REINTEGRO DESDE CUSTODIA
  // =====================================================

  @Post('non-conforming/:id/reintegrate')
  async reintegrateNonConformingProduct(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body()
    data: {
      bodegaDestinoId: number;
      motivo: string;
      referencia: string;
      observaciones?: string;
    },
  ) {
    const usuarioId = await this.requireAuthorizedUser(req);

    return this.inventoryService.reintegrateNonConformingProduct(
      id,
      data,
      usuarioId,
    );
  }

  // =====================================================
  // REEVALUACIÓN TÉCNICA
  // =====================================================

  @Patch('receipts/details/:id/reevaluate')
  async reevaluateReceiptProduct(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() data: ReevaluateInventoryReceiptDto,
  ) {
    const usuarioId = await this.requireAuthorizedUser(req);

    return this.inventoryService.reevaluateReceiptProduct(id, data, usuarioId);
  }

  // =====================================================
  // CORRECCIÓN DOCUMENTAL DE VERIFICACIÓN TÉCNICA
  // =====================================================

  @Patch('receipts/details/:id/verification')
  async editReceiptVerification(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body()
    data: {
      estadoVerificacionInvima: EstadoVerificacionInvima;
      temperaturaRegistrada: number | null;
      humedadRegistrada: number | null;
      observaciones: string | null;
      motivo: string;
      referencia: string;
    },
  ) {
    const usuarioId = await this.requireAuthorizedUser(req);

    return this.inventoryService.editReceiptVerification(id, data, usuarioId);
  }

  // =====================================================
  // CORRECCIÓN AUDITADA DE DATOS DE RECEPCIÓN
  // =====================================================

  @Patch('receipts/details/:id/correction')
  async correctReceiptDetail(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body()
    data: {
      numeroLote?: string;
      fechaVencimiento?: string;
      cantidadRecibida?: number;
      motivo: string;
      referencia: string;
    },
  ) {
    const usuarioId = await this.requireAuthorizedUser(req);

    return this.inventoryService.correctReceiptDetail(id, data, usuarioId);
  }
}
