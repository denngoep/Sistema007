const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:3000").replace(/\/$/, "");

// DATOS DEL PACIENTE

export interface DispensationPatient {
  id: number;
  tipoDocumento: string;
  numeroDocumento: string;
  nombres: string;
  apellidos: string;
  fechaNacimiento: string;
}

// INFORMACIÓN CLÍNICA

export interface DispensationDiagnosis {
  id: number;
  nombre: string;
  codigoCie10: string | null;
  tipo: string;
  requiereEsquema: boolean;
  fechaDiagnostico?: string;
}

export interface DispensationMedication {
  detalleFormulacionId: number;
  medicamento: string;
  concentracion: string;
  formaFarmaceutica: string;
  dosis: string;
  frecuencia: string;
  duracion: string;
  cantidad: number;
  cantidadFormulada: number;
  cantidadEntregada: number;
  cantidadPendiente: number;
  viaAdministracion: string;
  observaciones: string | null;
}

export interface DispensationFormulation {
  formulacionId: number;
  fechaFormulacion: string;
  vigenciaMeses: number;
  fechaFinVigencia: string;
  indicaciones: string | null;
  estado: string;

  atencion: {
    atencionClinicaId: number;
    numeroIngreso: string;
    fechaAtencion: string;
    profesional: {
      id: number;
      nombre: string;
    };
  };

  diagnostico: DispensationDiagnosis | null;
  medicamentos: DispensationMedication[];
}

export interface PatientMedicationsResponse {
  paciente: DispensationPatient;

  informacionClinica: {
    historiaClinicaId: number;
    grupoSanguineo: string | null;
    alergias: string | null;
    diagnosticosActivos: DispensationDiagnosis[];
  };

  totalFormulacionesVigentes: number;
  totalMedicamentos: number;
  formulacionesVigentes: DispensationFormulation[];
}

// VALIDACIÓN DE DISPENSACIÓN

export interface ValidateDispensationRequest {
  numeroDocumento: string;
  formulacionId: number;
  detalleFormulacionId: number;
  cantidad: number;
  bodegaId: number;
}

export interface DispensationLot {
  existenciaId: number;
  loteId: number;
  numeroLote: string;
  fechaVencimiento: string;
  productoInventarioId: number;
  codigoInterno: string;
  codigoBarras: string | null;
  descripcion: string;
  cantidadDisponible: number;
  cantidadSugerida: number;
}

export interface ValidateDispensationResponse {
  valida: boolean;
  mensaje: string;

  periodoDispensacion: {
    anio: number;
    mes: number;
  };

  paciente: DispensationPatient;

  formulacion: {
    id: number;
    fechaFormulacion: string;
    vigenciaMeses: number;
    fechaFinVigencia: string;
  };

  medicamento: {
    detalleFormulacionId: number;
    medicamentoId: number;
    nombre: string;
    concentracion: string;
    formaFarmaceutica: string;
    dosis: string;
    frecuencia: string;
    viaAdministracion: string;
    cantidadFormulada: number;
    cantidadEntregada: number;
    cantidadPendiente: number;
    cantidadAValidar: number;
  };

  inventario: {
    bodegaId: number;
    bodega: string;
    sede: string;
    stockDisponible: number;
    estrategiaSeleccion: string;
    lotesSugeridos: DispensationLot[];
  };
}

// REGISTRO DE DISPENSACIÓN

export interface CreateDispensationRequest extends ValidateDispensationRequest {
  observaciones?: string;
}

export interface CreateDispensationResponse {
  registrada: boolean;
  mensaje: string;
  dispensacion: {
    id: number;
    numeroDispensacion: string;
    fechaDispensacion: string;
    estado: string;
    [key: string]: unknown;
  };
}

// COMPROBANTE

export interface DispensationReceiptResponse {
  generado: boolean;
  mensaje: string;

  comprobante: {
    numeroComprobante: string;
    fechaComprobante: string;
    numeroDispensacion: string;
    fechaDispensacion: string;
    paciente: DispensationPatient;
    sede: string;
    bodega: string;
    dispensadoPor: {
      id: number;
      nombre: string;
      rol?: string;
    };
    medicamentos: Array<{
      numeroIngreso?: string;
      medicamento: string;
      concentracion: string;
      formaFarmaceutica: string;
      cantidadEntregada: number;
      numeroLote: string;
      fechaVencimiento: string;
    }>;
  };
}

// FIRMA DEL PACIENTE

export interface RegisterDispensationSignatureRequest {
  tipoFirma: "DIGITAL" | "MANUAL";
  firmaPaciente?: string;
  soporteFirmado?: string;
  fechaFirma?: string;
}

