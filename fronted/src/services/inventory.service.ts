export type InventoryConservationCondition =
  | "AMBIENTE"
  | "CADENA_FRIO"
  | "OTRA";

export type InventoryInvimaStatus =
  | "PENDIENTE"
  | "VIGENTE"
  | "NO_VIGENTE"
  | "NO_APLICA";

export type InventoryVerificationResult =
  | "PENDIENTE"
  | "CONFORME"
  | "NO_CONFORME";

export type InventoryProductType =
  | "MEDICAMENTO"
  | "DISPOSITIVO_MEDICO"
  | "INSUMO";

export type InventoryWarehouseType = "GENERAL" | "SATELITE" | "NO_CONFORMES";

export interface InventoryWarehouse {
  id: number;
  nombre: string;
  tipo: InventoryWarehouseType;
  permiteDispensacion: boolean;
  activa: boolean;
  sede: {
    id: number;
    nombre: string;
    ciudad: string;
  };
}

export interface InventoryStock {
  id: number;
  loteId: number;
  bodegaId: number;
  cantidad: number;
  bodega: InventoryWarehouse;
}

export interface InventoryBatch {
  id: number;
  productoInventarioId: number;
  numeroLote: string;
  fechaVencimiento: string;
  cantidad: number;
  estado: string;
  existencias: InventoryStock[];
}

export interface InventoryMedication {
  id: number;
  nombre: string;
  concentracion: string;
  formaFarmaceutica: string;
  viaAdministracion: string | null;
  activo: boolean;
}

export interface InventoryProduct {
  id: number;
  medicamentoId: number | null;
  codigoInterno: number;
  codigoBarras: string | null;
  tipo: string;
  descripcion: string;
  marca: string | null;
  laboratorio: string | null;
  registroInvima: string | null;
  condicionConservacion: InventoryConservationCondition;
  temperaturaMinima: number | null;
  temperaturaMaxima: number | null;
  humedadMaxima: number | null;
  claseRiesgo: string | null;
  estado: string;
  medicamento: InventoryMedication | null;
  lotes: InventoryBatch[];
}

export interface InventoryResponse {
  totalProductos: number;
  productos: InventoryProduct[];
}

export interface InventorySupplier {
  id: number;
  nit: string;
  razonSocial: string;
  nombreComercial: string | null;
}

export interface CreateInventorySupplier {
  nit: string;
  razonSocial: string;
  nombreComercial?: string;
  telefono?: string;
  correo?: string;
  direccion?: string;
  contacto?: string;
}

export interface CreateInventoryMedication {
  nombre: string;
  concentracion: string;
  formaFarmaceutica: string;
  viaAdministracion?: string;
}

export interface CreateInventoryProduct {
  tipo: InventoryProductType;
  descripcion: string;
  medicamento?: CreateInventoryMedication;
  marca?: string;
  laboratorio?: string;
  registroInvima?: string;
  condicionConservacion?: InventoryConservationCondition;
  temperaturaMinima?: number;
  temperaturaMaxima?: number;
  humedadMaxima?: number;
  claseRiesgo?: string;
}

export interface InventoryWarehouseOption {
  id: number;
  nombre: string;
  tipo: InventoryWarehouseType;
  permiteDispensacion: boolean;
  sede: {
    id: number;
    nombre: string;
    ciudad: string;
  };
}

/** Administrative warehouse data. This endpoint is deliberately separate
 * from the active-warehouse selector used by operational forms. */
