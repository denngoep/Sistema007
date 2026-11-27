import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { randomBytes } from 'node:crypto';
import type { Server } from 'node:http';
import * as bcrypt from 'bcrypt';
import { FormulationsModule } from '../formulations/formulations.module';
import { UsersModule } from '../users/users.module';
import { PrismaService } from '../prisma/prisma.service';
import { AuthRepository } from '../repositories/auth.repository';
import { UsersRepository } from '../repositories/users.repository';
import { AuthService } from '../services/auth.service';
import { MailService } from '../services/mail.service';
import { FormulationsService } from '../services/formulations.service';
import { RolUsuario } from '../generated/prisma/enums';
import { getJwtOptions, getJwtSecret } from './jwt.config';
import { JwtAuthGuard } from './jwt-auth.guard';
import type { ExecutionContext } from '@nestjs/common';

// Avoid loading the generated database driver in these isolated HTTP tests.
jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

describe('JWT configuration', () => {
  it.each([undefined, '', '   ', 'too-short', 'dev-secret-change-me'])(
    'rejects missing or unsafe configuration (case %#)',
    (secret) => {
      const config = { get: () => secret } as unknown as ConfigService;
      expect(() => getJwtSecret(config)).toThrow('JWT_SECRET');
    },
  );

  it('preserves the configured value exactly', () => {
    const secret = ` ${randomBytes(32).toString('hex')} `;
    const config = new ConfigService({ JWT_SECRET: secret });
    expect(getJwtSecret(config) === secret).toBe(true);
  });

  it('fails module initialization without a valid secret', async () => {
    await expect(
      Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({ ignoreEnvFile: true, isGlobal: true }),
          JwtModule.registerAsync({
            inject: [ConfigService],
            useFactory: getJwtOptions,
          }),
        ],
      })
        .overrideProvider(ConfigService)
        .useValue({ get: () => undefined })
        .compile(),
    ).rejects.toThrow('JWT_SECRET');
  });

  it('verifies using the same configuration even with an unconfigured JwtService', async () => {
    const config = new ConfigService({
      JWT_SECRET: randomBytes(32).toString('hex'),
    });
    const issuer = new JwtService(getJwtOptions(config));
    const guard = new JwtAuthGuard(new JwtService(), config);
    const req = {
      headers: {
        authorization: `Bearer ${await issuer.signAsync({ sub: 7 })}`,
      },
    };
    const context = {
      switchToHttp: () => ({ getRequest: () => req }),
    } as unknown as ExecutionContext;
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });
});