// AUTENTICACIÓN

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem("token");

  if (!token) {
    throw new Error("No hay una sesión activa. Inicia sesión nuevamente.");
  }

  return {
    Authorization: `Bearer ${token}`,
  };
}

// PROCESAMIENTO DE RESPUESTAS

async function getResponseData<T>(response: Response): Promise<T> {
  const data = await response.json();

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error(
        "Tu sesión no es válida o ha expirado. Inicia sesión nuevamente.",
      );
    }

    const message = data.message ?? data.mensaje;

    throw new Error(
      Array.isArray(message)
        ? message.join(", ")
        : typeof message === "string"
          ? message
          : "Ocurrió un error al procesar la solicitud",
    );
  }

  return data as T;
}

// CONSULTAR MEDICAMENTOS FORMULADOS DEL PACIENTE

export async function getPatientMedications(
  numeroDocumento: string,
): Promise<PatientMedicationsResponse> {
  const documento = numeroDocumento.trim();

  if (!documento) {
    throw new Error("Debes ingresar el número de documento del paciente.");
  }

  const response = await fetch(
    `${API_URL}/dispensations/patient/${encodeURIComponent(documento)}/medications`,
    {
      method: "GET",
      headers: getAuthHeaders(),
    },
  );

  return getResponseData<PatientMedicationsResponse>(response);
}

// VALIDAR DISPENSACIÓN Y EXISTENCIAS

