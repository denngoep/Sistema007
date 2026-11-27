const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const vm = require('node:vm');
function compile(source, globals, requireModule = () => ({})) {
  const context = { exports: {}, require: requireModule, ...globals };
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, context);
  return context.exports;
}
const read = file => fs.readFileSync(path.join(__dirname, '../src', file), 'utf8');
function handler(file, name, globals) {
  const source = read(file);
  const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let expression;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(parsed) === name) expression = node.initializer.getText(parsed);
    ts.forEachChild(node, visit);
  }
  visit(parsed); assert.ok(expression);
  return compile(`export const run = ${expression}`, globals).run;
}
test('permission lookup uses JWT and scope updates use the dedicated endpoint', async () => {
  const calls = [];
  const api = compile(read('services/users.service.ts'), {
    localStorage: { getItem: () => 'test-token' },
    fetch: async (url, options) => { calls.push({ url, options }); return { ok: true, json: async () => ({}) }; },
  });
  await api.getUserPermissions();
  await api.updateUserScope(7, { servicioId: 1, esCoordinador: true });
  assert.equal(calls[0].url, 'http://localhost:3000/users/permissions');
  assert.equal(calls[0].options.headers.Authorization, 'Bearer test-token');
  assert.equal(calls[1].url, 'http://localhost:3000/users/7/scope');
  assert.equal(calls[1].options.method, 'PATCH');
});
for (const mode of ['pending', 'allowed', 'denied', 'error']) {
  test(`user route follows server capability: ${mode}`, async () => {
    const states = []; let index = 0; let effect; let calls = 0;
    const jsx = (type, props) => ({ type, props });
    const Route = compile(read('components/UserManagementRoute.tsx'), {}, name => {
      if (name === 'react') return {
        useState: initial => { const slot = index++; if (!(slot in states)) states[slot] = initial; return [states[slot], value => { states[slot] = value; }]; },
        useEffect: callback => { effect = callback; },
      };
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
      if (name === 'react-router-dom') return { Navigate: 'Navigate', useLocation: () => ({ pathname: '/users' }) };
      if (name.includes('user-management-context')) return { UserManagementContext: { Provider: 'Provider' } };
      return { subscribeUserPermissions: (ok, fail) => { calls++; Promise.resolve().then(() => mode === 'error' ? fail() : ok({ canManageUsers: mode === 'allowed' })); return () => {}; } };
    }).default;
    const first = Route({ children: 'protected' }); assert.equal(first.type, 'p');
    if (mode === 'pending') return;
    const cleanup = effect();
    await new Promise(resolve => setImmediate(resolve)); index = 0;
    const result = Route({ children: 'protected' });
    assert.equal(result.type, mode === 'allowed' ? 'Provider' : 'Navigate');
    assert.equal(calls, 1); cleanup();
  });
}
test('coordinator creation does not send a chosen service', async () => {
  let sent;
  const run = handler('pages/CreateUser.tsx', 'handleSubmit', {
    loading: false, permissions: { isAdmin: false, allowedRoles: ['MEDICO'] }, nombre: 'Nuevo', correo: 'nuevo@example.test', password: 'test-only', rol: 'MEDICO', servicioId: '99',
    setMessage: () => {}, setError: () => {}, setLoading: () => {}, setNombre: () => {}, setCorreo: () => {}, setPassword: () => {}, setRol: () => {}, setServicioId: () => {},
    createUser: async body => { sent = body; return { message: 'OK' }; },
  });
  await run({ preventDefault: () => {} });
  assert.equal(Object.hasOwn(sent, 'servicioId'), false);
  assert.equal(Object.hasOwn(sent, 'esCoordinador'), false);
});
test('coordinator edit never sends existing account credentials', async () => {
  let sent;
  const run = handler('pages/EditUser.tsx', 'handleSubmit', {
    loading: false, permissions: { isAdmin: false, allowedRoles: ['MEDICO'] }, user: { id: 3 }, nombre: 'Nombre', correo: 'injected@example.test', password: 'injected-test', rol: 'MEDICO',
    setMessage: () => {}, setError: () => {}, setLoading: () => {}, setPassword: () => {},
    updateUser: async (id, body) => { sent = body; return { message: 'OK' }; },
  });
  await run({ preventDefault: () => {} });
  assert.deepEqual(JSON.parse(JSON.stringify(sent)), { nombre: 'Nombre', rol: 'MEDICO' });
});
test('coordinator cannot submit administrative scope form', async () => {
  const run = handler('pages/EditUser.tsx', 'handleScope', {
    user: { id: 3 }, permissions: { isAdmin: false },
    updateUserScope: () => assert.fail('Forbidden scope request'),
  });
  await run({ preventDefault: () => {} });
});

