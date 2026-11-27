import type { CreateFormulationData, CreatePatientDiagnosisData } from './formulations.service';

export interface ClinicalHistoryPatient {
  id: number;
  tipoDocumento: string;
  numeroDocumento: string;
  nombres: string;
  apellidos: string;
  fechaNacimiento: string;
  telefono: string | null;
  correo: string | null;
  activo: boolean;
}

export interface ClinicalAttentionProfessional {
  id: number;
  nombre: string;
  rol: string;
}

export interface ClinicalAttention {
  id: number;
  historiaClinicaId: number;
  profesionalId: number;
  numeroIngreso: string;
  fechaAtencion: string;
  motivoConsulta: string | null;
  evolucion: string | null;
  diagnostico: string | null;
  observaciones: string | null;
  createdAt: string;
  updatedAt: string;
  profesional: ClinicalAttentionProfessional;
  diagnosticosPaciente: Array<{
    id: number;
    codigoCie10: string | null;
    nombre: string;
    tipo: string;
    observaciones: string | null;
  }>;
  formulaciones: Array<{
    id: number;
    fechaFormulacion: string;
    vigenciaMeses: number;
    indicaciones: string | null;
    estado: string;
    diagnosticoPaciente: { codigoCie10: string | null; nombre: string } | null;
    medicamentos: Array<{
      id: number;
      medicamento: string;
      concentracion: string | null;
      formaFarmaceutica: string | null;
      dosis: string;
      frecuencia: string;
      duracion: string | null;
      cantidad: number;
      viaAdministracion: string | null;
      observaciones: string | null;
    }>;
  }>;
}

export interface ClinicalHistory {
  id: number;
  pacienteId: number;
  grupoSanguineo: string | null;
  alergias: string | null;
  antecedentes: string | null;
  diagnosticos: string | null;
  observaciones: string | null;
  createdAt: string;
  updatedAt: string;
  atenciones: ClinicalAttention[];
}

export interface ClinicalHistoryResponse {
  paciente: ClinicalHistoryPatient;
  historiaClinica: ClinicalHistory;
}

export interface CreateClinicalAttentionRequest {
  pacienteId: number;
  motivoConsulta: string;
  evolucion: string;
  diagnostico: string;
  observaciones?: string;
}

export interface CreateClinicalAttentionResponse {
  message: string;
  numeroIngreso: string;
  atencionClinica: ClinicalAttention;
}

export type CreateClinicalEncounterRequest = CreateClinicalAttentionRequest & {
  formulacion: Omit<CreateFormulationData, 'atencionClinicaId' | 'diagnosticoPacienteId'>;
} & (
  | { diagnosticoPacienteId: number; nuevoDiagnostico?: never }
  | { nuevoDiagnostico: Omit<CreatePatientDiagnosisData, 'pacienteId' | 'atencionClinicaId'>; diagnosticoPacienteId?: never }
);

export interface CreateClinicalEncounterResponse extends CreateClinicalAttentionResponse {
  diagnosticoPacienteId: number;
  formulacion: { id: number; advertenciasValidacion: string[] };
}

const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:3000").replace(/\/$/, "");

// Obtener el token JWT de la sesión actual.
function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem("token");

  if (!token) {
    throw new Error("No hay una sesión activa. Inicia sesión nuevamente.");
  }

  return {
    Authorization: `Bearer ${token}`,
  };
}

// Procesar las respuestas del backend.
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

// Consultar la historia clínica de un paciente.
export async function getClinicalHistoryByPatient(
  patientId: number,
): Promise<ClinicalHistoryResponse> {
  const response = await fetch(
    `${API_URL}/clinical-history/patient/${patientId}`,
    {
      method: "GET",
      headers: getAuthHeaders(),
    },
  );

  return getResponseData(response);
}

// Registrar una nueva atención clínica.
export async function createClinicalAttention(
  attentionData: CreateClinicalAttentionRequest,
): Promise<CreateClinicalAttentionResponse> {
  const response = await fetch(`${API_URL}/clinical-history/attentions`, {
    method: "POST",
    headers: {
      ...getAuthHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(attentionData),
  });

  return getResponseData(response);
}

export async function createClinicalEncounter(
  encounter: CreateClinicalEncounterRequest,
): Promise<CreateClinicalEncounterResponse> {
  const response = await fetch(`${API_URL}/clinical-history/encounters`, {
    method: 'POST',
    headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(encounter),
  });
  return getResponseData(response);
}
