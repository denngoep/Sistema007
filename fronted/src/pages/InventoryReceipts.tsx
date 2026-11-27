import { useNavigate } from "react-router-dom";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";

import {
  getInventoryReceipts,
  getInventoryReceiptById,
  reviewInventoryReceipt,
  type InventoryReceiptListItem,
  type InventoryReceiptFullDetail,
  type InventoryReceiptFullDetailItem,
  type InventoryInvimaStatus,
} from "../services/inventory.service";

import "../styles/InventoryReceipts.css";
import { useFunctionalTestAccess } from "../components/functional-test-access";

type ReceiptFilter = "TODOS" | "PENDIENTE" | "CONFORME" | "NO_CONFORME";

type ReviewResult = "CONFORME" | "NO_CONFORME";

type InventoryRole =
  | "ADMINISTRADOR"
  | "REGENTE_FARMACIA"
  | "QUIMICO_FARMACEUTICO"
  | "AUXILIAR_FARMACIA";

function getCurrentRole(): InventoryRole | null {
  try {
    const storedUser = localStorage.getItem("user");

    if (!storedUser) return null;

    const user = JSON.parse(storedUser) as {
      rol?: string;
    };

    const allowedRoles: InventoryRole[] = [
      "ADMINISTRADOR",
      "REGENTE_FARMACIA",
      "QUIMICO_FARMACEUTICO",
      "AUXILIAR_FARMACIA",
    ];

    return allowedRoles.includes(user.rol as InventoryRole)
      ? (user.rol as InventoryRole)
      : null;
  } catch {
    return null;
  }
}

function formatDate(value?: string | null) {
  if (!value) return "Sin fecha";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "Sin fecha"
    : date.toLocaleDateString("es-CO", {
        timeZone: "UTC",
      });
}

function displayStatus(value?: string | null) {
  return value ? value.replaceAll("_", " ") : "Sin registro";
}

