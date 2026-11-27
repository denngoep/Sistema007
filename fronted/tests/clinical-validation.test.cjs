const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(relative, globals = {}) {
  const source = fs.readFileSync(path.join(__dirname, relative), 'utf8');
  const context = { exports: {}, ...globals };
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, context);
  return context.exports;
}

const { validateMedication } = load('../src/validation/medication-validation.ts');
const medication = { medicamento: 'Metformina', dosis: '1 tableta', frecuencia: 'cada 2 horas', duracion: '30 días', cantidad: 30 };

test('backend and frontend use identical arithmetic rules', () => {
  const read = (name) => fs.readFileSync(path.join(__dirname, name), 'utf8').replace(/\r\n/g, '\n');
  assert.equal(read('../src/validation/medication-validation.ts'), read('../../backend/src/formulations/medication-validation.ts'));
});

test('rejects the reported mismatch without changing the prescription', () => {
  const input = Object.freeze({ ...medication });
  const result = validateMedication(input);
  assert.match(result.errors[0], /360 unidades/);
  assert.equal(input.cantidad, 30);
});

for (const duracion of ['30', '30 días', ' 30 ']) {
  test(`blocks inconsistent quantity for duration ${JSON.stringify(duracion)}`, () => {
    const input = Object.freeze({ ...medication, dosis: '1 Tableta', frecuencia: 'Cada 2 horas', duracion, observaciones: '' });
    const result = validateMedication(input, '');
    assert.match(result.errors[0], /360 unidades.*30/);
    assert.equal(result.warnings.length, 0);
    assert.equal(input.duracion, duracion);
    assert.equal(input.cantidad, 30);
    const valid = validateMedication({ ...input, cantidad: 360 }, '');
    assert.equal(valid.errors.length, 0);
    assert.equal(valid.warnings.length, 0);
  });
}
for (const duracion of ['1 mes', '30 h', '1.5', '1,5', '0', '-1']) {
  test(`does not infer days from ${JSON.stringify(duracion)}`, () => {
    const result = validateMedication({ ...medication, duracion });
    assert.equal(result.errors.length, 0);
    assert.equal(result.warnings.length, 1);
  });
}

test('accepts matching total units', () => {
  const result = validateMedication({ ...medication, cantidad: 360 });
  assert.equal(result.errors.length, 0);
  assert.equal(result.warnings.length, 0);
});

for (const field of ['medicamento', 'dosis', 'frecuencia', 'duracion']) {
  test(`requires ${field} independently of validity`, () => {
    assert.ok(validateMedication({ ...medication, [field]: ' ', vigenciaMeses: 1 }).errors.length);
  });
}
for (const cantidad of [0, -1, 0.5, NaN, Infinity, 2147483648]) {
  test(`rejects invalid quantity ${cantidad}`, () => {
    assert.ok(validateMedication({ ...medication, cantidad }).errors.length);
  });
}
for (const fields of [{ dosis: '500 mg' }, { frecuencia: 'según necesidad' }, { duracion: 'indefinido' }]) {
  test(`requires manual review for ${JSON.stringify(fields)}`, () => {
    const result = validateMedication({ ...medication, ...fields });
    assert.equal(result.errors.length, 0);
    assert.equal(result.warnings.length, 1);
  });
}

test('clinical service sends JWT and a request without a professional ID', async () => {
  let captured;
  const api = load('../src/services/clinical-history.service.ts', {
    localStorage: { getItem: () => 'test-only' },
    fetch: (url, options) => {
      captured = { url, options };
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    },
  });
  const body = { pacienteId: 9, motivoConsulta: 'Control', evolucion: 'Evolución', diagnostico: 'Diagnóstico' };
  await api.createClinicalAttention(body);
  assert.equal(captured.options.headers.Authorization, 'Bearer test-only');
  assert.deepEqual(JSON.parse(captured.options.body), body);
  assert.equal(Object.hasOwn(JSON.parse(captured.options.body), 'profesionalId'), false);
});

for (const diagnosis of [{ diagnosticoPacienteId: 50 }, { nuevoDiagnostico: { nombre: 'Diabetes', tipo: 'CRONICO' } }]) {
  test(`atomic encounter sends one authenticated request: ${Object.keys(diagnosis)[0]}`, async () => {
    const calls = [];
    const api = load('../src/services/clinical-history.service.ts', {
      localStorage: { getItem: () => 'test-only' },
      fetch: (url, options) => {
        calls.push({ url, options });
        return Promise.resolve({ ok: true, json: async () => ({ numeroIngreso: '00006' }) });
      },
    });
    const body = { pacienteId: 9, motivoConsulta: 'Control', evolucion: 'Control', diagnostico: 'Diabetes', ...diagnosis, formulacion: { vigenciaMeses: 1, medicamentos: [{ ...medication, cantidad: 360 }] } };
    const result = await api.createClinicalEncounter(body);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'http://localhost:3000/clinical-history/encounters');
    assert.equal(calls[0].options.headers.Authorization, 'Bearer test-only');
    assert.equal(calls[0].options.method, 'POST');
    assert.deepEqual(JSON.parse(calls[0].options.body), body);
    assert.equal(result.numeroIngreso, '00006');
  });
}

