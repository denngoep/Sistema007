import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import { useFunctionalTestAccess } from "../components/functional-test-access";
import "../styles/InventoryTransfers.css";

import {
  getInventoryProducts,
  getInventoryWarehouses,
  type InventoryProduct,
  type InventoryWarehouseOption,
} from "../services/inventory.service";

type TransferMode = "NORMAL" | "NO_CONFORME";

type Line = {
  loteId: number;
  cantidad: string;
};

type Lot = {
  loteId: number;
  codigo: number;
  producto: string;
  vencimiento: string;
  lote: string;
  disponible: number;
};

type Props = {
  onSuccess?: () => void | Promise<void>;
};

type InventoryRole =
  | "ADMINISTRADOR"
  | "REGENTE_FARMACIA"
  | "QUIMICO_FARMACEUTICO"
  | "AUXILIAR_FARMACIA";

const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:3000").replace(/\/$/, "");

const NORMAL_TRANSFER_ROLES: InventoryRole[] = [
  "ADMINISTRADOR",
  "REGENTE_FARMACIA",
  "QUIMICO_FARMACEUTICO",
  "AUXILIAR_FARMACIA",
];

const NON_CONFORMING_TRANSFER_ROLES: InventoryRole[] = [
  "ADMINISTRADOR",
  "REGENTE_FARMACIA",
  "QUIMICO_FARMACEUTICO",
];

const dateOnly = (value: string) => value.slice(0, 10);

const localToday = () => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const part = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "";

  return `${part("year")}-${part("month")}-${part("day")}`;
};

const getCurrentRole = (): string => {
  try {
    const storedUser = localStorage.getItem("user");

    if (!storedUser) return "";

    const user: unknown = JSON.parse(storedUser);

    if (!user || typeof user !== "object" || !("rol" in user)) {
      return "";
    }

    if (typeof user.rol === "string") {
      return user.rol.trim().toUpperCase();
    }

    if (
      user.rol &&
      typeof user.rol === "object" &&
      ("codigo" in user.rol || "nombre" in user.rol)
    ) {
      const roleValue =
        "codigo" in user.rol
          ? user.rol.codigo
          : "nombre" in user.rol
            ? user.rol.nombre
            : "";

      return typeof roleValue === "string"
        ? roleValue.trim().toUpperCase()
        : "";
    }

    return "";
  } catch {
    return "";
  }
};

const isOrdinaryWarehouse = (warehouse: InventoryWarehouseOption) =>
  warehouse.tipo !== "NO_CONFORMES" && warehouse.permiteDispensacion;

const isCustodyWarehouse = (warehouse: InventoryWarehouseOption) =>
  warehouse.tipo === "NO_CONFORMES" && !warehouse.permiteDispensacion;

const getApiError = async (
  response: Response,
  fallback: string,
): Promise<string> => {
  const body: unknown = await response.json().catch(() => null);

  if (body && typeof body === "object" && "message" in body) {
    const raw = body.message;

    if (typeof raw === "string") {
      return raw;
    }

    if (Array.isArray(raw)) {
      return raw.map(String).join(". ");
    }
  }

  return fallback;
};

