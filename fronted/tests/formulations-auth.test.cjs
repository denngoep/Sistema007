const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync(path.join(__dirname, '../src/services/formulations.service.ts'), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function setup() {
  let token = 'test-token';
  const calls = [];
  const context = {
    exports: {}, Headers,
    localStorage: { getItem: (key) => key === 'token' ? token : null },
    fetch: async (url, init) => {
      calls.push({ url, init });
      return { ok: true, json: async () => ({ ok: true }) };
    },
  };
  vm.runInNewContext(compiled, context);
  return { api: context.exports, calls, setToken: (value) => { token = value; } };
}

const cases = [
  ['createFormulation', { atencionClinicaId: 1, vigenciaMeses: 1, medicamentos: [] }, '/formulations', 'POST'],
  ['createPatientDiagnosis', { pacienteId: 7, nombre: 'Test', tipo: 'OTRO' }, '/formulations/diagnoses', 'POST'],
  ['getActiveDiagnosesByPatient', 7, '/formulations/patient/7/diagnoses', 'GET'],
  ['getActiveFormulationsByPatient', 7, '/formulations/patient/7/active', 'GET'],
];

for (const [method, body, suffix, verb] of cases) {
  test(`${method}: sends current JWT and preserves the request`, async () => {
    const env = setup();
    env.setToken('current-test-token');
    await env.api[method](body);
    assert.equal(env.calls.length, 1);
    const call = env.calls[0];
    assert.ok(call.url.endsWith(suffix));
    assert.equal(call.init.headers.get('Authorization'), 'Bearer current-test-token');
    assert.equal(call.init.method || 'GET', verb);
    if (verb === 'POST') {
      assert.equal(call.init.headers.get('Content-Type'), 'application/json');
      assert.deepEqual(JSON.parse(call.init.body), body);
    }
  });

  test(`${method}: does not send an anonymous request`, async () => {
    const env = setup();
    env.setToken(null);
    await assert.rejects(env.api[method](body), /iniciar sesión/);
    assert.equal(env.calls.length, 0);
  });
}
