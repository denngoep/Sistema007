import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { randomBytes } from 'node:crypto';
import type { Server } from 'node:http';
import type { Prisma } from '../generated/prisma/client';
import { RolUsuario } from '../generated/prisma/enums';
import request from 'supertest';
import { UsersModule } from './users.module';
import { PrismaService } from '../prisma/prisma.service';
import { AuthRepository } from '../repositories/auth.repository';
import { MailService } from '../services/mail.service';
import { SERVICE_ROLES } from './user-management.policy';

jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

describe('Service coordination HTTP security (simulated database)', () => {
  let app: INestApplication<Server>;
  let jwt: JwtService;
  let token: string;
  const services = [
    { id: 1, codigo: 'ASISTENCIAL', nombre: 'Asistencial', activo: true },
    { id: 2, codigo: 'FARMACIA', nombre: 'Farmacia', activo: true },
    { id: 3, codigo: 'ADMISIONES', nombre: 'Admisiones', activo: true },
  ];
  type User = {
    id: number;
    nombre: string;
    correo: string;
    rol: RolUsuario;
    activo: boolean;
    servicioId: number | null;
    esCoordinador: boolean;
  };
  let users: User[];
  let revokeBeforeTransaction: boolean;
  let failCommit: boolean;
  let changeTargetBeforeTransaction: boolean;
  let writes: number;
  const prisma = {
    usuario: { findUnique: jest.fn() },
    $transaction: jest.fn(),
    servicio: { findMany: jest.fn() },
  };
  const related = (user: User | undefined) =>
    user
      ? {
          ...user,
          servicio: services.find((s) => s.id === user.servicioId) ?? null,
        }
      : null;
  const find = (
    rows: User[],
    query: { where: { id?: number; correo?: string } },
  ) =>
    related(
      rows.find((u) =>
        query.where.id !== undefined
          ? u.id === query.where.id
          : u.correo === query.where.correo,
      ),
    );
  const send = (
    method: 'get' | 'post' | 'patch',
    url: string,
    body: object = {},
  ) =>
    request(app.getHttpServer())
      [method](url)
      .set('Authorization', `Bearer ${token}`)
      .send(body);
  const newUser = {
    nombre: 'Nuevo',
    correo: 'nuevo@example.test',
    password: 'Test-only-long-password',
    rol: 'ENFERMERO',
  };
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
        UsersModule,
      ],
    })
      .overrideProvider(ConfigService)
      .useValue(
        new ConfigService({ JWT_SECRET: randomBytes(32).toString('hex') }),
      )
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(AuthRepository)
      .useValue({})
      .overrideProvider(MailService)
      .useValue({})
      .compile();
    app = module.createNestApplication();
    app.useLogger(false);
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    jwt = module.get(JwtService);
  });
  afterAll(async () => {
    await app?.close();
  });
  beforeEach(async () => {
    jest.clearAllMocks();
    writes = 0;
    revokeBeforeTransaction = false;
    failCommit = false;
    changeTargetBeforeTransaction = false;
    services.forEach((s) => {
      s.activo = true;
    });
    users = [
      {
        id: 1,
        nombre: 'Administrador',
        correo: 'admin@example.test',
        rol: 'ADMINISTRADOR',
        activo: true,
        servicioId: null,
        esCoordinador: false,
      },
      {
        id: 2,
        nombre: 'Coordinador',
        correo: 'coord@example.test',
        rol: 'AUXILIAR_ENFERMERIA',
        activo: true,
        servicioId: 1,
        esCoordinador: true,
      },
      {
        id: 3,
        nombre: 'Médico',
        correo: 'medico@example.test',
        rol: 'MEDICO',
        activo: true,
        servicioId: 1,
        esCoordinador: false,
      },
      {
        id: 4,
        nombre: 'Farmacia',
        correo: 'farmacia@example.test',
        rol: 'REGENTE_FARMACIA',
        activo: true,
        servicioId: 2,
        esCoordinador: false,
      },
      {
        id: 5,
        nombre: 'Otro coordinador',
        correo: 'otro@example.test',
        rol: 'ENFERMERO',
        activo: true,
        servicioId: 1,
        esCoordinador: true,
      },
      {
        id: 6,
        nombre: 'Sin servicio',
        correo: 'sin@example.test',
        rol: 'MEDICO',
        activo: true,
        servicioId: null,
        esCoordinador: false,
      },
    ];
    token = await jwt.signAsync({
      sub: 2,
      rol: 'ADMINISTRADOR',
      servicioId: 2,
      esCoordinador: true,
    });
    prisma.usuario.findUnique.mockImplementation((query) =>
      Promise.resolve(
        find(users, query as { where: { id?: number; correo?: string } }),
      ),
    );
    prisma.servicio.findMany.mockResolvedValue(services);
    prisma.$transaction.mockImplementation(
      async (work: (tx: Prisma.TransactionClient) => Promise<unknown>) => {
        if (revokeBeforeTransaction) users[1].esCoordinador = false;
        if (changeTargetBeforeTransaction) users[2].servicioId = 2;
        const rows = structuredClone(users);
        const tx = {
          usuario: {
            findUnique: (query: { where: { id?: number; correo?: string } }) =>
              Promise.resolve(find(rows, query)),
            findMany: ({
              where,
            }: {
              where: {
                id?: number | { not: number };
                servicioId?: number;
                esCoordinador?: boolean;
                rol?: { in: RolUsuario[] };
              };
            }) =>
              Promise.resolve(
                rows
                  .filter(
                    (u) =>
                      (typeof where.id === 'number'
                        ? u.id === where.id
                        : u.id !== where.id?.not) &&
                      (where.servicioId === undefined ||
                        u.servicioId === where.servicioId) &&
                      (where.esCoordinador === undefined ||
                        u.esCoordinador === where.esCoordinador) &&
                      (!where.rol || where.rol.in.includes(u.rol)),
                  )
                  .map(related),
              ),
            create: ({ data }: { data: User & { password: string } }) => {
              writes++;
              const { password, ...safe } = data;
              expect(password).not.toBe(newUser.password);
              const row = {
                ...safe,
                id: 7,
                activo: true,
                servicioId: data.servicioId ?? null,
              };
              rows.push(row);
              return Promise.resolve(related(row));
            },
            update: ({
              where,
              data,
            }: {
              where: { id: number };
              data: Partial<User>;
            }) => {
              writes++;
              const row = rows.find((u) => u.id === where.id)!;
              Object.assign(
                row,
                Object.fromEntries(
                  Object.entries(data).filter(
                    ([, value]) => value !== undefined,
                  ),
                ),
              );
              return Promise.resolve(related(row));
            },
            count: () =>
              Promise.resolve(
                rows.filter((u) => u.activo && u.rol === 'ADMINISTRADOR')
                  .length,
              ),
          },
          servicio: {
            findUnique: ({ where }: { where: { id: number } }) =>
              Promise.resolve(services.find((s) => s.id === where.id) ?? null),
          },
        };
        const result = await work(tx as unknown as Prisma.TransactionClient);
        if (failCommit) throw new Error('Commit failed');
        users = rows;
        return result;
      },
    );
  });

  it('filters list to ordinary users in the current service', async () => {
    const response = await send('get', '/users').expect(200);
    expect((response.body as User[]).map((u) => u.id)).toEqual([3]);
  });
  it.each(services.map((s) => [s.id, s.codigo] as const))(
    'uses explicit designation and service %s, not professional hierarchy',
    async (id, codigo) => {
      users[1].servicioId = id;
      const response = await send('get', '/users/permissions').expect(200);
      expect(
        (response.body as { allowedRoles: string[] }).allowedRoles,
      ).toEqual(SERVICE_ROLES[codigo]);
      users[1].esCoordinador = false;
      await send('get', '/users').expect(403);
    },
  );
  it.each(
    services.flatMap((service) =>
      Object.values(RolUsuario).map(
        (rol) => [service.id, service.codigo, rol] as const,
      ),
    ),
  )(
    'service %s (%s) can create role %s only if allowed',
    async (id, codigo, rol) => {
      users[1].servicioId = id;
      const allowed = SERVICE_ROLES[codigo].includes(rol);
      await send('post', '/users', { ...newUser, rol }).expect(
        allowed ? 201 : 403,
      );
      if (allowed)
        expect(users.at(-1)).toMatchObject({
          servicioId: id,
          esCoordinador: false,
          rol,
        });
      else expect(writes).toBe(0);
    },
  );
  it.each([1, 2, 4, 5, 6, 999])(
    'cannot read/edit/disable protected target %s',
    async (id) => {
      await send('get', `/users/${id}`).expect(404);
      await send('patch', `/users/${id}`, { nombre: 'No permitido' }).expect(
        404,
      );
      await send('patch', `/users/${id}/status`, { activo: false }).expect(404);
      expect(writes).toBe(0);
    },
  );
  it('can edit role/name and status for an ordinary user in scope', async () => {
    await send('patch', '/users/3', {
      nombre: 'Editado',
      rol: 'ENFERMERO',
    }).expect(200);
    await send('patch', '/users/3/status', { activo: false }).expect(200);
    expect(users[2]).toMatchObject({
      nombre: 'Editado',
      rol: 'ENFERMERO',
      activo: false,
    });
  });
  it.each([
    { correo: 'changed@example.test' },
    { correo: null },
    { password: 'Another-test-password' },
    { password: null },
    { rol: 'ADMINISTRADOR' },
    { rol: 'REGENTE_FARMACIA' },
  ])('rejects forbidden field/role %#', async (payload) => {
    await send('patch', '/users/3', payload).expect(
      Object.values(payload).includes(null) ? 400 : 403,
    );
    expect(writes).toBe(0);
  });
  it.each([{ servicioId: 1 }, { servicioId: 2 }])(
    'rejects explicit service even if it matches %#',
    async (scope) => {
      await send('post', '/users', { ...newUser, ...scope }).expect(403);
      expect(writes).toBe(0);
    },
  );
  it('rejects scope and coordinator injection', async () => {
    await send('post', '/users', { ...newUser, esCoordinador: true }).expect(
      400,
    );
    await send('patch', '/users/3', { servicioId: 2 }).expect(400);
    await send('patch', '/users/3/scope', {
      servicioId: 1,
      esCoordinador: true,
    }).expect(403);
    expect(writes).toBe(0);
  });
  it.each([
    'inactiveUser',
    'inactiveService',
    'nullService',
    'revoked',
  ] as const)('denies ineffective designation: %s', async (condition) => {
    if (condition === 'inactiveUser') users[1].activo = false;
    if (condition === 'inactiveService') services[0].activo = false;
    if (condition === 'nullService') users[1].servicioId = null;
    if (condition === 'revoked') users[1].esCoordinador = false;
    await send('get', '/users').expect(403);
    expect(writes).toBe(0);
  });
  it('rechecks revocation inside transaction', async () => {
    revokeBeforeTransaction = true;
    await send('patch', '/users/3/status', { activo: false }).expect(403);
    expect(writes).toBe(0);
  });
  it('rechecks target service inside transaction', async () => {
    changeTargetBeforeTransaction = true;
    await send('patch', '/users/3/status', { activo: false }).expect(404);
    expect(writes).toBe(0);
  });
  it('rolls back a failed account update', async () => {
    failCommit = true;
    await send('patch', '/users/3', { nombre: 'No guardar' }).expect(500);
    expect(users[2].nombre).toBe('Médico');
  });
  it('administrator lists all and explicitly assigns/revokes coordination without changing role/id', async () => {
    token = await jwt.signAsync({ sub: 1 });
    const response = await send('get', '/users').expect(200);
    expect(response.body).toHaveLength(6);
    await send('patch', '/users/6/scope', {
      servicioId: 1,
      esCoordinador: true,
    }).expect(200);
    expect(users[5]).toMatchObject({
      id: 6,
      rol: 'MEDICO',
      servicioId: 1,
      esCoordinador: true,
    });
    await send('patch', '/users/6/scope', {
      servicioId: null,
      esCoordinador: false,
    }).expect(200);
  });
  it('administrator can create an unassigned account without inferring service', async () => {
    token = await jwt.signAsync({ sub: 1 });
    await send('post', '/users', newUser).expect(201);
    expect(users.at(-1)).toMatchObject({
      servicioId: null,
      esCoordinador: false,
    });
  });
  it('rejects incompatible, missing and inactive service assignments', async () => {
    token = await jwt.signAsync({ sub: 1 });
    for (const servicioId of [2, 999, null])
      await send('patch', '/users/3/scope', {
        servicioId,
        esCoordinador: true,
      }).expect(400);
    services[0].activo = false;
    await send('patch', '/users/3/scope', {
      servicioId: 1,
      esCoordinador: true,
    }).expect(400);
    expect(writes).toBe(0);
  });
  it('protects own scope and last active administrator', async () => {
    token = await jwt.signAsync({ sub: 1 });
    await send('patch', '/users/1/scope', {
      servicioId: null,
      esCoordinador: false,
    }).expect(403);
    await send('patch', '/users/1', { rol: 'MEDICO' }).expect(403);
    await send('patch', '/users/1/status', { activo: false }).expect(409);
    expect(writes).toBe(0);
  });
  it('requires JWT', async () => {
    await request(app.getHttpServer()).get('/users/permissions').expect(401);
  });

  it.each([
    { nombre: null },
    { nombre: '   ' },
    { rol: null },
    { password: null },
    { correo: null },
  ])('rejects malformed update without writes %#', async (payload) => {
    await send('patch', '/users/3', payload).expect(400);
    expect(writes).toBe(0);
  });
  it.each([
    { nombre: 42 },
    { nombre: '  ' },
    { password: null },
    { servicioId: null },
  ])('rejects malformed creation without writes %#', async (payload) => {
    await send('post', '/users', { ...newUser, ...payload }).expect(400);
    expect(writes).toBe(0);
  });
  it('revocation with the same JWT denies every management endpoint', async () => {
    await send('get', '/users').expect(200);
    users[1].esCoordinador = false;
    const permissions = await send('get', '/users/permissions').expect(200);
    expect(
      (permissions.body as { canManageUsers: boolean }).canManageUsers,
    ).toBe(false);
    await send('get', '/users').expect(403);
    await send('get', '/users/3').expect(403);
    await send('post', '/users', newUser).expect(403);
    await send('patch', '/users/3', { nombre: 'Rechazado' }).expect(403);
    await send('patch', '/users/3/status', { activo: false }).expect(403);
    await send('patch', '/users/3/scope', {
      servicioId: 1,
      esCoordinador: false,
    }).expect(403);
    expect(writes).toBe(0);
  });
  it('rejects removing coordination and self-escalation through scope requests', async () => {
    for (const id of [2, 3, 5]) {
      await send('patch', `/users/${id}/scope`, {
        servicioId: 1,
        esCoordinador: false,
      }).expect(403);
      await send('patch', `/users/${id}`, { esCoordinador: true }).expect(400);
    }
    expect(writes).toBe(0);
  });
});
