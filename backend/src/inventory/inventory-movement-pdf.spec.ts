import { PDFDocument } from 'pdf-lib';
import { createInventoryMovementPdf } from './inventory-movement-pdf';

describe('createInventoryMovementPdf', () => {
  it('genera un PDF institucional legible para un movimiento no dispensado', async () => {
    const bytes = await createInventoryMovementPdf({
      numero: 'MOV-00000001',
      tipo: 'AJUSTE_SALIDA',
      fecha: '23 de noviembre de 2026, 10:00',
      sedeOrigen: 'Sede principal',
      bodegaOrigen: 'Bodega central',
      producto: 'Metformina 500 mg tableta',
      codigoInterno: 1001,
      lote: 'L-100',
      vencimiento: '31 de diciembre de 2027',
      cantidad: 3,
      responsable: 'Profesional de farmacia',
      motivo: 'Diferencia de conteo físico',
    });

    const document = await PDFDocument.load(bytes);
    expect(document.getPageCount()).toBe(1);
    expect(bytes.subarray(0, 5).toString('ascii')).toBe('%PDF-');
  });
});
