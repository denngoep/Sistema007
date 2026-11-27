import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";

import {
  getInventoryProducts,
  getInventoryWarehouses,
  manageExpiredInventory,
  type InventoryBatch,
  type InventoryProduct,
  type InventoryWarehouseOption,
  type InventoryWarehouseType,
} from "../services/inventory.service";

import "../styles/InventoryExpirations.css";
import { useFunctionalTestAccess } from "../components/functional-test-access";

type ExpirationFilter =
  | "TODOS"
  | "VENCIDO"
  | "0_30"
  | "31_60"
  | "61_90"
  | "MAS_90";

type InventoryRole =
  | "ADMINISTRADOR"
  | "REGENTE_FARMACIA"
  | "AUXILIAR_FARMACIA"
  | "QUIMICO_FARMACEUTICO";

interface ExpirationRow {
  lote: InventoryBatch;
  producto: InventoryProduct;
  bodegaId: number;
  bodega: string;
  tipoBodega: InventoryWarehouseType;
  sedeId: number;
  sede: string;
  cantidad: number;
  permiteDispensacion: boolean;
  bodegaActiva: boolean;
  diasParaVencer: number;
}

interface ManagementSelection {
  row: ExpirationRow;
  destinoId: string;
  motivo: string;
  referencia: string;
}

const MANAGEMENT_ROLES: InventoryRole[] = [
  "ADMINISTRADOR",
  "REGENTE_FARMACIA",
  "QUIMICO_FARMACEUTICO",
];

const getCurrentRole = (): string => {
  try {
    const storedUser = localStorage.getItem("user");

    if (!storedUser) return "";

    const user = JSON.parse(storedUser) as {
      rol?: string | { nombre?: string; codigo?: string };
    };

    if (typeof user.rol === "string") {
      return user.rol.trim().toUpperCase();
    }

    if (user.rol && typeof user.rol === "object") {
      return String(user.rol.codigo ?? user.rol.nombre ?? "")
        .trim()
        .toUpperCase();
    }

    return "";
  } catch {
    return "";
  }
};

const formatDate = (value: string) => {
  const parts = value.slice(0, 10).split("-");

  if (parts.length !== 3) return value;

  return `${parts[2]}/${parts[1]}/${parts[0]}`;
};

const getBogotaToday = () => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const part = (type: string) =>
    parts.find((item) => item.type === type)?.value ?? "";

  return `${part("year")}-${part("month")}-${part("day")}`;
};

const getDaysUntilExpiration = (dateValue: string, todayValue: string) => {
  const expirationParts = dateValue.slice(0, 10).split("-").map(Number);

  const todayParts = todayValue.split("-").map(Number);

  if (
    expirationParts.length !== 3 ||
    todayParts.length !== 3 ||
    [...expirationParts, ...todayParts].some((part) => !Number.isFinite(part))
  ) {
    return Number.NaN;
  }

  const [year, month, day] = expirationParts;
  const [todayYear, todayMonth, todayDay] = todayParts;

  const expirationUTC = Date.UTC(year, month - 1, day);
  const todayUTC = Date.UTC(todayYear, todayMonth - 1, todayDay);

  return Math.round((expirationUTC - todayUTC) / 86_400_000);
};

const getExpirationStatus = (days: number) => {
  if (!Number.isFinite(days)) {
    return {
      label: "Fecha no válida",
      className: "notice",
    };
  }

  if (days < 0) {
    return {
      label: "Vencido",
      className: "expired",
    };
  }

  if (days <= 30) {
    return {
      label: days === 0 ? "Vence hoy" : "0 a 30 días",
      className: "critical",
    };
  }

  if (days <= 60) {
    return {
      label: "31 a 60 días",
      className: "warning",
    };
  }

  if (days <= 90) {
    return {
      label: "61 a 90 días",
      className: "notice",
    };
  }

  return {
    label: "Más de 90 días",
    className: "notice",
  };
};

const isNonConformingWarehouse = (warehouse: InventoryWarehouseOption) =>
  warehouse.tipo === "NO_CONFORMES" && !warehouse.permiteDispensacion;

