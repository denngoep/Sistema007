import { BadRequestException, Injectable } from '@nestjs/common';
import { Workbook, type Worksheet } from 'exceljs';

import { TipoMovimientoInventario } from '../generated/prisma/client';

import {
  InventoryMovementsRepository,
  type InventoryMovementFilters,
  type InventoryStockFilters,
} from '../repositories/inventory-movements.repository';

export type InventoryReportQuery = {
  busqueda?: string;
  tipo?: string;
  sedeId?: string;
  bodegaId?: string;
  productoId?: string;
  loteId?: string;
  usuarioId?: string;
  fechaInicio?: string;
  fechaFin?: string;
  pagina?: string;
  limite?: string;
  soloConExistencia?: string;
};

type ExcelValue = string | number | Date | null | undefined;

@Injectable()
export class InventoryMovementsService {
  constructor(private readonly repository: InventoryMovementsRepository) {}

  // VALIDACIONES

  private positiveInteger(
    value: string | undefined,
    field: string,
  ): number | undefined {
    if (value === undefined || value.trim() === '') {
      return undefined;
    }

    const number = Number(value);

    if (!Number.isSafeInteger(number) || number <= 0) {
      throw new BadRequestException(
        `${field} debe ser un número entero positivo`,
      );
    }

    return number;
  }

  private pagination(query: InventoryReportQuery) {
    const pagina = this.positiveInteger(query.pagina, 'pagina') ?? 1;

    const limite = this.positiveInteger(query.limite, 'limite') ?? 25;

    if (limite > 100) {
      throw new BadRequestException('El límite máximo por página es 100');
    }

    return { pagina, limite };
  }

  private parseDate(
    value: string | undefined,
    endOfDay = false,
  ): Date | undefined {
    if (!value) return undefined;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new BadRequestException(
        'Las fechas deben tener el formato AAAA-MM-DD',
      );
    }

    const date = new Date(
      `${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}-05:00`,
    );

    if (
      Number.isNaN(date.getTime()) ||
      new Date(date.getTime() - 5 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10) !== value
    ) {
      throw new BadRequestException(`La fecha ${value} no es válida`);
    }

