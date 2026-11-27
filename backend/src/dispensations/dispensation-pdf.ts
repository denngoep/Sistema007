import { BadRequestException } from '@nestjs/common';
import {
  PDFDocument,
  rgb,
  StandardFonts,
  type PDFFont,
  type PDFPage,
} from 'pdf-lib';
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const navy = rgb(6 / 255, 43 / 255, 85 / 255);
const turquoise = rgb(0 / 255, 174 / 255, 188 / 255);
const ink = rgb(23 / 255, 50 / 255, 77 / 255);
const muted = rgb(101 / 255, 123 / 255, 138 / 255);
const pale = rgb(244 / 255, 247 / 255, 250 / 255);
const line = rgb(220 / 255, 229 / 255, 237 / 255);
const white = rgb(1, 1, 1);

const pageWidth = 595.28;
const pageHeight = 841.89;
const margin = 40;
const contentWidth = pageWidth - margin * 2;

type ReceiptMedication = {
  numeroIngreso?: unknown;
  formulacionId?: unknown;
  codigoInterno?: unknown;
  codigoBarras?: unknown;
  medicamento?: unknown;
  concentracion?: unknown;
  formaFarmaceutica?: unknown;
  numeroLote?: unknown;
  fechaVencimiento?: unknown;
  cantidadEntregada?: unknown;
};

type ReceiptSnapshot = {
  numeroComprobante?: unknown;
  fechaComprobante?: unknown;
  numeroDispensacion?: unknown;
  fechaDispensacion?: unknown;
  paciente?: Record<string, unknown>;
  sede?: unknown;
  bodega?: unknown;
  dispensadoPor?: Record<string, unknown>;
  medicamentos?: ReceiptMedication[];
};

function text(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return 'No registrado';
  }

  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return String(value);
  if (typeof value === 'bigint') return String(value);
  if (value instanceof Date) return value.toISOString();

  return 'No registrado';
}

function safe(value: unknown): string {
  return Array.from(text(value))
    .map((char) => (char.charCodeAt(0) <= 255 ? char : '?'))
    .join('');
}

function formatDate(value: unknown, withTime = false): string {
  if (value === null || value === undefined || value === '') {
    return 'No registrada';
  }

  // Las fechas de vencimiento son fechas calendario.
  // Una cadena YYYY-MM-DD no debe cambiar de día por la zona horaria.
  if (!withTime && typeof value === 'string') {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

    if (match) {
      const year = Number(match[1]);
      const month = Number(match[2]);
      const day = Number(match[3]);

      const date = new Date(Date.UTC(year, month - 1, day));

      if (
        date.getUTCFullYear() === year &&
        date.getUTCMonth() === month - 1 &&
        date.getUTCDate() === day
      ) {
        return new Intl.DateTimeFormat('es-CO', {
          timeZone: 'UTC',
          day: '2-digit',
          month: 'long',
          year: 'numeric',
        }).format(date);
      }

      return 'No registrada';
    }
  }

  const date = value instanceof Date ? value : new Date(text(value));

  if (Number.isNaN(date.getTime())) {
    return 'No registrada';
  }

  return new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    ...(withTime
      ? {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        }
      : {}),
  }).format(date);
}

function formatExpiration(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return 'No registrada';
  }

  if (typeof value === 'string') {
    const match = /^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/.exec(value);

    if (match) {
      const year = Number(match[1]);
      const month = Number(match[2]);
      const day = Number(match[3]);

      const date = new Date(Date.UTC(year, month - 1, day));

      if (
        date.getUTCFullYear() === year &&
        date.getUTCMonth() === month - 1 &&
        date.getUTCDate() === day
      ) {
        return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
      }

      return 'No registrada';
    }
  }

  const date = value instanceof Date ? value : new Date(text(value));

  if (Number.isNaN(date.getTime())) {
    return 'No registrada';
  }

  return [
    String(date.getUTCDate()).padStart(2, '0'),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    date.getUTCFullYear(),
  ].join('/');
}

function wrap(
  value: unknown,
  font: PDFFont,
  size: number,
  width: number,
): string[] {
  const words = safe(value).split(/\s+/).filter(Boolean);

  if (!words.length) return ['No registrado'];

  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;

    if (font.widthOfTextAtSize(next, size) <= width || !current) {
      current = next;
    } else {
      lines.push(current);
      current = word;
    }
  }

  lines.push(current);

  return lines;
}

