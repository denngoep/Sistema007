import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { randomBytes } from 'node:crypto';
import type { Server } from 'node:http';
import { ClinicalHistoryModule } from './clinical-history.module';
import { FormulationsModule } from '../formulations/formulations.module';
import { PrismaService } from '../prisma/prisma.service';
import { AuthRepository } from '../repositories/auth.repository';
import { MailService } from '../services/mail.service';
import { validateMedication } from '../formulations/medication-validation';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

const medication = {
  medicamento: 'Metformina',
  concentracion: '500 mg',
  formaFarmaceutica: 'Tableta',
  dosis: '1 tableta',
  frecuencia: 'cada 2 horas',
  duracion: '30 días',
  cantidad: 360,
};

describe('Clinical authorship and validation over HTTP (no database)', () => {
  let app: INestApplication<Server>;
  let token: string;
  const prisma = {
    usuario: { findUnique: jest.fn() },
    paciente: { findUnique: jest.fn() },
    atencionClinica: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    formulacion: { create: jest.fn() },
  };
  const attention = {
    pacienteId: 9,
    motivoConsulta: 'Control',
    evolucion: 'Evolución',
    diagnostico: 'Diagnóstico',
  };
  const formula = () => ({
    atencionClinicaId: 15,
    vigenciaMeses: 1,
    medicamentos: [{ ...medication }],
  });

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
        ClinicalHistoryModule,
        FormulationsModule,
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
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    token = await module.get(JwtService).signAsync({
      sub: 42,
      nombre: 'Nombre desactualizado',
      rol: 'ADMINISTRADOR',
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.usuario.findUnique.mockResolvedValue({
      id: 42,
      nombre: 'Médica actual',
      rol: 'MEDICO',
      activo: true,
    });
    prisma.paciente.findUnique.mockResolvedValue({
      id: 9,
      activo: true,
      historiaClinica: { id: 11, atenciones: [] },
    });
    prisma.atencionClinica.findFirst.mockResolvedValue({
      numeroIngreso: '00005',
    });
    prisma.atencionClinica.findUnique.mockImplementation(
      (query: { where: { id?: number } }) =>
        Promise.resolve(
          query.where.id
            ? {
                id: 15,
                historiaClinicaId: 11,
                historiaClinica: { paciente: { activo: true } },
              }
            : null,
        ),
    );
    prisma.atencionClinica.create.mockImplementation(
      (query: { data: object }) =>
        Promise.resolve({
          ...query.data,
          id: 15,
          profesional: { id: 42, nombre: 'Médica actual', rol: 'MEDICO' },
        }),
    );
    prisma.formulacion.create.mockImplementation((query: { data: object }) =>
      Promise.resolve({ id: 16, ...query.data }),
    );
  });
  afterAll(async () => {
    await app?.close();
  });

  const post = (path: string, body: object) =>
    request(app.getHttpServer())
      .post(path)
      .set('Authorization', `Bearer ${token}`)
      .send(body);

  it('takes the author from JWT and returns database identity, preserving admission numbering', async () => {
    const response = await post(
      '/clinical-history/attentions',
      attention,
    ).expect(201);
    expect(prisma.atencionClinica.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          profesionalId: 42,
          historiaClinicaId: 11,
          numeroIngreso: '00006',
        }) as unknown,
        include: {
          profesional: { select: { id: true, nombre: true, rol: true } },
        },
      }),
    );
    expect(
      (response.body as { atencionClinica: { profesional: object } })
        .atencionClinica.profesional,
    ).toEqual({ id: 42, nombre: 'Médica actual', rol: 'MEDICO' });
  });

  it('continues the legacy admission sequence without rewriting existing admissions', async () => {
    prisma.atencionClinica.findFirst.mockResolvedValue({
      numeroIngreso: 'ING-2026-009',
    });
    const response = await post(
      '/clinical-history/attentions',
      attention,
    ).expect(201);
    expect((response.body as { numeroIngreso: string }).numeroIngreso).toBe(
      '00010',
    );
  });

  it('rejects a client-supplied professional ID', async () => {
    await post('/clinical-history/attentions', {
      ...attention,
      profesionalId: 1,
    }).expect(400);
    expect(prisma.atencionClinica.create).not.toHaveBeenCalled();
  });

  it('requires an authenticated active doctor', async () => {
    await request(app.getHttpServer())
      .post('/clinical-history/attentions')
      .send(attention)
      .expect(401);
    for (const user of [
      null,
      { activo: false, rol: 'MEDICO' },
      { activo: true, rol: 'ENFERMERO' },
    ]) {
      prisma.usuario.findUnique.mockResolvedValue(user);
      await post('/clinical-history/attentions', attention).expect(403);
    }
    expect(prisma.atencionClinica.create).not.toHaveBeenCalled();
  });

  it('rechecks professional authorization in the service', async () => {
    prisma.usuario.findUnique
      .mockResolvedValueOnce({ activo: true, rol: 'MEDICO' })
      .mockResolvedValueOnce({ activo: false, rol: 'MEDICO' });
    await post('/clinical-history/attentions', attention).expect(403);
    expect(prisma.atencionClinica.create).not.toHaveBeenCalled();
  });

  it.each(['motivoConsulta', 'evolucion', 'diagnostico'])(
    'rejects empty clinical field %s',
    async (field) => {
      await post('/clinical-history/attentions', {
        ...attention,
        [field]: '   ',
      }).expect(400);
      expect(prisma.atencionClinica.create).not.toHaveBeenCalled();
    },
  );

  it.each(['30', '30 días'])(
    'rejects inconsistent regimen with duration %s without writing',
    async (duracion) => {
      const body = formula();
      body.medicamentos[0].duracion = duracion;
      body.medicamentos[0].cantidad = 30;
      const response = await post('/formulations', body).expect(400);
      expect(JSON.stringify(response.body)).toContain('360');
      expect(prisma.formulacion.create).not.toHaveBeenCalled();
      expect(body.medicamentos[0].cantidad).toBe(30);
    },
  );

  it('preserves the total prescribed and does not multiply it by validity months', async () => {
    const body = { ...formula(), vigenciaMeses: 6 };
    await post('/formulations', body).expect(201);
    expect(prisma.formulacion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          vigenciaMeses: 6,
          medicamentos: { create: [expect.objectContaining(medication)] },
        }) as unknown,
      }),
    );
  });

  it.each([0, -1, 1.5, 2147483648])(
    'rejects invalid quantity %s',
    async (cantidad) => {
      const body = formula();
      body.medicamentos[0].cantidad = cantidad;
      await post('/formulations', body).expect(400);
      expect(prisma.formulacion.create).not.toHaveBeenCalled();
    },
  );

  it.each(['medicamento', 'dosis', 'frecuencia', 'duracion'])(
    'rejects missing or blank %s',
    async (field) => {
      for (const value of [undefined, '   ']) {
        await post('/formulations', {
          ...formula(),
          medicamentos: [{ ...medication, [field]: value }],
        }).expect(400);
      }
      expect(prisma.formulacion.create).not.toHaveBeenCalled();
    },
  );

  it('rejects empty and null detail arrays', async () => {
    for (const medicamentos of [[], [null], null])
      await post('/formulations', { ...formula(), medicamentos }).expect(400);
    expect(prisma.formulacion.create).not.toHaveBeenCalled();
  });

  it('returns a review warning instead of inventing a calculation for a variable regimen', async () => {
    const body = formula();
    body.medicamentos[0].frecuencia = 'según necesidad';
    body.medicamentos[0].cantidad = 30;
    const response = await post('/formulations', body).expect(201);
    expect(
      (response.body as { advertenciasValidacion: string[] })
        .advertenciasValidacion,
    ).toHaveLength(1);
  });

  it('rejects formulations for inactive patients', async () => {
    prisma.atencionClinica.findUnique.mockResolvedValue({
      id: 15,
      historiaClinica: { paciente: { activo: false } },
    });
    await post('/formulations', formula()).expect(400);
    expect(prisma.formulacion.create).not.toHaveBeenCalled();
  });
});

