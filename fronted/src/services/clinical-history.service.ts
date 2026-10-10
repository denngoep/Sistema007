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
  profesionalId: number;
  motivoConsulta?: string;
  evolucion?: string;
  diagnostico?: string;
  observaciones?: string;
}

export interface CreateClinicalAttentionResponse {
  message: string;
  numeroIngreso: string;
  atencionClinica: ClinicalAttention;
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

export async function getClinicalHistoryByPatient(
  patientId: number,
): Promise<ClinicalHistoryResponse> {
  const response = await fetch(
    `${API_URL}/clinical-history/patient/${patientId}`,
  );

  return getResponseData(response);
}

export async function createClinicalAttention(
  attentionData: CreateClinicalAttentionRequest,
): Promise<CreateClinicalAttentionResponse> {
  const response = await fetch(`${API_URL}/clinical-history/attentions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(attentionData),
  });

  return getResponseData(response);
}
