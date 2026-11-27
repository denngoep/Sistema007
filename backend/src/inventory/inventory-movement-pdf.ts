import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const navy = rgb(6 / 255, 43 / 255, 85 / 255);
const turquoise = rgb(0 / 255, 174 / 255, 188 / 255);
const ink = rgb(23 / 255, 50 / 255, 77 / 255);
const muted = rgb(101 / 255, 123 / 255, 138 / 255);

export type InventoryMovementReceiptSnapshot = {
  numero: string;
  tipo: string;
  fecha: string;
  sedeOrigen?: string | null;
  bodegaOrigen?: string | null;
  sedeDestino?: string | null;
  bodegaDestino?: string | null;
  producto: string;
  codigoInterno: string | number;
  lote: string;
  vencimiento: string;
  cantidad: number;
  responsable: string;
  motivo?: string | null;
  referencia?: string | null;
};

function label(type: string) {
  return (
    (
      {
        INGRESO: 'Ingreso por recepción',
        TRASLADO: 'Traslado entre bodegas',
        AJUSTE_ENTRADA: 'Ajuste de entrada',
        AJUSTE_SALIDA: 'Ajuste de salida',
        DEVOLUCION_PROVEEDOR: 'Devolución a proveedor',
      } as Record<string, string>
    )[type] ?? type
  );
}

function wrap(value: string, max = 86) {
  const words = value.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > max && current) {
      lines.push(current);
      current = word;
    } else current = next;
  }
  if (current) lines.push(current);
  return lines;
}

export async function createInventoryMovementPdf(
  snapshot: InventoryMovementReceiptSnapshot,
): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const margin = 42;
  const width = 511;
  let y = 775;

  page.drawRectangle({
    x: 0,
    y: 835,
    width: 595.28,
    height: 6,
    color: turquoise,
  });
  page.drawRectangle({ x: margin, y: 694, width, height: 78, color: navy });
  page.drawText('SISTEMA 007', {
    x: margin + 18,
    y: 745,
    size: 11,
    font: bold,
    color: rgb(1, 1, 1),
  });
  page.drawText('COMPROBANTE DE MOVIMIENTO DE INVENTARIO', {
    x: margin + 18,
    y: 720,
    size: 15,
    font: bold,
    color: rgb(1, 1, 1),
  });
  page.drawText(`N.º ${snapshot.numero}`, {
    x: 420,
    y: 745,
    size: 9,
    font: regular,
    color: rgb(1, 1, 1),
  });
  y = 665;
  const line = (title: string, value?: string | number | null) => {
    if (value === undefined || value === null || value === '') return;
    page.drawText(title, { x: margin, y, size: 8, font: bold, color: muted });
    const values = wrap(String(value));
    values.forEach((row, index) =>
      page.drawText(row, {
        x: 160,
        y: y - index * 14,
        size: 9.5,
        font: regular,
        color: ink,
      }),
    );
    y -= Math.max(22, values.length * 14 + 8);
  };
  line('TIPO', label(snapshot.tipo));
  line('FECHA Y HORA', snapshot.fecha);
  line(
    'SEDE / BODEGA ORIGEN',
    [snapshot.sedeOrigen, snapshot.bodegaOrigen].filter(Boolean).join(' — '),
  );
  line(
    'SEDE / BODEGA DESTINO',
    [snapshot.sedeDestino, snapshot.bodegaDestino].filter(Boolean).join(' — '),
  );
  page.drawRectangle({
    x: margin,
    y: y - 104,
    width,
    height: 96,
    color: rgb(244 / 255, 247 / 255, 250 / 255),
  });
  y -= 25;
  line('PRODUCTO', snapshot.producto);
  line('CÓDIGO / LOTE', `${snapshot.codigoInterno} / ${snapshot.lote}`);
  line(
    'VENCIMIENTO / CANTIDAD',
    `${snapshot.vencimiento} / ${snapshot.cantidad}`,
  );
  line('RESPONSABLE', snapshot.responsable);
  line('MOTIVO', snapshot.motivo);
  line('REFERENCIA', snapshot.referencia);
  page.drawLine({
    start: { x: margin, y: 86 },
    end: { x: margin + width, y: 86 },
    thickness: 0.6,
    color: turquoise,
  });
  page.drawText(
    'Documento generado y almacenado de forma privada por Sistema 007.',
    { x: margin, y: 66, size: 8, font: regular, color: muted },
  );
  return Buffer.from(await pdf.save());
}