export interface ManagedInventoryWarehouse extends InventoryWarehouse {
  codigo: string | null;
  descripcion: string | null;
  creadoPor: { id: number; nombre: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface InventorySiteOption {
  id: number;
  codigo: string;
  nombre: string;
  ciudad: string;
}

export interface CreateInventoryWarehouse {
  sedeId: number;
  codigo: string;
  nombre: string;
  tipo: InventoryWarehouseType;
  descripcion?: string;
  permiteDispensacion: boolean;
}

export interface UpdateInventoryWarehouse {
  codigo?: string;
  nombre?: string;
  tipo?: InventoryWarehouseType;
  descripcion?: string | null;
  permiteDispensacion?: boolean;
  activa?: boolean;
}

// AJUSTES DE INVENTARIO

export interface AdjustInventoryBatchItem {
  loteId: number;
  cantidadFisica: number;
}

export interface AdjustInventoryBatch {
  bodegaId: number;
  motivo: string;
  referencia?: string;
  productos: AdjustInventoryBatchItem[];
}

export interface AdjustInventoryBatchResponse {
  mensaje?: string;
  totalAjustados?: number;
  totalSinCambios?: number;
  movimientos?: {
    id: number;
    tipo: string;
    cantidad: number;
  }[];
}

// TRASLADOS DE INVENTARIO

export interface TransferInventory {
  loteId: number;
  bodegaOrigenId: number;
  bodegaDestinoId: number;
  cantidad: number;
  motivo: string;
  referencia?: string;
}

export interface TransferInventoryResponse {
  mensaje?: string;
  movimiento?: {
    id: number;
    tipo: string;
    cantidad: number;
  };
}

// RECEPCIÓN DE INVENTARIO

export interface InventoryReceiptItem {
  productoId: number;
  numeroLote: string;
  fechaVencimiento: string;
  cantidad: number;
  costoUnitario?: number;
  estadoVerificacionInvima: InventoryInvimaStatus;
  temperaturaRegistrada?: number;
  humedadRegistrada?: number;
  resultadoVerificacion: InventoryVerificationResult;
  observacionesVerificacion?: string;
}

export interface CreateInventoryReceipt {
  numeroFactura: string;
  fechaFactura: string;
  proveedorId: number;
  bodegaDestinoId: number;
  observaciones?: string;
  productos: InventoryReceiptItem[];
}

export interface InventoryReceiptDetail {
  productoId: number;
  loteId: number | null;
  numeroLote: string;
  cantidadRecibida: number;
  cantidadIngresada: number;
  existenciaActual: number | null;
  resultadoVerificacion: InventoryVerificationResult;
  estadoVerificacionInvima: InventoryInvimaStatus;
}

export interface InventoryReceiptResponse {
  mensaje: string;
  actaId: number;
  ingresoId: number | null;
  numeroIngreso: string | null;
  numeroActa: string;
  numeroFactura: string;
  proveedor: string;
  bodegaDestino: string;
  estado: string;
  totalProductos: number;
  totalConformes: number;
  totalPendientes: number;
  totalNoConformes: number;
  detalles: InventoryReceiptDetail[];
}

export interface InventoryReceiptListItem {
  id: number;
  numeroActa: string;
  numeroFactura: string;
  fechaFactura: string;
  fechaRecepcion: string;
  estado: string;
  observaciones: string | null;
  proveedor: {
    id: number;
    razonSocial: string;
  };
  totalProductos: number;
  totalConformes: number;
  totalPendientes: number;
  totalNoConformes: number;
}

export interface InventoryReceiptsResponse {
  totalRecepciones: number;
  recepciones: InventoryReceiptListItem[];
}

export interface InventoryReceiptTechnicalAudit {
  id: number;
  detalleActaRecepcionId?: number;
  responsableId?: number;
  resultadoAnterior: string;
  resultadoNuevo: string;
  estadoInvimaAnterior: string;
  estadoInvimaNuevo: string;
  motivo: string;
  referencia: string;
  observaciones: string | null;
  tipoCambio?: "REEVALUACION" | "CORRECCION_DOCUMENTAL";
  temperaturaAnterior?: number | null;
  temperaturaNueva?: number | null;
  humedadAnterior?: number | null;
  humedadNueva?: number | null;
  observacionesAnteriores?: string | null;
  observacionesNuevas?: string | null;
  fechaReevaluacion?: string;
}

export interface InventoryReceiptDetailCorrection {
  id: number;
  motivo: string;
  referencia: string;
  fechaCorreccion: string;
  documentos?: InventoryDocument[];
}

export interface InventoryReceiptFullDetailItem {
  id: number;
  productoId: number;
  producto: {
    id: number;
    descripcion: string;
    tipo: InventoryProductType;
    medicamento?: InventoryMedication | null;
  };
  numeroLote: string;
  fechaVencimiento: string;
  cantidadRecibida: number;
  estadoVerificacionInvima: InventoryInvimaStatus;
  resultadoVerificacion: InventoryVerificationResult;
  temperaturaRegistrada: number | null;
  humedadRegistrada: number | null;
  observaciones: string | null;
  detalleIngreso: {
    cantidadIngresada: number;
    lote?: InventoryBatch;
  } | null;
  gestionNoConforme?: {
    id: number;
    estado: string;
    cantidad: number;
    motivo: string | null;
    disposicion: string | null;
    observaciones: string | null;
    bodega?: {
      id: number;
      nombre: string;
      permiteDispensacion: boolean;
    } | null;
    responsable?: {
      id: number;
      nombre: string;
    } | null;
  } | null;
  reevaluacionesTecnicas?: InventoryReceiptTechnicalAudit[];
  correcciones?: InventoryReceiptDetailCorrection[];
}

export interface InventoryReceiptFullDetail {
  id: number;
  numeroActa: string;
  numeroFactura: string;
  fechaFactura: string;
  fechaRecepcion: string;
  estado: string;
  observaciones: string | null;
  proveedor: {
    id: number;
    razonSocial: string;
  };
  elaboradoPor: {
    id: number;
    nombre: string;
  } | null;
  revisadoPor: {
    id: number;
    nombre: string;
  } | null;
  ingresoInventario: {
    id: number;
    numeroIngreso: string;
    bodegaDestino: {
      id: number;
      nombre: string;
    };
  } | null;
  detalles: InventoryReceiptFullDetailItem[];
  totalProductos: number;
  totalConformes: number;
  totalPendientes: number;
  totalNoConformes: number;
}

export interface ReviewInventoryReceipt {
  detalleActaId: number;
  resultado: "CONFORME" | "NO_CONFORME";
  estadoVerificacionInvima: InventoryInvimaStatus;
  temperaturaRegistrada?: number;
  humedadRegistrada?: number;
  observaciones?: string;
}

export interface ReviewInventoryReceiptResponse {
  mensaje: string;
  actaId: number;
  numeroActa: string;
  estado: string;
  ingresoId: number | null;
  numeroIngreso: string | null;
  totalConformes: number;
  totalPendientes: number;
  totalNoConformes: number;
}

export interface ReevaluateInventoryReceipt {
  resultadoNuevo: "CONFORME" | "NO_CONFORME";
  estadoInvimaNuevo: InventoryInvimaStatus;
  motivo: string;
  referencia: string;
  observaciones?: string;
}

export interface CorrectInventoryReceiptVerification {
  estadoVerificacionInvima: InventoryInvimaStatus;
  temperaturaRegistrada: number | null;
  humedadRegistrada: number | null;
  observaciones: string | null;
  motivo: string;
  referencia: string;
}

export interface UpdateInventoryReceipt {
  numeroFactura?: string;
  fechaFactura?: string;
  numeroOrdenCompra?: string;
  numeroRemision?: string;
  observaciones?: string;
}

export interface CorrectInventoryReceiptDetail {
  numeroLote?: string;
  fechaVencimiento?: string;
  cantidadRecibida?: number;
  motivo: string;
  referencia: string;
}

// VENCIMIENTOS DE INVENTARIO

export interface InventoryExpirationStock {
  bodegaId: number;
  bodega: string;
  tipoBodega: InventoryWarehouseType;
  sedeId: number;
  sede: string;
  cantidad: number;
  permiteDispensacion: boolean;
}

export interface InventoryExpirationBatch {
  loteId: number;
  numeroLote: string;
  fechaVencimiento: string;
  diasParaVencer: number;
  existencias: InventoryExpirationStock[];
}

export interface InventoryExpirationsResponse {
  lotes: InventoryExpirationBatch[];
}

export interface ManageExpiredInventory {
  loteId: number;
  bodegaOrigenId: number;
  bodegaDestinoId: number;
  motivo: string;
  referencia?: string;
}

export interface ManageExpiredInventoryResponse {
  mensaje?: string;
  numeroLote: string;
  cantidadTrasladada: number;
}

// CONFIGURACIÓN DE API

const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:3000").replace(/\/$/, "");

// Todas las solicitudes utilizan JWT
async function authenticatedFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  const token = localStorage.getItem("token");
  const headers = new Headers(init.headers);

  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  try {
    return await globalThis.fetch(input, {
      ...init,
      headers,
    });
  } catch {
    throw new Error(
      "No fue posible conectar con el backend de Sistema 007. Verifica que esté iniciado en http://localhost:3000.",
    );
  }
}

const fetch = authenticatedFetch;

async function getApiErrorMessage(
  response: Response,
  defaultMessage: string,
): Promise<string> {
  const errorData: unknown = await response.json().catch(() => null);

  if (errorData && typeof errorData === "object" && "message" in errorData) {
    const errorMessage = errorData.message;

    if (typeof errorMessage === "string") {
      return errorMessage;
    }

    if (Array.isArray(errorMessage)) {
      return errorMessage.map(String).join(". ");
    }
  }

  return defaultMessage;
}

// CONSULTAR PRODUCTOS Y EXISTENCIAS

export async function getInventoryProducts(): Promise<InventoryResponse> {
  const response = await fetch(`${API_URL}/inventory/products`);

  if (!response.ok) {
    throw new Error(
      await getApiErrorMessage(
        response,
        "No fue posible consultar el inventario",
      ),
    );
  }

  return response.json() as Promise<InventoryResponse>;
}

// REGISTRAR PRODUCTO

export async function createInventoryProduct(
  data: CreateInventoryProduct,
): Promise<InventoryProduct> {
  const response = await fetch(`${API_URL}/inventory/products`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error(
      await getApiErrorMessage(
        response,
        "No fue posible registrar el producto",
      ),
    );
  }

  return response.json() as Promise<InventoryProduct>;
}

// CONSULTAR PROVEEDORES

export async function getInventorySuppliers(): Promise<InventorySupplier[]> {
  const response = await fetch(`${API_URL}/inventory/suppliers`);

  if (!response.ok) {
    throw new Error(
      await getApiErrorMessage(
        response,
        "No fue posible consultar los proveedores",
      ),
    );
  }

  return response.json() as Promise<InventorySupplier[]>;
}

// REGISTRAR PROVEEDOR

export async function createInventorySupplier(
  data: CreateInventorySupplier,
): Promise<InventorySupplier> {
  const response = await fetch(`${API_URL}/inventory/suppliers`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error(
      await getApiErrorMessage(
        response,
        "No fue posible registrar el proveedor",
      ),
    );
  }

  return response.json() as Promise<InventorySupplier>;
}

// CONSULTAR BODEGAS

export async function getInventoryWarehouses(): Promise<
  InventoryWarehouseOption[]
> {
  const response = await fetch(`${API_URL}/inventory/warehouses`);

  if (!response.ok) {
    throw new Error(
      await getApiErrorMessage(
        response,
        "No fue posible consultar las bodegas",
      ),
    );
  }

  return response.json() as Promise<InventoryWarehouseOption[]>;
}

export async function getManagedInventoryWarehouses(): Promise<
  ManagedInventoryWarehouse[]
> {
  const response = await fetch(`${API_URL}/inventory/warehouses/management`);
  if (!response.ok) {
    throw new Error(
      await getApiErrorMessage(response, "No fue posible consultar las bodegas administrables"),
    );
  }
  return response.json() as Promise<ManagedInventoryWarehouse[]>;
}

export async function getInventorySites(): Promise<InventorySiteOption[]> {
  const response = await fetch(`${API_URL}/inventory/sites`);
  if (!response.ok) {
    throw new Error(
      await getApiErrorMessage(response, "No fue posible consultar las sedes activas"),
    );
  }
  return response.json() as Promise<InventorySiteOption[]>;
}

export async function createManagedInventoryWarehouse(
  data: CreateInventoryWarehouse,
): Promise<ManagedInventoryWarehouse> {
  const response = await fetch(`${API_URL}/inventory/warehouses`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error(
      await getApiErrorMessage(response, "No fue posible registrar la bodega"),
    );
  }
  return response.json() as Promise<ManagedInventoryWarehouse>;
}

export async function updateManagedInventoryWarehouse(
  id: number,
  data: UpdateInventoryWarehouse,
): Promise<ManagedInventoryWarehouse> {
  const response = await fetch(`${API_URL}/inventory/warehouses/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error(
      await getApiErrorMessage(response, "No fue posible actualizar la bodega"),
    );
  }
  return response.json() as Promise<ManagedInventoryWarehouse>;
}

// REGISTRAR RECEPCIÓN POR FACTURA

export async function createInventoryReceipt(
  data: CreateInventoryReceipt,
): Promise<InventoryReceiptResponse> {
  const response = await fetch(`${API_URL}/inventory/receipts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error(
      await getApiErrorMessage(
        response,
        "No fue posible registrar el ingreso de inventario",
      ),
    );
  }

  return response.json() as Promise<InventoryReceiptResponse>;
}

// CONSULTAR HISTORIAL DE RECEPCIONES

export async function getInventoryReceipts(): Promise<InventoryReceiptsResponse> {
  const response = await fetch(`${API_URL}/inventory/receipts`);

  if (!response.ok) {
    throw new Error(
      await getApiErrorMessage(
        response,
        "No fue posible consultar las recepciones",
      ),
    );
  }

  return response.json() as Promise<InventoryReceiptsResponse>;
}

// CONSULTAR DETALLE DE UNA RECEPCIÓN

export async function getInventoryReceiptById(
  id: number,
): Promise<InventoryReceiptFullDetail> {
  const response = await fetch(`${API_URL}/inventory/receipts/${id}`);

  if (!response.ok) {
    throw new Error(
      await getApiErrorMessage(
        response,
        "No fue posible consultar el detalle de la recepción",
      ),
    );
  }

  return response.json() as Promise<InventoryReceiptFullDetail>;
}

// APROBAR O RECHAZAR UN PRODUCTO PENDIENTE

export async function reviewInventoryReceipt(
  id: number,
  data: ReviewInventoryReceipt,
): Promise<ReviewInventoryReceiptResponse> {
  const response = await fetch(`${API_URL}/inventory/receipts/${id}/review`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error(
      await getApiErrorMessage(
        response,
        "No fue posible registrar la revisión",
      ),
    );
  }

  return response.json() as Promise<ReviewInventoryReceiptResponse>;
}

// REEVALUACIÓN TÉCNICA

export async function reevaluateInventoryReceipt(
  detalleActaId: number,
  data: ReevaluateInventoryReceipt,
): Promise<void> {
  const token = localStorage.getItem("token");

  if (!token) {
    throw new Error("Debes iniciar sesión para reevaluar productos.");
  }

  const response = await fetch(
    `${API_URL}/inventory/receipts/details/${detalleActaId}/reevaluate`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    },
  );