describe('Access security over HTTP (no database)', () => {
  let app: INestApplication<Server>;
  let jwt: JwtService;
  let authService: AuthService;
  let token: string;
  const usuario = { findUnique: jest.fn() };
  const authRepository = {
    findByEmail: jest.fn(),
    createUser: jest.fn(),
    resetFailedAttempts: jest.fn(),
  };
  const usersRepository = {
    findByEmail: jest.fn(),
    create: jest.fn(),
    findActor: jest.fn().mockResolvedValue({
      id: 7,
      activo: true,
      rol: 'ADMINISTRADOR',
      servicioId: null,
      esCoordinador: false,
      servicio: null,
    }),
    transaction: jest.fn((work: (tx: object) => Promise<unknown>) => work({})),
  };
  const formulationsService = {
    createFormulation: jest.fn(),
    createPatientDiagnosis: jest.fn(),
    getActiveDiagnosesByPatient: jest.fn(),
    getActiveFormulationsByPatient: jest.fn(),
  };
  const routes = [
    {
      method: 'get',
      path: '/formulations/patient/987/diagnoses',
      body: {},
      service: 'getActiveDiagnosesByPatient',
    },
    {
      method: 'get',
      path: '/formulations/patient/987/active',
      body: {},
      service: 'getActiveFormulationsByPatient',
    },
    {
      method: 'post',
      path: '/formulations',
      body: {
        atencionClinicaId: 1,
        vigenciaMeses: 1,
        medicamentos: [
          {
            medicamento: 'Prueba',
            dosis: '1',
            frecuencia: '24h',
            duracion: '1 día',
            cantidad: 1,
          },
        ],
      },
      service: 'createFormulation',
    },
    {
      method: 'post',
      path: '/formulations/diagnoses',
      body: { pacienteId: 987, nombre: 'Prueba', tipo: 'OTRO' },
      service: 'createPatientDiagnosis',
    },
  ] as const;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ ignoreEnvFile: true, isGlobal: true }),
        FormulationsModule,
        UsersModule,
      ],
    })
      .overrideProvider(ConfigService)
      .useValue(
        new ConfigService({ JWT_SECRET: randomBytes(32).toString('hex') }),
      )
      .overrideProvider(PrismaService)
      .useValue({ usuario })
      .overrideProvider(AuthRepository)
      .useValue(authRepository)
      .overrideProvider(UsersRepository)
      .useValue(usersRepository)
      .overrideProvider(MailService)
      .useValue({ sendRecoveryCode: jest.fn() })
      .overrideProvider(FormulationsService)
      .useValue(formulationsService)
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
    jwt = module.get(JwtService);
    authService = module.get(AuthService);
    token = await jwt.signAsync({
      sub: 7,
      email: 'test@example.invalid',
      nombre: 'Test',
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    usuario.findUnique.mockResolvedValue({ activo: true, rol: 'MEDICO' });
    for (const fn of Object.values(formulationsService))
      fn.mockResolvedValue({ ok: true });
  });

  afterAll(async () => {
    await app?.close();
  });

  for (const route of routes) {
    const send = (bearer?: string) => {
      const req = request(app.getHttpServer())[route.method](route.path);
      if (bearer) req.set('Authorization', `Bearer ${bearer}`);
      return req.send(route.body);
    };

    it(`${route.path}: rejects anonymous access before reading patient data`, async () => {
      await send().expect(401);
      expect(usuario.findUnique).not.toHaveBeenCalled();
      expect(formulationsService[route.service]).not.toHaveBeenCalled();
    });

    it(`${route.path}: rejects invalid and expired tokens`, async () => {
      const expired = await jwt.signAsync({ sub: 7 }, { expiresIn: -1 });
      const forged = await new JwtService({
        secret: randomBytes(32).toString('hex'),
      }).signAsync({ sub: 7 });
      const invalidSubject = await jwt.signAsync({ sub: '7' });
      for (const invalid of ['invalid', expired, forged, invalidSubject])
        await send(invalid).expect(401);
      expect(formulationsService[route.service]).not.toHaveBeenCalled();
    });

    it.each(Object.values(RolUsuario))(
      `${route.path}: enforces current database role %s`,
      async (rol) => {
        usuario.findUnique.mockResolvedValue({ activo: true, rol });
        const allowed =
          rol === 'MEDICO' ||
          (route.method === 'get' &&
            (rol === 'ADMINISTRADOR' || rol === 'ENFERMERO'));
        await send(token).expect(
          allowed ? (route.method === 'post' ? 201 : 200) : 403,
        );
        expect(usuario.findUnique).toHaveBeenCalledWith({
          where: { id: 7 },
          select: { activo: true, rol: true },
        });
        if (allowed) {
          expect(formulationsService[route.service]).toHaveBeenCalledTimes(1);
        } else {
          expect(formulationsService[route.service]).not.toHaveBeenCalled();
        }
      },
    );

    it(`${route.path}: rejects inactive/deleted users and ignores a role forged in JWT`, async () => {
      for (const user of [
        null,
        { activo: false, rol: 'MEDICO' },
        { activo: true, rol: 'AUXILIAR_FARMACIA' },
      ]) {
        usuario.findUnique.mockResolvedValue(user);
        await send(await jwt.signAsync({ sub: 7, rol: 'MEDICO' })).expect(403);
      }
      expect(formulationsService[route.service]).not.toHaveBeenCalled();
    });
  }

  it('rejects public registration without looking up or creating users', async () => {
    for (const bearer of [undefined, token]) {
      const req = request(app.getHttpServer()).post('/api/auth/register');
      if (bearer) req.set('Authorization', `Bearer ${bearer}`);
      await req
        .send({
          nombre: 'Test',
          email: 'test@example.invalid',
          password: 'test-password',
          rol: 'ADMINISTRADOR',
        })
        .expect(403);
    }
    expect(authRepository.findByEmail).not.toHaveBeenCalled();
    expect(authRepository.createUser).not.toHaveBeenCalled();
  });

  it('preserves administrative user creation with an explicit validated role', async () => {
    const body = {
      nombre: 'Test',
      correo: 'test@example.invalid',
      password: 'test-password',
      rol: 'MEDICO',
    };
    await request(app.getHttpServer()).post('/users').send(body).expect(401);
    await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', `Bearer ${token}`)
      .send(body)
      .expect(403);
    expect(usersRepository.create).not.toHaveBeenCalled();
    usuario.findUnique.mockResolvedValue({
      activo: true,
      rol: 'ADMINISTRADOR',
    });
    usersRepository.findByEmail.mockResolvedValue(null);
    usersRepository.create.mockResolvedValue({
      id: 8,
      nombre: body.nombre,
      rol: body.rol,
    });
    await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...body, rol: 'UNKNOWN' })
      .expect(400);
    await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', `Bearer ${token}`)
      .send(body)
      .expect(201);
    const args = usersRepository.create.mock.calls[0] as string[];
    expect(args[3]).toBe('MEDICO');
    expect(await bcrypt.compare(body.password, args[2])).toBe(true);
  });

  it('keeps Google and password recovery routes available', async () => {
    const cases = [
      {
        path: 'google',
        method: 'loginWithGoogle',
        body: { credential: 'test-credential' },
      },
      {
        path: 'forgot-password',
        method: 'requestPasswordRecovery',
        body: { email: 'test@example.invalid' },
      },
      {
        path: 'reset-password',
        method: 'resetPassword',
        body: {
          email: 'test@example.invalid',
          codigo: '123456',
          nuevaPassword: 'Test-password1',
        },
      },
    ] as const;
    for (const item of cases) {
      const spy = jest
        .spyOn(authService, item.method)
        .mockResolvedValue({ success: true, message: 'ok' });
      try {
        await request(app.getHttpServer())
          .post(`/api/auth/${item.path}`)
          .send(item.body)
          .expect(201);
        expect(spy).toHaveBeenCalledWith(expect.objectContaining(item.body));
      } finally {
        spy.mockRestore();
      }
    }
  });

  it('issues a login token accepted by the protected routes (CAPTCHA mocked)', async () => {
    const previous = process.env.RECAPTCHA_SECRET_KEY;
    process.env.RECAPTCHA_SECRET_KEY = 'test-only';
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    } as Response);
    authRepository.findByEmail.mockResolvedValue({
      id: 7,
      correo: 'test@example.invalid',
      nombre: 'Test',
      rol: 'MEDICO',
      activo: true,
      intentosFallidos: 0,
      password: await bcrypt.hash('test-password', 4),
    });
    try {
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: 'test@example.invalid',
          password: 'test-password',
          captchaToken: 'test-captcha',
        })
        .expect(201);
      const loginToken = (response.body as { token: string }).token;
      await request(app.getHttpServer())
        .get('/formulations/patient/987/active')
        .set('Authorization', `Bearer ${loginToken}`)
        .expect(200);
    } finally {
      fetchSpy.mockRestore();
      if (previous === undefined) delete process.env.RECAPTCHA_SECRET_KEY;
      else process.env.RECAPTCHA_SECRET_KEY = previous;
    }
  });
});