export default function InventoryTransfers({ onSuccess }: Props) {
  const [products, setProducts] = useState<InventoryProduct[]>([]);
  const [warehouses, setWarehouses] = useState<InventoryWarehouseOption[]>([]);

  const [transferMode, setTransferMode] = useState<TransferMode>("NORMAL");

  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [reason, setReason] = useState("");
  const [reference, setReference] = useState("");
  const [observations, setObservations] = useState("");
  const [search, setSearch] = useState("");

  const [showAdditionalSearch, setShowAdditionalSearch] = useState(false);
  const [additionalSearch, setAdditionalSearch] = useState("");

  const [lines, setLines] = useState<Line[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const role = getCurrentRole();
  const functionalTestAccess = useFunctionalTestAccess();

  const canTransferNormal = functionalTestAccess || NORMAL_TRANSFER_ROLES.some(
    (allowedRole) => allowedRole === role,
  );

  const canTransferNonConforming = functionalTestAccess || NON_CONFORMING_TRANSFER_ROLES.some(
    (allowedRole) => allowedRole === role,
  );

  const canAccessPage = canTransferNormal || canTransferNonConforming;

  const isNonConforming = transferMode === "NO_CONFORME";

  const canUseCurrentMode = isNonConforming
    ? canTransferNonConforming
    : canTransferNormal;

  const refresh = async () => {
    const [productData, warehouseData] = await Promise.all([
      getInventoryProducts(),
      getInventoryWarehouses(),
    ]);

    setProducts(productData.productos);
    setWarehouses(warehouseData);
  };

  // Carga inicial sin setState síncrono dentro del efecto.
  useEffect(() => {
    let active = true;

    if (!canAccessPage) {
      return () => {
        active = false;
      };
    }

    Promise.all([getInventoryProducts(), getInventoryWarehouses()])
      .then(([productData, warehouseData]) => {
        if (!active) return;

        setProducts(productData.productos);
        setWarehouses(warehouseData);
      })
      .catch((err: unknown) => {
        if (!active) return;

        setError(
          err instanceof Error
            ? err.message
            : "No fue posible cargar el inventario.",
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
  }, [canAccessPage]);

  const originWarehouse = useMemo(
    () => warehouses.find((warehouse) => warehouse.id === Number(origin)),
    [warehouses, origin],
  );

  const originWarehouses = useMemo(
    () => warehouses.filter(isOrdinaryWarehouse),
    [warehouses],
  );

  const destinationWarehouses = useMemo(() => {
    if (!originWarehouse || !isOrdinaryWarehouse(originWarehouse)) {
      return [];
    }

    return warehouses.filter((warehouse) => {
      if (
        warehouse.id === originWarehouse.id ||
        warehouse.sede.id !== originWarehouse.sede.id
      ) {
        return false;
      }

      return isNonConforming
        ? isCustodyWarehouse(warehouse)
        : isOrdinaryWarehouse(warehouse);
    });
  }, [warehouses, originWarehouse, isNonConforming]);

  const lots = useMemo<Lot[]>(() => {
    const originId = Number(origin);
    const today = localToday();

    if (
      !originId ||
      !originWarehouse ||
      !isOrdinaryWarehouse(originWarehouse)
    ) {
      return [];
    }

    return products.flatMap((product) => {
      if (product.estado !== "ACTIVO") {
        return [];
      }

      return product.lotes.flatMap((batch) => {
        if (
          batch.estado !== "DISPONIBLE" ||
          dateOnly(batch.fechaVencimiento) < today
        ) {
          return [];
        }

        const stock = batch.existencias.find(
          (item) =>
            item.bodegaId === originId &&
            item.cantidad > 0 &&
            item.bodega.activa &&
            item.bodega.tipo !== "NO_CONFORMES" &&
            item.bodega.permiteDispensacion,
        );

        if (!stock) {
          return [];
        }

        return [
          {
            loteId: batch.id,
            codigo: product.codigoInterno,
            producto: product.descripcion,
            vencimiento: dateOnly(batch.fechaVencimiento),
            lote: batch.numeroLote,
            disponible: stock.cantidad,
          },
        ];
      });
    });
  }, [products, origin, originWarehouse]);

  const matchesSearch = (lot: Lot, query: string) =>
    [String(lot.codigo), lot.producto, lot.lote, lot.vencimiento].some(
      (value) => value.toLowerCase().includes(query),
    );

  const visibleLots = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return lots;

    return lots.filter((lot) => matchesSearch(lot, query));
  }, [lots, search]);

  const additionalLots = useMemo(() => {
    const query = additionalSearch.trim().toLowerCase();

    if (!query) return [];

    return lots.filter((lot) => matchesSearch(lot, query));
  }, [lots, additionalSearch]);

  const selected = lines.map((line) => ({
    ...line,
    lot: lots.find((item) => item.loteId === line.loteId),
  }));

  const total = lines.reduce(
    (sum, line) => sum + (Number(line.cantidad) || 0),
    0,
  );

  const showInitialCatalog = Boolean(origin) && lines.length === 0;

  const resetProducts = () => {
    setLines([]);
    setSearch("");
    setShowAdditionalSearch(false);
    setAdditionalSearch("");
  };

  const changeMode = (mode: TransferMode) => {
    if (saving || mode === transferMode) {
      return;
    }

    if (mode === "NO_CONFORME" && !canTransferNonConforming) {
      setError("No tienes permisos para trasladar productos a No Conformes.");
      return;
    }

    if (mode === "NORMAL" && !canTransferNormal) {
      setError("No tienes permisos para registrar traslados.");
      return;
    }

    setTransferMode(mode);
    setDestination("");
    setReason("");
    setReference("");
    setObservations("");
    resetProducts();
    setError("");
    setSuccess("");
  };

  const add = (loteId: number) => {
    if (saving || !canUseCurrentMode) {
      return;
    }

    if (isNonConforming && lines.length > 0) {
      setError(
        "Para Productos No Conformes debes registrar un lote por operación.",
      );
      return;
    }

    setLines((previous) =>
      previous.some((line) => line.loteId === loteId)
        ? previous
        : [
            ...previous,
            {
              loteId,
              cantidad: "1",
            },
          ],
    );

    setShowAdditionalSearch(false);
    setAdditionalSearch("");
    setError("");
    setSuccess("");
  };

  const remove = (loteId: number) => {
    if (saving || !canUseCurrentMode) return;

    setLines((previous) => previous.filter((line) => line.loteId !== loteId));

    setError("");
    setSuccess("");
  };

  const updateQuantity = (loteId: number, cantidad: string) => {
    if (saving || !canUseCurrentMode) return;

    setLines((previous) =>
      previous.map((line) =>
        line.loteId === loteId ? { ...line, cantidad } : line,
      ),
    );

    setError("");
    setSuccess("");
  };

  const clear = () => {
    if (saving || !canUseCurrentMode) return;

    resetProducts();
    setReason("");
    setReference("");
    setObservations("");
    setError("");
    setSuccess("");
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (saving) {
      return;
    }

    setError("");
    setSuccess("");

    const currentRole = getCurrentRole();

    const allowedNormal = functionalTestAccess || NORMAL_TRANSFER_ROLES.some(
      (allowedRole) => allowedRole === currentRole,
    );

    const allowedNonConforming = functionalTestAccess || NON_CONFORMING_TRANSFER_ROLES.some(
      (allowedRole) => allowedRole === currentRole,
    );

    if (isNonConforming && !allowedNonConforming) {
      setError(
        "Tu rol no tiene autorización para trasladar productos a No Conformes.",
      );
      return;
    }

    if (!isNonConforming && !allowedNormal) {
      setError("Tu rol no tiene autorización para registrar traslados.");
      return;
    }

    const originId = Number(origin);
    const destinationId = Number(destination);

    if (!originId || !destinationId || originId === destinationId) {
      setError("Selecciona dos bodegas diferentes.");
      return;
    }

    const selectedOrigin = warehouses.find(
      (warehouse) => warehouse.id === originId,
    );

    const selectedDestination = warehouses.find(
      (warehouse) => warehouse.id === destinationId,
    );

    if (
      !selectedOrigin ||
      !selectedDestination ||
      !isOrdinaryWarehouse(selectedOrigin)
    ) {
      setError("Selecciona una bodega de origen válida.");
      return;
    }

    if (isNonConforming && !isCustodyWarehouse(selectedDestination)) {
      setError(
        "Debes seleccionar una bodega de Productos No Conformes que no permita dispensación.",
      );
      return;
    }

    if (!isNonConforming && !isOrdinaryWarehouse(selectedDestination)) {
      setError(
        "El traslado normal requiere una bodega de destino habilitada para dispensación.",
      );
      return;
    }

    if (selectedOrigin.sede.id !== selectedDestination.sede.id) {
      setError("Las bodegas deben pertenecer a la misma sede.");
      return;
    }

    if (!reason.trim()) {
      setError(
        isNonConforming
          ? "Debes indicar el motivo de la no conformidad."
          : "El motivo del traslado es obligatorio.",
      );
      return;
    }

    if (!lines.length) {
      setError("Agrega al menos un producto.");
      return;
    }

    if (isNonConforming && lines.length !== 1) {
      setError("Los traslados a Productos No Conformes se registran por lote.");
      return;
    }

    for (const line of selected) {
      const quantity = Number(line.cantidad);

      if (
        !line.lot ||
        !line.cantidad.trim() ||
        !Number.isInteger(quantity) ||
        quantity <= 0 ||
        quantity > line.lot.disponible
      ) {
        setError(
          `Cantidad inválida para el lote ${line.lot?.lote ?? line.loteId}.`,
        );
        return;
      }
    }

    const confirmed = window.confirm(
      `¿Confirmas ${
        isNonConforming ? "el traslado a Productos No Conformes" : "el traslado"
      }?\n\n` +
        `Origen: ${selectedOrigin.nombre}\n` +
        `Destino: ${selectedDestination.nombre}\n` +
        `Sede: ${selectedOrigin.sede.nombre}\n` +
        `Lotes: ${lines.length}\n` +
        `Total de unidades: ${total}\n\n` +
        `Motivo: ${reason.trim()}\n\n` +
        (isNonConforming
          ? "Las unidades serán separadas del inventario ordinario y quedarán bajo custodia."
          : ""),
    );

    if (!confirmed) {
      return;
    }

    setSaving(true);

    try {
      const token = localStorage.getItem("token");

      if (!token) {
        throw new Error("Debes iniciar sesión para registrar el traslado.");
      }

      const url = isNonConforming
        ? `${API_URL}/inventory/transfers/non-conforming`
        : `${API_URL}/inventory/transfers/batch`;

      const payload = isNonConforming
        ? {
            loteId: lines[0].loteId,
            bodegaOrigenId: originId,
            bodegaDestinoId: destinationId,
            cantidad: Number(lines[0].cantidad),
            motivo: reason.trim(),
            referencia: reference.trim() || undefined,
            observaciones: observations.trim() || undefined,
          }
        : {
            bodegaOrigenId: originId,
            bodegaDestinoId: destinationId,
            motivo: reason.trim(),
            productos: lines.map((line) => ({
              loteId: line.loteId,
              cantidad: Number(line.cantidad),
            })),
          };

      const response = await globalThis.fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const message = await getApiError(
          response,
          isNonConforming
            ? "No se pudo registrar el traslado a Productos No Conformes."
            : "No se pudo registrar el traslado agrupado.",
        );

        throw new Error(message);
      }

      // El backend confirmó la operación.
      // Se limpia el formulario para evitar duplicados.

      resetProducts();
      setReason("");
      setReference("");
      setObservations("");
      setOrigin("");
      setDestination("");

      setSuccess(
        isNonConforming
          ? "Producto trasladado a custodia de No Conformes correctamente."
          : "Traslado agrupado registrado correctamente.",
      );

      try {
        await refresh();

        if (onSuccess) {
          await onSuccess();
        }
      } catch {
        setError(
          "El traslado se registró, pero no se pudieron actualizar las existencias. Actualiza la página para consultar los saldos.",
        );
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo registrar el traslado.",
      );
    } finally {
      setSaving(false);
    }
  };

  // =====================================================
  // ESTILOS
  // =====================================================

  const th: CSSProperties = {
    textAlign: "left",
    padding: "12px 10px",
    borderBottom: "1px solid #dbe4ed",
    whiteSpace: "nowrap",
  };

  const td: CSSProperties = {
    padding: "10px",
    borderBottom: "1px solid #e8edf2",
  };

  const field: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: 7,
    fontWeight: 600,
  };

  const input: CSSProperties = {
    width: "100%",
    minHeight: 44,
    border: "1px solid #d4dfe9",
    borderRadius: 8,
    padding: "9px 12px",
    font: "inherit",
    background: "white",
  };

  const button: CSSProperties = {
    background: "#062b55",
    color: "white",
    border: 0,
    borderRadius: 8,
    padding: "11px 16px",
    cursor: "pointer",
  };

  const modeButton = (mode: TransferMode): CSSProperties => ({
    ...button,
    flex: "1 1 220px",
    minHeight: 48,
    background: transferMode === mode ? "#062b55" : "#f1f5f9",
    color: transferMode === mode ? "#ffffff" : "#062b55",
    border: transferMode === mode ? "2px solid #062b55" : "2px solid #dbe4ed",
    opacity: saving ? 0.6 : 1,
  });

  // =====================================================
  // TABLA DE LOTES
  // =====================================================

  const renderLotTable = (items: Lot[]) => (
    <div style={{ overflowX: "auto" }}>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
        }}
      >
        <thead>
          <tr>
            <th style={th}>Código</th>
            <th style={th}>Producto</th>
            <th style={th}>Vencimiento</th>
            <th style={th}>Lote</th>
            <th style={th}>Disponible</th>
            <th style={th}>Acción</th>
          </tr>
        </thead>

        <tbody>
          {items.map((lot) => {
            const alreadyAdded = lines.some(
              (line) => line.loteId === lot.loteId,
            );

            const blocked =
              isNonConforming && lines.length > 0 && !alreadyAdded;

            return (
              <tr key={lot.loteId}>
                <td style={td}>{lot.codigo}</td>
                <td style={td}>{lot.producto}</td>
                <td style={td}>{lot.vencimiento}</td>
                <td style={td}>{lot.lote}</td>

                <td style={td}>
                  <strong>{lot.disponible}</strong>
                </td>

                <td style={td}>
                  <button
                    type="button"
                    style={{
                      ...button,
                      background:
                        alreadyAdded || blocked ? "#e8eef4" : "#062b55",
                      color: alreadyAdded || blocked ? "#062b55" : "white",
                    }}
                    disabled={
                      alreadyAdded || blocked || saving || !canUseCurrentMode
                    }
                    onClick={() => add(lot.loteId)}
                  >
                    {alreadyAdded
                      ? "Agregado"
                      : blocked
                        ? "Un lote por gestión"
                        : "Agregar"}
                  </button>
                </td>
              </tr>
            );
          })}

          {!items.length && (
            <tr>
              <td
                colSpan={6}
                style={{
                  ...td,
                  textAlign: "center",
                  color: "#61758a",
                  padding: 24,
                }}
              >
                No se encontraron productos disponibles.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  // =====================================================
  // ACCESO NO AUTORIZADO
  // =====================================================

  if (!canAccessPage) {
    return (
      <section
        className="inventory-transfers"
        style={{
          background: "white",
          padding: 28,
          borderRadius: 14,
          border: "1px solid #e0e8f0",
        }}
      >
        <h2 style={{ marginTop: 0 }}>Traslado entre bodegas</h2>

        <p role="alert" style={{ color: "#a32323" }}>
          No tienes permisos para registrar traslados de inventario.
        </p>
      </section>
    );
  }

  // =====================================================
  // PANTALLA
  // =====================================================

  return (
    <section
      className="inventory-transfers"
      style={{
        background: "white",
        padding: 28,
        borderRadius: 14,
        border: "1px solid #e0e8f0",
      }}
    >
      <h2 style={{ marginTop: 0 }}>Traslado entre bodegas</h2>

      <p style={{ color: "#61758a" }}>
        Selecciona el tipo de traslado, la bodega de origen y los productos que
        deseas mover.
      </p>

      {error && (
        <p role="alert" style={{ color: "#a32323" }}>
          {error}
        </p>
      )}

      {success && (
        <p role="status" style={{ color: "#16734a" }}>
          {success}
        </p>
      )}

      {loading ? (
        <p>Cargando existencias...</p>
      ) : (
        <form onSubmit={(event) => void submit(event)}>
          {/* TIPO DE TRASLADO */}

          <div
            style={{
              margin: "24px 0",
              padding: 20,
              background: "#f8fafc",
              borderRadius: 12,
              border: "1px solid #dbe4ed",
            }}
          >
            <strong
              style={{
                display: "block",
                marginBottom: 12,
                color: "#062b55",
              }}
            >
              Tipo de traslado
            </strong>

            <div
              style={{
                display: "flex",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              {canTransferNormal && (
                <button
                  type="button"
                  disabled={saving}
                  style={modeButton("NORMAL")}
                  aria-pressed={transferMode === "NORMAL"}
                  onClick={() => changeMode("NORMAL")}
                >
                  Traslado normal
                </button>
              )}

              {canTransferNonConforming && (
                <button
                  type="button"
                  disabled={saving}
                  style={modeButton("NO_CONFORME")}
                  aria-pressed={transferMode === "NO_CONFORME"}
                  onClick={() => changeMode("NO_CONFORME")}
                >
                  Traslado a No Conformes
                </button>
              )}
            </div>

            <p
              style={{
                marginBottom: 0,
                marginTop: 12,
                fontSize: 13,
                color: "#61758a",
              }}
            >
              {isNonConforming
                ? "Separa unidades no conformes del inventario ordinario y regístralas en una bodega de custodia. Esta operación se realiza por lote."
                : "Traslada uno o varios lotes entre bodegas habilitadas de la misma sede."}
            </p>
          </div>

          {/* BODEGAS */}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(270px, 1fr))",
              gap: 20,
              margin: "24px 0",
            }}
          >
            <label style={field}>
              Bodega de origen
              <select
                style={input}
                value={origin}
                required
                disabled={saving}
                onChange={(event) => {
                  setOrigin(event.target.value);
                  setDestination("");
                  resetProducts();
                  setError("");
                  setSuccess("");
                }}
              >
                <option value="">Seleccionar bodega</option>

                {originWarehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.nombre} - {warehouse.sede.nombre}
                  </option>
                ))}
              </select>
            </label>

            <label style={field}>
              {isNonConforming ? "Bodega de custodia" : "Bodega de destino"}

              <select
                style={input}
                value={destination}
                required
                disabled={!origin || saving}
                onChange={(event) => {
                  setDestination(event.target.value);
                  setError("");
                  setSuccess("");
                }}
              >
                <option value="">Seleccionar bodega</option>

                {destinationWarehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.nombre} - {warehouse.sede.nombre}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {origin && destinationWarehouses.length === 0 && (
            <p
              style={{
                color: "#8b5a17",
                background: "#fff8e8",
                padding: 12,
                borderRadius: 8,
              }}
            >
              {isNonConforming
                ? "No hay una bodega de Productos No Conformes habilitada en esta sede."
                : "No hay otra bodega habilitada para traslados ordinarios en esta sede."}
            </p>
          )}

          {/* MOTIVO */}

          <label
            style={{
              ...field,
              marginBottom: 20,
            }}
          >
            {isNonConforming
              ? "Motivo de la no conformidad"
              : "Motivo del traslado"}

            <textarea
              style={{
                ...input,
                minHeight: 85,
                resize: "vertical",
              }}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder={
                isNonConforming
                  ? "Describe el daño, deterioro o condición que requiere separar el producto"
                  : "Describe el motivo del movimiento entre bodegas"
              }
              required
              disabled={saving}
            />
          </label>

          {/* DATOS ADICIONALES DE NO CONFORMIDAD */}

          {isNonConforming && canTransferNonConforming && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(270px, 1fr))",
                gap: 20,
                marginBottom: 28,
              }}
            >
              <label style={field}>
                Referencia o soporte (opcional)
                <input
                  style={input}
                  type="text"
                  value={reference}
                  onChange={(event) => setReference(event.target.value)}
                  placeholder="Acta, reporte o número de soporte"
                  disabled={saving}
                />
              </label>

              <label style={field}>
                Observaciones (opcional)
                <textarea
                  style={{
                    ...input,
                    minHeight: 85,
                    resize: "vertical",
                  }}
                  value={observations}
                  onChange={(event) => setObservations(event.target.value)}
                  placeholder="Información adicional del producto"
                  disabled={saving}
                />
              </label>
            </div>
          )}

          {/* CATÁLOGO INICIAL */}

          {showInitialCatalog && (
            <div
              style={{
                borderTop: "1px solid #e0e8f0",
                paddingTop: 20,
              }}
            >
              <h3 style={{ marginTop: 0 }}>Productos disponibles</h3>

              <p
                style={{
                  color: "#61758a",
                  fontSize: 14,
                }}
              >
                {lots.length} lote(s) disponibles en la bodega seleccionada.
              </p>

              <input
                style={{
                  ...input,
                  marginBottom: 14,
                }}
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por código, medicamento, lote o vencimiento"
                aria-label="Buscar productos"
                autoComplete="off"
                disabled={saving}
              />

              {renderLotTable(visibleLots)}
            </div>
          )}

          {/* MENSAJE INICIAL */}

          {!origin && (
            <div
              style={{
                padding: 24,
                border: "1px dashed #d4dfe9",
                borderRadius: 10,
                textAlign: "center",
                color: "#61758a",
              }}
            >
              Selecciona una bodega de origen para consultar los productos
              disponibles.
            </div>
          )}

          {/* PRODUCTOS SELECCIONADOS */}

          {lines.length > 0 && (
            <div
              style={{
                borderTop: "1px solid #e0e8f0",
                paddingTop: 20,
                marginTop: 8,
              }}
            >
              <h3 style={{ marginTop: 0 }}>
                {isNonConforming
                  ? "Producto para custodia"
                  : `Productos del traslado (${lines.length})`}
              </h3>

              <p
                style={{
                  color: "#61758a",
                  fontSize: 14,
                }}
              >
                {isNonConforming
                  ? "Indica únicamente la cantidad afectada. Las unidades restantes permanecerán en la bodega de origen."
                  : "Revisa las cantidades antes de confirmar el movimiento."}
              </p>

              <div style={{ overflowX: "auto" }}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                  }}
                >
                  <thead>
                    <tr>
                      <th style={th}>Código</th>
                      <th style={th}>Producto</th>
                      <th style={th}>Vencimiento</th>
                      <th style={th}>Lote</th>
                      <th style={th}>Disponible</th>

                      <th style={th}>
                        {isNonConforming
                          ? "Cantidad afectada"
                          : "Cantidad a trasladar"}
                      </th>

                      <th style={th}>Acción</th>
                    </tr>
                  </thead>

                  <tbody>
                    {selected.map(({ loteId, cantidad, lot }) => (
                      <tr key={loteId}>
                        <td style={td}>{lot?.codigo ?? "—"}</td>

                        <td style={td}>{lot?.producto ?? "—"}</td>

                        <td style={td}>{lot?.vencimiento ?? "—"}</td>

                        <td style={td}>{lot?.lote ?? "—"}</td>

                        <td style={td}>{lot?.disponible ?? "—"}</td>

                        <td style={td}>
                          <input
                            aria-label={`Cantidad del lote ${
                              lot?.lote ?? loteId
                            }`}
                            style={{
                              ...input,
                              minWidth: 105,
                            }}
                            type="number"
                            min={1}
                            max={lot?.disponible}
                            step={1}
                            value={cantidad}
                            onChange={(event) =>
                              updateQuantity(loteId, event.target.value)
                            }
                            required
                            disabled={saving}
                          />
                        </td>

                        <td style={td}>
                          <button
                            type="button"
                            onClick={() => remove(loteId)}
                            disabled={saving}
                            style={{
                              ...button,
                              background: "#f0f3f6",
                              color: "#8b2323",
                            }}
                          >
                            Quitar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* BUSCADOR ADICIONAL */}

              {!isNonConforming && (
                <div
                  style={{
                    marginTop: 20,
                    padding: 18,
                    border: "1px solid #dbe4ed",
                    borderRadius: 10,
                    background: "#f8fafc",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: 12,
                    }}
                  >
                    <div>
                      <strong
                        style={{
                          color: "#062b55",
                        }}
                      >
                        Agregar productos al traslado
                      </strong>

                      <p
                        style={{
                          margin: "5px 0 0",
                          color: "#61758a",
                          fontSize: 13,
                        }}
                      >
                        Agrega otro medicamento o lote sin perder los productos
                        seleccionados.
                      </p>
                    </div>

                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => {
                        setShowAdditionalSearch((previous) => !previous);
                        setAdditionalSearch("");
                      }}
                      style={{
                        ...button,
                        background: "#00aebc",
                      }}
                    >
                      {showAdditionalSearch
                        ? "Cerrar buscador"
                        : "+ Agregar otro producto"}
                    </button>
                  </div>

                  {showAdditionalSearch && (
                    <div
                      style={{
                        marginTop: 18,
                      }}
                    >
                      <input
                        type="search"
                        style={input}
                        value={additionalSearch}
                        onChange={(event) =>
                          setAdditionalSearch(event.target.value)
                        }
                        placeholder="Escribe el código, nombre o lote"
                        aria-label="Buscar otro producto para el traslado"
                        autoComplete="off"
                        disabled={saving}
                        autoFocus
                      />

                      {additionalSearch.trim() && (
                        <div
                          style={{
                            marginTop: 12,
                          }}
                        >
                          {renderLotTable(additionalLots)}
                        </div>
                      )}

                      {!additionalSearch.trim() && (
                        <p
                          style={{
                            color: "#61758a",
                            fontSize: 13,
                            marginBottom: 0,
                          }}
                        >
                          Escribe un código o nombre para consultar los lotes
                          disponibles.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* RESUMEN */}

              <div
                style={{
                  marginTop: 24,
                  padding: 16,
                  borderRadius: 10,
                  background: "#f3f7fb",
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 24,
                  color: "#062b55",
                }}
              >
                <span>
                  Lotes seleccionados: <strong>{lines.length}</strong>
                </span>

                <span>
                  {isNonConforming
                    ? "Unidades a custodia"
                    : "Total de unidades"}
                  : <strong>{total}</strong>
                </span>
              </div>

              {isNonConforming && (
                <p
                  style={{
                    marginTop: 14,
                    padding: 12,
                    borderRadius: 8,
                    background: "#fff8e8",
                    color: "#805719",
                    fontSize: 13,
                  }}
                >
                  El producto será trasladado a una bodega de custodia y no
                  estará disponible para dispensación. Su disposición posterior
                  deberá gestionarse desde Productos No Conformes.
                </p>
              )}
            </div>
          )}

          {/* ACCIONES */}

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              flexWrap: "wrap",
              gap: 12,
              marginTop: 24,
            }}
          >
            <button
              type="button"
              disabled={saving}
              onClick={clear}
              style={{
                ...button,
                background: "#eef2f6",
                color: "#062b55",
              }}
            >
              Limpiar
            </button>

            <button
              type="submit"
              disabled={
                saving || !lines.length || !destination || !canUseCurrentMode
              }
              style={{
                ...button,
                opacity:
                  saving || !lines.length || !destination || !canUseCurrentMode
                    ? 0.5
                    : 1,
              }}
            >
              {saving
                ? "Registrando..."
                : isNonConforming
                  ? "Confirmar traslado a custodia"
                  : `Confirmar traslado (${lines.length})`}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
