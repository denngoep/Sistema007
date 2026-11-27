import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { randomBytes } from 'node:crypto';
import type { Server } from 'node:http';
import type { Prisma } from '../generated/prisma/client';
import request from 'supertest';
import { ClinicalHistoryModule } from './clinical-history.module';
import { PrismaService } from '../prisma/prisma.service';
import { AuthRepository } from '../repositories/auth.repository';
import { MailService } from '../services/mail.service';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

// Transactional test double: changes are staged and published only on commit.
// No real database connection. Actual controllers, DTOs, services and repositories run.
describe('Atomic clinical encounter over HTTP', () => {
  let app: INestApplication<Server>;
  let token: string;
  type Row = Record<string, unknown>;
  let committed: { attentions: Row[]; diagnoses: Row[]; formulations: Row[] };
  let failure: 'attention' | 'diagnosis' | 'formulation' | 'commit' | undefined;
  let professional: {
    id: number;
    activo: boolean;
    rol: string;
    nombre: string;
  };
  let patientActive: boolean;
  let diagnosisHistory: number;
  let diagnosisActive: boolean;
  let requiresScheme: boolean;
  let schemes: { medicamentos: { medicamento: string }[] }[];
  let duplicateCode: boolean;
  let conflicts: number;
  const stagedCounts: number[][] = [];
  const prisma = {
    usuario: { findUnique: jest.fn() },
    // Any accidental repository use of the root client must fail the request.
    paciente: {
      findUnique: jest.fn(() => {
        throw new Error('Root client escaped transaction');
      }),
    },
    $transaction: jest.fn(),
  };
  const body = () => ({
    pacienteId: 9,
    motivoConsulta: 'Control',
    evolucion: 'Control',
    diagnostico: 'Diabetes',
    nuevoDiagnostico: {
      nombre: 'Diabetes',
      codigoCie10: 'E11',
      tipo: 'CRONICO',
    },
    formulacion: {
      vigenciaMeses: 1,
      medicamentos: [
        {
          medicamento: 'Metformina',
          dosis: '1 Tableta',
          frecuencia: 'Cada 2 horas',
          duracion: '30',
          cantidad: 360,
        },
      ],
    },
  });
  const existing = () => {
    return {
      ...body(),
      nuevoDiagnostico: undefined,
      diagnosticoPacienteId: 50,
    };
  };
  const post = (payload: object) =>
    request(app.getHttpServer())
      .post('/clinical-history/encounters')
      .set('Authorization', `Bearer ${token}`)
      .send(payload);

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
        ClinicalHistoryModule,
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
      .signAsync({ sub: 42, rol: 'ADMINISTRADOR' });
  });
  afterAll(async () => {
    await app?.close();
  });
  beforeEach(() => {
    jest.clearAllMocks();
    committed = { attentions: [], diagnoses: [], formulations: [] };
    stagedCounts.length = 0;
    failure = undefined;
    conflicts = 0;
    duplicateCode = false;
    patientActive = true;
    diagnosisHistory = 11;
    diagnosisActive = true;
    requiresScheme = false;
    schemes = [];
    professional = {
      id: 42,
      activo: true,
      rol: 'MEDICO',
      nombre: 'Profesional actual',
    };
    prisma.usuario.findUnique.mockImplementation(() =>
      Promise.resolve(professional),
    );
    prisma.$transaction.mockImplementation(
      async (work: (tx: Prisma.TransactionClient) => Promise<unknown>) => {
        const staged = structuredClone(committed);
        const fail = (operation: typeof failure) => {
          if (failure === operation)
            throw new Error(`Simulated ${operation} failure`);
        };
        const tx = {
          usuario: { findUnique: () => Promise.resolve(professional) },
          paciente: {
            findUnique: () =>
              Promise.resolve({
                id: 9,
                activo: patientActive,
                historiaClinica: { id: 11, atenciones: [] },
              }),
          },
          atencionClinica: {
            findFirst: () => Promise.resolve({ numeroIngreso: 'ING-2026-005' }),
            findUnique: ({ where }: { where: { id?: number } }) =>
              Promise.resolve(
                where.id
                  ? {
                      ...staged.attentions.find((a) => a.id === where.id),
                      historiaClinica: { paciente: { activo: patientActive } },
                    }
                  : null,
              ),
            create: ({ data }: { data: Row }) => {
              fail('attention');
              const row = { ...data, id: 15, profesional: professional };
              staged.attentions.push(row);
              return Promise.resolve(row);
            },
          },
          diagnosticoPaciente: {
            findFirst: () => Promise.resolve(duplicateCode ? { id: 50 } : null),
            findUnique: ({ where }: { where: { id: number } }) =>
              Promise.resolve({
                ...(staged.diagnoses.find((d) => d.id === where.id) ?? {
                  id: 50,
                  historiaClinicaId: diagnosisHistory,
                  activo: diagnosisActive,
                  requiereEsquema: requiresScheme,
                }),
                esquemas: schemes,
              }),
            create: ({ data }: { data: Row }) => {
              fail('diagnosis');
              const row = { ...data, id: 16 };
              staged.diagnoses.push(row);
              return Promise.resolve(row);
            },
          },
          formulacion: {
            create: ({ data }: { data: Row }) => {
              fail('formulation');
              const row = { ...data, id: 17 };
              staged.formulations.push(row);
              return Promise.resolve(row);
            },
          },
        };
        try {
          const result = await work(tx as unknown as Prisma.TransactionClient);
          fail('commit');
          if (conflicts > 0) {
            conflicts--;
            throw Object.assign(new Error('serialization'), { code: 'P2034' });
          }
          committed = staged;
          return result;
        } finally {
          stagedCounts.push([
            staged.attentions.length,
            staged.diagnoses.length,
            staged.formulations.length,
          ]);
        }
      },
    );
  });
  const expectEmpty = () =>
    expect(committed).toEqual({
      attentions: [],
      diagnoses: [],
      formulations: [],
    });

  it('commits attention, new diagnosis and formulation with JWT author and unchanged totals', async () => {
    const response = await post(body()).expect(201);
    expect((response.body as { numeroIngreso: string }).numeroIngreso).toBe(
      '00006',
    );
    expect(committed.attentions[0]).toMatchObject({
      profesionalId: 42,
      historiaClinicaId: 11,
    });
    expect(committed.diagnoses[0]).toMatchObject({
      atencionClinicaId: 15,
      historiaClinicaId: 11,
    });
    expect(committed.formulations[0]).toMatchObject({
      atencionClinicaId: 15,
      diagnosticoPacienteId: 16,
      medicamentos: {
        create: [expect.objectContaining({ cantidad: 360, duracion: '30' })],
      },
    });
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'Serializable',
    });
    expect(prisma.paciente.findUnique).not.toHaveBeenCalled();
  });
  it('reuses existing diagnosis without changing it', async () => {
    await post(existing()).expect(201);
    expect(committed.diagnoses).toEqual([]);
    expect(committed.formulations[0].diagnosticoPacienteId).toBe(50);
  });
  it.each(['attention', 'diagnosis', 'formulation', 'commit'] as const)(
    'rolls back on %s failure',
    async (stage) => {
      failure = stage;
      await post(body()).expect(500);
      expectEmpty();
      const counts = {
        attention: [0, 0, 0],
        diagnosis: [1, 0, 0],
        formulation: [1, 1, 0],
        commit: [1, 1, 1],
      };
      expect(stagedCounts).toEqual([counts[stage]]);
    },
  );
  it('rolls back attention and diagnosis on arithmetic validation failure', async () => {
    const input = body();
    input.formulacion.medicamentos[0].cantidad = 30;
    const response = await post(input).expect(400);
    expect(JSON.stringify(response.body)).toContain('360 unidades');
    expect(stagedCounts).toEqual([[1, 1, 0]]);
    expectEmpty();
  });
  it('rolls back attention on duplicate active CIE-10', async () => {
    duplicateCode = true;
    await post(body()).expect(400);
    expectEmpty();
    expect(stagedCounts).toEqual([[1, 0, 0]]);
  });
  it.each([
    'inactive',
    'otherPatient',
    'missingScheme',
    'unauthorizedMedication',
  ] as const)(
    'preserves diagnosis/scheme validation: %s',
    async (condition) => {
      if (condition === 'inactive') diagnosisActive = false;
      if (condition === 'otherPatient') diagnosisHistory = 99;
      if (
        condition === 'missingScheme' ||
        condition === 'unauthorizedMedication'
      )
        requiresScheme = true;
      if (condition === 'unauthorizedMedication')
        schemes = [{ medicamentos: [{ medicamento: 'Otro' }] }];
      await post(existing()).expect(400);
      expectEmpty();
    },
  );
  it('does not leave a new diagnosis requiring a missing scheme', async () => {
    await post({
      ...body(),
      nuevoDiagnostico: { ...body().nuevoDiagnostico, requiereEsquema: true },
    }).expect(400);
    expectEmpty();
  });
  it('accepts an authorized active scheme', async () => {
    requiresScheme = true;
    schemes = [{ medicamentos: [{ medicamento: 'Metformina' }] }];
    await post(existing()).expect(201);
  });
  it('retries a rolled-back serialization conflict without duplicate records', async () => {
    conflicts = 1;
    await post(body()).expect(201);
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    expect(committed.attentions).toHaveLength(1);
    expect(committed.diagnoses).toHaveLength(1);
    expect(committed.formulations).toHaveLength(1);
  });
  it('returns conflict after bounded retries with no persisted records', async () => {
    conflicts = 3;
    await post(body()).expect(409);
    expectEmpty();
    expect(prisma.$transaction).toHaveBeenCalledTimes(3);
  });
  it('requires JWT', async () => {
    await request(app.getHttpServer())
      .post('/clinical-history/encounters')
      .send(body())
      .expect(401);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it.each(['inactive', 'nurse'])(
    'rejects unauthorized professional %s',
    async (condition) => {
      if (condition === 'inactive') professional.activo = false;
      else professional.rol = 'ENFERMERO';
      await post(body()).expect(403);
      expectEmpty();
    },
  );
  it('rechecks the professional inside the transaction', async () => {
    prisma.usuario.findUnique.mockResolvedValue({ ...professional });
    professional.activo = false;
    await post(body()).expect(403);
    expectEmpty();
  });
  it('rejects inactive patient', async () => {
    patientActive = false;
    await post(body()).expect(400);
    expectEmpty();
  });
  it.each([
    () => ({ ...body(), profesionalId: 1 }),
    () => ({
      ...body(),
      nuevoDiagnostico: { ...body().nuevoDiagnostico, pacienteId: 99 },
    }),
    () => ({
      ...body(),
      formulacion: { ...body().formulacion, atencionClinicaId: 99 },
    }),
    () => ({ ...body(), formulacion: null }),
    () => ({
      ...body(),
      formulacion: { ...body().formulacion, medicamentos: [] },
    }),
    () => ({ ...body(), nuevoDiagnostico: null }),
    () => ({ ...body(), diagnosticoPacienteId: 50 }),
    () => ({ ...existing(), diagnosticoPacienteId: undefined }),
  ])('rejects malformed or ambiguous request %#', async (input) => {
    await post(input()).expect(400);
    expectEmpty();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
