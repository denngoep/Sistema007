import { BadRequestException, ConflictException } from '@nestjs/common';
import { TipoBodega } from '../generated/prisma/enums';

jest.mock('../generated/prisma/client', () =>
  jest.requireActual<typeof import('../generated/prisma/enums')>(
    '../generated/prisma/enums',
  ),
);
jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

import { InventoryService } from '../services/inventory.service';

describe('InventoryService - administración de bodegas', () => {
  const buildService = (overrides: Record<string, jest.Mock> = {}) => {
    const repository = {
      findSiteById: jest.fn().mockResolvedValue({ id: 1, activa: true }),
      findWarehouseByNameInSite: jest.fn().mockResolvedValue(null),
      findWarehouseByCode: jest.fn().mockResolvedValue(null),
      createWarehouse: jest.fn().mockResolvedValue({ id: 9 }),
      findWarehouseById: jest.fn().mockResolvedValue({
        id: 9,
        sedeId: 1,
        codigo: 'BOD-PRINCIPAL',
        nombre: 'Principal',
        tipo: TipoBodega.GENERAL,
        permiteDispensacion: false,
        activa: true,
        sede: { activa: true },
      }),
      updateWarehouse: jest.fn().mockResolvedValue({ id: 9 }),
      registerReceipt: jest.fn(),
      ...overrides,
    };

    return {
      repository,
      service: new InventoryService(
        repository as never,
        {} as never,
        {} as never,
        {} as never,
      ),
    };
  };

  it('normaliza el código y registra la bodega con el responsable autenticado', async () => {
    const { service, repository } = buildService();

    await service.createWarehouse(
      {
        sedeId: 1,
        codigo: ' bod-principal ',
        nombre: 'Bodega principal',
        tipo: TipoBodega.GENERAL,
        permiteDispensacion: true,
      },
      24,
    );

    expect(repository.createWarehouse).toHaveBeenCalledWith(
      expect.objectContaining({
        codigo: 'BOD-PRINCIPAL',
        creadoPorId: 24,
        permiteDispensacion: true,
      }),
    );
  });

  it('rechaza códigos duplicados antes de crear una bodega', async () => {
    const { service, repository } = buildService({
      findWarehouseByCode: jest.fn().mockResolvedValue({ id: 2 }),
    });

    await expect(
      service.createWarehouse(
        { sedeId: 1, codigo: 'BOD-01', nombre: 'Otra bodega' },
        24,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(repository.createWarehouse).not.toHaveBeenCalled();
  });

  it('impide dispensación desde una bodega de no conformes', async () => {
    const { service } = buildService();

    await expect(
      service.createWarehouse(
        {
          sedeId: 1,
          codigo: 'NC-01',
          nombre: 'No conformes',
          tipo: TipoBodega.NO_CONFORMES,
          permiteDispensacion: true,
        },
        24,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('desactiva sin eliminar la bodega ni su historial', async () => {
    const { service, repository } = buildService();

    await service.updateWarehouse(9, { activa: false });

    expect(repository.updateWarehouse).toHaveBeenCalledWith(9, {
      activa: false,
    });
  });

  it('rechaza una recepción dirigida a una bodega inactiva', async () => {
    const { service, repository } = buildService({
      findWarehouseById: jest.fn().mockResolvedValue({
        id: 9,
        activa: false,
        sede: { activa: true },
      }),
    });

    await expect(
      service.registerReceipt(
        {
          numeroFactura: 'FAC-100',
          fechaFactura: '2026-11-23',
          proveedorId: 1,
          bodegaDestinoId: 9,
          productos: [],
        },
        24,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.registerReceipt).not.toHaveBeenCalled();
  });
});