  if (!response.ok) {
    throw new Error(
      await getApiErrorMessage(
        response,
        "No fue posible registrar la reevaluación técnica",
      ),
    );
  }
}

// CORRECCIÓN DOCUMENTAL DE VERIFICACIÓN TÉCNICA

export async function correctInventoryReceiptVerification(
  detalleActaId: number,
  data: CorrectInventoryReceiptVerification,
): Promise<void> {
  const token = localStorage.getItem("token");

  if (!token) {
    throw new Error(
      "Debes iniciar sesión para corregir la verificación técnica.",
    );
  }

  const response = await fetch(
    `${API_URL}/inventory/receipts/details/${detalleActaId}/verification`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    },
  );

  if (!response.ok) {
    throw new Error(
      await getApiErrorMessage(
        response,
        "No fue posible registrar la corrección documental",
      ),
    );
  }
}

// ACTUALIZAR DATOS ADMINISTRATIVOS

export async function updateInventoryReceipt(
  id: number,
  data: UpdateInventoryReceipt,
): Promise<InventoryReceiptFullDetail> {
  const response = await fetch(`${API_URL}/inventory/receipts/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error(
      await getApiErrorMessage(
        response,
        "No fue posible actualizar la recepción",
      ),
    );
  }

  return response.json() as Promise<InventoryReceiptFullDetail>;
}

// CORREGIR LOTE, VENCIMIENTO O CANTIDAD RECIBIDA

export async function correctInventoryReceiptDetail(
  detalleActaId: number,
  data: CorrectInventoryReceiptDetail,
): Promise<{ correccionId: number }> {
  const response = await fetch(
    `${API_URL}/inventory/receipts/details/${detalleActaId}/correction`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    },
  );

  if (!response.ok) {
    throw new Error(
      await getApiErrorMessage(
        response,
        "No fue posible corregir los datos del producto",
      ),
    );
  }

  return response.json() as Promise<{ correccionId: number }>;
}

// REGISTRAR TRASLADO ENTRE BODEGAS

export async function transferInventory(
  data: TransferInventory,
): Promise<TransferInventoryResponse> {
  const response = await fetch(`${API_URL}/inventory/transfers`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error(
      await getApiErrorMessage(
        response,
        "No fue posible realizar el traslado de inventario",
      ),
    );
  }

  return response.json() as Promise<TransferInventoryResponse>;
}

// REGISTRAR AJUSTES MÚLTIPLES DE INVENTARIO

export async function adjustInventoryBatch(
  data: AdjustInventoryBatch,
): Promise<AdjustInventoryBatchResponse> {
  const response = await fetch(`${API_URL}/inventory/adjustments/batch`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error(
      await getApiErrorMessage(
        response,
        "No fue posible registrar los ajustes de inventario",
      ),
    );
  }

  return response.json() as Promise<AdjustInventoryBatchResponse>;
}

// Ajustes documentales. Se utiliza solo cuando la migración documental está
// aplicada y VITE_INVENTORY_DOCUMENTS_ENABLED=true.
export async function adjustInventoryBatchDocumented(
  data: AdjustInventoryBatch,
  support: File,
): Promise<AdjustInventoryBatchResponse> {
  const body = new FormData();
  body.append("datos", JSON.stringify(data));
  body.append("soporte", support);

  const response = await fetch(
    `${API_URL}/inventory/adjustments/batch/documented`,
    { method: "POST", body },
  );

  if (!response.ok) {
    throw new Error(
      await getApiErrorMessage(
        response,
        "No fue posible registrar el ajuste documentado",
      ),
    );
  }

  return response.json() as Promise<AdjustInventoryBatchResponse>;
}

export type InventoryDocument = {
  id: number;
  proposito: string;
  version: number;
  documentoInventario: { id: number; mime: string; tamano: number; creadoAt: string; sha256: string };
  registradoPor: { nombre: string };
};

export async function getInventoryMovementDocuments(
  movementId: number,
): Promise<InventoryDocument[]> {
  const response = await fetch(`${API_URL}/inventory/movements/${movementId}/documents`);
  if (!response.ok) throw new Error(await getApiErrorMessage(response, "No fue posible consultar los documentos"));
  return response.json() as Promise<InventoryDocument[]>;
}

export async function getInventoryReceiptDocuments(
  receiptId: number,
): Promise<InventoryDocument[]> {
  const response = await fetch(`${API_URL}/inventory/receipts/${receiptId}/documents`);
  if (!response.ok) throw new Error(await getApiErrorMessage(response, "No fue posible consultar los documentos de la recepción"));
  return response.json() as Promise<InventoryDocument[]>;
}

export async function createInventoryMovementReceipt(movementId: number) {
  const response = await fetch(`${API_URL}/inventory/movements/${movementId}/receipt`, { method: "POST" });
  if (!response.ok) throw new Error(await getApiErrorMessage(response, "No fue posible generar el comprobante"));
  return response.json() as Promise<{ documentoId: number; existente: boolean }>;
}

export async function uploadInventoryReceiptInvoice(receiptId: number, file: File) {
  const body = new FormData();
  body.append("archivo", file);
  const response = await fetch(`${API_URL}/inventory/receipts/${receiptId}/invoice`, { method: "POST", body });
  if (!response.ok) throw new Error(await getApiErrorMessage(response, "No fue posible adjuntar la factura"));
  return response.json() as Promise<InventoryDocument>;
}

export async function getInventoryReceiptCorrectionDocuments(
  correctionId: number,
): Promise<InventoryDocument[]> {
  const response = await fetch(
    `${API_URL}/inventory/receipts/corrections/${correctionId}/documents`,
  );
  if (!response.ok) {
    throw new Error(
      await getApiErrorMessage(response, "No fue posible consultar los soportes de la corrección"),
    );
  }
  return response.json() as Promise<InventoryDocument[]>;
}

export async function uploadInventoryReceiptCorrectionSupport(
  correctionId: number,
  file: File,
): Promise<InventoryDocument> {
  const body = new FormData();
  body.append("archivo", file);
  const response = await fetch(
    `${API_URL}/inventory/receipts/corrections/${correctionId}/documents`,
    { method: "POST", body },
  );
  if (!response.ok) {
    throw new Error(
      await getApiErrorMessage(response, "No fue posible adjuntar el soporte de la corrección"),
    );
  }
  return response.json() as Promise<InventoryDocument>;
}

export async function downloadInventoryDocument(documentId: number): Promise<void> {
  const response = await fetch(`${API_URL}/inventory/documents/${documentId}/download`);
  if (!response.ok) throw new Error(await getApiErrorMessage(response, "No fue posible descargar el documento"));
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `Sistema007_inventario_${documentId}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// CONSULTAR VENCIMIENTOS DE INVENTARIO

export async function getInventoryExpirations(
  dias = 90,
): Promise<InventoryExpirationsResponse> {
  const response = await fetch(
    `${API_URL}/inventory/expirations?dias=${encodeURIComponent(String(dias))}`,
  );

  if (!response.ok) {
    throw new Error(
      await getApiErrorMessage(
        response,
        "No fue posible consultar los vencimientos de inventario",
      ),
    );
  }

  return response.json() as Promise<InventoryExpirationsResponse>;
}

// GESTIONAR LOTE VENCIDO

export async function manageExpiredInventory(
  data: ManageExpiredInventory,
): Promise<ManageExpiredInventoryResponse> {
  const response = await fetch(`${API_URL}/inventory/expired/manage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error(
      await getApiErrorMessage(
        response,
        "No fue posible gestionar el lote vencido",
      ),
    );
  }

  return response.json() as Promise<ManageExpiredInventoryResponse>;
}