for (const isAdmin of [false, true]) {
  test(`rendered edit form matches administrative permissions: ${isAdmin}`, () => {
    const user = { id: 3, nombre: 'Test', correo: 'test@example.test', rol: 'AUXILIAR_FARMACIA', servicioId: 2, esCoordinador: false };
    const permissions = { isAdmin, userId: 1, allowedRoles: ['QUIMICO_FARMACEUTICO', 'REGENTE_FARMACIA', 'AUXILIAR_FARMACIA'], services: [{ id: 2, nombre: 'Farmacia' }] };
    let stateIndex = 0;
    const jsx = (type, props) => ({ type, props });
    const Page = compile(read('pages/EditUser.tsx'), {}, name => {
      if (name === 'react') return { useState: initial => [stateIndex++ === 0 ? user : initial, () => {}], useEffect: () => {} };
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
      if (name === 'react-router-dom') return { useParams: () => ({ id: '3' }), useNavigate: () => {} };
      if (name.includes('user-management-context')) return { useUserManagement: () => permissions };
      return {};
    }).default;
    const nodes = [];
    const walk = value => { if (Array.isArray(value)) return value.forEach(walk); if (value && typeof value === 'object') { nodes.push(value); walk(value.props?.children); } };
    walk(Page());
    const email = nodes.find(node => node.props?.id === 'correo');
    assert.equal(email.props.readOnly, !isAdmin);
    assert.equal(nodes.some(node => node.props?.id === 'password'), isAdmin);
    assert.equal(nodes.some(node => node.props?.id === 'servicio'), isAdmin);
    const roles = nodes.find(node => node.props?.id === 'rol').props.children;
    assert.deepEqual(Array.from(roles, node => node.props.value), permissions.allowedRoles);
    if (!isAdmin) assert.ok(nodes.some(node => typeof node.props?.children === 'string' && node.props.children.includes('solo lectura')));
  });
}

function permissionEnvironment() {
  const listeners = new Map();
  let timer, token = 'initial-token';
  const pending = [];
  const window = {
    addEventListener: (name, callback) => listeners.set(name, callback),
    removeEventListener: name => listeners.delete(name),
    setInterval: (callback, ms) => { assert.equal(ms, 30000); timer = callback; return 1; },
    clearInterval: () => { timer = undefined; },
    dispatchEvent: event => listeners.get(event.type)?.(),
  };
  const document = { visibilityState: 'visible', addEventListener: window.addEventListener, removeEventListener: window.removeEventListener };
  const api = compile(read('services/users.service.ts'), {
    window, document, Event,
    localStorage: { getItem: () => token },
    fetch: (url, options) => new Promise(resolve => pending.push({ url, options, resolve })),
  });
  const respond = (index, data, status = 200) => pending[index].resolve({ ok: status < 400, status, json: async () => data });
  return { api, listeners, pending, respond, tick: () => timer(), setToken: value => { token = value; } };
}
const flush = () => new Promise(resolve => setImmediate(resolve));

test('permission subscription refreshes on focus, periodic check and denial, and cleans up', async () => {
  const env = permissionEnvironment(); const values = []; let errors = 0;
  const cleanup = env.api.subscribeUserPermissions(value => values.push(value), () => { errors++; });
  env.respond(0, { canManageUsers: true }); await flush();
  env.listeners.get('focus')(); env.respond(1, { canManageUsers: false }); await flush();
  assert.deepEqual(values.map(v => v.canManageUsers), [true, false]);
  env.tick(); env.respond(2, {}, 403); await flush(); assert.equal(errors, 1);
  const denied = env.api.getUsers(); env.respond(3, {}, 403);
  await assert.rejects(denied, /autorización/);
  assert.equal(env.pending.length, 5); // An HTTP rejection triggers a fresh permission check.
  cleanup(); env.respond(4, { canManageUsers: true }); await flush();
  assert.equal(values.length, 2); assert.equal(env.listeners.size, 0);
});
test('out-of-order and previous-session permission responses cannot restore access', async () => {
  const env = permissionEnvironment(); const values = []; let errors = 0;
  const cleanup = env.api.subscribeUserPermissions(value => values.push(value), () => { errors++; });
  env.listeners.get('focus')(); env.respond(1, { canManageUsers: false }); await flush();
  env.respond(0, { canManageUsers: true }); await flush();
  assert.deepEqual(values.map(v => v.canManageUsers), [false]);
  env.tick(); env.setToken('different-session'); env.respond(2, { canManageUsers: true }); await flush();
  assert.equal(errors, 1); assert.equal(values.length, 1); cleanup();
});
