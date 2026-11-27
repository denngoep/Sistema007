import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";

import {
  adjustInventoryBatch,
  adjustInventoryBatchDocumented,
  getInventoryProducts,
  getInventoryWarehouses,
  type AdjustInventoryBatchResponse,
  type InventoryProduct,
  type InventoryWarehouseOption,
} from "../services/inventory.service";

import "../styles/InventoryAdjustments.css";

type Props = {
  onSuccess?: () => void | Promise<void>;
};

type Lot = {
  loteId: number;
  codigo: number;
  producto: string;
  numeroLote: string;
  vencimiento: string;
  existencia: number;
};

type AdjustmentLine = {
  loteId: number;
  cantidadFisica: string;
};

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

const isValidQuantity = (value: string) =>
  value.trim() !== "" &&
  Number.isSafeInteger(Number(value)) &&
  Number(value) >= 0;

const inventoryDocumentsEnabled =
  import.meta.env.VITE_INVENTORY_DOCUMENTS_ENABLED === "true";

export default function InventoryAdjustments({ onSuccess }: Props) {
  const [products, setProducts] = useState<InventoryProduct[]>([]);
  const [warehouses, setWarehouses] = useState<InventoryWarehouseOption[]>([]);

  const [warehouseId, setWarehouseId] = useState("");
  const [search, setSearch] = useState("");
  const [showResults, setShowResults] = useState(false);

  const [reason, setReason] = useState("");
  const [reference, setReference] = useState("");
  const [support, setSupport] = useState<File | null>(null);

  const [lines, setLines] = useState<AdjustmentLine[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [result, setResult] = useState<AdjustInventoryBatchResponse | null>(
    null,
  );

  const loadData = async () => {
    const [productData, warehouseData] = await Promise.all([
      getInventoryProducts(),
      getInventoryWarehouses(),
    ]);

    setProducts(productData.productos);
    setWarehouses(warehouseData);
  };

  useEffect(() => {
    let active = true;

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
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const lots = useMemo<Lot[]>(() => {
    const selectedWarehouse = Number(warehouseId);
    const today = localToday();

    if (!selectedWarehouse) return [];

    return products.flatMap((product) => {
      if (product.estado !== "ACTIVO") return [];

      return product.lotes.flatMap((batch) => {
        if (
          batch.estado !== "DISPONIBLE" ||
          dateOnly(batch.fechaVencimiento) < today
        ) {
          return [];
        }

        const stock = batch.existencias.find(
          (item) =>
            item.bodegaId === selectedWarehouse &&
            item.bodega.activa &&
            item.bodega.permiteDispensacion,
        );

        if (!stock) return [];

        return [
          {
            loteId: batch.id,
            codigo: product.codigoInterno,
            producto: product.descripcion,
            numeroLote: batch.numeroLote,
            vencimiento: dateOnly(batch.fechaVencimiento),
            existencia: stock.cantidad,
          },
        ];
      });
    });
  }, [products, warehouseId]);

  const selected = useMemo(
    () =>
      lines.map((line) => ({
        ...line,
        lot: lots.find((item) => item.loteId === line.loteId),
      })),
    [lines, lots],
  );

  const selectedIds = useMemo(
    () => new Set(lines.map((line) => line.loteId)),
    [lines],
  );

  const availableLots = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return [];

    return lots.filter((lot) => {
      if (selectedIds.has(lot.loteId)) return false;

      return [
        String(lot.codigo),
        lot.producto,
        lot.numeroLote,
        lot.vencimiento,
      ].some((value) => value.toLowerCase().includes(query));
    });
  }, [lots, search, selectedIds]);

  const validQuantities =
    selected.length > 0 &&
    selected.every(
      ({ cantidadFisica, lot }) =>
        Boolean(lot) && isValidQuantity(cantidadFisica),
    );

  const differences = selected.map(({ cantidadFisica, lot }) =>
    lot && isValidQuantity(cantidadFisica)
      ? Number(cantidadFisica) - lot.existencia
      : null,
  );

  const totalIncreases = differences.reduce<number>(
    (sum, difference) =>
      sum + (difference !== null && difference > 0 ? difference : 0),
    0,
  );

  const totalDecreases = differences.reduce<number>(
    (sum, difference) =>
      sum + (difference !== null && difference < 0 ? Math.abs(difference) : 0),
    0,
  );

  const changedLots = differences.filter(
    (difference) => difference !== null && difference !== 0,
  ).length;

  const add = (loteId: number) => {
    if (saving || !lots.some((lot) => lot.loteId === loteId)) return;

    setLines((previous) =>
      previous.some((line) => line.loteId === loteId)
        ? previous
        : [...previous, { loteId, cantidadFisica: "" }],
    );

    setSearch("");
    setShowResults(false);
    setError("");
    setSuccess("");
    setResult(null);
  };

  const remove = (loteId: number) => {
    setLines((previous) => previous.filter((line) => line.loteId !== loteId));

    setError("");
  };

  const updateQuantity = (loteId: number, cantidadFisica: string) => {
    setLines((previous) =>
      previous.map((line) =>
        line.loteId === loteId ? { ...line, cantidadFisica } : line,
      ),
    );

    setError("");
  };

  const clear = () => {
    setLines([]);
    setReason("");
    setReference("");
    setSearch("");
    setShowResults(false);
    setError("");
    setSuccess("");
    setResult(null);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (saving) return;

    setError("");
    setSuccess("");
    setResult(null);

    const selectedWarehouse = Number(warehouseId);

    if (
      !selectedWarehouse ||
      !warehouses.some(
        (warehouse) =>
          warehouse.id === selectedWarehouse && warehouse.permiteDispensacion,
      )
    ) {
      setError("Selecciona una bodega habilitada.");
      return;
    }

    if (!lines.length) {
      setError("Agrega al menos un lote al conteo físico.");
      return;
    }

    if (!validQuantities) {
      setError(
        "Todas las cantidades físicas deben ser números enteros iguales o mayores que cero.",
      );
      return;
    }

    if (!reason.trim()) {
      setError("La justificación escrita del ajuste es obligatoria.");
      return;
    }

    if (inventoryDocumentsEnabled && !support) {
      setError("Adjunta el soporte documental obligatorio del ajuste.");
      return;
    }

    const warehouse = warehouses.find((item) => item.id === selectedWarehouse);

    const confirmed = window.confirm(
      `¿Confirmas el ajuste de inventario?\n\n` +
        `Bodega: ${warehouse?.nombre ?? ""}\n` +
        `Lotes revisados: ${lines.length}\n` +
        `Lotes con diferencias: ${changedLots}\n` +
        `Unidades de entrada: ${totalIncreases}\n` +
        `Unidades de salida: ${totalDecreases}\n\n` +
        `Motivo: ${reason.trim()}\n` +
        `Referencia: ${reference.trim() || "Sin referencia"}\n\n` +
        "Esta operación modificará las existencias y quedará registrada.",
    );

    if (!confirmed) return;

    setSaving(true);

    try {
      const adjustment = {
        bodegaId: selectedWarehouse,
        motivo: reason.trim(),
        referencia: reference.trim() || undefined,
        productos: lines.map((line) => ({
          loteId: line.loteId,
          cantidadFisica: Number(line.cantidadFisica),
        })),
      };
      const response =
        inventoryDocumentsEnabled && support
          ? await adjustInventoryBatchDocumented(adjustment, support)
          : await adjustInventoryBatch(adjustment);

      // El backend ya registró la operación.
      // No se repite si falla la actualización posterior.

      setLines([]);
      setReason("");
      setReference("");
      setSupport(null);
      setSearch("");
      setShowResults(false);

      setResult(response);
      setSuccess(response.mensaje || "Conteo físico procesado correctamente.");

      try {
        await loadData();
        await onSuccess?.();
      } catch {
        setError(
          "El ajuste fue registrado, pero no se pudieron actualizar las existencias. Actualiza la página.",
        );
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No fue posible registrar el ajuste.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="adjustments-container">
      <div className="adjustments-heading">
        <h2>Ajustes por conteo físico</h2>
        <p>
          Selecciona la bodega y agrega los productos que vas a revisar. Puedes
          incluir varios medicamentos y lotes en un mismo conteo.
        </p>
      </div>

      {error && (
        <div className="adjustments-alert adjustments-alert-error" role="alert">
          {error}
        </div>
      )}

      {inventoryDocumentsEnabled && (
        <p className="adjustments-alert adjustments-alert-success">
          Los ajustes requieren una justificación escrita y un soporte PDF o
          imagen de máximo 10 MB.
        </p>
      )}

      {success && (
        <div
          className="adjustments-alert adjustments-alert-success"
          role="status"
        >
          <strong>{success}</strong>

          {result && (
            <p>
              Movimientos generados:{" "}
              <strong>{result.movimientos?.length ?? 0}</strong>
            </p>
          )}
        </div>
      )}

      {loading ? (
        <p className="adjustments-muted">Cargando existencias...</p>
      ) : (
        <form onSubmit={(event) => void submit(event)}>
          <div className="adjustments-form-grid">
            <label className="adjustments-field">
              Bodega
              <select
                className="adjustments-input"
                value={warehouseId}
                required
                disabled={saving}
                onChange={(event) => {
                  setWarehouseId(event.target.value);
                  clear();
                }}
              >
                <option value="">Seleccionar bodega</option>

                {warehouses
                  .filter((warehouse) => warehouse.permiteDispensacion)
                  .map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>
                      {warehouse.nombre} - {warehouse.sede.nombre}
                    </option>
                  ))}
              </select>
            </label>

            <label className="adjustments-field">
              Referencia del conteo (opcional)
              <input
                className="adjustments-input"
                value={reference}
                onChange={(event) => setReference(event.target.value)}
                placeholder="Ej. CONTEO-002"
                disabled={saving}
              />
            </label>
          </div>

          {!warehouseId && (
            <div className="adjustments-placeholder">
              Selecciona una bodega para comenzar el conteo físico.
            </div>
          )}

          {warehouseId && (
            <>
              <div className="adjustments-section">
                <h3>Buscar y agregar productos</h3>

                <p className="adjustments-muted">
                  Busca por nombre, código o lote. Selecciona los productos que
                  necesitas revisar.
                </p>

                <div className="adjustments-search-area">
                  <input
                    type="search"
                    className="adjustments-input adjustments-search"
                    value={search}
                    onChange={(event) => {
                      setSearch(event.target.value);
                      setShowResults(true);
                    }}
                    onFocus={() => setShowResults(true)}
                    placeholder="Escribe el nombre, código o lote del producto"
                    aria-label="Buscar productos para conteo físico"
                    disabled={saving}
                    autoComplete="off"
                  />

                  {search.trim() && (
                    <button
                      type="button"
                      className="adjustments-button adjustments-button-secondary"
                      onClick={() => {
                        setSearch("");
                        setShowResults(false);
                      }}
                      disabled={saving}
                    >
                      Limpiar búsqueda
                    </button>
                  )}
                </div>

                {showResults && search.trim() && (
                  <div className="adjustments-search-results">
                    {availableLots.length > 0 ? (
                      <>
                        <p className="adjustments-muted">
                          {availableLots.length} lote(s) encontrados. Selecciona
                          el que deseas agregar.
                        </p>

                        <div className="adjustments-table-wrapper">
                          <table className="adjustments-table">
                            <thead>
                              <tr>
                                <th>Código</th>
                                <th>Producto</th>
                                <th>Lote</th>
                                <th>Vencimiento</th>
                                <th>Existencia</th>
                                <th>Acción</th>
                              </tr>
                            </thead>

                            <tbody>
                              {availableLots.map((lot) => (
                                <tr key={lot.loteId}>
                                  <td>{lot.codigo}</td>
                                  <td>{lot.producto}</td>
                                  <td>{lot.numeroLote}</td>
                                  <td>{lot.vencimiento}</td>
                                  <td>
                                    <strong>{lot.existencia}</strong>
                                  </td>
                                  <td>
                                    <button
                                      type="button"
                                      className="adjustments-button"
                                      onClick={() => add(lot.loteId)}
                                      disabled={saving}
                                    >
                                      Agregar
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </>
                    ) : (
                      <div className="adjustments-placeholder">
                        No se encontraron lotes disponibles pendientes de
                        agregar para esta búsqueda.
                      </div>
                    )}
                  </div>
                )}

                {!search.trim() && (
                  <p className="adjustments-muted">
                    {lots.length} lote(s) disponibles en la bodega. Escribe en
                    el buscador para seleccionar uno.
                  </p>
                )}
              </div>

              <div className="adjustments-section">
                <h3>
                  Conteo físico ({lines.length}{" "}
                  {lines.length === 1 ? "lote" : "lotes"})
                </h3>

                <p className="adjustments-muted">
                  Registra la cantidad realmente encontrada para cada lote.
                  Puedes ingresar cero cuando no haya unidades físicas.
                </p>

                {lines.length === 0 ? (
                  <div className="adjustments-placeholder">
                    Todavía no has agregado productos al conteo. Utiliza el
                    buscador para comenzar.
                  </div>
                ) : (
                  <>
                    <div className="adjustments-table-wrapper">
                      <table className="adjustments-table">
                        <thead>
                          <tr>
                            <th>Código</th>
                            <th>Producto</th>
                            <th>Lote</th>
                            <th>Vencimiento</th>
                            <th>Sistema</th>
                            <th>Conteo físico</th>
                            <th>Diferencia</th>
                            <th>Acción</th>
                          </tr>
                        </thead>

                        <tbody>
                          {selected.map(({ loteId, cantidadFisica, lot }) => {
                            const valid = isValidQuantity(cantidadFisica);

                            const difference =
                              valid && lot
                                ? Number(cantidadFisica) - lot.existencia
                                : null;

                            return (
                              <tr key={loteId}>
                                <td>{lot?.codigo ?? "—"}</td>

                                <td>{lot?.producto ?? "—"}</td>

                                <td>{lot?.numeroLote ?? "—"}</td>

                                <td>{lot?.vencimiento ?? "—"}</td>

                                <td>
                                  <strong>{lot?.existencia ?? "—"}</strong>
                                </td>

                                <td>
                                  <input
                                    type="number"
                                    min={0}
                                    step={1}
                                    required
                                    className="adjustments-input adjustments-quantity"
                                    value={cantidadFisica}
                                    onChange={(event) =>
                                      updateQuantity(loteId, event.target.value)
                                    }
                                    aria-label={`Cantidad física del lote ${
                                      lot?.numeroLote ?? loteId
                                    }`}
                                    placeholder="Cantidad"
                                    disabled={saving}
                                  />
                                </td>

                                <td>
                                  {difference === null ? (
                                    "—"
                                  ) : difference > 0 ? (
                                    <strong className="adjustments-positive">
                                      +{difference} Entrada
                                    </strong>
                                  ) : difference < 0 ? (
                                    <strong className="adjustments-negative">
                                      {difference} Salida
                                    </strong>
                                  ) : (
                                    <span className="adjustments-muted">
                                      Sin diferencia
                                    </span>
                                  )}
                                </td>

                                <td>
                                  <button
                                    type="button"
                                    className="adjustments-button adjustments-button-remove"
                                    disabled={saving}
                                    onClick={() => remove(loteId)}
                                  >
                                    Quitar
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="adjustments-summary">
                      <span>
                        Lotes revisados: <strong>{lines.length}</strong>
                      </span>

                      <span>
                        Con diferencias: <strong>{changedLots}</strong>
                      </span>

                      <span>
                        Entradas: <strong>{totalIncreases}</strong>
                      </span>

                      <span>
                        Salidas: <strong>{totalDecreases}</strong>
                      </span>
                    </div>

                    <label className="adjustments-field adjustments-reason">
                      Motivo y justificación del ajuste
                      <textarea
                        className="adjustments-input adjustments-textarea"
                        value={reason}
                        onChange={(event) => setReason(event.target.value)}
                        placeholder="Describe la causa de las diferencias encontradas."
                        required
                        disabled={saving}
                      />
                    </label>

                    {inventoryDocumentsEnabled && (
                      <label className="adjustments-field adjustments-reason">
                        Soporte documental obligatorio
                        <input
                          className="adjustments-input"
                          type="file"
                          accept="application/pdf,image/png,image/jpeg"
                          onChange={(event) =>
                            setSupport(event.target.files?.[0] ?? null)
                          }
                          disabled={saving}
                          required
                        />
                      </label>
                    )}
                  </>
                )}
              </div>
            </>
          )}

          <div className="adjustments-actions">
            <button
              type="button"
              className="adjustments-button adjustments-button-secondary"
              disabled={saving}
              onClick={clear}
            >
              Limpiar
            </button>

            <button
              type="submit"
              className="adjustments-button"
              disabled={
                saving || !lines.length || !validQuantities || !reason.trim()
              }
            >
              {saving
                ? "Registrando ajustes..."
                : `Confirmar ajustes (${lines.length})`}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
