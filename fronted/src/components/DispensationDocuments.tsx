import { useEffect, useRef, useState } from "react";
import type { PointerEvent } from "react";
import { PenLine, Upload } from "lucide-react";

import {
  downloadDispensationDocument,
  generateDispensationReceipt,
  getDispensationDetail,
  getDispensationHistory,
  getDispensationReport,
  getDispensationReportSites,
  downloadDispensationReport,
  registerDispensationSupport,
} from "../services/dispensations.service";

import type {
  DispensationDetail,
  DispensationHistoryRow,
  DispensationReportFilters,
  DispensationReportRow,
  DispensationReportSite,
} from "../services/dispensations.service";

import "../styles/DispensationDocuments.css";

type Props = {
  confirmedId?: number;
  readOnly?: boolean;
};

function formatDate(value?: string) {
  if (!value) return "No registrada";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function documentStatus(value: string) {
  const labels: Record<string, string> = {
    PENDIENTE: "Soporte pendiente",
    REGISTRADO: "Soporte registrado",
    LEGADO_POR_VERIFICAR: "Registro histórico por verificar",
  };

  return labels[value] ?? value;
}

function deliveryStatus(value: string) {
  const labels: Record<string, string> = {
    CONFIRMADA: "Entrega confirmada",
    PENDIENTE: "Entrega pendiente",
    ANULADA: "Entrega anulada",
  };

  return labels[value] ?? value;
}

function colombiaDateTimeLocal(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(date).reduce<Record<string, string>>((value, part) => {
    if (part.type !== "literal") value[part.type] = part.value;
    return value;
  }, {});
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

function colombiaDateTimeToIso(value: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const [, year, month, day, hour, minute] = match;
  const date = new Date(Date.UTC(+year, +month - 1, +day, +hour + 5, +minute));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function fileSize(size: number) {
  return `${(size / 1024 / 1024).toFixed(size < 1024 * 1024 ? 1 : 2)} MB`;
}

export default function DispensationDocuments({ confirmedId, readOnly = false }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const manualInput = useRef<HTMLInputElement>(null);
  const drawing = useRef(false);

  const [rows, setRows] = useState<DispensationHistoryRow[]>([]);
  const [detail, setDetail] = useState<DispensationDetail | null>(null);

  // Control visual del modal
  const [maximized, setMaximized] = useState(false);

  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [documento, setDocumento] = useState("");
  const [modo, setModo] = useState<"DIGITAL" | "MANUAL">("DIGITAL");
  const [tipoReceptor, setTipoReceptor] = useState("PACIENTE");
  const [nombre, setNombre] = useState("");
  const [tipoDocumento, setTipoDocumento] = useState("");
  const [numero, setNumero] = useState("");
  const [relacion, setRelacion] = useState("");
  const [constancia, setConstancia] = useState("");
  const [fechaFirma, setFechaFirma] = useState(colombiaDateTimeLocal());
  const [manual, setManual] = useState<File | null>(null);
  const [draggingManual, setDraggingManual] = useState(false);
  const [correccion, setCorreccion] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [reportFilters, setReportFilters] = useState<DispensationReportFilters>({ estado: "CONFIRMADA" });
  const [reportRows, setReportRows] = useState<DispensationReportRow[]>([]);
  const [reportTotals, setReportTotals] = useState({ totalEntregas: 0, totalUnidades: 0 });
  const [reportLoading, setReportLoading] = useState(false);
  const [reportSites, setReportSites] = useState<DispensationReportSite[]>([]);
  const [showLegacyReports] = useState(() => false);

  // CONSULTAR HISTORIAL

  async function loadHistory(filter = documento) {
    setLoading(true);
    setError("");

    try {
      setRows(await getDispensationHistory(filter));
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "No fue posible consultar el historial.",
      );
    } finally {
      setLoading(false);
    }
  }

  // ABRIR DETALLE

  async function open(id: number) {
    setBusy(true);
    setError("");

    try {
      const value = await getDispensationDetail(id);

      setDetail(value);
      setMaximized(false);
      setFechaFirma(colombiaDateTimeLocal());
      setManual(null);

      const patient = value.comprobante?.paciente;

      if (patient) {
        setNombre(`${patient.nombres} ${patient.apellidos}`);
        setTipoDocumento(patient.tipoDocumento);
        setNumero(patient.numeroDocumento);
      }

      setCorreccion(
        value.soportes.length > 0 ||
          value.estadoDocumental === "LEGADO_POR_VERIFICAR",
      );
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "No fue posible abrir la entrega.",
      );
    } finally {
      setBusy(false);
    }
  }

  // CERRAR DETALLE

  function closeDetail() {
    if (busy) return;

    setDetail(null);
    setMaximized(false);
    drawing.current = false;
  }

  // AMPLIAR O RESTAURAR

  function toggleMaximized() {
    setMaximized((current) => !current);
  }

  // CARGA INICIAL DEL HISTORIAL
  // La respuesta asincrónica actualiza el estado,
  // evitando hacerlo directamente dentro del efecto.

  useEffect(() => {
    let cancelled = false;

    getDispensationHistory("")
      .then((result) => {
        if (!cancelled) {
          setRows(result);
        }
      })
      .catch((reason) => {
        if (!cancelled) {
          setError(
            reason instanceof Error
              ? reason.message
              : "No fue posible consultar el historial.",
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    getDispensationReportSites().then(setReportSites).catch(() => setReportSites([]));
  }, []);

  // ABRIR AUTOMÁTICAMENTE UNA ENTREGA CONFIRMADA

  useEffect(() => {
    if (!confirmedId) return;

    let cancelled = false;

    getDispensationDetail(confirmedId)
      .then((value) => {
        if (cancelled) return;

        setDetail(value);
        setMaximized(false);
        setFechaFirma(colombiaDateTimeLocal());
        setManual(null);

        const patient = value.comprobante?.paciente;

        if (patient) {
          setNombre(`${patient.nombres} ${patient.apellidos}`);
          setTipoDocumento(patient.tipoDocumento);
          setNumero(patient.numeroDocumento);
        }

        setCorreccion(
          value.soportes.length > 0 ||
            value.estadoDocumental === "LEGADO_POR_VERIFICAR",
        );
      })
      .catch((reason) => {
        if (!cancelled) {
          setError(
            reason instanceof Error
              ? reason.message
              : "No fue posible abrir la entrega.",
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [confirmedId]);

  // CERRAR CON LA TECLA ESCAPE

  useEffect(() => {
    if (!detail) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) {
        setDetail(null);
        setMaximized(false);
        drawing.current = false;
      }
    };

    window.addEventListener("keydown", closeOnEscape);

    return () => {
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [detail, busy]);

  // FIRMA MANUSCRITA

  function pointer(event: PointerEvent<HTMLCanvasElement>) {
    const target = event.currentTarget;
    const context = target.getContext("2d");

    if (!context) return;

    const box = target.getBoundingClientRect();

    const x = (event.clientX - box.left) * (target.width / box.width);

    const y = (event.clientY - box.top) * (target.height / box.height);

    if (event.type === "pointerdown") {
      drawing.current = true;
      target.setPointerCapture(event.pointerId);
      context.beginPath();
      context.moveTo(x, y);
      return;
    }

    if (!drawing.current || event.type !== "pointermove") return;

    context.lineWidth = 3;
    context.lineCap = "round";
    context.strokeStyle = "#062b55";
    context.lineTo(x, y);
    context.stroke();
  }

  function clearSignature() {
    const current = canvas.current;
    const context = current?.getContext("2d");

    if (current && context) {
      context.clearRect(0, 0, current.width, current.height);
    }
  }

  function selectManual(file?: File | null) {
    if (!file) return;
    const supported = ["application/pdf", "image/png", "image/jpeg"];
    if (!supported.includes(file.type) || file.size > 10 * 1024 * 1024) {
      setError("Adjunta un PDF, JPG o PNG válido de máximo 10 MB.");
      return;
    }
    setError("");
    setManual(file);
  }

  // REGISTRAR SOPORTE

  async function submitSupport() {
    if (!detail || busy) return;

    const base = detail.documentos.find(
      (item) => item.proposito === "COMPROBANTE",
    );

    if (!base) {
      setError("Genera primero el comprobante PDF.");
      return;
    }

    let file: Blob | File | null = manual;

    if (modo === "DIGITAL") {
      file = await new Promise<Blob | null>((resolve) => {
        if (!canvas.current) {
          resolve(null);
          return;
        }

        canvas.current.toBlob(resolve, "image/png");
      });
    }

    if (!file) {
      setError(
        modo === "DIGITAL"
          ? "Captura la firma antes de guardar."
          : "Selecciona el soporte físico firmado.",
      );
      return;
    }

    const data = new FormData();

    data.set(
      "file",
      file,
      modo === "DIGITAL" ? "firma.png" : (manual?.name ?? "soporte.pdf"),
    );

    data.set("versionEsperada", String(detail.versionDocumental));

    data.set("documentoBaseId", String(base.id));
    data.set("modalidad", modo);
    data.set("tipoReceptor", tipoReceptor);
    data.set("nombreReceptor", nombre);
    data.set("tipoDocumentoReceptor", tipoDocumento);
    data.set("numeroDocumentoReceptor", numero);
    const signedAt = colombiaDateTimeToIso(fechaFirma);
    if (!signedAt) {
      setError("Indica una fecha y hora de recepción válidas.");
      return;
    }
    data.set("fechaFirma", signedAt);

    if (tipoReceptor === "TERCERO_AUTORIZADO") {
      data.set("relacionReceptor", relacion);
      data.set("constanciaAutorizacion", constancia);
    }

    if (correccion) {
      data.set("motivoCorreccion", motivo);
    }

    setBusy(true);
    setError("");

    try {
      await registerDispensationSupport(detail.id, data, correccion);

      clearSignature();
      setManual(null);
      if (manualInput.current) manualInput.current.value = "";

      await open(detail.id);
      await loadHistory();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "No fue posible registrar el soporte.",
      );
    } finally {
      setBusy(false);
    }
  }

  // GENERAR COMPROBANTE PDF

  async function makeReceipt() {
    if (!detail) return;

    setBusy(true);
    setError("");

    try {
      await generateDispensationReceipt(detail.id);
      await open(detail.id);
      await loadHistory();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "No fue posible generar el PDF.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function loadReport() {
    setReportLoading(true);
    setError("");
    try {
      const result = await getDispensationReport(reportFilters);
      setReportRows(result.rows);
      setReportTotals({ totalEntregas: result.totalEntregas, totalUnidades: result.totalUnidades });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No fue posible generar el reporte.");
    } finally {
      setReportLoading(false);
    }
  }

  function updateReportFilter(key: keyof DispensationReportFilters, value: string) {
    setReportFilters((current) => ({ ...current, [key]: value }));
  }

  return (
    <section className="dispensation-documents">
      {/* ENCABEZADO */}

      <header className="dispensation-documents__header">
        <div>
          <span className="dispensation-documents__eyebrow">
            Entrega y trazabilidad
          </span>

          <h2>Soportes de dispensación</h2>

          <p>
            Consulta comprobantes, registra la recepción y conserva las
            versiones documentales de cada entrega.
          </p>
        </div>
      </header>

      {/* BÚSQUEDA */}

      <form
        className="dispensation-documents__search"
        onSubmit={(event) => {
          event.preventDefault();
          void loadHistory();
        }}
      >
        <label htmlFor="support-patient-document">Documento del paciente</label>

        <div className="dispensation-documents__search-row">
          <input
            id="support-patient-document"
            value={documento}
            onChange={(event) => setDocumento(event.target.value)}
            placeholder="Ej.: 123456789"
            autoComplete="off"
          />

          <button className="inventory-receipt-submit" disabled={loading}>
            {loading ? "Consultando..." : "Buscar soportes"}
          </button>
        </div>
      </form>

      {error && (
        <div className="inventory-receipt-error" role="alert">
          {error}
        </div>
      )}

      {/* HISTORIAL DE ENTREGAS */}

      <div className="dispensation-documents__history">
        <div className="dispensation-documents__history-title">
          <h3>Historial de entregas</h3>

          <span>
            {loading
              ? "Actualizando…"
              : `${rows.length} registro(s) consultado(s)`}
          </span>
        </div>

        <div className="dispensation-documents__table-wrap">
          <table className="dispensation-documents__table">
            <thead>
              <tr>
                <th>Entrega</th>
                <th>Paciente</th>
                <th>Ingreso y medicamentos</th>
                <th>Estados</th>
                <th aria-label="Acciones" />
              </tr>
            </thead>

            <tbody>
              {rows.map((row) => {
                const ingresos = [
                  ...new Set(
                    row.detalles.map(
                      (item) =>
                        item.detalleFormulacion.formulacion.atencionClinica
                          .numeroIngreso,
                    ),
                  ),
                ];

                return (
                  <tr key={row.id}>
                    <td>
                      <strong>{row.numeroDispensacion}</strong>

                      <small>{formatDate(row.fechaDispensacion)}</small>
                    </td>

                    <td>
                      <strong>
                        {row.paciente.nombres} {row.paciente.apellidos}
                      </strong>

                      <small>Documento: {row.paciente.numeroDocumento}</small>
                    </td>

                    <td>
                      <span className="dispensation-documents__ingress">
                        Ingreso {ingresos.join(", ")}
                      </span>

                      <span className="dispensation-documents__medications">
                        {row.detalles
                          .map(
                            (item) =>
                              `${item.detalleFormulacion.medicamento} · ${item.cantidadEntregada} und.`,
                          )
                          .join(" · ")}
                      </span>
                    </td>

                    <td>
                      <span
                        className={`dispensation-documents__tag dispensation-documents__tag--delivery-${row.estado.toLowerCase()}`}
                      >
                        {deliveryStatus(row.estado)}
                      </span>

                      <span
                        className={`dispensation-documents__tag dispensation-documents__tag--document-${row.estadoDocumental.toLowerCase()}`}
                      >
                        {documentStatus(row.estadoDocumental)}
                      </span>
                    </td>

                    <td>
                      <button
                        type="button"
                        className="inventory-back-button"
                        onClick={() => void open(row.id)}
                        disabled={busy}
                      >
                        Ver detalle
                      </button>
                    </td>
                  </tr>
                );
              })}

              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={5}>
                    <div className="dispensation-documents__empty">
                      No hay dispensaciones para el filtro indicado.
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showLegacyReports && <>
      {/* REPORTES DE DISPENSACIÓN: trasladados al módulo centralizado /reports. */}

      <section className="dispensation-documents__reports">
        <header>
          <div>
            <span className="dispensation-documents__eyebrow">
              Consulta y exportación
            </span>

            <h3>Reportes de dispensación</h3>

            <p>
              Los reportes son de solo lectura y no modifican entregas, lotes ni
              inventario.
            </p>
          </div>
        </header>

        <div className="dispensation-documents__report-filters">
          <label>
            Desde
            <input
              type="date"
              value={reportFilters.desde ?? ""}
              onChange={(event) =>
                updateReportFilter("desde", event.target.value)
              }
            />
          </label>

          <label>
            Hasta
            <input
              type="date"
              value={reportFilters.hasta ?? ""}
              onChange={(event) =>
                updateReportFilter("hasta", event.target.value)
              }
            />
          </label>

          <label>
            Sede
            <select
              value={reportFilters.sedeId ?? ""}
              onChange={(event) =>
                updateReportFilter("sedeId", event.target.value)
              }
            >
              <option value="">Todas las sedes</option>

              {reportSites.map((site) => (
                <option key={site.id} value={String(site.id)}>
                  {site.nombre} ({site.codigo})
                </option>
              ))}
            </select>
          </label>

          <label>
            Medicamento
            <input
              value={reportFilters.medicamento ?? ""}
              onChange={(event) =>
                updateReportFilter("medicamento", event.target.value)
              }
              placeholder="Nombre o parte del nombre"
            />
          </label>

          <label>
            Estado de entrega
            <select
              value={reportFilters.estado ?? ""}
              onChange={(event) =>
                updateReportFilter("estado", event.target.value)
              }
            >
              <option value="CONFIRMADA">Confirmadas</option>

              <option value="PENDIENTE">Pendientes</option>

              <option value="ANULADA">Anuladas</option>
            </select>
          </label>

          <label>
            Soporte
            <select
              value={reportFilters.soporte ?? ""}
              onChange={(event) =>
                updateReportFilter("soporte", event.target.value)
              }
            >
              <option value="">Todos</option>

              <option value="PENDIENTE">Pendiente de soporte</option>
            </select>
          </label>
        </div>

        <div className="dispensation-documents__report-actions">
          <button
            type="button"
            className="inventory-receipt-submit"
            onClick={() => void loadReport()}
            disabled={reportLoading}
          >
            {reportLoading ? "Consultando…" : "Consultar reporte"}
          </button>

          <button
            type="button"
            className="inventory-back-button"
            onClick={() =>
              void downloadDispensationReport(reportFilters, "excel")
            }
            disabled={reportLoading}
          >
            Descargar Excel
          </button>

          <button
            type="button"
            className="inventory-back-button"
            onClick={() =>
              void downloadDispensationReport(reportFilters, "pdf")
            }
            disabled={reportLoading}
          >
            Descargar PDF
          </button>
        </div>

        {(reportRows.length > 0 || reportLoading) && (
          <>
            <div className="dispensation-documents__report-summary">
              <div>
                <span>Entregas</span>
                <strong>{reportTotals.totalEntregas}</strong>
              </div>

              <div>
                <span>Unidades dispensadas</span>
                <strong>{reportTotals.totalUnidades}</strong>
              </div>

              <div>
                <span>Filas de trazabilidad</span>
                <strong>{reportRows.length}</strong>
              </div>
            </div>

            <div className="dispensation-documents__table-wrap">
              <table className="dispensation-documents__table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Paciente / ingreso</th>
                    <th>Medicamento y lote</th>
                    <th>Cantidad</th>
                    <th>Sede / responsable</th>
                    <th>Soporte</th>
                  </tr>
                </thead>

                <tbody>
                  {reportRows.map((row, index) => (
                    <tr key={`${row.dispensacion}-${row.lote}-${index}`}>
                      <td>{formatDate(row.fecha)}</td>

                      <td>
                        <strong>{row.paciente}</strong>

                        <small>Ingreso {row.ingreso}</small>
                      </td>

                      <td>
                        <strong>{row.medicamento}</strong>

                        <small>
                          {row.concentracion} · Lote {row.lote} · Vence{" "}
                          {formatDate(row.vencimiento)}
                        </small>
                      </td>

                      <td>{row.cantidad}</td>

                      <td>
                        {row.sede}

                        <small>{row.responsable}</small>
                      </td>

                      <td>
                        <span
                          className={`dispensation-documents__tag dispensation-documents__tag--document-${row.estadoSoporte.toLowerCase()}`}
                        >
                          {documentStatus(row.estadoSoporte)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
      </>}

      {/* VENTANA MODAL */}

      {detail && (
        <div
          className="dispensation-documents__modal-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeDetail();
            }
          }}
        >
          <article
            className={`dispensation-documents__detail ${
              maximized ? "dispensation-documents__detail--maximized" : ""
            }`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="dispensation-detail-title"
          >
            {/* ENCABEZADO */}

            <header className="dispensation-documents__detail-header">
              <div className="dispensation-documents__detail-heading">
                <span className="dispensation-documents__eyebrow">
                  Detalle de entrega
                </span>

                <h3 id="dispensation-detail-title">
                  {detail.numeroDispensacion}
                </h3>
              </div>

              <div className="dispensation-documents__status-group">
                <span
                  className={`dispensation-documents__tag dispensation-documents__tag--delivery-${detail.estado.toLowerCase()}`}
                >
                  {deliveryStatus(detail.estado)}
                </span>

                <span
                  className={`dispensation-documents__tag dispensation-documents__tag--document-${detail.estadoDocumental.toLowerCase()}`}
                >
                  {documentStatus(detail.estadoDocumental)}
                </span>
              </div>

              {/* CONTROLES DE VENTANA */}

              <div className="dispensation-documents__window-controls">
                <button
                  type="button"
                  className="dispensation-documents__window-button"
                  onClick={toggleMaximized}
                  aria-label={
                    maximized ? "Restaurar ventana" : "Ampliar ventana"
                  }
                  aria-pressed={maximized}
                  title={maximized ? "Restaurar ventana" : "Ampliar ventana"}
                >
                  {maximized ? (
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <rect x="8" y="3" width="13" height="13" rx="2" />

                      <path d="M16 16v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2h3" />
                    </svg>
                  ) : (
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                    </svg>
                  )}
                </button>

                <button
                  type="button"
                  className="dispensation-documents__modal-close"
                  aria-label="Cerrar detalle"
                  title="Cerrar"
                  onClick={closeDetail}
                  disabled={busy}
                >
                  ×
                </button>
              </div>
            </header>

            {/* INFORMACIÓN DE LA ENTREGA */}

            <section
              className="dispensation-documents__detail-summary"
              aria-label="Información de la entrega"
            >
              <div>
                <span>Paciente</span>

                <strong>
                  {detail.comprobante.paciente.nombres}{" "}
                  {detail.comprobante.paciente.apellidos}
                </strong>

                <small>
                  {detail.comprobante.paciente.tipoDocumento}{" "}
                  {detail.comprobante.paciente.numeroDocumento}
                </small>
              </div>

              <div>
                <span>Ingreso clínico</span>

                <strong>
                  {[
                    ...new Set(
                      detail.comprobante.medicamentos
                        .map((item) => item.numeroIngreso)
                        .filter(Boolean),
                    ),
                  ].join(", ") || "No disponible"}
                </strong>

                <small>
                  Fecha: {formatDate(detail.comprobante.fechaDispensacion)}
                </small>
              </div>

              <div>
                <span>Sede y bodega</span>

                <strong>{detail.comprobante.sede}</strong>

                <small>{detail.comprobante.bodega}</small>
              </div>

              <div>
                <span>Responsable</span>

                <strong>{detail.comprobante.dispensadoPor.nombre}</strong>

                <small>
                  {detail.comprobante.dispensadoPor.rol ??
                    "Profesional farmacéutico"}
                </small>
              </div>
            </section>

            {/* MEDICAMENTOS ENTREGADOS */}

            <section
              className="dispensation-documents__delivered-medications"
              aria-labelledby="delivered-medications-title"
            >
              <h4 id="delivered-medications-title">Medicamentos entregados</h4>

              <div className="dispensation-documents__table-wrap">
                <table className="dispensation-documents__table">
                  <thead>
                    <tr>
                      <th>Medicamento</th>
                      <th>Presentación</th>
                      <th>Lote</th>
                      <th>Vencimiento</th>
                      <th>Cantidad</th>
                    </tr>
                  </thead>

                  <tbody>
                    {detail.comprobante.medicamentos.map((item, index) => (
                      <tr key={`${item.numeroLote}-${index}`}>
                        <td>
                          <strong>{item.medicamento}</strong>

                          <small>{item.concentracion}</small>
                        </td>

                        <td>{item.formaFarmaceutica}</td>

                        <td>{item.numeroLote}</td>

                        <td>{formatDate(item.fechaVencimiento)}</td>

                        <td>{item.cantidadEntregada}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* DOCUMENTOS */}

            <section
              className="dispensation-documents__actions"
              aria-label="Documentos de la entrega"
            >
              {!readOnly && !detail.documentos.some(
                (item) => item.proposito === "COMPROBANTE",
              ) && (
                <button
                  type="button"
                  className="inventory-receipt-submit"
                  onClick={() => void makeReceipt()}
                  disabled={busy}
                >
                  Generar comprobante PDF
                </button>
              )}

              {detail.documentos.map((item) => (
                <button
                  type="button"
                  className="inventory-back-button"
                  key={item.id}
                  onClick={() =>
                    void downloadDispensationDocument(detail.id, item)
                  }
                >
                  Descargar{" "}
                  {item.proposito === "COMPROBANTE"
                    ? "comprobante"
                    : item.proposito === "SOPORTE_FIRMADO"
                      ? "soporte firmado"
                      : "firma"}
                </button>
              ))}
            </section>

            {/* REGISTRO DE RECEPCIÓN */}

            {!readOnly && !detail.documentos.some(
              (item) => item.proposito === "COMPROBANTE",
            ) && (
              <p className="dispensation-documents__receipt-requirement">
                Genera el comprobante PDF para habilitar el registro trazable de la evidencia de recibido.
              </p>
            )}

            {!readOnly && detail.documentos.some(
              (item) => item.proposito === "COMPROBANTE",
            ) && (
              <section className="dispensation-documents__form-area">
                <div className="dispensation-documents__form-heading">
                  <h4>
                    {correccion
                      ? "Registrar corrección documental"
                      : "Registrar recepción"}
                  </h4>

                  <p>
                    {correccion
                      ? "La corrección conservará el soporte anterior e incorporará una nueva versión."
                      : "La evidencia de recibido no modifica la entrega ni las existencias."}
                  </p>
                </div>

                {/* MODALIDAD */}

                <div className="dispensation-documents__form-section">
                  <h5>1. Modalidad de firma</h5>

                  <div className="dispensation-documents__field-grid">
                    <div className="dispensation-documents__mode-picker" role="radiogroup" aria-label="Modalidad de evidencia">
                      <button type="button" role="radio" aria-checked={modo === "DIGITAL"} className={modo === "DIGITAL" ? "active" : ""} onClick={() => setModo("DIGITAL")}>
                        <PenLine size={20} aria-hidden="true" />
                        <span>Firma manuscrita en pantalla<small>Use cursor, dedo o lápiz óptico.</small></span>
                      </button>
                      <button type="button" role="radio" aria-checked={modo === "MANUAL"} className={modo === "MANUAL" ? "active" : ""} onClick={() => setModo("MANUAL")}>
                        <Upload size={20} aria-hidden="true" />
                        <span>Adjuntar soporte físico firmado<small>PDF, JPG, JPEG o PNG · máximo 10 MB.</small></span>
                      </button>
                    </div>

                    <label>
                      Persona que recibe
                      <select
                        value={tipoReceptor}
                        onChange={(event) =>
                          setTipoReceptor(event.target.value)
                        }
                      >
                        <option value="PACIENTE">Paciente</option>

                        <option value="TERCERO_AUTORIZADO">
                          Tercero autorizado
                        </option>
                      </select>
                    </label>
                  </div>
                </div>

                {/* IDENTIFICACIÓN */}

                <div className="dispensation-documents__form-section">
                  <h5>2. Datos de identificación</h5>

                  <div className="dispensation-documents__field-grid">
                    <label>
                      Nombre completo
                      <input
                        value={nombre}
                        onChange={(event) => setNombre(event.target.value)}
                      />
                    </label>

                    <label>
                      Tipo de documento
                      <input
                        value={tipoDocumento}
                        onChange={(event) =>
                          setTipoDocumento(event.target.value)
                        }
                      />
                    </label>

                    <label>
                      Número de documento
                      <input
                        value={numero}
                        onChange={(event) => setNumero(event.target.value)}
                      />
                    </label>

                    <label>
                      Fecha de recepción
                      <input
                        type="datetime-local"
                        value={fechaFirma}
                        onChange={(event) => setFechaFirma(event.target.value)}
                      />
                    </label>
                  </div>

                  {tipoReceptor === "TERCERO_AUTORIZADO" && (
                    <div className="dispensation-documents__field-grid dispensation-documents__field-grid--third">
                      <label>
                        Relación con el paciente
                        <input
                          value={relacion}
                          onChange={(event) => setRelacion(event.target.value)}
                        />
                      </label>

                      <label>
                        Constancia de autorización
                        <textarea
                          value={constancia}
                          onChange={(event) =>
                            setConstancia(event.target.value)
                          }
                        />
                      </label>
                    </div>
                  )}
                </div>

                {/* CORRECCIÓN DOCUMENTAL */}

                {correccion && (
                  <div className="dispensation-documents__form-section">
                    <h5>3. Motivo de corrección</h5>

                    <label className="dispensation-documents__full-field">
                      Describe el motivo
                      <textarea
                        value={motivo}
                        onChange={(event) => setMotivo(event.target.value)}
                        required
                      />
                    </label>
                  </div>
                )}

                {/* EVIDENCIA DE RECIBIDO */}

                <div className="dispensation-documents__form-section">
                  <h5>{correccion ? "4" : "3"}. Evidencia de recibido</h5>

                  {modo === "DIGITAL" ? (
                    <div className="dispensation-documents__signature">
                      <div>
                        <strong>Firma manuscrita</strong>

                        <span>
                          Use el cursor, dedo o lápiz óptico dentro del área.
                        </span>
                      </div>

                      <canvas
                        ref={canvas}
                        width={1000}
                        height={360}
                        onPointerDown={pointer}
                        onPointerMove={pointer}
                        onPointerUp={() => {
                          drawing.current = false;
                        }}
                        onPointerLeave={() => {
                          drawing.current = false;
                        }}
                        aria-label="Área de firma manuscrita"
                      />

                      <button
                        type="button"
                        className="inventory-back-button"
                        onClick={clearSignature}
                      >
                        Limpiar firma
                      </button>
                    </div>
                  ) : (
                    <div
                      className={`dispensation-documents__file-field dispensation-documents__file-field--drop ${draggingManual ? "is-dragging" : ""}`}
                      onDragOver={(event) => { event.preventDefault(); setDraggingManual(true); }}
                      onDragLeave={() => setDraggingManual(false)}
                      onDrop={(event) => {
                        event.preventDefault();
                        setDraggingManual(false);
                        selectManual(event.dataTransfer.files?.[0]);
                      }}
                    >
                      <strong>Soporte físico firmado</strong>
                      <span>Adjunta el comprobante impreso y firmado en PDF, JPG o PNG. Máximo 10 MB.</span>
                      <input
                        ref={manualInput}
                        type="file"
                        accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png"
                        onChange={(event) => selectManual(event.target.files?.[0])}
                      />
                      <button type="button" className="dispensation-documents__select-file" onClick={() => manualInput.current?.click()}>
                        Seleccionar archivo
                      </button>
                      {manual && (
                        <div className="dispensation-documents__selected-file">
                          <small>{manual.name} · {fileSize(manual.size)}</small>
                          <button type="button" onClick={() => { setManual(null); if (manualInput.current) manualInput.current.value = ""; }}>Retirar archivo</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="dispensation-documents__submit">
                  <button
                    type="button"
                    className="inventory-receipt-submit"
                    onClick={() => void submitSupport()}
                    disabled={busy}
                  >
                    {busy
                      ? "Guardando…"
                      : correccion
                        ? "Registrar nueva versión"
                        : "Registrar soporte de recibido"}
                  </button>
                </div>
              </section>
            )}

            {readOnly && (
              <p className="dispensation-documents__receipt-requirement">
                Consulta de supervisión: la recepción, la firma y las correcciones documentales requieren un profesional farmacéutico autorizado.
              </p>
            )}

            {/* VERSIONES CONSERVADAS */}

            {detail.soportes.length > 0 && (
              <section className="dispensation-documents__versions">
                <h4>Versiones conservadas</h4>

                <ol>
                  {detail.soportes.map((support) => (
                    <li key={support.id}>
                      <strong>Versión {support.version}</strong>

                      <span>
                        {support.modalidad === "DIGITAL"
                          ? "Firma en tableta"
                          : "PDF firmado"}{" "}
                        · {formatDate(support.fechaFirma)} · Registrado por{" "}
                        {support.registradoPor.nombre}
                      </span>

                      {support.motivoCorreccion && (
                        <small>Motivo: {support.motivoCorreccion}</small>
                      )}
                    </li>
                  ))}
                </ol>
              </section>
            )}
          </article>
        </div>
      )}
    </section>
  );
}
