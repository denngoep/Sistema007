import { DispensationDocumentsService } from '../dispensations/dispensation-documents.service';
jest.mock('../dispensations/dispensation-documents.service', () => ({
  DispensationDocumentsService: class {},
}));
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { randomBytes } from 'node:crypto';
import type { Server } from 'node:http';
import request from 'supertest';
import { JwtAuthGuard } from './jwt-auth.guard';
import { getJwtOptions } from './jwt.config';
import { RolUsuario } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { UsersController } from '../controllers/users.controller';
import { ClinicalHistoryController } from '../controllers/clinical-history.controller';
import { InventoryController } from '../controllers/inventory.controller';
import { InventoryMovementsController } from '../controllers/inventory-movements.controller';
import { DispensationsController } from '../controllers/dispensations.controller';
import { UsersService } from '../services/users.service';
import { ClinicalHistoryService } from '../services/clinical-history.service';
import { ClinicalEncounterService } from '../services/clinical-encounter.service';
import { InventoryService } from '../services/inventory.service';
import { InventoryMovementsService } from '../services/inventory-movements.service';
import { DispensationsService } from '../services/dispensations.service';

jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));
jest.mock('../generated/prisma/client', () =>
  jest.requireActual<typeof import('../generated/prisma/enums')>(
    '../generated/prisma/enums',
  ),
);
jest.mock('../services/users.service', () => ({ UsersService: class {} }));
jest.mock('../services/clinical-history.service', () => ({
  ClinicalHistoryService: class {},
}));
jest.mock('../services/clinical-encounter.service', () => ({
  ClinicalEncounterService: class {},
}));
jest.mock('../services/inventory.service', () => ({
  InventoryService: class {},
}));
jest.mock('../services/inventory-movements.service', () => ({
  InventoryMovementsService: class {},
}));
jest.mock('../services/dispensations.service', () => ({
  DispensationsService: class {},
}));