function patientName(patient: Record<string, unknown>): string {
  const fullName = patient.nombre ?? patient.nombreCompleto;

  if (typeof fullName === 'string' && fullName.trim()) {
    return fullName.trim();
  }

  const names = [patient.nombres, patient.apellidos]
    .filter(
      (value): value is string =>
        typeof value === 'string' && value.trim().length > 0,
    )
    .map((value) => value.trim());

  return names.length ? names.join(' ') : 'No registrado';
}

function uniqueAdmissionNumbers(medications: ReceiptMedication[]): string {
  const numbers = medications
    .map((medication) => medication.numeroIngreso)
    .filter(
      (value): value is string =>
        typeof value === 'string' && value.trim().length > 0,
    )
    .map((value) => value.trim());

  const unique = [...new Set(numbers)];

  return unique.length ? unique.join(', ') : 'No registrado';
}

async function loadLogo(pdf: PDFDocument) {
  const candidates = [
    resolve(process.cwd(), 'src/dispensations/assets/logo-sistema007.png'),
    resolve(process.cwd(), 'dist/dispensations/assets/logo-sistema007.png'),
  ];

  for (const path of candidates) {
    try {
      const bytes = await readFile(path);
      return await pdf.embedPng(bytes);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  return null;
}

export async function validateUploadedPdf(bytes: Buffer) {
  if (
    bytes.length > 10 * 1024 * 1024 ||
    !bytes.subarray(0, 5).equals(Buffer.from('%PDF-'))
  ) {
    throw new BadRequestException('Se requiere un PDF de máximo 10 MB');
  }

  try {
    const pdf = await PDFDocument.load(bytes);

    if (pdf.isEncrypted || pdf.getPageCount() < 1 || pdf.getPageCount() > 50) {
      throw new Error();
    }

    for (const [, obj] of pdf.context.enumerateIndirectObjects()) {
      if (
        /\/(JavaScript|JS|OpenAction|AA|Launch|EmbeddedFiles|EmbeddedFile|XFA|RichMedia|AcroForm)\b/.test(
          obj.toString(),
        )
      ) {
        throw new Error();
      }
    }
  } catch {
    throw new BadRequestException(
      'PDF inválido, cifrado o con contenido activo; imprime a PDF y vuelve a cargarlo',
    );
  }

  return bytes;
}

export async function validateManualEvidence(bytes: Buffer): Promise<{
  bytes: Buffer;
  mime: 'application/pdf' | 'image/png' | 'image/jpeg';
}> {
  if (bytes.length === 0 || bytes.length > 10 * 1024 * 1024) {
    throw new BadRequestException(
      'El soporte debe ser PDF, JPG o PNG y no superar 10 MB',
    );
  }

  if (bytes.subarray(0, 5).equals(Buffer.from('%PDF-'))) {
    return { bytes: await validateUploadedPdf(bytes), mime: 'application/pdf' };
  }

  try {
    const image = sharp(bytes, { limitInputPixels: 30000000 });
    const metadata = await image.metadata();
    const format = metadata.format;

    if (
      !['png', 'jpeg'].includes(format || '') ||
      (metadata.pages ?? 1) !== 1 ||
      !metadata.width ||
      !metadata.height
    ) {
      throw new Error();
    }

    return {
      bytes,
      mime: format === 'png' ? 'image/png' : 'image/jpeg',
    };
  } catch {
    throw new BadRequestException(
      'El soporte debe ser un PDF válido o una imagen JPG/PNG válida',
    );
  }
}

export async function normalizeSignature(bytes: Buffer) {
  if (bytes.length > 2 * 1024 * 1024) {
    throw new BadRequestException('Firma demasiado grande');
  }

  try {
    const image = sharp(bytes, {
      limitInputPixels: 4000000,
    });

    const metadata = await image.metadata();

    if (
      !['png', 'jpeg'].includes(metadata.format || '') ||
      (metadata.pages ?? 1) !== 1
    ) {
      throw new Error();
    }

    const { channels } = await image.stats();

    if (channels.slice(0, 3).every((channel) => channel.stdev < 2)) {
      throw new Error();
    }

    return await image
      .resize({
        width: 1000,
        height: 400,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .flatten({ background: '#fff' })
      .png()
      .toBuffer();
  } catch {
    throw new BadRequestException('Firma vacía o imagen no válida (PNG/JPEG)');
  }
}

export async function createReceiptPdf(rawSnapshot: unknown) {
  const snapshot = (rawSnapshot ?? {}) as ReceiptSnapshot;

  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const logo = await loadLogo(pdf);

  const pages: PDFPage[] = [];

  let page!: PDFPage;
  let y = 0;

  const newPage = () => {
    page = pdf.addPage([pageWidth, pageHeight]);
    pages.push(page);
    y = pageHeight - margin;

    page.drawRectangle({
      x: 0,
      y: pageHeight - 6,
      width: pageWidth,
      height: 6,
      color: turquoise,
    });
  };

  const ensure = (height: number) => {
    if (y - height < margin + 28) {
      newPage();
    }
  };

  const rule = () => {
    page.drawLine({
      start: { x: margin, y },
      end: { x: pageWidth - margin, y },
      thickness: 0.8,
      color: line,
    });

    y -= 14;
  };

  const value = (label: string, item: unknown, x: number, width: number) => {
    const lines = wrap(item, regular, 9.3, width);

    page.drawText(safe(label).toUpperCase(), {
      x,
      y,
      size: 7.2,
      font: bold,
      color: muted,
    });

    y -= 12;

    for (const row of lines) {
      page.drawText(row, {
        x,
        y,
        size: 9.3,
        font: regular,
        color: ink,
      });

      y -= 12;
    }
  };

  const title = (heading: string) => {
    ensure(32);

    page.drawText(heading, {
      x: margin,
      y,
      size: 11,
      font: bold,
      color: navy,
    });

    y -= 8;
    rule();
  };

  const columns = ([left, right]: Array<[string, unknown]>) => {
    const top = y;

    value(left[0], left[1], margin, 235);
    const leftEnd = y;

    y = top;

    value(right[0], right[1], 315, 240);

    y = Math.min(leftEnd, y) - 6;
  };

  const medications =
    Array.isArray(snapshot.medicamentos) && snapshot.medicamentos.length
      ? snapshot.medicamentos
      : [];

  newPage();

  // ENCABEZADO INSTITUCIONAL

  page.drawRectangle({
    x: margin,
    y: y - 60,
    width: contentWidth,
    height: 60,
    color: navy,
  });

  if (logo) {
    const dimensions = logo.scaleToFit(43, 43);

    page.drawImage(logo, {
      x: margin + 12 + (43 - dimensions.width) / 2,
      y: y - 52 + (43 - dimensions.height) / 2,
      width: dimensions.width,
      height: dimensions.height,
    });
  } else {
    page.drawRectangle({
      x: margin + 16,
      y: y - 45,
      width: 31,
      height: 31,
      color: turquoise,
    });

    page.drawText('007', {
      x: margin + 19,
      y: y - 35,
      size: 13,
      font: bold,
      color: navy,
    });
  }

  page.drawText('SISTEMA 007', {
    x: margin + 65,
    y: y - 25,
    size: 10,
    font: bold,
    color: white,
  });

  page.drawText('COMPROBANTE DE ENTREGA DE MEDICAMENTOS', {
    x: margin + 65,
    y: y - 42,
    size: 12,
    font: bold,
    color: white,
  });

  y -= 80;

  // INFORMACIÓN DEL COMPROBANTE

  page.drawRectangle({
    x: margin,
    y: y - 35,
    width: contentWidth,
    height: 35,
    color: pale,
    borderColor: line,
    borderWidth: 0.8,
  });

  page.drawText('NÚMERO DE COMPROBANTE', {
    x: margin + 12,
    y: y - 14,
    size: 7.2,
    font: bold,
    color: muted,
  });

  page.drawText(safe(snapshot.numeroComprobante), {
    x: margin + 12,
    y: y - 27,
    size: 10,
    font: bold,
    color: navy,
  });

  page.drawText('FECHA DE ENTREGA', {
    x: 340,
    y: y - 14,
    size: 7.2,
    font: bold,
    color: muted,
  });

  page.drawText(formatDate(snapshot.fechaDispensacion, true), {
    x: 340,
    y: y - 27,
    size: 9,
    font: regular,
    color: ink,
  });

  y -= 55;

  // INFORMACIÓN DEL PACIENTE

  title('INFORMACIÓN DEL PACIENTE');

  const patient = snapshot.paciente ?? {};

  columns([
    ['Paciente', patientName(patient)],
    [
      'Identificación',
      `${text(patient.tipoDocumento)} ${text(patient.numeroDocumento)}`,
    ],
  ]);

  // INFORMACIÓN DE LA DISPENSACIÓN

  title('INFORMACIÓN DE LA DISPENSACIÓN');

  columns([
    ['Número de ingreso', uniqueAdmissionNumbers(medications)],
    ['Sede', snapshot.sede],
  ]);

  columns([
    ['Bodega de dispensación', snapshot.bodega],
    ['Número de dispensación', snapshot.numeroDispensacion],
  ]);

  // DETALLE DE MEDICAMENTOS DISPENSADOS

  title('DETALLE DE MEDICAMENTOS DISPENSADOS');

  const table = [
    { label: 'CÓDIGO', x: margin, width: 58 },
    { label: 'MEDICAMENTO / PRESENTACIÓN', x: 98, width: 173 },
    { label: 'LOTE', x: 271, width: 85 },
    { label: 'VENCIMIENTO', x: 356, width: 100 },
    { label: 'CANT.', x: 456, width: 99 },
  ];

  const head = () => {
    page.drawRectangle({
      x: margin,
      y: y - 22,
      width: contentWidth,
      height: 22,
      color: navy,
    });

    for (const column of table) {
      page.drawText(column.label, {
        x: column.x + 5,
        y: y - 14,
        size: 6.2,
        font: bold,
        color: white,
      });
    }

    y -= 22;
  };

  head();

  if (!medications.length) {
    const height = 32;

    page.drawRectangle({
      x: margin,
      y: y - height,
      width: contentWidth,
      height,
      color: white,
      borderColor: line,
      borderWidth: 0.5,
    });

    page.drawText('No hay medicamentos registrados', {
      x: margin + 8,
      y: y - 19,
      size: 8.5,
      font: regular,
      color: muted,
    });

    y -= height;
  }

  for (const medication of medications) {
    const description = [
      text(medication.medicamento),
      [medication.concentracion, medication.formaFarmaceutica]
        .filter((item) => item !== null && item !== undefined && item !== '')
        .map((item) => text(item))
        .join(' · '),
    ]
      .filter(Boolean)
      .join(' ');

    const cells = [
      medication.codigoInterno,
      description,
      medication.numeroLote,
      formatExpiration(medication.fechaVencimiento),
      medication.cantidadEntregada,
    ].map((item, index) => wrap(item, regular, 8.2, table[index].width - 10));

    const height = Math.max(...cells.map((cell) => cell.length)) * 11 + 12;

    ensure(height + 24);

    if (y > pageHeight - margin - 130 && pages.length > 1) {
      head();
    }

    page.drawRectangle({
      x: margin,
      y: y - height,
      width: contentWidth,
      height,
      color: white,
      borderColor: line,
      borderWidth: 0.5,
    });

    cells.forEach((cell, index) => {
      cell.forEach((row, lineIndex) => {
        page.drawText(row, {
          x: table[index].x + 5,
          y: y - 12 - lineIndex * 11,
          size: 8.2,
          font: regular,
          color: ink,
        });
      });
    });

    y -= height;
  }

  y -= 16;

  // RESPONSABLE DE LA DISPENSACIÓN

  title('RESPONSABLE DE LA DISPENSACIÓN');

  const professional = snapshot.dispensadoPor ?? {};

  columns([
    ['Nombre', professional.nombre],
    ['Rol', professional.rol],
  ]);

  // CONSTANCIA DE RECIBIDO

  ensure(150);

  title('CONSTANCIA DE RECIBIDO');

  page.drawRectangle({
    x: margin,
    y: y - 100,
    width: contentWidth,
    height: 100,
    color: pale,
    borderColor: line,
    borderWidth: 0.8,
  });

  page.drawText(
    'El receptor declara haber recibido los medicamentos relacionados en este comprobante.',
    {
      x: margin + 14,
      y: y - 18,
      size: 8.8,
      font: regular,
      color: ink,
    },
  );

  page.drawText('NOMBRE DEL RECEPTOR', {
    x: margin + 14,
    y: y - 42,
    size: 7,
    font: bold,
    color: muted,
  });

  page.drawLine({
    start: { x: margin + 14, y: y - 57 },
    end: { x: 270, y: y - 57 },
    thickness: 0.7,
    color: muted,
  });

  page.drawText('IDENTIFICACIÓN', {
    x: 310,
    y: y - 42,
    size: 7,
    font: bold,
    color: muted,
  });

  page.drawLine({
    start: { x: 310, y: y - 57 },
    end: { x: 540, y: y - 57 },
    thickness: 0.7,
    color: muted,
  });

  page.drawText('RELACIÓN CON EL PACIENTE (CUANDO APLIQUE)', {
    x: margin + 14,
    y: y - 76,
    size: 7,
    font: bold,
    color: muted,
  });

  page.drawLine({
    start: { x: margin + 14, y: y - 91 },
    end: { x: 270, y: y - 91 },
    thickness: 0.7,
    color: muted,
  });

  page.drawText('FIRMA Y FECHA DE RECIBIDO', {
    x: 310,
    y: y - 76,
    size: 7,
    font: bold,
    color: muted,
  });

  page.drawLine({
    start: { x: 310, y: y - 91 },
    end: { x: 540, y: y - 91 },
    thickness: 0.7,
    color: muted,
  });

  // PIE DE PÁGINA

  pages.forEach((current, index) => {
    current.drawLine({
      start: { x: margin, y: 28 },
      end: { x: pageWidth - margin, y: 28 },
      thickness: 0.6,
      color: line,
    });

    current.drawText('Sistema 007 · Soporte de dispensación', {
      x: margin,
      y: 16,
      size: 7,
      font: regular,
      color: muted,
    });

    current.drawText(`Página ${index + 1} de ${pages.length}`, {
      x: pageWidth - margin - 55,
      y: 16,
      size: 7,
      font: regular,
      color: muted,
    });
  });

  return Buffer.from(await pdf.save());
}

export async function createDispensationReportPdf(
  rows: Array<Record<string, string | number>>,
  title: string,
) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page!: PDFPage;
  let y = 0;
  const newPage = () => {
    page = pdf.addPage([pageWidth, pageHeight]);
    y = pageHeight - margin;
    page.drawRectangle({
      x: 0,
      y: pageHeight - 6,
      width: pageWidth,
      height: 6,
      color: turquoise,
    });
    page.drawText('SISTEMA 007', {
      x: margin,
      y,
      size: 10,
      font: bold,
      color: navy,
    });
    page.drawText(title, {
      x: margin,
      y: y - 20,
      size: 14,
      font: bold,
      color: navy,
    });
    page.drawText(`Generado: ${formatDate(new Date(), true)}`, {
      x: margin,
      y: y - 35,
      size: 8,
      font: regular,
      color: muted,
    });
    y -= 55;
  };
  newPage();
  for (const row of rows) {
    const summary = Object.entries(row)
      .map(([key, value]) => `${key}: ${value}`)
      .join(' · ');
    const lines = wrap(summary, regular, 8.2, contentWidth);
    const height = lines.length * 11 + 12;
    if (y - height < 45) newPage();
    page.drawRectangle({
      x: margin,
      y: y - height,
      width: contentWidth,
      height,
      color: pale,
      borderColor: line,
      borderWidth: 0.5,
    });
    lines.forEach((entry, index) =>
      page.drawText(entry, {
        x: margin + 7,
        y: y - 11 - index * 11,
        size: 8.2,
        font: regular,
        color: ink,
      }),
    );
    y -= height + 5;
  }
  return Buffer.from(await pdf.save());
}

export async function attachSignature(
  base: Buffer,
  image: Buffer,
  lines: string[],
) {
  const pdf = await PDFDocument.load(base);

  const regular = await pdf.embedFont(StandardFonts.Helvetica);

  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const page = pdf.addPage([pageWidth, pageHeight]);

  page.drawRectangle({
    x: 0,
    y: pageHeight - 6,
    width: pageWidth,
    height: 6,
    color: turquoise,
  });

  page.drawRectangle({
    x: margin,
    y: pageHeight - 96,
    width: contentWidth,
    height: 56,
    color: navy,
  });

  page.drawText('SISTEMA 007', {
    x: margin + 16,
    y: pageHeight - 62,
    size: 10,
    font: bold,
    color: white,
  });

  page.drawText('CONSTANCIA DE RECEPCIÓN', {
    x: margin + 16,
    y: pageHeight - 80,
    size: 14,
    font: bold,
    color: white,
  });

  let y = pageHeight - 120;

  for (const entry of lines) {
    for (const row of wrap(entry, regular, 9.2, contentWidth)) {
      page.drawText(row, {
        x: margin,
        y,
        size: 9.2,
        font: regular,
        color: ink,
      });

      y -= 14;
    }
  }

  const png = await pdf.embedPng(image);

  const dimensions = png.scaleToFit(contentWidth, 175);

  page.drawRectangle({
    x: margin,
    y: 64,
    width: contentWidth,
    height: 205,
    color: pale,
    borderColor: line,
    borderWidth: 0.8,
  });

  page.drawText('FIRMA DEL RECEPTOR', {
    x: margin + 14,
    y: 246,
    size: 7.2,
    font: bold,
    color: muted,
  });

  page.drawImage(png, {
    x: margin + 14,
    y: 78,
    width: dimensions.width,
    height: dimensions.height,
  });

  return Buffer.from(await pdf.save());
}
