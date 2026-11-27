import {
  Controller,
  ForbiddenException,
  Get,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import {
  InventoryMovementsService,
  type InventoryReportQuery,
} from '../services/inventory-movements.service';
import { hasFunctionalTestAccess } from '../testing/functional-test-access.service';

type AuthenticatedRequest = {
  user?: {
    sub: number;
    email: string;
    nombre: string;
  };
};

@Controller('inventory')
@UseGuards(JwtAuthGuard)
export class InventoryMovementsController {
  constructor(
    private readonly movementsService: InventoryMovementsService,
    private readonly prisma: PrismaService,
  ) {}

  // VALIDAR ACCESO A REPORTES DE INVENTARIO

  private async requireReportAccess(req: AuthenticatedRequest): Promise<void> {
    const usuarioId = req.user?.sub;

    if (!Number.isInteger(usuarioId) || !usuarioId || usuarioId <= 0) {
      throw new UnauthorizedException(
        'No se pudo identificar al usuario autenticado',
      );
    }

    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: {
        activo: true,
        rol: true,
      },
    });

    if (!usuario || !usuario.activo) {
      throw new ForbiddenException(
        'El usuario no existe o se encuentra inactivo',
      );
    }

    const allowedRoles = [
      'ADMINISTRADOR',
      'REGENTE_FARMACIA',
      'QUIMICO_FARMACEUTICO',
      'AUXILIAR_FARMACIA',
    ];

    if (
      !allowedRoles.includes(usuario.rol) &&
      !(await hasFunctionalTestAccess(this.prisma, usuarioId))
    ) {
      throw new ForbiddenException(
        'No tienes autorización para consultar reportes de inventario',
      );
    }
  }

  // CONSULTAR MOVIMIENTOS

  @Get('movements')
  async getMovements(
    @Req() req: AuthenticatedRequest,
    @Query() query: InventoryReportQuery,
  ) {
    await this.requireReportAccess(req);

    return this.movementsService.getMovements(query);
  }

  // EXPORTAR MOVIMIENTOS CSV

  @Get('movements/export')
  async exportMovements(
    @Req() req: AuthenticatedRequest,
    @Query() query: InventoryReportQuery,
    @Res() res: Response,
  ) {
    await this.requireReportAccess(req);

    const csv = await this.movementsService.exportMovements(query);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');

    res.setHeader(
      'Content-Disposition',
      'attachment; filename="movimientos-inventario.csv"',
    );

    res.send(csv);
  }

  // EXPORTAR MOVIMIENTOS EXCEL

  @Get('movements/export/excel')
  async exportMovementsExcel(
    @Req() req: AuthenticatedRequest,
    @Query() query: InventoryReportQuery,
    @Res() res: Response,
  ) {
    await this.requireReportAccess(req);

    const excel = await this.movementsService.exportMovementsExcel(query);

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );

    res.setHeader(
      'Content-Disposition',
      'attachment; filename="Sistema007_Movimientos.xlsx"',
    );

    res.send(excel);
  }

  // CONSULTAR EXISTENCIAS

  @Get('stock-report')
  async getStockReport(
    @Req() req: AuthenticatedRequest,
    @Query() query: InventoryReportQuery,
  ) {
    await this.requireReportAccess(req);

    return this.movementsService.getStockReport(query);
  }

  // EXPORTAR EXISTENCIAS CSV

  @Get('stock-report/export')
  async exportStockReport(
    @Req() req: AuthenticatedRequest,
    @Query() query: InventoryReportQuery,
    @Res() res: Response,
  ) {
    await this.requireReportAccess(req);

    const csv = await this.movementsService.exportStock(query);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');

    res.setHeader(
      'Content-Disposition',
      'attachment; filename="existencias-inventario.csv"',
    );

    res.send(csv);
  }

  // EXPORTAR EXISTENCIAS EXCEL

  @Get('stock-report/export/excel')
  async exportStockExcel(
    @Req() req: AuthenticatedRequest,
    @Query() query: InventoryReportQuery,
    @Res() res: Response,
  ) {
    await this.requireReportAccess(req);

    const excel = await this.movementsService.exportStockExcel(query);

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );

    res.setHeader(
      'Content-Disposition',
      'attachment; filename="Sistema007_Existencias.xlsx"',
    );

    res.send(excel);
  }
}
