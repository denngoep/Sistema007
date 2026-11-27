jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InventoryDocumentsService } from './inventory-documents.service';

describe('InventoryDocumentsService', () => {
  const original = process.env.INVENTORY_DOCUMENTS_ENABLED;

  afterEach(() => {
    if (original === undefined) delete process.env.INVENTORY_DOCUMENTS_ENABLED;
    else process.env.INVENTORY_DOCUMENTS_ENABLED = original;
  });

  it('mantiene las rutas documentales apagadas antes de la migración', async () => {
    delete process.env.INVENTORY_DOCUMENTS_ENABLED;
    const service = new InventoryDocumentsService({} as never, {} as never);

    await expect(service.listMovementDocuments(1)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('calcula SHA-256 de manera determinista para verificar integridad', () => {
    expect(InventoryDocumentsService.sha256(Buffer.from('Sistema 007'))).toBe(
      '300c729a25232c9e393e13c49f342be6774d695f2d2de842a5291c15632c8757',
    );
  });

  it('rechaza un archivo cuyo MIME no corresponde con su firma binaria', async () => {
    process.env.INVENTORY_DOCUMENTS_ENABLED = 'true';
    const service = new InventoryDocumentsService({} as never, {} as never);

    await expect(
      service.prepareAdjustmentSupport({
        buffer: Buffer.from([0xff, 0xd8, 0xff, 0x00]),
        mimetype: 'image/png',
        size: 4,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('consulta soportes únicamente por la corrección solicitada', async () => {
    process.env.INVENTORY_DOCUMENTS_ENABLED = 'true';
    const findMany = jest.fn().mockResolvedValue([]);
    const service = new InventoryDocumentsService(
      { documentoCorreccionDetalleRecepcion: { findMany } } as never,
      {} as never,
    );

    await expect(service.listReceiptCorrectionDocuments(17)).resolves.toEqual(
      [],
    );
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { correccionDetalleRecepcionId: 17 },
      }),
    );
  });
});
