import { PrismaService } from '../prisma/prisma.service';

// This is deliberately not configurable. It can only grant the extra test
// capabilities to the known administrator in the isolated local test copy.
const FUNCTIONAL_TEST_DATABASE = 'sistema007_funcional_pruebas';
const FUNCTIONAL_TEST_ADMIN_ID = 2;

export async function hasFunctionalTestAccess(
  prisma: PrismaService,
  userId: number,
): Promise<boolean> {
  if (userId !== FUNCTIONAL_TEST_ADMIN_ID) return false;

  if (typeof prisma.$queryRaw !== 'function') return false;

  const rows = await prisma.$queryRaw<
    Array<{ databaseName: string | null }>
  >`SELECT DATABASE() AS databaseName`;

  if (rows[0]?.databaseName !== FUNCTIONAL_TEST_DATABASE) return false;

  const user = await prisma.usuario.findUnique({
    where: { id: userId },
    select: { activo: true, rol: true, nombre: true },
  });

  return (
    user?.activo === true &&
    user.rol === 'ADMINISTRADOR' &&
    user.nombre === 'Usuario Prueba'
  );
}
