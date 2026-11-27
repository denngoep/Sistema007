// Arithmetic checks only; this does not assess clinical appropriateness.
// Kept identical in both apps; parity is checked by the frontend tests.
export interface MedicationValidationInput {
  medicamento: string;
  dosis: string;
  frecuencia: string;
  duracion?: string | null;
  cantidad: number;
  observaciones?: string | null;
}

export interface MedicationValidation {
  errors: string[];
  warnings: string[];
}

const normalize = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

export function validateMedication(
  medication: MedicationValidationInput,
  indicaciones?: string | null,
): MedicationValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const required = [
    ['medicamento', 'medicamento'],
    ['dosis', 'dosis'],
    ['frecuencia', 'frecuencia'],
    ['duracion', 'duración del tratamiento'],
  ] as const;

  for (const [key, label] of required) {
    if (typeof medication[key] !== 'string' || !medication[key]?.trim()) {
      errors.push(`Debe registrar ${label}.`);
    }
  }
  if (
    !Number.isSafeInteger(medication.cantidad) ||
    medication.cantidad < 1 ||
    medication.cantidad > 2147483647
  ) {
    errors.push(
      'La cantidad total prescrita debe ser un entero positivo válido.',
    );
  }
  if (errors.length) return { errors, warnings };

  const dose = normalize(medication.dosis).match(
    /^(-?\d+(?:[.,]\d+)?)\s+(tabletas?|comprimidos?|capsulas?)$/,
  );
  const frequency = normalize(medication.frecuencia);
  const hours = frequency.match(
    /^(?:cada\s+)?(-?\d+(?:[.,]\d+)?)\s*(?:horas?|h)$/,
  );
  const times = frequency.match(/^(-?\d+)\s+veces?\s+al\s+dia$/);
  const durationText = normalize(medication.duracion!);
  // The form expresses unitless positive integers in days.
  const unitlessDays =
    /^\d+$/.test(durationText) &&
    Number.isSafeInteger(Number(durationText)) &&
    Number(durationText) > 0
      ? Number(durationText)
      : undefined;
  const duration = durationText.match(
    /^(-?\d+(?:[.,]\d+)?)\s+(dias?|semanas?)$/,
  );
  const numeric = (value: string) => Number(value.replace(',', '.'));
  const doseUnits = dose ? numeric(dose[1]) : undefined;
  const intervalHours = hours ? numeric(hours[1]) : undefined;
  const dailyTimes = times ? numeric(times[1]) : undefined;
  const days = duration
    ? numeric(duration[1]) * (duration[2].startsWith('semana') ? 7 : 1)
    : unitlessDays;

  if (
    doseUnits !== undefined &&
    (!Number.isFinite(doseUnits) || doseUnits <= 0)
  ) {
    errors.push('La dosis expresada en unidades debe ser mayor que cero.');
  }
  if (
    (intervalHours !== undefined &&
      (!Number.isFinite(intervalHours) || intervalHours <= 0)) ||
    (dailyTimes !== undefined &&
      (!Number.isSafeInteger(dailyTimes) || dailyTimes <= 0))
  ) {
    errors.push(
      'El intervalo o número de administraciones debe ser mayor que cero y válido.',
    );
  }
  if (days !== undefined && (!Number.isFinite(days) || days <= 0)) {
    errors.push('La duración del tratamiento debe ser mayor que cero.');
  }
  if (errors.length) return { errors, warnings };

  // Conditional/variable instructions cannot be reduced to a fixed daily total.
  const instructions = normalize(
    `${indicaciones ?? ''} ${medication.observaciones ?? ''}`,
  );
  const variable =
    /\b(segun|necesidad|prn|sos|rescate|altern\w*|escalon\w*|titul\w*|ajust\w*|suspend\w*|hasta|maxim\w*|si)\b/.test(
      instructions,
    );
  const administrations = intervalHours ? 24 / intervalHours : dailyTimes;
  if (
    variable ||
    doseUnits === undefined ||
    days === undefined ||
    administrations === undefined ||
    !Number.isSafeInteger(days) ||
    !Number.isSafeInteger(administrations)
  ) {
    warnings.push(
      'No se pudo comprobar automáticamente la cantidad para esta pauta. Revise dosis, frecuencia, duración y unidad de entrega; la vigencia no sustituye la duración.',
    );
    return { errors, warnings };
  }

  const expected = doseUnits * administrations * days;
  if (!Number.isSafeInteger(expected) || expected < 1) {
    warnings.push(
      'La pauta requiere revisión manual de unidades fraccionadas o del total; no se redondeó ni modificó la cantidad.',
    );
  } else if (medication.cantidad !== expected) {
    errors.push(
      `La pauta indicada corresponde aritméticamente a ${expected} unidades y la cantidad total prescrita es ${medication.cantidad}. Revise dosis, frecuencia, duración y cantidad; no se modificó ningún valor.`,
    );
  }
  return { errors, warnings };
}