test('atomic encounter reports failure without falling back to sequential writes', async () => {
  let calls = 0;
  const api = load('../src/services/clinical-history.service.ts', {
    localStorage: { getItem: () => 'test-only' },
    fetch: async () => { calls++; return { ok: false, json: async () => ({ message: ['Error de formulación'] }) }; },
  });
  await assert.rejects(api.createClinicalEncounter({}), /Error de formulación/);
  assert.equal(calls, 1);
});

test('atomic encounter refuses anonymous submission', async () => {
  let calls = 0;
  const api = load('../src/services/clinical-history.service.ts', {
    localStorage: { getItem: () => null },
    fetch: async () => { calls++; throw new Error('Unexpected request'); },
  });
  await assert.rejects(api.createClinicalEncounter({}), /sesión activa/);
  assert.equal(calls, 0);
});

function loadSubmission(globals) {
  const source = fs.readFileSync(path.join(__dirname, '../src/pages/ClinicalHistory.tsx'), 'utf8');
  const parsed = ts.createSourceFile('ClinicalHistory.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let handler;
  const visit = (node) => {
    if (ts.isVariableDeclaration(node) && node.name.getText(parsed) === 'handleCreateAttention') handler = node.initializer.getText(parsed);
    ts.forEachChild(node, visit);
  };
  visit(parsed);
  assert.ok(handler);
  const context = { exports: {}, ...globals };
  vm.runInNewContext(ts.transpileModule(`export const submit = ${handler}`, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, context);
  return context.exports.submit;
}

test('actual clinical form refuses submission by a read-only role', async () => {
  let message = '';
  const submit = loadSubmission({ canRegisterAttention: false, savingAttention: false, setAttentionError: value => { message = value; } });
  await submit({ preventDefault: () => {} });
  assert.match(message, /permisos/);
});

for (const scenario of ['existing', 'new', 'serverFailure', 'arithmeticFailure', 'cancelWarning']) {
  test(`actual form submission uses atomic flow: ${scenario}`, async () => {
    const calls = [];
    const errors = [];
    let cleared = 0;
    let reloaded = 0;
    const pendingDiagnosis = scenario === 'new' ? { nombre: 'Diabetes', tipo: 'CRONICO', codigoCie10: 'E11', requiereEsquema: false } : null;
    const submit = loadSubmission({
      canRegisterAttention: true, savingAttention: false, patientId: '9', motivoConsulta: ' Control ', evolucion: ' Control ', diagnostico: ' Diabetes ',
      diagnosticoPacienteId: pendingDiagnosis ? '' : '50', pendingDiagnosis, vigenciaMeses: '1', indicaciones: '', observacionesAtencion: '',
      medicamentos: [{ ...medication, duracion: '30', cantidad: scenario === 'arithmeticFailure' ? '30' : '360', dosis: scenario === 'cancelWarning' ? '500 mg' : '1 tableta', concentracion: '', formaFarmaceutica: '', viaAdministracion: '', observaciones: '' }],
      validateMedication, window: { confirm: () => false },
      setAttentionError: value => errors.push(value), setAttentionSuccess: () => {}, setSavingAttention: () => {}, setShowAttentionForm: () => {},
      clearAttentionForm: () => { cleared++; }, loadClinicalHistory: async () => { reloaded++; },
      createClinicalEncounter: async (body) => {
        calls.push(body);
        if (scenario === 'serverFailure') throw new Error('Simulated failure');
        return { numeroIngreso: '00006' };
      },
    });
    await submit({ preventDefault: () => {} });
    const blocked = ['arithmeticFailure', 'cancelWarning'].includes(scenario);
    assert.equal(calls.length, blocked ? 0 : 1);
    const success = ['existing', 'new'].includes(scenario);
    assert.equal(cleared, success ? 1 : 0);
    assert.equal(reloaded, success ? 1 : 0);
    if (!blocked) {
      assert.equal(calls[0].pacienteId, 9);
      assert.equal(calls[0].formulacion.medicamentos[0].cantidad, 360);
      assert.equal(Object.hasOwn(calls[0], 'profesionalId'), false);
      if (pendingDiagnosis) assert.deepEqual(JSON.parse(JSON.stringify(calls[0].nuevoDiagnostico)), pendingDiagnosis);
      else assert.equal(calls[0].diagnosticoPacienteId, 50);
    }
    if (scenario === 'arithmeticFailure') assert.match(errors.join(' '), /360 unidades/);
    if (scenario === 'serverFailure') assert.ok(errors.some(Boolean));
  });
}
