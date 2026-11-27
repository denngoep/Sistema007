const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:3000").replace(/\/$/, "");

export type InventoryReportFilters = {
  busqueda?: string;
  tipo?: string;
  sedeId?: string;
  bodegaId?: string;
  fechaInicio?: string;
  fechaFin?: string;
  soloConExistencia?: string;
};

export type WarehouseOption = {
  id: number;
  nombre: string;
  sede: { id: number; nombre: string; ciudad?: string };
};

function headers(): HeadersInit {
  const token = localStorage.getItem("token");
  if (!token) throw new Error("No hay una sesión activa. Inicia sesión nuevamente.");
  return { Authorization: `Bearer ${token}` };
}

function query(filters: Record<string, string | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value?.trim()) params.set(key, value.trim());
  }
  return params.toString();
}

async function responseData<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({}));
  if (response.ok) return data as T;
  const message = Array.isArray(data.message) ? data.message.join(", ") : data.message;
  if (response.status === 401) throw new Error("Tu sesión expiró. Inicia sesión nuevamente.");
  if (response.status === 403) throw new Error("No tienes permisos para consultar este reporte.");
  throw new Error(message || "No fue posible consultar el reporte.");
}

export async function getReportWarehouses(): Promise<WarehouseOption[]> {
  return responseData<WarehouseOption[]>(await fetch(`${API_URL}/inventory/warehouses`, { headers: headers(), cache: "no-store" }));
}

export async function getInventoryReport(kind: "movements" | "stock", filters: InventoryReportFilters) {
  const params = query({ ...filters, pagina: "1", limite: "100" });
  const endpoint = kind === "movements" ? "movements" : "stock-report";
  return responseData<{ movimientos?: Record<string, unknown>[]; existencias?: Record<string, unknown>[] }>(
    await fetch(`${API_URL}/inventory/${endpoint}${params ? `?${params}` : ""}`, { headers: headers(), cache: "no-store" }),
  );
}

export async function downloadInventoryReport(kind: "movements" | "stock", filters: InventoryReportFilters) {
  const params = query(filters);
  const endpoint = kind === "movements" ? "movements/export/excel" : "stock-report/export/excel";
  const response = await fetch(`${API_URL}/inventory/${endpoint}${params ? `?${params}` : ""}`, { headers: headers(), cache: "no-store" });
  if (!response.ok) await responseData(response);
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = kind === "movements" ? "Sistema007_Movimientos.xlsx" : "Sistema007_Existencias.xlsx";
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 30000);
}
