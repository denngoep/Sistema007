const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const roles = ['ADMINISTRADOR', 'MEDICO', 'ENFERMERO', 'AUXILIAR_ENFERMERIA', 'RECEPCION_ADMISIONES', 'REGENTE_FARMACIA', 'AUXILIAR_FARMACIA', 'QUIMICO_FARMACEUTICO'];
const jsx = (type, props) => ({ type, props });
function load(file, globals = {}, requireModule = () => ({})) {
  const source = fs.readFileSync(path.join(__dirname, '../src', file), 'utf8');
  const context = { exports: {}, require: requireModule, ...globals };
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, context);
  return context.exports;
}
const { canRegisterClinicalAttention } = load('validation/clinical-access.ts');
const { default: App } = load('App.tsx', {}, name => name === 'react/jsx-runtime' ? { jsx, jsxs: jsx } : name === 'react-router-dom' ? { BrowserRouter: 'BrowserRouter', Routes: 'Routes', Route: 'Route' } : { __esModule: true, default: name });
const routes = App().props.children.props.children;
function authorize(storedUser, route, token = 'test-token') {
  const { default: ProtectedRoute } = load('components/ProtectedRoute.tsx', {
    localStorage: { getItem: key => key === 'token' ? token : storedUser },
  }, name => name === 'react/jsx-runtime' ? { jsx, jsxs: jsx } : name === 'react-router-dom' ? { Navigate: 'Navigate' } : { USER_ROLES: roles });
  return ProtectedRoute({ ...route.props.element.props, children: 'page' });
}
const clinical = ['ADMINISTRADOR', 'MEDICO', 'ENFERMERO'];
const pharmacy = ['REGENTE_FARMACIA', 'AUXILIAR_FARMACIA', 'QUIMICO_FARMACEUTICO'];
const expected = {
  '/dashboard': roles, '/users': ['ADMINISTRADOR'], '/users/new': ['ADMINISTRADOR'], '/users/:id/edit': ['ADMINISTRADOR'],
  '/patients': roles, '/patients/new': ['ADMINISTRADOR', 'RECEPCION_ADMISIONES'], '/patients/:id/edit': ['ADMINISTRADOR', 'RECEPCION_ADMISIONES'],
  '/clinical-history': clinical, '/clinical-history/patient/:patientId': clinical,
  '/inventory': ['ADMINISTRADOR', ...pharmacy], '/inventory/movements': ['ADMINISTRADOR', ...pharmacy],
  '/inventory/receipts/:id/edit': ['ADMINISTRADOR', 'REGENTE_FARMACIA', 'QUIMICO_FARMACEUTICO'], '/dispensations': ['ADMINISTRADOR', ...pharmacy],
};
for (const rol of roles) {
  test(`direct URL access matrix for ${rol}`, () => {
    for (const [url, allowed] of Object.entries(expected)) {
      const route = routes.find(r => r.props.path === url);
      assert.ok(route, url);
      if (url.startsWith('/users')) {
        assert.equal(route.props.element.props.children.type, './components/UserManagementRoute');
        continue; // Dedicated gate checks current backend capabilities, independently of role.
      }
      const result = authorize(JSON.stringify({ rol, activo: true }), route);
      // A role outside the static list renders the asynchronous functional-test
      // gate first. That pending gate is not access: it must receive an explicit
      // backend capability before it renders the protected page.
      const grantsDirectAccess = result.type !== 'Navigate' && typeof result.type !== 'function';
      assert.equal(grantsDirectAccess, allowed.includes(rol), `${rol}: ${url}`);
    }
  });
  test(`clinical write controls for ${rol}`, () => {
    assert.equal(canRegisterClinicalAttention(JSON.stringify({ rol, activo: true })), rol === 'MEDICO');
    assert.equal(canRegisterClinicalAttention(JSON.stringify({ rol, activo: false })), false);
  });
}
test('invalid, inactive and unknown sessions fail closed', () => {
  const route = routes.find(r => r.props.path === '/dashboard');
  for (const value of [null, '{', 'null', JSON.stringify({ rol: 'COORDINADOR', activo: true }), JSON.stringify({ rol: 'MEDICO', activo: 'true' }), JSON.stringify({ rol: 'MEDICO', activo: false })]) {
    assert.equal(authorize(value, route).props.to, '/login');
    assert.equal(canRegisterClinicalAttention(value), false);
  }
  assert.equal(authorize(JSON.stringify({ rol: 'MEDICO', activo: true }), route, null).props.to, '/login');
});
test('Prisma and frontend expose the same roles', () => {
  const schema = fs.readFileSync(path.join(__dirname, '../../backend/prisma/schema.prisma'), 'utf8');
  const prismaRoles = schema.match(/enum RolUsuario\s*\{([^}]+)\}/)[1].trim().split(/\s+/);
  const { USER_ROLES } = load('services/users.service.ts');
  assert.deepEqual(Array.from(USER_ROLES).sort(), prismaRoles.sort());
});