export default function InventoryReceipts() {
  const navigate = useNavigate();

  const listRef = useRef<HTMLDivElement>(null);
  const detailRef = useRef<HTMLDivElement>(null);

  const role = getCurrentRole();
  const functionalTestAccess = useFunctionalTestAccess();

  const canReview =
    functionalTestAccess || role === "ADMINISTRADOR" || role === "REGENTE_FARMACIA" || role === "QUIMICO_FARMACEUTICO";

  const [receipts, setReceipts] = useState<InventoryReceiptListItem[]>([]);

  const [filter, setFilter] = useState<ReceiptFilter>("TODOS");

  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedReceipt, setSelectedReceipt] =
    useState<InventoryReceiptFullDetail | null>(null);

  const [detailLoading, setDetailLoading] = useState(false);

  const [detailError, setDetailError] = useState("");

  const [reviewingId, setReviewingId] = useState<number | null>(null);

  const [result, setResult] = useState<ReviewResult>("CONFORME");

  const [invimaStatus, setInvimaStatus] =
    useState<InventoryInvimaStatus>("VIGENTE");

  const [temperature, setTemperature] = useState("");

  const [humidity, setHumidity] = useState("");

  const [observations, setObservations] = useState("");

  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [detailOpen, setDetailOpen] = useState(false);

  function scrollToDetail() {
    window.requestAnimationFrame(() => {
      detailRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }

  function scrollToList() {
    window.requestAnimationFrame(() => {
      listRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }

  async function loadReceipts() {
    try {
      setLoading(true);
      setError("");

      const response = await getInventoryReceipts();

      setReceipts(response.recepciones);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No fue posible cargar las recepciones",
      );
    } finally {
      setLoading(false);
    }
  }

  // Carga inicial corregida para evitar
  // react-hooks/set-state-in-effect.
  useEffect(() => {
    let active = true;

    getInventoryReceipts()
      .then((response) => {
        if (!active) return;

        setReceipts(response.recepciones);
        setError("");
      })
      .catch((err: unknown) => {
        if (!active) return;

        setError(
          err instanceof Error
            ? err.message
            : "No fue posible cargar las recepciones",
        );
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const filteredReceipts = useMemo(() => {
    return receipts.filter((receipt) => {
      const query = search.trim().toLowerCase();

      const matchesSearch =
        receipt.numeroFactura.toLowerCase().includes(query) ||
        receipt.numeroActa.toLowerCase().includes(query) ||
        (receipt.proveedor?.razonSocial ?? "").toLowerCase().includes(query);

      const matchesStatus =
        filter === "TODOS" ||
        (filter === "PENDIENTE" && receipt.totalPendientes > 0) ||
        (filter === "CONFORME" && receipt.totalConformes > 0) ||
        (filter === "NO_CONFORME" && receipt.totalNoConformes > 0);

      return matchesSearch && matchesStatus;
    });
  }, [receipts, search, filter]);

  const totalPending = receipts.reduce(
    (sum, receipt) => sum + receipt.totalPendientes,
    0,
  );

  const totalConforming = receipts.reduce(
    (sum, receipt) => sum + receipt.totalConformes,
    0,
  );

  const totalNonConforming = receipts.reduce(
    (sum, receipt) => sum + receipt.totalNoConformes,
    0,
  );

  async function openDetail(id: number) {
    if (saving) return;

    setDetailOpen(true);
    setDetailLoading(true);
    setDetailError("");
    setSuccess("");
    setReviewingId(null);
    setSelectedReceipt(null);

    scrollToDetail();

    try {
      const detail = await getInventoryReceiptById(id);

      setSelectedReceipt(detail);
    } catch (err) {
      setDetailError(
        err instanceof Error
          ? err.message
          : "No fue posible consultar el detalle",
      );
    } finally {
      setDetailLoading(false);
    }
  }

  function closeDetail() {
    if (saving) return;

    setDetailOpen(false);
    setSelectedReceipt(null);
    setDetailError("");
    setReviewingId(null);
    setSuccess("");

    scrollToList();
  }

  function startReview(item: InventoryReceiptFullDetailItem) {
    if (!canReview) return;

    setReviewingId(item.id);
    setResult("CONFORME");

    setInvimaStatus(
      item.estadoVerificacionInvima === "NO_VIGENTE"
        ? "NO_VIGENTE"
        : item.estadoVerificacionInvima === "NO_APLICA"
          ? "NO_APLICA"
          : "VIGENTE",
    );

    setTemperature(
      item.temperaturaRegistrada == null
        ? ""
        : String(item.temperaturaRegistrada),
    );

    setHumidity(
      item.humedadRegistrada == null ? "" : String(item.humedadRegistrada),
    );

    setObservations("");
    setDetailError("");
    setSuccess("");
  }

  async function submitReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canReview) {
      setDetailError(
        "No tienes permisos para realizar verificaciones técnicas.",
      );
      return;
    }

    if (!selectedReceipt || reviewingId === null || saving) {
      return;
    }

    if (!observations.trim()) {
      setDetailError(
        "Debes escribir una observación que justifique la revisión.",
      );
      return;
    }

    if (
      result === "CONFORME" &&
      (invimaStatus === "PENDIENTE" || invimaStatus === "NO_VIGENTE")
    ) {
      setDetailError(
        "No puedes aprobar un producto con verificación INVIMA pendiente o no vigente.",
      );
      return;
    }

    const item = selectedReceipt.detalles.find(
      (detail) => detail.id === reviewingId,
    );

    if (!item) return;

    if (
      result === "CONFORME" &&
      item.producto.tipo === "MEDICAMENTO" &&
      invimaStatus === "NO_APLICA"
    ) {
      setDetailError(
        "Para medicamentos debes registrar una verificación INVIMA vigente.",
      );
      return;
    }

    const temp = temperature.trim() === "" ? undefined : Number(temperature);

    const hum = humidity.trim() === "" ? undefined : Number(humidity);

    if (
      (temp !== undefined && !Number.isFinite(temp)) ||
      (hum !== undefined && (!Number.isFinite(hum) || hum < 0 || hum > 100))
    ) {
      setDetailError(
        "Verifica los valores de temperatura y humedad (0 a 100 %).",
      );
      return;
    }

    const question =
      result === "CONFORME"
        ? `¿Confirmas aprobar ${item.cantidadRecibida} unidades del lote ${item.numeroLote}? Se sumarán al inventario.`
        : `¿Confirmas rechazar el lote ${item.numeroLote}? No se sumará al inventario.`;

    if (!window.confirm(question)) return;

    setSaving(true);
    setDetailError("");
    setSuccess("");

    try {
      await reviewInventoryReceipt(selectedReceipt.id, {
        detalleActaId: reviewingId,
        resultado: result,
        estadoVerificacionInvima: invimaStatus,
        ...(temp !== undefined
          ? {
              temperaturaRegistrada: temp,
            }
          : {}),
        ...(hum !== undefined
          ? {
              humedadRegistrada: hum,
            }
          : {}),
        observaciones: observations.trim(),
      });

      const [updatedDetail, updatedList] = await Promise.all([
        getInventoryReceiptById(selectedReceipt.id),
        getInventoryReceipts(),
      ]);

      setSelectedReceipt(updatedDetail);
      setReceipts(updatedList.recepciones);
      setReviewingId(null);

      setSuccess(
        "La revisión se guardó correctamente y el seguimiento fue actualizado.",
      );
    } catch (err) {
      setDetailError(
        err instanceof Error
          ? err.message
          : "No fue posible guardar la revisión",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="inventory-content inventory-receipts">
      <div ref={listRef} className="inventory-toolbar">
        <div>
          <h2>Seguimiento de recepciones</h2>

          <p>
            {canReview
              ? "Consulta las facturas registradas y gestiona los productos pendientes de verificación técnica."
              : "Consulta las facturas registradas y el estado de su verificación técnica. Acceso de solo lectura."}
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadReceipts()}
          disabled={loading}
        >
          {loading ? "Actualizando..." : "Actualizar"}
        </button>
      </div>

      <div className="inventory-overview">
        <button type="button" onClick={() => setFilter("TODOS")} aria-pressed={filter === "TODOS"}>
          <strong>{receipts.length}</strong>
          <span>Recepciones registradas</span>
        </button>

        <button type="button" onClick={() => setFilter("PENDIENTE")} aria-pressed={filter === "PENDIENTE"}>
          <strong>{totalPending}</strong>
          <span>Productos pendientes</span>
        </button>

        <button type="button" onClick={() => setFilter("CONFORME")} aria-pressed={filter === "CONFORME"}>
          <strong>{totalConforming}</strong>
          <span>Productos conformes</span>
        </button>

        <button type="button" onClick={() => setFilter("NO_CONFORME")} aria-pressed={filter === "NO_CONFORME"}>
          <strong>{totalNonConforming}</strong>
          <span>Productos no conformes</span>
        </button>
      </div>

      <div className="inventory-toolbar">
        <input
          type="search"
          placeholder="Buscar factura, acta o proveedor"
          aria-label="Buscar recepción"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />

        <select
          aria-label="Filtrar recepciones"
          value={filter}
          onChange={(event) => setFilter(event.target.value as ReceiptFilter)}
        >
          <option value="TODOS">Todas las recepciones</option>

          <option value="PENDIENTE">Con pendientes</option>

          <option value="CONFORME">Con productos conformes</option>

          <option value="NO_CONFORME">Con productos no conformes</option>
        </select>
      </div>

      {loading && <p>Cargando recepciones...</p>}

      {error && <p role="alert">{error}</p>}

      {!loading && !error && filteredReceipts.length === 0 && (
        <p>No se encontraron recepciones con los filtros seleccionados.</p>
      )}

      {!loading && !error && filteredReceipts.length > 0 && (
        <div className="inventory-receipts-table-wrap">
          <table className="inventory-table">
            <thead>
              <tr>
                <th>Acta</th>
                <th>Factura</th>
                <th>Proveedor</th>
                <th>Fecha de recepción</th>
                <th>Estado</th>
                <th>Conformes</th>
                <th>Pendientes</th>
                <th>No conformes</th>
                <th>Acciones</th>
              </tr>
            </thead>

            <tbody>
              {filteredReceipts.map((receipt) => (
                <tr key={receipt.id}>
                  <td title={receipt.numeroActa}>{receipt.numeroActa}</td>

                  <td>{receipt.numeroFactura}</td>

                  <td>{receipt.proveedor?.razonSocial ?? "Sin proveedor"}</td>

                  <td>{formatDate(receipt.fechaRecepcion)}</td>

                  <td>{displayStatus(receipt.estado)}</td>

                  <td>{receipt.totalConformes}</td>

                  <td>{receipt.totalPendientes}</td>

                  <td>{receipt.totalNoConformes}</td>

                  <td>
                    {canReview ? (
                      <button
                        type="button"
                        className="receipt-action"
                        disabled={saving}
                        onClick={() =>
                          navigate(`/inventory/receipts/${receipt.id}/edit`)
                        }
                      >
                        Gestionar recepción
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="receipt-action"
                        disabled={saving}
                        onClick={() => void openDetail(receipt.id)}
                      >
                        Ver detalle
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {detailOpen && (
        <div
          ref={detailRef}
          className="receipt-detail-panel"
          aria-live="polite"
          style={{
            scrollMarginTop: "24px",
          }}
        >
          <div className="receipt-detail-heading">
            <div>
              <h3>
                Detalle de recepción
                {selectedReceipt ? ` · ${selectedReceipt.numeroFactura}` : ""}
              </h3>

              <p>
                {canReview
                  ? "Verificación técnica de los productos registrados"
                  : "Información de los productos registrados. Consulta de solo lectura."}
              </p>
            </div>

            <button
              type="button"
              className="receipt-secondary-button"
              disabled={saving}
              onClick={closeDetail}
            >
              Cerrar
            </button>
          </div>

          {detailLoading && <p>Cargando detalle...</p>}

          {detailError && (
            <p className="receipt-error" role="alert">
              {detailError}
            </p>
          )}

          {success && (
            <p className="receipt-success" role="status">
              {success}
            </p>
          )}

          {selectedReceipt && !detailLoading && (
            <>
              <div className="receipt-detail-meta">
                <span>
                  <b>Acta:</b> {selectedReceipt.numeroActa}
                </span>

                <span>
                  <b>Proveedor:</b>{" "}
                  {selectedReceipt.proveedor?.razonSocial ?? "Sin proveedor"}
                </span>

                <span>
                  <b>Fecha:</b> {formatDate(selectedReceipt.fechaRecepcion)}
                </span>

                <span>
                  <b>Estado:</b> {displayStatus(selectedReceipt.estado)}
                </span>

                <span>
                  <b>Destino:</b>{" "}
                  {selectedReceipt.ingresoInventario?.bodegaDestino?.nombre ??
                    "Sin ingreso confirmado"}
                </span>

                <span>
                  <b>Responsable:</b>{" "}
                  {selectedReceipt.elaboradoPor?.nombre ?? "Sin registro"}
                </span>
              </div>

              <div className="receipt-detail-table-wrap">
                <table className="receipt-detail-table">
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th>Lote</th>
                      <th>Vencimiento</th>
                      <th>Recibido</th>
                      <th>Ingresado</th>
                      <th>INVIMA</th>
                      <th>Resultado</th>

                      {canReview && <th>Acción</th>}
                    </tr>
                  </thead>

                  <tbody>
                    {selectedReceipt.detalles.map((item) => (
                      <tr key={item.id}>
                        <td>
                          {item.producto?.descripcion ??
                            "Producto sin descripción"}
                        </td>

                        <td>{item.numeroLote}</td>

                        <td>{formatDate(item.fechaVencimiento)}</td>

                        <td>{item.cantidadRecibida}</td>

                        <td>{item.detalleIngreso?.cantidadIngresada ?? 0}</td>

                        <td>{displayStatus(item.estadoVerificacionInvima)}</td>

                        <td>{displayStatus(item.resultadoVerificacion)}</td>

                        {canReview && (
                          <td>
                            {item.resultadoVerificacion === "PENDIENTE" ? (
                              <button
                                type="button"
                                className="receipt-action"
                                disabled={saving}
                                onClick={() => startReview(item)}
                              >
                                Revisar
                              </button>
                            ) : (
                              <span className="receipt-reviewed">Revisado</span>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {canReview && reviewingId !== null && (
                <form
                  className="receipt-review-form"
                  onSubmit={(event) => void submitReview(event)}
                >
                  <h4>Revisar producto pendiente</h4>

                  <div className="receipt-review-fields">
                    <label>
                      Resultado
                      <select
                        value={result}
                        onChange={(event) =>
                          setResult(event.target.value as ReviewResult)
                        }
                        disabled={saving}
                      >
                        <option value="CONFORME">
                          Conforme (aprobar ingreso)
                        </option>

                        <option value="NO_CONFORME">
                          No conforme (rechazar)
                        </option>
                      </select>
                    </label>

                    <label>
                      Verificación INVIMA
                      <select
                        value={invimaStatus}
                        onChange={(event) =>
                          setInvimaStatus(
                            event.target.value as InventoryInvimaStatus,
                          )
                        }
                        disabled={saving}
                      >
                        <option value="VIGENTE">Vigente</option>

                        <option value="PENDIENTE">Pendiente</option>

                        <option value="NO_VIGENTE">No vigente</option>

                        <option value="NO_APLICA">No aplica</option>
                      </select>
                    </label>

                    <label>
                      Temperatura registrada (°C)
                      <input
                        type="number"
                        step="any"
                        value={temperature}
                        onChange={(event) => setTemperature(event.target.value)}
                        disabled={saving}
                        placeholder="Opcional"
                      />
                    </label>

                    <label>
                      Humedad registrada (%)
                      <input
                        type="number"
                        step="any"
                        min="0"
                        max="100"
                        value={humidity}
                        onChange={(event) => setHumidity(event.target.value)}
                        disabled={saving}
                        placeholder="Opcional"
                      />
                    </label>
                  </div>

                  <label>
                    Observaciones de la revisión
                    <textarea
                      required
                      rows={3}
                      value={observations}
                      onChange={(event) => setObservations(event.target.value)}
                      disabled={saving}
                      placeholder="Describe la verificación realizada y el motivo de la decisión"
                    />
                  </label>

                  <div className="receipt-review-actions">
                    <button
                      type="button"
                      className="receipt-secondary-button"
                      onClick={() => setReviewingId(null)}
                      disabled={saving}
                    >
                      Cancelar
                    </button>

                    <button
                      type="submit"
                      className="receipt-primary-button"
                      disabled={saving}
                    >
                      {saving ? "Guardando..." : "Guardar revisión"}
                    </button>
                  </div>
                </form>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