describe('Conservative arithmetic checks', () => {
  it.each(['30', '30 días', ' 30 '])(
    'interprets duration %s as days without changing input',
    (duracion) => {
      const input = Object.freeze({
        ...medication,
        dosis: '1 Tableta',
        frecuencia: 'Cada 2 horas',
        duracion,
        cantidad: 30,
        observaciones: '',
      });
      const result = validateMedication(input, '');
      expect(result.errors[0]).toMatch(/360 unidades.*30/);
      expect(result.warnings).toEqual([]);
      expect(input.duracion).toBe(duracion);
      expect(input.cantidad).toBe(30);
      expect(validateMedication({ ...input, cantidad: 360 }, '')).toEqual({
        errors: [],
        warnings: [],
      });
    },
  );
  it.each([
    {
      dosis: '2 cápsulas',
      frecuencia: '3 veces al día',
      duracion: '1 semana',
      cantidad: 42,
    },
    {
      dosis: '0,5 comprimidos',
      frecuencia: 'cada 12 horas',
      duracion: '30 días',
      cantidad: 30,
    },
  ])('accepts an unambiguous matching regimen %#', (fields) => {
    expect(validateMedication({ ...medication, ...fields })).toEqual({
      errors: [],
      warnings: [],
    });
  });
  it.each([
    { dosis: '500 mg' },
    { dosis: '5 ml' },
    { frecuencia: 'cada 5 horas' },
    { frecuencia: 'cada 48 horas' },
    { duracion: '1 mes' },
    { duracion: '30 h' },
    { duracion: '1.5' },
    { duracion: '1,5' },
    { duracion: '0' },
    { duracion: '-1' },
    { duracion: 'indefinido' },
    { dosis: '1/2 tableta' },
    { observaciones: 'Si presenta dolor' },
  ])(
    'does not guess unsupported or conditional units/schedules %#',
    (fields) => {
      const result = validateMedication({ ...medication, ...fields });
      expect(result.errors).toEqual([]);
      expect(result.warnings).toHaveLength(1);
    },
  );
  it.each([
    { dosis: '0 tabletas' },
    { frecuencia: 'cada 0 horas' },
    { duracion: '-1 días' },
  ])('rejects non-positive interpretable parameters %#', (fields) => {
    expect(
      validateMedication({ ...medication, ...fields }).errors.length,
    ).toBeGreaterThan(0);
  });
  it('does not mutate input or infer duration from validity', () => {
    const original = Object.freeze({
      ...medication,
      cantidad: 30,
      duracion: undefined,
      vigenciaMeses: 1,
    });
    expect(validateMedication(original).errors.join(' ')).toContain('duración');
    expect(original.cantidad).toBe(30);
  });
});
