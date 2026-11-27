jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

import { hasFunctionalTestAccess } from './functional-test-access.service';

describe('FunctionalTestAccessService', () => {
  const prisma = {
    $queryRaw: jest.fn(),
    usuario: { findUnique: jest.fn() },
  };
  beforeEach(() => jest.resetAllMocks());

  it('never grants access to a different user', async () => {
    await expect(hasFunctionalTestAccess(prisma as never, 99)).resolves.toBe(
      false,
    );
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('denies the test administrator outside the isolated database', async () => {
    prisma.$queryRaw.mockResolvedValue([{ databaseName: 'sistema007' }]);
    await expect(hasFunctionalTestAccess(prisma as never, 2)).resolves.toBe(
      false,
    );
    expect(prisma.usuario.findUnique).not.toHaveBeenCalled();
  });

  it('grants access only to the active known test administrator in the isolated database', async () => {
    prisma.$queryRaw.mockResolvedValue([
      { databaseName: 'sistema007_funcional_pruebas' },
    ]);
    prisma.usuario.findUnique.mockResolvedValue({
      activo: true,
      rol: 'ADMINISTRADOR',
      nombre: 'Usuario Prueba',
    });

    await expect(hasFunctionalTestAccess(prisma as never, 2)).resolves.toBe(
      true,
    );
  });
});
