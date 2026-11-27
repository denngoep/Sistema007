import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { randomBytes } from 'node:crypto';
import type { Server } from 'node:http';
import request from 'supertest';
import { PatientsModule } from './patients.module';
import { PrismaService } from '../prisma/prisma.service';
import { AuthRepository } from '../repositories/auth.repository';
import { MailService } from '../services/mail.service';
import { RolUsuario } from '../generated/prisma/enums';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

describe('Patient registration and history linkage (simulated Prisma)', () => {
  let app: INestApplication<Server>;
  let token: string;
  let failHistory: boolean;
  let stored: { document: string; histories: number }[];
  const prisma = {
    usuario: { findUnique: jest.fn() },
    paciente: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };
  const payload = {
    tipoDocumento: 'CC',
    numeroDocumento: 'TEST-007',
    nombres: 'Prueba',
    apellidos: 'Registro',
    fechaNacimiento: '2000-01-01',
  };
  const post = (body: object = payload) =>
    request(app.getHttpServer())
      .post('/patients')
      .set('Authorization', `Bearer ${token}`)
      .send(body);
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
        PatientsModule,
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
    token = await module
      .get(JwtService)
      .signAsync({ sub: 42, rol: 'RECEPCION_ADMISIONES' });
  });
  afterAll(async () => {
    await app?.close();
  });
  beforeEach(() => {
    jest.resetAllMocks();
    failHistory = false;
    stored = [];
    prisma.usuario.findUnique.mockResolvedValue({
      activo: true,
      rol: 'RECEPCION_ADMISIONES',
    });
    prisma.paciente.findUnique.mockResolvedValue(null);
    prisma.paciente.findMany.mockResolvedValue([]);
    prisma.paciente.update.mockResolvedValue({ id: 1 });
    prisma.paciente.create.mockImplementation(
      ({
        data,
      }: {
        data: { numeroDocumento: string; historiaClinica?: { create: object } };
      }) => {
        if (!data.historiaClinica?.create)
          return Promise.reject(new Error('Missing nested history'));
        if (failHistory)
          return Promise.reject(new Error('History insert failed'));
        if (stored.some((p) => p.document === data.numeroDocumento))
          return Promise.reject(
            Object.assign(new Error('Duplicate document'), { code: 'P2002' }),
          );
        stored.push({ document: data.numeroDocumento, histories: 1 });
        return Promise.resolve({
          id: stored.length,
          numeroDocumento: data.numeroDocumento,
        });
      },
    );
  });
  it('creates a patient and one empty history in one nested write', async () => {
    await post().expect(201);
    expect(stored).toEqual([
      { document: payload.numeroDocumento, histories: 1 },
    ]);
    expect(prisma.paciente.create).toHaveBeenCalledTimes(1);
    expect(prisma.paciente.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          historiaClinica: { create: {} },
        }) as unknown,
      }),
    );
  });
  it('does not persist the patient when history creation fails', async () => {
    failHistory = true;
    await post().expect(500);
    expect(stored).toEqual([]);
  });
  it('rejects an already registered document without writing', async () => {
    prisma.paciente.findUnique.mockResolvedValue({ id: 1 });
    await post().expect(409);
    expect(prisma.paciente.create).not.toHaveBeenCalled();
  });
  it('handles concurrent duplicates as 409 without a second history', async () => {
    const responses = await Promise.all([post(), post()]);
    expect(responses.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(stored).toHaveLength(1);
    expect(stored[0].histories).toBe(1);
  });
  it('normalizes surrounding whitespace before checking document uniqueness', async () => {
    await post({ ...payload, numeroDocumento: ' TEST-007 ' }).expect(201);
    expect(prisma.paciente.findUnique).toHaveBeenCalledWith({
      where: { numeroDocumento: 'TEST-007' },
    });
  });
  it.each(['tipoDocumento', 'numeroDocumento', 'nombres', 'apellidos'])(
    'rejects blank %s',
    async (field) => {
      await post({ ...payload, [field]: '   ' }).expect(400);
      expect(prisma.paciente.create).not.toHaveBeenCalled();
    },
  );
  it('rejects injected clinical content and author fields', async () => {
    await post({
      ...payload,
      historiaClinica: { diagnosticos: 'Injected' },
      profesionalId: 1,
    }).expect(400);
    expect(prisma.paciente.create).not.toHaveBeenCalled();
  });
  it.each(Object.values(RolUsuario))(
    'enforces patient permissions for %s from database, not token',
    async (rol) => {
      prisma.usuario.findUnique.mockResolvedValue({ activo: true, rol });
      await request(app.getHttpServer())
        .get('/patients')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      const canManage =
        rol === 'ADMINISTRADOR' || rol === 'RECEPCION_ADMISIONES';
      await post().expect(canManage ? 201 : 403);
      await request(app.getHttpServer())
        .patch('/patients/1')
        .set('Authorization', `Bearer ${token}`)
        .send({ nombres: 'Cambio' })
        .expect(canManage ? 200 : 403);
    },
  );
  it('rejects anonymous and inactive callers', async () => {
    await request(app.getHttpServer())
      .post('/patients')
      .send(payload)
      .expect(401);
    prisma.usuario.findUnique.mockResolvedValue({
      activo: false,
      rol: 'RECEPCION_ADMISIONES',
    });
    await post().expect(403);
    expect(prisma.paciente.create).not.toHaveBeenCalled();
  });
  it.each([
    ['P2002', 409],
    ['P2025', 404],
  ] as const)('handles update error %s', async (code, status) => {
    prisma.paciente.update.mockRejectedValue({ code });
    await request(app.getHttpServer())
      .patch('/patients/1')
      .set('Authorization', `Bearer ${token}`)
      .send({ nombres: 'Cambio' })
      .expect(status);
  });
  it('demographic edits do not create or change clinical history', async () => {
    await request(app.getHttpServer())
      .patch('/patients/1')
      .set('Authorization', `Bearer ${token}`)
      .send({ nombres: 'Cambio' })
      .expect(200);
    const data = (prisma.paciente.update.mock.calls[0] as [{ data: object }])[0]
      .data;
    expect(data).not.toHaveProperty('historiaClinica');
    expect(prisma.paciente.create).not.toHaveBeenCalled();
  });
});
