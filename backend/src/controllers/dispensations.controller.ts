import type { Response } from 'express';

import { FileInterceptor } from '@nestjs/platform-express';

import { DispensationDocumentsService } from '../dispensations/dispensation-documents.service';

import { DispensationSupportDto } from '../dto/dispensation-support.dto';

import {
  Body,
  Headers,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';

import { PrismaService } from '../prisma/prisma.service';

import { CreateDispensationDto } from '../dto/create-dispensation.dto';

import { ValidateDispensationDto } from '../dto/validate-dispensation.dto';

import { DispensationsService } from '../services/dispensations.service';
import { hasFunctionalTestAccess } from '../testing/functional-test-access.service';

type AuthenticatedRequest = {
  user?: {
    sub: number;

    email: string;

    nombre: string;
  };
};

@Controller('dispensations')
@UseGuards(JwtAuthGuard)
export class DispensationsController {
  constructor(
    private readonly dispensationsService: DispensationsService,

    private readonly prisma: PrismaService,

    private readonly documents: DispensationDocumentsService,
  ) {}

  // VALIDAR USUARIO Y PERMISOS DE DISPENSACIÓN

  private async requireDispensationAccess(
    req: AuthenticatedRequest,
    includeAdministrator = false,
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
        activo: true,

        rol: true,
      },
    });

    if (!usuario || !usuario.activo) {
      throw new ForbiddenException(
        'El usuario no existe o se encuentra inactivo',
      );
    }

    const rolesAutorizados = [
      'REGENTE_FARMACIA',

      'QUIMICO_FARMACEUTICO',

      'AUXILIAR_FARMACIA',
    ];

    if (includeAdministrator) {
      rolesAutorizados.push('ADMINISTRADOR');
    }

    if (
      !rolesAutorizados.includes(usuario.rol) &&
      !(await hasFunctionalTestAccess(this.prisma, usuarioId))
    ) {
      throw new ForbiddenException(
        'No tienes autorización para realizar operaciones de dispensación',
      );
    }

    return usuarioId;
  }

  // HU-022 - CONSULTAR MEDICAMENTOS A DISPENSAR

  @Get('patient/:numeroDocumento/medications')
  async getMedicationsToDispense(
    @Req() req: AuthenticatedRequest,

    @Param('numeroDocumento') numeroDocumento: string,
  ) {
    await this.requireDispensationAccess(req, true);

    return this.dispensationsService.getMedicationsToDispense(numeroDocumento);
  }

  // HU-023 Y HU-024 - VALIDAR ENTREGA Y EVITAR DOBLE DISPENSACIÓN

  @Post('validate')
  async validateDispensation(
    @Req() req: AuthenticatedRequest,

    @Body() dto: ValidateDispensationDto,
  ) {
    await this.requireDispensationAccess(req);

    return this.dispensationsService.validateDispensation(dto);
  }

  // HU-025 - REGISTRAR DISPENSACIÓN

  @Post()
  async createDispensation(
    @Req() req: AuthenticatedRequest,

    @Body() dto: CreateDispensationDto,

    @Headers('idempotency-key') key: string,
  ) {
    const usuarioId = await this.requireDispensationAccess(req);

    return this.dispensationsService.createDispensation(dto, usuarioId, key);
  }

  // HU-026 - GENERAR COMPROBANTE DE DISPENSACIÓN

  @Post(':id/receipt')
  async generateReceipt(
    @Req() req: AuthenticatedRequest,

    @Param('id', ParseIntPipe) dispensacionId: number,
  ) {
    const actor = await this.requireDispensationAccess(req);

    return this.documents.receipt(dispensacionId, actor);
  }

  // HU-027 - REGISTRAR FIRMA DEL PACIENTE

  @Post(':id/signature')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 10 * 1024 * 1024,
        files: 1,
        fields: 15,
        fieldSize: 4096,
      },
    }),
  )
  async registerSignature(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,

    @Body() dto: DispensationSupportDto,
    @UploadedFile() file?: { buffer: Buffer },
  ) {
    const actor = await this.requireDispensationAccess(req);

    return this.documents.support(id, dto, file?.buffer, actor, false);
  }

  @Post(':id/supports/corrections')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 10 * 1024 * 1024,
        files: 1,
        fields: 15,
        fieldSize: 4096,
      },
    }),
  )
  async correctSupport(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,

    @Body() dto: DispensationSupportDto,
    @UploadedFile() file?: { buffer: Buffer },
  ) {
    const actor = await this.requireDispensationAccess(req);

    return this.documents.support(id, dto, file?.buffer, actor, true);
  }

  @Get()
  async history(
    @Req() req: AuthenticatedRequest,
    @Query('documento') document = '',
    @Query('page') page = '1',
  ) {
    await this.requireDispensationAccess(req, true);

    return this.documents.history(document, Number(page));
  }

  @Get('requests/:key')
  async recover(@Req() req: AuthenticatedRequest, @Param('key') key: string) {
    const actor = await this.requireDispensationAccess(req, true);

    return this.documents.recover(key, actor);
  }

  @Get('reports/options')
  async reportOptions(@Req() req: AuthenticatedRequest) {
    await this.requireDispensationAccess(req, true);
    return this.documents.reportOptions();
  }

  @Get('reports')
  async report(
    @Req() req: AuthenticatedRequest,
    @Query() query: Record<string, string | undefined>,
  ) {
    await this.requireDispensationAccess(req, true);
    return this.documents.report(query);
  }

  @Get('reports/export/excel')
  async reportExcel(
    @Req() req: AuthenticatedRequest,
    @Query() query: Record<string, string | undefined>,
    @Res() res: Response,
  ) {
    await this.requireDispensationAccess(req, true);
    const file = await this.documents.reportExcel(query);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="Sistema007_Reporte_Dispensaciones.xlsx"',
    );
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(file);
  }

  @Get('reports/export/pdf')
  async reportPdf(
    @Req() req: AuthenticatedRequest,
    @Query() query: Record<string, string | undefined>,
    @Res() res: Response,
  ) {
    await this.requireDispensationAccess(req, true);
    const file = await this.documents.reportPdf(query);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="Sistema007_Reporte_Dispensaciones.pdf"',
    );
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(file);
  }

  @Get(':id/supports')
  async supports(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.requireDispensationAccess(req, true);

    return this.documents.detail(id);
  }

  @Get(':id/documents/:documentId')
  async download(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,

    @Param('documentId', ParseIntPipe) documentId: number,
    @Res() res: Response,
  ) {
    await this.requireDispensationAccess(req, true);

    const doc = await this.documents.download(id, documentId);

    res.setHeader('Content-Type', doc.mime);

    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${doc.filename}"`,
    );

    res.setHeader('Cache-Control', 'private, no-store');

    res.setHeader('X-Content-Type-Options', 'nosniff');

    res.send(doc.bytes);
  }

  @Get(':id')
  async detail(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.requireDispensationAccess(req, true);

    return this.documents.detail(id);
  }
}