export async function validateDispensation(
  data: ValidateDispensationRequest,
): Promise<ValidateDispensationResponse> {
  const response = await fetch(`${API_URL}/dispensations/validate`, {
    method: "POST",
    headers: {
      ...getAuthHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  return getResponseData<ValidateDispensationResponse>(response);
}

// REGISTRAR DISPENSACIÓN

export async function createDispensation(
  data: CreateDispensationRequest,
): Promise<CreateDispensationResponse> {
  const fingerprint = Array.from(
    new Uint8Array(
      await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(JSON.stringify(data)),
      ),
    ),
  )
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");

  let intent = pendingDispensation();

  if (intent && intent.fingerprint !== fingerprint) {
    throw new Error(
      "Hay una entrega sin resolver. Recupérala antes de iniciar otra.",
    );
  }

  if (!intent) {
    intent = {
      key: crypto.randomUUID(),
      fingerprint,
    };

    sessionStorage.setItem(intentStorageKey(), JSON.stringify(intent));
  }

  const response = await fetch(`${API_URL}/dispensations`, {
    method: "POST",
    headers: {
      ...getAuthHeaders(),
      "Idempotency-Key": intent.key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  const result = await getResponseData<CreateDispensationResponse>(response);

  sessionStorage.removeItem(intentStorageKey());

  return result;
}

// GENERAR COMPROBANTE

export async function generateDispensationReceipt(
  dispensacionId: number,
): Promise<DispensationReceiptResponse> {
  const response = await fetch(
    `${API_URL}/dispensations/${dispensacionId}/receipt`,
    {
      method: "POST",
      headers: getAuthHeaders(),
    },
  );

  return getResponseData<DispensationReceiptResponse>(response);
}

// DOCUMENTOS DE DISPENSACIÓN

export interface DispensationDocument {
  id: number;
  proposito: string;
  sha256: string;
  mime: string;
  creadoAt: string;
}

export interface DispensationDetail {
  id: number;
  numeroDispensacion: string;
  estado: string;
  versionDocumental: number;
  estadoDocumental: string;
  comprobante: DispensationReceiptResponse["comprobante"];
  documentos: DispensationDocument[];

  soportes: Array<{
    id: number;
    version: number;
    modalidad: string;
    nombreReceptor: string;
    fechaFirma: string;
    motivoCorreccion: string | null;
    registradoPor: {
      nombre: string;
    };
    documentoFirmadoId: number;
  }>;
}

export interface DispensationHistoryRow {
  id: number;
  numeroDispensacion: string;
  fechaDispensacion: string;
  estado: string;
  estadoDocumental: string;

  paciente: {
    nombres: string;
    apellidos: string;
    numeroDocumento: string;
  };

  detalles: Array<{
    cantidadEntregada: number;
    detalleFormulacion: {
      medicamento: string;
      formulacion: {
        atencionClinica: {
          numeroIngreso: string;
        };
      };
    };
  }>;
}

// CONTROL DE IDEMPOTENCIA

function intentStorageKey() {
  const user = JSON.parse(localStorage.getItem("user") || "{}") as {
    id?: number;
  };

  if (!user.id) {
    throw new Error("Sesión no válida");
  }

  return `dispensation-intent-${user.id}`;
}

export function pendingDispensation(): {
  key: string;
  fingerprint: string;
} | null {
  return JSON.parse(sessionStorage.getItem(intentStorageKey()) || "null");
}

export async function recoverDispensation() {
  const intent = pendingDispensation();

  if (!intent) {
    return null;
  }

  const result = await getResponseData<CreateDispensationResponse>(
    await fetch(
      `${API_URL}/dispensations/requests/${encodeURIComponent(intent.key)}`,
      {
        headers: getAuthHeaders(),
        cache: "no-store",
      },
    ),
  );

  sessionStorage.removeItem(intentStorageKey());

  return result;
}

// HISTORIAL DE DISPENSACIONES

export async function getDispensationHistory(
  document = "",
  page = 1,
): Promise<DispensationHistoryRow[]> {
  return getResponseData(
    await fetch(
      `${API_URL}/dispensations?documento=${encodeURIComponent(document)}&page=${page}`,
      {
        headers: getAuthHeaders(),
        cache: "no-store",
      },
    ),
  );
}

// DETALLE DE DISPENSACIÓN

export async function getDispensationDetail(
  id: number,
): Promise<DispensationDetail> {
  return getResponseData(
    await fetch(`${API_URL}/dispensations/${id}`, {
      headers: getAuthHeaders(),
      cache: "no-store",
    }),
  );
}

// DESCARGAR DOCUMENTO DE DISPENSACIÓN

export async function downloadDispensationDocument(
  id: number,
  doc: DispensationDocument,
) {
  const response = await fetch(
    `${API_URL}/dispensations/${id}/documents/${doc.id}`,
    {
      headers: getAuthHeaders(),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    await getResponseData(response);
    return;
  }

  const url = URL.createObjectURL(await response.blob());

  const a = document.createElement("a");
  a.href = url;
  a.download = `dispensacion-${id}-${doc.id}.${
    doc.mime === "image/png" ? "png" : "pdf"
  }`;

  a.click();

  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

// REGISTRAR SOPORTE DE DISPENSACIÓN

export async function registerDispensationSupport(
  id: number,
  form: FormData,
  correction: boolean,
) {
  return getResponseData(
    await fetch(
      `${API_URL}/dispensations/${id}/${
        correction ? "supports/corrections" : "signature"
      }`,
      {
        method: "POST",
        headers: getAuthHeaders(),
        body: form,
      },
    ),
  );
}

// FILTROS DE REPORTES

export interface DispensationReportFilters {
  desde?: string;
  hasta?: string;
  sedeId?: string;
  medicamento?: string;
  estado?: string;
  soporte?: string;
}

// FILAS DE REPORTES

export interface DispensationReportRow {
  dispensacion: string;
  fecha: string;
  paciente: string;
  documento: string;
  ingreso: string;
  medicamento: string;
  concentracion: string;
  lote: string;
  vencimiento: string;
  cantidad: number;
  sede: string;
  bodega: string;
  responsable: string;
  estadoEntrega: string;
  estadoSoporte: string;
}

export interface DispensationReportSite {
  id: number;
  codigo: string;
  nombre: string;
}

// CONSTRUIR PARÁMETROS DE REPORTES

function reportQuery(filters: DispensationReportFilters) {
  const query = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value?.trim()) {
      query.set(key, value.trim());
    }
  });

  return query.toString();
}

// CONSULTAR REPORTE DE DISPENSACIONES

export async function getDispensationReport(
  filters: DispensationReportFilters,
) {
  const query = reportQuery(filters);

  return getResponseData<{
    rows: DispensationReportRow[];
    totalEntregas: number;
    totalUnidades: number;
  }>(
    await fetch(`${API_URL}/dispensations/reports${query ? `?${query}` : ""}`, {
      headers: getAuthHeaders(),
      cache: "no-store",
    }),
  );
}

// CONSULTAR SEDES PARA REPORTES

export async function getDispensationReportSites(): Promise<
  DispensationReportSite[]
> {
  return getResponseData<DispensationReportSite[]>(
    await fetch(`${API_URL}/dispensations/reports/options`, {
      headers: getAuthHeaders(),
      cache: "no-store",
    }),
  );
}

// DESCARGAR REPORTE DE DISPENSACIONES

export async function downloadDispensationReport(
  filters: DispensationReportFilters,
  format: "excel" | "pdf",
) {
  const query = reportQuery(filters);

  const response = await fetch(
    `${API_URL}/dispensations/reports/export/${format}${
      query ? `?${query}` : ""
    }`,
    {
      headers: getAuthHeaders(),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    await getResponseData(response);
    return;
  }

  const url = URL.createObjectURL(await response.blob());

  const link = document.createElement("a");
  link.href = url;
  link.download = `Sistema007_Reporte_Dispensaciones.${
    format === "excel" ? "xlsx" : "pdf"
  }`;

  link.click();

  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
