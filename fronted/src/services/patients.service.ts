export interface Patient {
  id: number;
  tipoDocumento: string;
  numeroDocumento: string;
  nombres: string;
  apellidos: string;
  fechaNacimiento: string;
  telefono: string | null;
  correo: string | null;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
}
export interface PatientPage { patients: Patient[]; total: number; page: number; limit: number; totalPages: number; }

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

    if (response.status === 401) {
      throw new Error(
        "Tu sesión no es válida o ha expirado. Inicia sesión nuevamente.",
      );
    }

    throw new Error(
      Array.isArray(message)
        ? message.join(", ")
        : message || "Ocurrió un error al procesar la solicitud",
    );
  }

  return data;
}

// Consultar pacientes.
export async function getPatients(): Promise<Patient[]> {
  const response = await fetch(`${API_URL}/patients`, {
    method: "GET",
    headers: getAuthHeaders(),
  });

  return getResponseData(response);
}

export async function searchPatients(filters: { search?: string; estado?: string; page: number; limit: number }): Promise<PatientPage> {
  const query = new URLSearchParams(); Object.entries(filters).forEach(([key, value]) => { if (value !== undefined && String(value) !== "") query.set(key, String(value)); });
  return getResponseData(await fetch(`${API_URL}/patients/search?${query}`, { method: 'GET', headers: getAuthHeaders(), cache: 'no-store' }));
}

// Registrar un paciente.
export async function createPatient(
  patientData: CreatePatientRequest,
): Promise<CreatePatientResponse> {
  const response = await fetch(`${API_URL}/patients`, {
    method: "POST",
    headers: {
      ...getAuthHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(patientData),
  });

  return getResponseData(response);
}

// Actualizar los datos de un paciente.
export async function updatePatient(
  id: number,
  patientData: UpdatePatientRequest,
): Promise<UpdatePatientResponse> {
  const response = await fetch(`${API_URL}/patients/${id}`, {
    method: "PATCH",
    headers: {
      ...getAuthHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(patientData),
  });

  return getResponseData(response);
}