// Real JWT guard and controllers; business services and database are simulated.
describe('HTTP role boundaries (no database)', () => {
  let app: INestApplication<Server>;
  let token: string;
  const usuario = { findUnique: jest.fn() };
  const action = jest.fn(() => Promise.resolve({ ok: true }));
  const pharmacy = [
    'REGENTE_FARMACIA',
    'QUIMICO_FARMACEUTICO',
    'AUXILIAR_FARMACIA',
  ];
  const managers = ['REGENTE_FARMACIA', 'QUIMICO_FARMACEUTICO'];
  const cases: {
    method: 'get' | 'post' | 'patch';
    url: string;
    roles: string[];
  }[] = [
    { method: 'get', url: '/users', roles: ['ADMINISTRADOR'] },
    { method: 'post', url: '/users', roles: ['ADMINISTRADOR'] },
    { method: 'patch', url: '/users/1', roles: ['ADMINISTRADOR'] },
    { method: 'patch', url: '/users/1/status', roles: ['ADMINISTRADOR'] },
    {
      method: 'get',
      url: '/clinical-history/patient/1',
      roles: ['ADMINISTRADOR', 'MEDICO', 'ENFERMERO'],
    },
    { method: 'post', url: '/clinical-history/attentions', roles: ['MEDICO'] },
    { method: 'post', url: '/clinical-history/encounters', roles: ['MEDICO'] },
    {
      method: 'get',
      url: '/inventory/products',
      roles: ['ADMINISTRADOR', ...pharmacy],
    },
    {
      method: 'post',
      url: '/inventory/products',
      roles: ['ADMINISTRADOR', ...managers],
    },
    {
      method: 'get',
      url: '/inventory/warehouses/management',
      roles: ['ADMINISTRADOR', ...managers],
    },
    {
      method: 'get',
      url: '/inventory/sites',
      roles: ['ADMINISTRADOR', ...managers],
    },
    {
      method: 'patch',
      url: '/inventory/warehouses/1',
      roles: ['ADMINISTRADOR', ...managers],
    },
    {
      method: 'post',
      url: '/inventory/transfers',
      roles: ['ADMINISTRADOR', ...pharmacy],
    },
    ...[
      '/inventory/movements',
      '/inventory/movements/export/excel',
      '/inventory/stock-report',
      '/inventory/stock-report/export/excel',
    ].map((url) => ({
      method: 'get' as const,
      url,
      roles: ['ADMINISTRADOR', ...pharmacy],
    })),
    {
      method: 'get',
      url: '/dispensations/patient/TEST/medications',
      roles: ['ADMINISTRADOR', ...pharmacy],
    },
    { method: 'post', url: '/dispensations', roles: pharmacy },
    { method: 'post', url: '/dispensations/validate', roles: pharmacy },
    { method: 'post', url: '/dispensations/1/receipt', roles: pharmacy },
    { method: 'post', url: '/dispensations/1/signature', roles: pharmacy },
    {
      method: 'post',
      url: '/dispensations/1/supports/corrections',
      roles: pharmacy,
    },
    ...[
      '/dispensations',
      '/dispensations/1',
      '/dispensations/requests/test',
      '/dispensations/1/supports',
      '/dispensations/1/documents/1',
      '/dispensations/reports/options',
      '/dispensations/reports',
      '/dispensations/reports/export/excel',
      '/dispensations/reports/export/pdf',
    ].map((url) => ({
      method: 'get' as const,
      url,
      roles: ['ADMINISTRADOR', ...pharmacy],
    })),
  ];
  beforeAll(async () => {
    const config = new ConfigService({
      JWT_SECRET: randomBytes(32).toString('hex'),
    });
    const module = await Test.createTestingModule({
      imports: [JwtModule.register(getJwtOptions(config))],
      controllers: [
        UsersController,
        ClinicalHistoryController,
        InventoryController,
        InventoryMovementsController,
        DispensationsController,
      ],
      providers: [
        JwtAuthGuard,
        {
          provide: DispensationDocumentsService,
          useValue: {
            receipt: action,
            support: action,
            history: action,
            detail: action,
            recover: action,
            reportOptions: action,
            report: action,
            reportExcel: jest.fn(() => {
              void action();
              return Promise.resolve(Buffer.from('excel'));
            }),
            reportPdf: jest.fn(() => {
              void action();
              return Promise.resolve(Buffer.from('%PDF-'));
            }),
            download: jest.fn(() => {
              void action();
              return Promise.resolve({
                bytes: Buffer.from('test'),
                mime: 'application/pdf',
                filename: 'test.pdf',
              });
            }),
          },
        },
        { provide: ConfigService, useValue: config },
        { provide: PrismaService, useValue: { usuario } },
        {
          provide: UsersService,
          useValue: {
            getUsers: action,
            createUser: action,
            updateUser: action,
            updateUserStatus: action,
          },
        },
        {
          provide: ClinicalHistoryService,
          useValue: {
            getClinicalHistoryByPatientId: action,
            createClinicalAttention: action,
          },
        },
        { provide: ClinicalEncounterService, useValue: { create: action } },
        {
          provide: InventoryService,
          useValue: {
            getAllProducts: action,
            createProduct: action,
            getWarehousesForAdministration: action,
            getActiveSites: action,
            updateWarehouse: action,
            transferInventory: action,
          },
        },
        {
          provide: InventoryMovementsService,
          useValue: {
            getMovements: action,
            getStockReport: action,
            exportMovements: action,
            exportStock: action,
            exportMovementsExcel: jest.fn(() => {
              void action();
              return Promise.resolve(Buffer.from('excel'));
            }),
            exportStockExcel: jest.fn(() => {
              void action();
              return Promise.resolve(Buffer.from('excel'));
            }),
          },
        },
        {
          provide: DispensationsService,
          useValue: {
            getMedicationsToDispense: action,
            createDispensation: action,
            validateDispensation: action,
            generateReceipt: action,
            registerSignature: action,
          },
        },
      ],
    }).compile();
    app = module.createNestApplication();
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
  });
  for (const route of cases) {
    it.each(Object.values(RolUsuario))(
      `${route.method} ${route.url} enforces database role %s`,
      async (rol) => {
        usuario.findUnique.mockResolvedValue({
          id: 42,
          activo: true,
          rol,
          esCoordinador: !route.url.startsWith('/users'),
          servicioId: 1,
        });
        const allowed = route.roles.includes(rol);
        await request(app.getHttpServer())
          [route.method](route.url)
          .set('Authorization', `Bearer ${token}`)
          .send({})
          .expect(allowed ? (route.method === 'post' ? 201 : 200) : 403);
        expect(action).toHaveBeenCalledTimes(allowed ? 1 : 0);
      },
    );
    it(`${route.method} ${route.url} denies anonymous and inactive requests`, async () => {
      await request(app.getHttpServer())
        [route.method](route.url)
        .send({})
        .expect(401);
      usuario.findUnique.mockResolvedValue({
        id: 42,
        activo: false,
        rol: route.roles[0],
      });
      await request(app.getHttpServer())
        [route.method](route.url)
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(403);
      expect(action).not.toHaveBeenCalled();
    });
  }
});
