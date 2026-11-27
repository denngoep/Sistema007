import { BadRequestException, ConflictException } from '@nestjs/common';
import { PDFDocument } from 'pdf-lib';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class {},
}));

jest.mock('../repositories/dispensations.repository', () => ({
  DispensationsRepository: class {},
}));

import { DispensationsService } from '../services/dispensations.service';
import { PrivateDocumentStore } from './private-document.store';

import {
  createReceiptPdf,
  normalizeSignature,
  validateManualEvidence,
  validateUploadedPdf,
} from './dispensation-pdf';

import { receiptSnapshot } from './receipt-snapshot';

describe('Dispensation documents (isolated)', () => {
  let documentRoot: string;

  beforeEach(async () => {
    documentRoot = await mkdtemp(join(tmpdir(), 'sistema007-dispensacion-'));

    process.env.DISPENSATION_DOCUMENT_ROOT = documentRoot;
  });

  afterEach(async () => {
    delete process.env.DISPENSATION_DOCUMENT_ROOT;

    await rm(documentRoot, {
      recursive: true,
      force: true,
    });
  });

  it('creates a readable PDF from a stable snapshot', async () => {
    const snapshot = receiptSnapshot({
      numeroComprobante: 'COMP-1',
      fechaComprobante: new Date('2026-11-23T12:00:00Z'),

      numeroDispensacion: 'DISP-1',
      fechaDispensacion: new Date('2026-11-23T11:00:00Z'),

      paciente: {
        tipoDocumento: 'CC',
        numeroDocumento: '1',
        nombres: 'Ana',
        apellidos: 'Pérez',
      },

      bodega: {
        nombre: 'Farmacia',
        sede: {
          nombre: 'IPS',
        },
      },

      dispensadoPor: {
        id: 2,
        nombre: 'Químico',
        rol: 'QUIMICO_FARMACEUTICO',
      },

      detalles: [
        {
          cantidadEntregada: 2,

          lote: {
            numeroLote: 'L-1',
            fechaVencimiento: new Date('2027-01-01'),

            productoInventario: {
              codigoInterno: 10025,
              codigoBarras: null,
            },
          },

          detalleFormulacion: {
            medicamento: 'Medicamento',
            concentracion: '500 mg',
            formaFarmaceutica: 'Tableta',

            formulacion: {
              id: 3,

              atencionClinica: {
                numeroIngreso: 'ING-1',
              },
            },
          },
        },
      ],
    });

    // Verifica que el código interno del producto
    // se conserve en los datos del comprobante.
    expect(snapshot.medicamentos[0].codigoInterno).toBe(10025);

    expect(snapshot.medicamentos[0].numeroIngreso).toBe('ING-1');

    const bytes = await createReceiptPdf(snapshot);

    expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');

    const pdf = await PDFDocument.load(bytes);

    expect(pdf.getPageCount()).toBeGreaterThan(0);
  });

  it('keeps a long list of delivered lots on readable pages', async () => {
    const medicamentos = Array.from({ length: 40 }, (_, index) => ({
      numeroIngreso: 'ING-1',

      codigoInterno: 10025 + index,

      medicamento: `Medicamento de prueba ${index + 1}`,

      concentracion: '500 mg',
      formaFarmaceutica: 'Tableta',

      numeroLote: `LOTE-${index + 1}`,

      fechaVencimiento: '2027-01-01T00:00:00.000Z',

      cantidadEntregada: index + 1,
    }));

    const bytes = await createReceiptPdf({
      numeroComprobante: 'COMP-2',

      numeroDispensacion: 'DISP-2',

      fechaDispensacion: '2026-11-23T12:00:00.000Z',

      paciente: {
        nombres: 'Ana',
        apellidos: 'Pérez',
        tipoDocumento: 'CC',
        numeroDocumento: '1',
      },

      sede: 'IPS',
      bodega: 'Farmacia',

      dispensadoPor: {
        nombre: 'Responsable',
        rol: 'REGENTE_FARMACIA',
      },

      medicamentos,
    });

    const pdf = await PDFDocument.load(bytes);

    expect(pdf.getPageCount()).toBeGreaterThan(1);
  });

  it('rejects empty signatures and non-PDF manual uploads', async () => {
    await expect(
      normalizeSignature(Buffer.from('not an image')),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      validateUploadedPdf(Buffer.from('not a PDF')),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('accepts a valid PNG as a physical signed support and rejects arbitrary files', async () => {
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADElEQVR42mNk+M/wHwAF/gL+QpVAJwAAAABJRU5ErkJggg==',
      'base64',
    );

    await expect(validateManualEvidence(png)).resolves.toMatchObject({
      mime: 'image/png',
    });
    await expect(
      validateManualEvidence(Buffer.from('not a file')),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('stores private documents with an integrity hash and detects tampering', async () => {
    const store = new PrivateDocumentStore();

    const saved = await store.put(
      Buffer.from('%PDF-1.4\nexample'),
      'application/pdf',
    );

    await expect(store.get(saved)).resolves.toEqual(
      Buffer.from('%PDF-1.4\nexample'),
    );

    await writeFile(join(documentRoot, saved.claveAlmacenamiento), 'altered');

    await expect(store.get(saved)).rejects.toBeDefined();
  });

  it('returns a prior delivery for the same idempotency key without a new transaction', async () => {
    const prior = {
      id: 9,
      dispensadoPorId: 7,
      hashSolicitud: '',
    };

    const repository = {
      findByKey: jest.fn().mockResolvedValue(prior),
    };

    const service = new DispensationsService(repository as never);

    const dto = {
      numeroDocumento: '10',
      formulacionId: 1,
      detalleFormulacionId: 2,
      cantidad: 3,
      bodegaId: 4,
    };

    prior.hashSolicitud = createHash('sha256')
      .update(
        JSON.stringify({
          usuarioId: 7,
          documento: '10',
          formulacionId: 1,
          detalleFormulacionId: 2,
          cantidad: 3,
          bodegaId: 4,
          observaciones: '',
        }),
      )
      .digest('hex');

    await expect(
      service.createDispensation(dto, 7, 'same-delivery-key-1234'),
    ).resolves.toMatchObject({
      registrada: true,
      dispensacion: prior,
    });

    expect(repository.findByKey).toHaveBeenCalledTimes(1);
  });

  it('rejects reuse of a key for a different delivery intention', async () => {
    const repository = {
      findByKey: jest.fn().mockResolvedValue({
        id: 9,
        dispensadoPorId: 7,
        hashSolicitud: 'other',
      }),
    };

    const service = new DispensationsService(repository as never);

    await expect(
      service.createDispensation(
        {
          numeroDocumento: '10',
          formulacionId: 1,
          detalleFormulacionId: 2,
          cantidad: 3,
          bodegaId: 4,
        },
        7,
        'different-delivery-key',
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
