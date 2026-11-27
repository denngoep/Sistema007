import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  createInventoryMovementReceipt,
  downloadInventoryDocument,
} from "../services/inventory.service";
import "../styles/Inventory.css";

type DataRecord = Record<string, unknown>;
type ReportType = "movements" | "stock";
type ExportFormat = "csv" | "excel";

const API_URL = (
  import.meta.env.VITE_API_URL || "http://localhost:3000"
).replace(/\/$/, "");

const endpoints = {
  movements: "/inventory/movements",
  movementsExport: "/inventory/movements/export",
  movementsExcel: "/inventory/movements/export/excel",
  stock: "/inventory/stock-report",
  stockExport: "/inventory/stock-report/export",
  stockExcel: "/inventory/stock-report/export/excel",
};
const inventoryDocumentsEnabled =
  import.meta.env.VITE_INVENTORY_DOCUMENTS_ENABLED === "true";

function getToken(): string {
  const keys = ["token", "accessToken", "access_token", "authToken"];

  for (const key of keys) {
    const value = localStorage.getItem(key) || sessionStorage.getItem(key);

    if (value) {
      try {
        const parsed: unknown = JSON.parse(value);

        if (typeof parsed === "string") return parsed;

        if (
          typeof parsed === "object" &&
          parsed !== null &&
          "token" in parsed &&
          typeof parsed.token === "string"
        ) {
          return parsed.token;
        }
      } catch {
        return value;
      }
    }
  }

  return "";
}

function getHeaders(): HeadersInit {
  const token = getToken();

  return token ? { Authorization: `Bearer ${token}` } : {};
}

function extractRecords(value: unknown): DataRecord[] {
  if (Array.isArray(value)) {
    return value.filter(
      (item): item is DataRecord =>
        typeof item === "object" && item !== null && !Array.isArray(item),
    );
  }

  if (typeof value !== "object" || value === null) return [];

  const data = value as DataRecord;

  for (const key of [
    "movimientos",
    "existencias",
    "productos",
    "registros",
    "items",
    "results",
    "data",
  ]) {
    if (key in data) {
      const result = extractRecords(data[key]);

      if (Array.isArray(data[key]) || result.length) {
        return result;
      }
    }
  }

  return [];
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  if (typeof value === "boolean") {
    return value ? "Sí" : "No";
  }

  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value.map(displayValue).join(", ");
  }

  if (typeof value === "object") {
    const record = value as DataRecord;

    for (const key of [
      "nombre",
      "descripcion",
      "numeroLote",
      "codigoInterno",
      "razonSocial",
    ]) {
      if (record[key] !== undefined) {
        return displayValue(record[key]);
      }
    }

    return JSON.stringify(value);
  }

  return String(value);
}

function readableColumn(key: string): string {
  const labels: Record<string, string> = {
    id: "ID",
    tipo: "Tipo",
    tipoMovimiento: "Tipo de movimiento",
    fecha: "Fecha",
    fechaMovimiento: "Fecha del movimiento",
    fechaCreacion: "Fecha de registro",
    createdAt: "Fecha de registro",
    producto: "Producto",
    productoId: "ID producto",
    codigoInterno: "Código",
    descripcion: "Descripción",
    medicamento: "Medicamento",
    lote: "Lote",
    numeroLote: "Número de lote",
    cantidad: "Cantidad",
    cantidadAnterior: "Cantidad anterior",
    cantidadNueva: "Cantidad nueva",
    bodega: "Bodega",
    bodegaOrigen: "Bodega origen",
    bodegaDestino: "Bodega destino",
    usuario: "Usuario",
    responsable: "Responsable",
    observaciones: "Observaciones",
    motivo: "Motivo",
    referencia: "Referencia",
    numeroFactura: "Factura",
    existencia: "Existencia",
    existencias: "Existencias",
    estado: "Estado",
  };

  if (labels[key]) return labels[key];

  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/^./, (letter) => letter.toUpperCase());
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "No fue posible completar la operación.";
}

async function requestRecords(
  endpoint: string,
  signal?: AbortSignal,
): Promise<DataRecord[]> {
  const response = await fetch(`${API_URL}${endpoint}`, {
    method: "GET",
    headers: getHeaders(),
    signal,
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error(
        "La sesión no está autorizada. Verifica que hayas iniciado sesión.",
      );
    }

    if (response.status === 403) {
      throw new Error(
        "Tu usuario no tiene permisos para consultar este reporte.",
      );
    }

    throw new Error(
      `No fue posible consultar el reporte. Código HTTP ${response.status}.`,
    );
  }

  const data: unknown = await response.json();

  return extractRecords(data);
}