function InventoryExpirations({
  onSuccess,
}: {
  onSuccess?: () => void | Promise<void>;
}) {
  const currentRole = getCurrentRole();
  const functionalTestAccess = useFunctionalTestAccess();

  const canManageExpirations = functionalTestAccess || MANAGEMENT_ROLES.some(
    (role) => role === currentRole,
  );

  const [productos, setProductos] = useState<InventoryProduct[]>([]);

  const [bodegas, setBodegas] = useState<InventoryWarehouseOption[]>([]);

  const [fechaConsulta, setFechaConsulta] = useState(getBogotaToday);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [search, setSearch] = useState("");

  const [statusFilter, setStatusFilter] = useState<ExpirationFilter>("TODOS");

  const [warehouseFilter, setWarehouseFilter] = useState("");

  const [management, setManagement] = useState<ManagementSelection | null>(
    null,
  );

  const [saving, setSaving] = useState(false);
  const [managementError, setManagementError] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [productData, warehouseData] = await Promise.all([
        getInventoryProducts(),
        getInventoryWarehouses(),
      ]);

      setProductos(productData.productos);
      setBodegas(warehouseData);
      setFechaConsulta(getBogotaToday());

      return true;
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No fue posible consultar los vencimientos.",
      );

      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    Promise.all([getInventoryProducts(), getInventoryWarehouses()])
      .then(([productData, warehouseData]) => {
        if (!active) return;

        setProductos(productData.productos);
        setBodegas(warehouseData);
        setFechaConsulta(getBogotaToday());
      })
      .catch((err: unknown) => {
        if (!active) return;

        setError(
          err instanceof Error
            ? err.message
            : "No fue posible consultar los vencimientos.",
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

  const rows = useMemo<ExpirationRow[]>(() => {
    return productos.flatMap((producto) =>
      producto.lotes.flatMap((lote) => {
        const diasParaVencer = getDaysUntilExpiration(
          lote.fechaVencimiento,
          fechaConsulta,
        );

        return lote.existencias
          .filter((existencia) => existencia.cantidad > 0)
          .map((existencia) => ({
            lote,
            producto,
            bodegaId: existencia.bodegaId,
            bodega: existencia.bodega.nombre,
            tipoBodega: existencia.bodega.tipo,
            sedeId: existencia.bodega.sede.id,
            sede: existencia.bodega.sede.nombre,
            cantidad: existencia.cantidad,
            permiteDispensacion: existencia.bodega.permiteDispensacion,
            bodegaActiva: existencia.bodega.activa,
            diasParaVencer,
          }));
      }),
    );
  }, [productos, fechaConsulta]);

  const summary = useMemo(() => {
    const vencidos = rows.filter((row) => row.diasParaVencer < 0);

    return {
      vencidos: vencidos.length,

      proximos30: rows.filter(
        (row) => row.diasParaVencer >= 0 && row.diasParaVencer <= 30,
      ).length,

      proximos60: rows.filter(
        (row) => row.diasParaVencer >= 31 && row.diasParaVencer <= 60,
      ).length,

      proximos90: rows.filter(
        (row) => row.diasParaVencer >= 61 && row.diasParaVencer <= 90,
      ).length,

      unidadesVencidas: vencidos.reduce(
        (total, row) => total + row.cantidad,
        0,
      ),
    };
  }, [rows]);

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();

    return rows
      .filter((row) => {
        if (!term) return true;

        return [
          row.producto.descripcion,
          row.producto.codigoInterno,
          row.producto.registroInvima,
          row.lote.numeroLote,
          row.bodega,
          row.sede,
        ].some((value) =>
          String(value ?? "")
            .toLowerCase()
            .includes(term),
        );
      })
      .filter(
        (row) => !warehouseFilter || row.bodegaId === Number(warehouseFilter),
      )
      .filter((row) => {
        const days = row.diasParaVencer;

        switch (statusFilter) {
          case "VENCIDO":
            return days < 0;

          case "0_30":
            return days >= 0 && days <= 30;

          case "31_60":
            return days >= 31 && days <= 60;

          case "61_90":
            return days >= 61 && days <= 90;

          case "MAS_90":
            return days > 90;

          default:
            return true;
        }
      })
      .sort(
        (a, b) =>
          a.diasParaVencer - b.diasParaVencer ||
          a.bodega.localeCompare(b.bodega),
      );
  }, [rows, search, statusFilter, warehouseFilter]);

  const availableDestinations = useMemo(() => {
    if (!management || !canManageExpirations) {
      return [];
    }

    return bodegas.filter(
      (bodega) =>
        isNonConformingWarehouse(bodega) &&
        bodega.id !== management.row.bodegaId &&
        bodega.sede.id === management.row.sedeId,
    );
  }, [bodegas, management, canManageExpirations]);

  const canManageRow = (row: ExpirationRow) =>
    canManageExpirations &&
    Number.isFinite(row.diasParaVencer) &&
    row.diasParaVencer < 0 &&
    row.cantidad > 0 &&
    row.bodegaActiva &&
    row.tipoBodega !== "NO_CONFORMES" &&
    row.permiteDispensacion;

  const openManagement = (row: ExpirationRow) => {
    if (!canManageRow(row)) {
      return;
    }

    setManagement({
      row,
      destinoId: "",
      motivo: "Traslado por vencimiento del lote",
      referencia: "",
    });

    setManagementError("");
    setSuccess("");
  };

  const submitManagement = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!canManageExpirations || !management || saving) {
      return;
    }

    const { row, destinoId, motivo, referencia } = management;

    setManagementError("");

    if (!canManageRow(row)) {
      setManagementError(
        "El lote seleccionado no cumple las condiciones para gestionar su vencimiento.",
      );
      return;
    }

    const destination = availableDestinations.find(
      (bodega) => bodega.id === Number(destinoId),
    );

    if (!destination) {
      setManagementError(
        "Selecciona una bodega de productos no conformes perteneciente a la misma sede.",
      );
      return;
    }

    if (
      destination.tipo !== "NO_CONFORMES" ||
      destination.permiteDispensacion ||
      destination.sede.id !== row.sedeId ||
      destination.id === row.bodegaId
    ) {
      setManagementError(
        "La bodega de destino no es válida para gestionar productos vencidos.",
      );
      return;
    }

    if (!motivo.trim()) {
      setManagementError("El motivo es obligatorio.");
      return;
    }

    const confirmed = window.confirm(
      `¿Confirmas el traslado del lote vencido?\n\n` +
        `Producto: ${row.producto.descripcion}\n` +
        `Lote: ${row.lote.numeroLote}\n` +
        `Cantidad: ${row.cantidad} unidades\n` +
        `Sede: ${row.sede}\n` +
        `Origen: ${row.bodega}\n` +
        `Destino: ${destination.nombre}\n\n` +
        "Se trasladará la totalidad de las existencias de este lote " +
        "en la bodega de origen. Esta operación modifica el inventario.",
    );

    if (!confirmed) return;

    setSaving(true);

    try {
      const result = await manageExpiredInventory({
        loteId: row.lote.id,
        bodegaOrigenId: row.bodegaId,
        bodegaDestinoId: destination.id,
        motivo: motivo.trim(),
        referencia: referencia.trim() || undefined,
      });

      setManagement(null);

      setSuccess(
        `Gestión registrada. Lote ${result.numeroLote}: ` +
          `${result.cantidadTrasladada} unidades trasladadas.`,
      );

      const refreshed = await loadData();

      if (!refreshed) {
        setError(
          "La gestión se registró, pero no se pudieron actualizar las existencias. Actualiza la página para consultar los saldos.",
        );
      }

      if (onSuccess) {
        try {
          await onSuccess();
        } catch {
          // El traslado ya fue registrado.
        }
      }
    } catch (err) {
      setManagementError(
        err instanceof Error
          ? err.message
          : "No fue posible gestionar el lote vencido.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="inventory-content expiration-page">
      <div className="expiration-heading">
        <div>
          <h2>Control de vencimientos</h2>

          <p>
            Consulta todos los lotes con existencias y realiza seguimiento
            prioritario a los próximos 90 días.
          </p>
        </div>

        <button
          type="button"
          className="expiration-refresh"
          onClick={() => {
            setSuccess("");
            void loadData();
          }}
          disabled={loading || saving}
        >
          {loading ? "Actualizando..." : "Actualizar"}
        </button>
      </div>

      <div className="expiration-summary">
        <article className="expiration-summary-card">
          <span>Lotes vencidos por bodega</span>

          <strong>{loading ? "—" : summary.vencidos}</strong>

          <small>{summary.unidadesVencidas} unidades vencidas</small>
        </article>

        <article className="expiration-summary-card">
          <span>Próximos 30 días</span>

          <strong>{loading ? "—" : summary.proximos30}</strong>

          <small>Incluye los que vencen hoy</small>
        </article>

        <article className="expiration-summary-card">
          <span>De 31 a 60 días</span>

          <strong>{loading ? "—" : summary.proximos60}</strong>

          <small>Seguimiento preventivo</small>
        </article>

        <article className="expiration-summary-card">
          <span>De 61 a 90 días</span>

          <strong>{loading ? "—" : summary.proximos90}</strong>

          <small>Control anticipado</small>
        </article>
      </div>

      {success && (
        <div className="expiration-success" role="status">
          {success}
        </div>
      )}

      {error && (
        <div className="expiration-error" role="alert">
          {error}
        </div>
      )}

      <div className="expiration-filters">
        <div className="expiration-filter-field">
          <label htmlFor="expiration-search">Buscar producto o lote</label>

          <input
            id="expiration-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Código, producto, lote o INVIMA"
          />
        </div>

        <div className="expiration-filter-field">
          <label htmlFor="expiration-status">Estado</label>

          <select
            id="expiration-status"
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as ExpirationFilter)
            }
          >
            <option value="TODOS">Todos los estados</option>

            <option value="VENCIDO">Vencidos</option>

            <option value="0_30">0 a 30 días</option>

            <option value="31_60">31 a 60 días</option>

            <option value="61_90">61 a 90 días</option>

            <option value="MAS_90">Más de 90 días</option>
          </select>
        </div>

        <div className="expiration-filter-field">
          <label htmlFor="expiration-warehouse">Bodega</label>

          <select
            id="expiration-warehouse"
            value={warehouseFilter}
            onChange={(event) => setWarehouseFilter(event.target.value)}
          >
            <option value="">Todas las bodegas</option>

            {bodegas.map((bodega) => (
              <option key={bodega.id} value={bodega.id}>
                {bodega.nombre} - {bodega.sede.nombre}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="expiration-results-heading">
        <h3>Detalle de vencimientos</h3>

        <span>
          {loading ? "Consultando..." : `${filteredRows.length} registros`}
        </span>
      </div>

      {loading && (
        <div className="inventory-message">Consultando vencimientos...</div>
      )}

      {!loading && !error && filteredRows.length === 0 && (
        <div className="inventory-empty">
          <h3>No se encontraron lotes</h3>

          <p>
            No hay lotes con existencias positivas que coincidan con los filtros
            seleccionados.
          </p>
        </div>
      )}

      {!loading && !error && filteredRows.length > 0 && (
        <div className="expiration-table-wrapper">
          <table className="inventory-table expiration-table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Producto</th>
                <th>Lote</th>
                <th>Vencimiento</th>
                <th>Días</th>
                <th>Estado</th>
                <th>Sede / Bodega</th>
                <th>Existencia</th>
                <th>Gestión</th>
              </tr>
            </thead>

            <tbody>
              {filteredRows.map((row) => {
                const status = getExpirationStatus(row.diasParaVencer);

                const isExpired = row.diasParaVencer < 0;

                const canManage = canManageRow(row);

                return (
                  <tr key={`${row.lote.id}-${row.bodegaId}`}>
                    <td>{row.producto.codigoInterno}</td>

                    <td>
                      <strong className="inventory-product-name">
                        {row.producto.descripcion}
                      </strong>

                      <small>
                        {row.producto.laboratorio || "Sin laboratorio"}
                      </small>
                    </td>

                    <td>{row.lote.numeroLote}</td>

                    <td>{formatDate(row.lote.fechaVencimiento)}</td>

                    <td>
                      {!Number.isFinite(row.diasParaVencer)
                        ? "—"
                        : isExpired
                          ? `${Math.abs(row.diasParaVencer)} días vencido`
                          : row.diasParaVencer === 0
                            ? "Hoy"
                            : `${row.diasParaVencer} días`}
                    </td>

                    <td>
                      <span
                        className={`expiration-status expiration-status-${status.className}`}
                      >
                        {status.label}
                      </span>
                    </td>

                    <td>
                      <strong>{row.bodega}</strong>

                      <small>{row.sede}</small>
                    </td>

                    <td>
                      <strong>{row.cantidad}</strong>
                    </td>

                    <td>
                      {canManage ? (
                        <button
                          type="button"
                          className="expiration-manage-button"
                          onClick={() => openManagement(row)}
                        >
                          Gestionar
                        </button>
                      ) : isExpired ? (
                        <span className="expiration-muted">
                          {row.tipoBodega === "NO_CONFORMES"
                            ? "En productos no conformes"
                            : canManageExpirations
                              ? "Gestión no disponible"
                              : "Solo consulta"}
                        </span>
                      ) : (
                        <span className="expiration-muted">Seguimiento</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="expiration-footnote">
        Se muestran todos los lotes con existencias positivas, incluidos los que
        vencen después de 90 días. Los indicadores destacan los vencidos y los
        próximos a vencer. Los registros se presentan por bodega y no equivalen
        necesariamente a lotes únicos. El traslado a una bodega de productos no
        conformes no representa la disposición final del producto.
      </p>

      {canManageExpirations && management && (
        <div className="expiration-modal-overlay">
          <div
            className="expiration-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="expiration-modal-title"
          >
            <div className="expiration-modal-header">
              <div>
                <span className="inventory-eyebrow">CONTROL DE INVENTARIO</span>

                <h2 id="expiration-modal-title">Gestionar lote vencido</h2>
              </div>

              <button
                type="button"
                className="expiration-modal-close"
                onClick={() => {
                  if (!saving) {
                    setManagement(null);
                  }
                }}
                disabled={saving}
                aria-label="Cerrar"
              >
                ×
              </button>
            </div>

            <div className="expiration-selected-lot">
              <strong>{management.row.producto.descripcion}</strong>

              <p>Lote: {management.row.lote.numeroLote}</p>

              <p>
                Fecha de vencimiento:{" "}
                {formatDate(management.row.lote.fechaVencimiento)}
              </p>

              <p>Sede: {management.row.sede}</p>

              <p>Bodega de origen: {management.row.bodega}</p>

              <p>
                Cantidad a trasladar:{" "}
                <strong>{management.row.cantidad} unidades</strong>
              </p>
            </div>

            <form onSubmit={submitManagement}>
              <div className="expiration-modal-fields">
                <div className="expiration-filter-field">
                  <label htmlFor="expiration-destination">
                    Bodega de productos no conformes
                  </label>

                  <select
                    id="expiration-destination"
                    value={management.destinoId}
                    onChange={(event) =>
                      setManagement({
                        ...management,
                        destinoId: event.target.value,
                      })
                    }
                    required
                    disabled={saving}
                  >
                    <option value="">Seleccionar bodega</option>

                    {availableDestinations.map((bodega) => (
                      <option key={bodega.id} value={bodega.id}>
                        {bodega.nombre} - {bodega.sede.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="expiration-filter-field">
                  <label htmlFor="expiration-reason">Motivo</label>

                  <textarea
                    id="expiration-reason"
                    value={management.motivo}
                    onChange={(event) =>
                      setManagement({
                        ...management,
                        motivo: event.target.value,
                      })
                    }
                    rows={3}
                    required
                    disabled={saving}
                  />
                </div>

                <div className="expiration-filter-field">
                  <label htmlFor="expiration-reference">
                    Referencia o acta (opcional)
                  </label>

                  <input
                    id="expiration-reference"
                    value={management.referencia}
                    onChange={(event) =>
                      setManagement({
                        ...management,
                        referencia: event.target.value,
                      })
                    }
                    placeholder="Número de acta o referencia"
                    disabled={saving}
                  />
                </div>
              </div>

              {availableDestinations.length === 0 && (
                <div className="expiration-error" role="alert">
                  No existe una bodega de productos no conformes disponible en
                  la misma sede para realizar este traslado.
                </div>
              )}

              <div className="expiration-warning">
                Se trasladará la totalidad de las existencias de este lote desde
                la bodega de origen hacia la bodega de productos no conformes.
                No se realizará una baja ni destrucción automática.
              </div>

              {managementError && (
                <div className="expiration-error" role="alert">
                  {managementError}
                </div>
              )}

              <div className="expiration-modal-actions">
                <button
                  type="button"
                  className="expiration-cancel-button"
                  onClick={() => setManagement(null)}
                  disabled={saving}
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="expiration-submit-button"
                  disabled={saving || availableDestinations.length === 0}
                >
                  {saving ? "Registrando traslado..." : "Confirmar gestión"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}

export default InventoryExpirations;
