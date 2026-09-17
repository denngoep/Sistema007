export interface Patient {
  id: number;
  tipoDocumento: string;
  numeroDocumento: string;
  nombres: string;
  apellidos: string;
  fechaNacimiento: string;
  telefono: string | null;
  correo: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePatientRequest {
  tipoDocumento: string;
  numeroDocumento: string;
  nombres: string;
  apellidos: string;
  fechaNacimiento: string;
  telefono?: string;
  correo?: string;
}

export interface CreatePatientResponse {
  message: string;
  patient: Patient;
}

export interface UpdatePatientRequest {
  tipoDocumento?: string;
  numeroDocumento?: string;
  nombres?: string;
  apellidos?: string;
  fechaNacimiento?: string;
  telefono?: string;
  correo?: string;
}

export interface UpdatePatientResponse {
  message: string;
  patient: Patient;
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

export async function getPatients(): Promise<Patient[]> {
  const response = await fetch(`${API_URL}/patients`);

  if (!response.ok) {
    throw new Error("No fue posible consultar los pacientes");
  }

  return response.json();
}

export async function createPatient(
  patientData: CreatePatientRequest,
): Promise<CreatePatientResponse> {
  const response = await fetch(`${API_URL}/patients`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(patientData),
  });

  return getResponseData(response);
}

export async function updatePatient(
  id: number,
  patientData: UpdatePatientRequest,
): Promise<UpdatePatientResponse> {
  const response = await fetch(`${API_URL}/patients/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(patientData),
  });

  return getResponseData(response);
}