export default function InventoryMovements() {
  const [reportType, setReportType] = useState<ReportType>("movements");

  const [movements, setMovements] = useState<DataRecord[]>([]);

  const [stock, setStock] = useState<DataRecord[]>([]);

  const [loading, setLoading] = useState(true);

  const [downloading, setDownloading] = useState<ExportFormat | null>(null);

  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [generatingReceiptId, setGeneratingReceiptId] = useState<number | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const endpoint =
      reportType === "movements" ? endpoints.movements : endpoints.stock;

    requestRecords(endpoint, controller.signal)
      .then((records) => {
        if (controller.signal.aborted) return;

        if (reportType === "movements") {
          setMovements(records);
        } else {
          setStock(records);
        }

        setError("");
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;

        setError(getErrorMessage(err));
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [reportType, reloadKey]);

  const records = reportType === "movements" ? movements : stock;

  const filteredRecords = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("es-CO");

    if (!query) return records;

    return records.filter((record) =>
      Object.values(record).some((value) =>
        displayValue(value).toLocaleLowerCase("es-CO").includes(query),
      ),
    );
  }, [records, search]);

  const columns = useMemo(() => {
    const keys = new Set<string>();

    filteredRecords.forEach((record) => {
      Object.keys(record).forEach((key) => keys.add(key));
    });

    return Array.from(keys);
  }, [filteredRecords]);

  const changeReport = (type: ReportType) => {
    setReportType(type);
    setSearch("");
    setError("");
    setLoading(true);
  };

  const refresh = () => {
    setLoading(true);
    setError("");
    setReloadKey((previous) => previous + 1);
  };

  const generateReceipt = async (record: DataRecord) => {
    const id = typeof record.id === "number" ? record.id : Number(record.id);
    if (!Number.isInteger(id) || id <= 0 || generatingReceiptId !== null) return;
    setGeneratingReceiptId(id);
    setError("");
    try {
      const result = await createInventoryMovementReceipt(id);
      await downloadInventoryDocument(result.documentoId);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setGeneratingReceiptId(null);
    }
  };

  // DESCARGAR REPORTES CSV Y EXCEL

  const downloadReport = async (format: ExportFormat) => {
    if (downloading !== null) return;

    setDownloading(format);
    setError("");

    const endpoint =
      reportType === "movements"
        ? format === "excel"
          ? endpoints.movementsExcel
          : endpoints.movementsExport
        : format === "excel"
          ? endpoints.stockExcel
          : endpoints.stockExport;

    try {
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: "GET",
        headers: getHeaders(),
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error(
            "La sesión no está autorizada. Inicia sesión nuevamente.",
          );
        }

        if (response.status === 403) {
          throw new Error(
            "Tu usuario no tiene permisos para descargar este reporte.",
          );
        }

        throw new Error(
          `No fue posible descargar el reporte. Código HTTP ${response.status}.`,
        );
      }

      const blob = await response.blob();

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      const date = new Date().toISOString().slice(0, 10);

      const extension = format === "excel" ? "xlsx" : "csv";

      const filename =
        reportType === "movements"
          ? `Sistema007_Movimientos_${date}.${extension}`
          : `Sistema007_Existencias_${date}.${extension}`;

      link.href = url;
      link.download = filename;

      document.body.appendChild(link);
      link.click();
      link.remove();

      window.setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 1000);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setDownloading(null);
    }
  };

  return (
    <main className="inventory-page">
      <header className="inventory-header">
        <div>
          <span className="inventory-section-label">
            SISTEMA 007 / INVENTARIO
          </span>

          <h1>Movimientos de inventario</h1>

          <p>
            Consulta los movimientos registrados, verifica las existencias y
            descarga reportes para seguimiento y trazabilidad.
          </p>
        </div>

        <Link
          to="/inventory"
          className="inventory-back-button"
          style={{ textDecoration: "none" }}
        >
          Volver a Inventario
        </Link>
      </header>

      <section className="inventory-content">
        <div className="inventory-toolbar">
          <div>
            <h2>Reportes de inventario</h2>
            <span>Selecciona el reporte que deseas consultar.</span>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            marginBottom: 24,
          }}
        >
          <button
            type="button"
            onClick={() => changeReport("movements")}
            aria-pressed={reportType === "movements"}
            style={{
              padding: "12px 20px",
              borderRadius: 8,
              border: "1px solid #062b55",
              background: reportType === "movements" ? "#062b55" : "#ffffff",
              color: reportType === "movements" ? "#ffffff" : "#062b55",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Movimientos
          </button>

          <button
            type="button"
            onClick={() => changeReport("stock")}
            aria-pressed={reportType === "stock"}
            style={{
              padding: "12px 20px",
              borderRadius: 8,
              border: "1px solid #062b55",
              background: reportType === "stock" ? "#062b55" : "#ffffff",
              color: reportType === "stock" ? "#ffffff" : "#062b55",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Existencias
          </button>
        </div>

        <div className="inventory-search-container">
          <label htmlFor="inventory-report-search">Buscar en el reporte</label>

          <input
            id="inventory-report-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar producto, lote, bodega, movimiento..."
          />
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 16,
            flexWrap: "wrap",
            margin: "20px 0",
          }}
        >
          <div>
            <strong>
              {reportType === "movements"
                ? "Historial de movimientos"
                : "Reporte de existencias"}
            </strong>

            <p
              style={{
                margin: "6px 0 0",
                color: "#64748b",
              }}
            >
              {loading
                ? "Consultando información..."
                : `${filteredRecords.length} registros encontrados`}
            </p>
          </div>

          <div
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              onClick={refresh}
              disabled={loading}
              style={{
                padding: "11px 18px",
                borderRadius: 8,
                border: "1px solid #062b55",
                background: "#ffffff",
                color: "#062b55",
                cursor: loading ? "not-allowed" : "pointer",
                fontWeight: 600,
              }}
            >
              Actualizar
            </button>

            <button
              type="button"
              onClick={() => downloadReport("csv")}
              disabled={downloading !== null}
              style={{
                padding: "11px 18px",
                borderRadius: 8,
                border: "none",
                background: "#00aebc",
                color: "#ffffff",
                cursor: downloading !== null ? "not-allowed" : "pointer",
                fontWeight: 600,
              }}
            >
              {downloading === "csv" ? "Descargando CSV..." : "Descargar CSV"}
            </button>

            <button
              type="button"
              onClick={() => downloadReport("excel")}
              disabled={downloading !== null}
              style={{
                padding: "11px 18px",
                borderRadius: 8,
                border: "none",
                background: "#062b55",
                color: "#ffffff",
                cursor: downloading !== null ? "not-allowed" : "pointer",
                fontWeight: 600,
              }}
            >
              {downloading === "excel"
                ? "Descargando Excel..."
                : "Descargar Excel"}
            </button>
          </div>
        </div>

        {error && (
          <div className="inventory-message" role="alert">
            {error}
          </div>
        )}

        {loading && (
          <div className="inventory-message">
            Cargando información del inventario...
          </div>
        )}

        {!loading && !error && filteredRecords.length === 0 && (
          <div className="inventory-empty">
            <h3>No se encontraron registros</h3>

            <p>
              {search.trim()
                ? "No hay resultados que coincidan con la búsqueda."
                : "El reporte no contiene registros para mostrar."}
            </p>
          </div>
        )}

        {!loading && !error && filteredRecords.length > 0 && (
          <div className="inventory-table-container">
            <table className="inventory-table">
              <thead>
                <tr>
                  {columns.map((column) => (
                    <th key={column}>{readableColumn(column)}</th>
                  ))}
                  {inventoryDocumentsEnabled && reportType === "movements" && (
                    <th>Comprobante</th>
                  )}
                </tr>
              </thead>

              <tbody>
                {filteredRecords.map((record, index) => (
                  <tr key={`${String(record.id ?? index)}-${index}`}>
                    {columns.map((column) => (
                      <td key={column}>{displayValue(record[column])}</td>
                    ))}
                    {inventoryDocumentsEnabled && reportType === "movements" && (
                      <td>
                        {record.tipo === "DISPENSACION" ? (
                          <span>Soporte de dispensación</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void generateReceipt(record)}
                            disabled={generatingReceiptId !== null}
                            className="inventory-back-button"
                          >
                            {generatingReceiptId === record.id
                              ? "Generando..."
                              : "PDF"}
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