    return date;
  }

  // FILTROS DE MOVIMIENTOS

  private movementFilters(
    query: InventoryReportQuery,
  ): InventoryMovementFilters {
    let tipo: TipoMovimientoInventario | undefined;

    if (query.tipo && query.tipo !== 'TODOS') {
      if (
        !Object.values(TipoMovimientoInventario).includes(
          query.tipo as TipoMovimientoInventario,
        )
      ) {
        throw new BadRequestException('El tipo de movimiento no es válido');
      }

      tipo = query.tipo as TipoMovimientoInventario;
    }

    const fechaInicio = this.parseDate(query.fechaInicio);
    const fechaFin = this.parseDate(query.fechaFin, true);

    if (fechaInicio && fechaFin && fechaInicio.getTime() > fechaFin.getTime()) {
      throw new BadRequestException(
        'La fecha inicial no puede superar la fecha final',
      );
    }

    return {
      busqueda: query.busqueda?.trim(),
      tipo,
      sedeId: this.positiveInteger(query.sedeId, 'sedeId'),
      bodegaId: this.positiveInteger(query.bodegaId, 'bodegaId'),
      productoId: this.positiveInteger(query.productoId, 'productoId'),
      loteId: this.positiveInteger(query.loteId, 'loteId'),
      usuarioId: this.positiveInteger(query.usuarioId, 'usuarioId'),
      fechaInicio,
      fechaFin,
    };
  }

  // FILTROS DE EXISTENCIAS

  private stockFilters(query: InventoryReportQuery): InventoryStockFilters {
    if (
      query.soloConExistencia !== undefined &&
      !['true', 'false'].includes(query.soloConExistencia)
    ) {
      throw new BadRequestException('soloConExistencia debe ser true o false');
    }

    return {
      busqueda: query.busqueda?.trim(),
      sedeId: this.positiveInteger(query.sedeId, 'sedeId'),
      bodegaId: this.positiveInteger(query.bodegaId, 'bodegaId'),
      productoId: this.positiveInteger(query.productoId, 'productoId'),
      loteId: this.positiveInteger(query.loteId, 'loteId'),
      soloConExistencia: query.soloConExistencia !== 'false',
    };
  }

  // CONSULTAR MOVIMIENTOS

  async getMovements(query: InventoryReportQuery) {
    const filters = this.movementFilters(query);
    const { pagina, limite } = this.pagination(query);

    return this.repository.findMovements(filters, pagina, limite);
  }

  // CONSULTAR EXISTENCIAS

  async getStockReport(query: InventoryReportQuery) {
    const filters = this.stockFilters(query);
    const { pagina, limite } = this.pagination(query);

    return this.repository.findStockReport(filters, pagina, limite);
  }

  // PROTECCIÓN DE VALORES CSV

  private csvCell(value: unknown): string {
    if (value === null || value === undefined) return '';

    let text: string;

    if (typeof value === 'string') {
      text = value;
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      text = String(value);
    } else if (value instanceof Date) {
      text = value.toISOString();
    } else {
      text = '';
    }

    if (/^[\s]*[=+\-@\t\r]/.test(text)) {
      text = `'${text}`;
    }

    return `"${text.replace(/"/g, '""')}"`;
  }

  private buildCsv(rows: unknown[][]): string {
    return (
      '\uFEFF' +
      rows
        .map((row) => row.map((cell) => this.csvCell(cell)).join(';'))
        .join('\r\n')
    );
  }

  // EXPORTAR MOVIMIENTOS CSV

  async exportMovements(query: InventoryReportQuery) {
    const movements = await this.repository.findMovementsForExport(
      this.movementFilters(query),
    );

    const rows: unknown[][] = [
      [
        'ID',
        'Fecha',
        'Tipo',
        'Código interno',
        'Producto',
        'Lote',
        'Vencimiento',
        'Cantidad',
        'Sede origen',
        'Bodega origen',
        'Sede destino',
        'Bodega destino',
        'Responsable',
        'Motivo',
        'Referencia',
        'Ingreso',
        'Dispensación',
      ],
    ];

    for (const movement of movements) {
      const product = movement.lote.productoInventario;

      rows.push([
        movement.id,
        movement.fechaMovimiento.toISOString(),
        movement.tipo,
        product.codigoInterno,
        product.descripcion,
        movement.lote.numeroLote,
        movement.lote.fechaVencimiento.toISOString().slice(0, 10),
        movement.cantidad,
        movement.bodegaOrigen?.sede.nombre,
        movement.bodegaOrigen?.nombre,
        movement.bodegaDestino?.sede.nombre,
        movement.bodegaDestino?.nombre,
        movement.usuario.nombre,
        movement.motivo,
        movement.referencia,
        movement.ingresoInventario?.numeroIngreso,
        movement.dispensacion?.numeroDispensacion,
      ]);
    }

    return this.buildCsv(rows);
  }

  // EXPORTAR EXISTENCIAS CSV

  async exportStock(query: InventoryReportQuery) {
    const stock = await this.repository.findStockForExport(
      this.stockFilters(query),
    );

    const rows: unknown[][] = [
      [
        'Código interno',
        'Producto',
        'Lote',
        'Fecha vencimiento',
        'Estado lote',
        'Sede',
        'Bodega',
        'Tipo bodega',
        'Cantidad',
      ],
    ];

    for (const item of stock) {
      const product = item.lote.productoInventario;

      rows.push([
        product.codigoInterno,
        product.descripcion,
        item.lote.numeroLote,
        item.lote.fechaVencimiento.toISOString().slice(0, 10),
        item.lote.estado,
        item.bodega.sede.nombre,
        item.bodega.nombre,
        item.bodega.tipo,
        item.cantidad,
      ]);
    }

    return this.buildCsv(rows);
  }

  // ENCABEZADO EXCEL SIN IMÁGENES

  private styleWorksheet(
    worksheet: Worksheet,
    title: string,
    headers: string[],
    reportType: string,
  ): void {
    const totalColumns = headers.length;
    const lastColumn = worksheet.getColumn(totalColumns).letter;

    const navy = 'FF062B55';
    const teal = 'FF00AEBC';
    const white = 'FFFFFFFF';
    const light = 'FFE6F7F9';

    const fecha = new Intl.DateTimeFormat('es-CO', {
      timeZone: 'America/Bogota',
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date());

    // FILAS
    // 1 Y 2: ENCABEZADO AZUL
    // 3: INFORMACIÓN
    // 4: TÍTULOS DE LA TABLA

    worksheet.getRow(1).height = 48;
    worksheet.getRow(2).height = 48;
    worksheet.getRow(3).height = 35;
    worksheet.getRow(4).height = 38;

    // FONDO AZUL EN TODO EL ENCABEZADO

    for (let row = 1; row <= 2; row++) {
      for (let col = 1; col <= totalColumns; col++) {
        worksheet.getRow(row).getCell(col).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: navy },
        };
      }
    }

    // TÍTULO CENTRADO EN TODO EL ANCHO

    worksheet.mergeCells(`A1:${lastColumn}1`);

    const titleCell = worksheet.getCell('A1');
    titleCell.value = title;

    titleCell.font = {
      name: 'Arial',
      size: 24,
      bold: true,
      color: { argb: white },
    };

    titleCell.alignment = {
      horizontal: 'center',
      vertical: 'middle',
      wrapText: true,
    };

    // SUBTÍTULO CENTRADO

    worksheet.mergeCells(`A2:${lastColumn}2`);

    const subtitleCell = worksheet.getCell('A2');

    subtitleCell.value = 'Sistema de Gestión y Dispensación de Medicamentos';

    subtitleCell.font = {
      name: 'Arial',
      size: 12,
      color: { argb: white },
    };

    subtitleCell.alignment = {
      horizontal: 'center',
      vertical: 'middle',
      wrapText: true,
    };

    // FILA 3: INFORMACIÓN DEL REPORTE

    for (let col = 1; col <= totalColumns; col++) {
      const cell = worksheet.getRow(3).getCell(col);

      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: light },
      };

      cell.border = {
        top: {
          style: 'medium',
          color: { argb: teal },
        },
      };
    }

    const firstEnd = Math.floor(totalColumns / 3);
    const secondEnd = Math.floor((totalColumns * 2) / 3);

    const firstEndLetter = worksheet.getColumn(firstEnd).letter;

    const secondStartLetter = worksheet.getColumn(firstEnd + 1).letter;

    const secondEndLetter = worksheet.getColumn(secondEnd).letter;

    const thirdStartLetter = worksheet.getColumn(secondEnd + 1).letter;

    worksheet.mergeCells(`A3:${firstEndLetter}3`);

    worksheet.mergeCells(`${secondStartLetter}3:${secondEndLetter}3`);

    worksheet.mergeCells(`${thirdStartLetter}3:${lastColumn}3`);

    const infoCells = [
      worksheet.getCell('A3'),
      worksheet.getCell(`${secondStartLetter}3`),
      worksheet.getCell(`${thirdStartLetter}3`),
    ];

    infoCells[0].value = `Fecha de generación: ${fecha}`;

    infoCells[1].value = 'Origen: Sistema 007';

    infoCells[2].value = `Tipo de reporte: ${reportType}`;

    for (const cell of infoCells) {
      cell.font = {
        name: 'Arial',
        size: 11,
        bold: true,
        color: { argb: navy },
      };

      cell.alignment = {
        horizontal: 'center',
        vertical: 'middle',
        wrapText: true,
      };
    }

    // FILA 4: ENCABEZADOS DE LA TABLA

    const headerRow = worksheet.getRow(4);
    headerRow.values = headers;

    headerRow.eachCell((cell) => {
      cell.font = {
        name: 'Arial',
        size: 11,
        bold: true,
        color: { argb: white },
      };

      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF008F9C' },
      };

      cell.alignment = {
        horizontal: 'center',
        vertical: 'middle',
        wrapText: true,
      };

      cell.border = {
        bottom: {
          style: 'medium',
          color: { argb: navy },
        },
      };
    });

    // CONGELAR LAS CUATRO PRIMERAS FILAS

    worksheet.views = [
      {
        state: 'frozen',
        ySplit: 4,
      },
    ];
  }

  // PROTEGER VALORES DE EXCEL

  private safeExcelValue(value: ExcelValue): string | number | Date | null {
    if (value === undefined || value === null) {
      return null;
    }

    if (typeof value === 'string' && /^[\s]*[=+\-@\t\r]/.test(value)) {
      return `'${value}`;
    }

    return value;
  }

  // AGREGAR FILAS DE DATOS

  private addExcelRow(worksheet: Worksheet, values: ExcelValue[]): void {
    const row = worksheet.addRow(
      values.map((value) => this.safeExcelValue(value)),
    );

    row.height = 26;

    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.font = {
        name: 'Arial',
        size: 10,
        color: { argb: 'FF263445' },
      };

      cell.alignment = {
        vertical: 'middle',
        horizontal: 'left',
        wrapText: false,
      };

      if (row.number % 2 === 0) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF1F7FA' },
        };
      }
    });
  }

  // FINALIZAR EXCEL

  private async finishExcel(
    workbook: Workbook,
    worksheet: Worksheet,
    columnCount: number,
  ): Promise<Buffer> {
    const lastRow = Math.max(worksheet.rowCount, 4);

    worksheet.autoFilter = {
      from: {
        row: 4,
        column: 1,
      },
      to: {
        row: lastRow,
        column: columnCount,
      },
    };

    worksheet.pageSetup = {
      orientation: 'landscape',
      paperSize: 9,
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    };

    worksheet.pageSetup.printTitlesRow = '1:4';

    const data = await workbook.xlsx.writeBuffer();

    return Buffer.from(data);
  }

  // EXPORTAR MOVIMIENTOS EXCEL

  async exportMovementsExcel(query: InventoryReportQuery): Promise<Buffer> {
    const movements = await this.repository.findMovementsForExport(
      this.movementFilters(query),
    );

    const workbook = new Workbook();

    workbook.creator = 'Sistema 007';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('Movimientos');

    const headers = [
      'ID',
      'Fecha',
      'Tipo',
      'Código interno',
      'Producto',
      'Lote',
      'Vencimiento',
      'Cantidad',
      'Sede origen',
      'Bodega origen',
      'Sede destino',
      'Bodega destino',
      'Responsable',
      'Motivo',
      'Referencia',
      'Ingreso',
      'Dispensación',
    ];

    const widths = [
      12, 24, 28, 20, 48, 22, 20, 16, 30, 30, 30, 30, 32, 42, 36, 22, 22,
    ];

    widths.forEach((width, index) => {
      worksheet.getColumn(index + 1).width = width;
    });

    this.styleWorksheet(
      worksheet,
      'REPORTE DE MOVIMIENTOS',
      headers,
      'Movimientos',
    );

    for (const movement of movements) {
      const product = movement.lote.productoInventario;

      this.addExcelRow(worksheet, [
        movement.id,
        movement.fechaMovimiento,
        movement.tipo,
        product.codigoInterno,
        product.descripcion,
        movement.lote.numeroLote,
        movement.lote.fechaVencimiento,
        movement.cantidad,
        movement.bodegaOrigen?.sede.nombre,
        movement.bodegaOrigen?.nombre,
        movement.bodegaDestino?.sede.nombre,
        movement.bodegaDestino?.nombre,
        movement.usuario.nombre,
        movement.motivo,
        movement.referencia,
        movement.ingresoInventario?.numeroIngreso,
        movement.dispensacion?.numeroDispensacion,
      ]);
    }

    worksheet.getColumn(2).numFmt = 'dd/mm/yyyy hh:mm';

    worksheet.getColumn(7).numFmt = 'dd/mm/yyyy';

    worksheet.getColumn(8).numFmt = '#,##0';

    return this.finishExcel(workbook, worksheet, headers.length);
  }

  // EXPORTAR EXISTENCIAS EXCEL

  async exportStockExcel(query: InventoryReportQuery): Promise<Buffer> {
    const stock = await this.repository.findStockForExport(
      this.stockFilters(query),
    );

    const workbook = new Workbook();

    workbook.creator = 'Sistema 007';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('Existencias');

    const headers = [
      'Código interno',
      'Producto',
      'Lote',
      'Fecha vencimiento',
      'Estado lote',
      'Sede',
      'Bodega',
      'Tipo bodega',
      'Cantidad',
    ];

    const widths = [22, 48, 24, 24, 24, 32, 32, 28, 18];

    widths.forEach((width, index) => {
      worksheet.getColumn(index + 1).width = width;
    });

    this.styleWorksheet(
      worksheet,
      'REPORTE DE EXISTENCIAS',
      headers,
      'Existencias',
    );

    for (const item of stock) {
      const product = item.lote.productoInventario;

      this.addExcelRow(worksheet, [
        product.codigoInterno,
        product.descripcion,
        item.lote.numeroLote,
        item.lote.fechaVencimiento,
        item.lote.estado,
        item.bodega.sede.nombre,
        item.bodega.nombre,
        item.bodega.tipo,
        item.cantidad,
      ]);
    }

    worksheet.getColumn(4).numFmt = 'dd/mm/yyyy';

    worksheet.getColumn(9).numFmt = '#,##0';

    return this.finishExcel(workbook, worksheet, headers.length);
  }
}
