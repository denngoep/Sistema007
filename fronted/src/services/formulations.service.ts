export interface FormulationMedication {
  medicamento: string;
  concentracion?: string;
  formaFarmaceutica?: string;
  dosis: string;
  frecuencia: string;
  duracion?: string;
  cantidad: number;
  viaAdministracion?: string;
  observaciones?: string;
}

export interface CreateFormulationData {
  atencionClinicaId: number;
  diagnosticoPacienteId?: number;
  vigenciaMeses: number;
  indicaciones?: string;
  medicamentos: FormulationMedication[];
}

export interface PatientDiagnosis {
  id: number;
  historiaClinicaId: number;
  atencionClinicaId: number | null;
  nombre: string;
  codigoCie10: string | null;
  tipo: string;
  requiereEsquema: boolean;
  fechaDiagnostico: string;
  observaciones: string | null;
  activo: boolean;
}

export interface CreatePatientDiagnosisData {
  pacienteId: number;
  atencionClinicaId?: number;
  nombre: string;
  codigoCie10?: string;
  tipo: "AGUDO" | "CRONICO" | "OTRO";
  requiereEsquema?: boolean;
  observaciones?: string;
}

export interface CreatePatientDiagnosisResponse {
  message: string;
  diagnostico: PatientDiagnosis;
}

export interface ActiveDiagnosesResponse {
  paciente: {
    id: number;
    tipoDocumento: string;
    numeroDocumento: string;
    nombres: string;
    apellidos: string;
    activo: boolean;
  };
  totalDiagnosticos: number;
  diagnosticos: PatientDiagnosis[];
}

const API_URL = "http://localhost:3000";

async function getResponseData(response: Response) {
  const data = await response.json();

  if (!response.ok) {
    const message = data.message;

    throw new Error(
      Array.isArray(message)
        ? message.join(", ")
        : message || "Ocurrió un error al procesar la solicitud",
    );
  }

  return data;
}

export async function createFormulation(formulation: CreateFormulationData) {
  const response = await fetch(`${API_URL}/formulations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(formulation),
  });

  return getResponseData(response);
}

export async function createPatientDiagnosis(
  diagnosis: CreatePatientDiagnosisData,
): Promise<CreatePatientDiagnosisResponse> {
  const response = await fetch(`${API_URL}/formulations/diagnoses`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(diagnosis),
  });

  return getResponseData(response);
}

export async function getActiveDiagnosesByPatient(
  patientId: number,
): Promise<ActiveDiagnosesResponse> {
  const response = await fetch(
    `${API_URL}/formulations/patient/${patientId}/diagnoses`,
  );

  return getResponseData(response);
}

export async function getActiveFormulationsByPatient(patientId: number) {
  const response = await fetch(
    `${API_URL}/formulations/patient/${patientId}/active`,
  );

  return getResponseData(response);
}
