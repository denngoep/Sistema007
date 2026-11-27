import { useEffect, useState, type FormEvent } from "react";
import {
  createManagedInventoryWarehouse,
  getInventorySites,
  getManagedInventoryWarehouses,
  updateManagedInventoryWarehouse,
  type CreateInventoryWarehouse,
  type InventorySiteOption,
  type InventoryWarehouseType,
  type ManagedInventoryWarehouse,
} from "../services/inventory.service";
import "../styles/Inventory.css";

const emptyForm = (): CreateInventoryWarehouse => ({
  sedeId: 0,
  codigo: "",
  nombre: "",
  tipo: "GENERAL",
  descripcion: "",
  permiteDispensacion: false,
});

const typeLabel: Record<InventoryWarehouseType, string> = {
  GENERAL: "General",
  SATELITE: "Satélite",
  NO_CONFORMES: "No conformes",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeZone: "America/Bogota",
  }).format(new Date(value));
}

/** Administrative configuration only. Operational selectors keep consuming
 * /inventory/warehouses and therefore never expose inactive warehouses. */
export default function InventoryWarehouses() {
  const [warehouses, setWarehouses] = useState<ManagedInventoryWarehouse[]>([]);
  const [sites, setSites] = useState<InventorySiteOption[]>([]);
  const [form, setForm] = useState<CreateInventoryWarehouse>(emptyForm);
  const [editing, setEditing] = useState<ManagedInventoryWarehouse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [warehouseData, siteData] = await Promise.all([
        getManagedInventoryWarehouses(),
        getInventorySites(),
      ]);
      setWarehouses(warehouseData);
      setSites(siteData);
      setForm((current) =>
        current.sedeId || !siteData[0]
          ? current
          : { ...current, sedeId: siteData[0].id },
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No fue posible cargar las bodegas.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Defer the first fetch so the effect only subscribes to the screen life
    // cycle; state updates happen from the asynchronous request callback.
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const setType = (tipo: InventoryWarehouseType) => {
    setForm((current) => ({
      ...current,
      tipo,
      permiteDispensacion: tipo === "NO_CONFORMES" ? false : current.permiteDispensacion,
    }));
  };

  const reset = () => {
    setEditing(null);
    setNotice("");
    setForm({ ...emptyForm(), sedeId: sites[0]?.id ?? 0 });
  };

  const beginEdit = (warehouse: ManagedInventoryWarehouse) => {
    setEditing(warehouse);
    setError("");
    setNotice("");
    setForm({
      sedeId: warehouse.sede.id,
      codigo: warehouse.codigo ?? "",
      nombre: warehouse.nombre,
      tipo: warehouse.tipo,
      descripcion: warehouse.descripcion ?? "",
      permiteDispensacion: warehouse.permiteDispensacion,
    });
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setNotice("");
    if (!form.nombre.trim()) {
      setError("El nombre de la bodega es obligatorio.");
      return;
    }
    if (!editing && !form.codigo.trim()) {
      setError("El código de la bodega es obligatorio.");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await updateManagedInventoryWarehouse(editing.id, {
          ...(form.codigo.trim() ? { codigo: form.codigo.trim() } : {}),
          nombre: form.nombre.trim(),
          tipo: form.tipo,
          descripcion: form.descripcion?.trim() || null,
          permiteDispensacion: form.permiteDispensacion,
        });
        setNotice("Bodega actualizada. Su historial operativo se conserva.");
      } else {
        await createManagedInventoryWarehouse({
          ...form,
          codigo: form.codigo.trim(),
          nombre: form.nombre.trim(),
          descripcion: form.descripcion?.trim() || undefined,
        });
        setNotice("Bodega registrada correctamente.");
      }
      await load();
      reset();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No fue posible guardar la bodega.");
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (warehouse: ManagedInventoryWarehouse) => {
    setError("");
    setNotice("");
    setSaving(true);
    try {
      await updateManagedInventoryWarehouse(warehouse.id, { activa: !warehouse.activa });
      setNotice(warehouse.activa ? "Bodega desactivada para movimientos nuevos." : "Bodega activada.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No fue posible actualizar el estado.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="inventory-content warehouse-admin">
      <div className="inventory-toolbar warehouse-admin__heading">
        <div>
          <span className="inventory-eyebrow">CONFIGURACIÓN</span>
          <h2>Bodegas</h2>
          <p>Administra las bodegas sin eliminar su trazabilidad histórica.</p>
        </div>
        <span className="warehouse-admin__count">{warehouses.length} registradas</span>
      </div>

      {error && <div className="inventory-message inventory-message--error">{error}</div>}
      {notice && <div className="inventory-message inventory-message--success">{notice}</div>}

      <form className="warehouse-form" onSubmit={submit}>
        <div className="warehouse-form__title">
          <h3>{editing ? "Editar bodega" : "Registrar bodega"}</h3>
          <p>{editing ? "La sede no se modifica para preservar la trazabilidad." : "Los campos marcados son obligatorios."}</p>
        </div>
        <label>
          Sede
          <select
            value={form.sedeId || ""}
            disabled={Boolean(editing) || saving}
            onChange={(event) => setForm((current) => ({ ...current, sedeId: Number(event.target.value) }))}
            required
          >
            <option value="">Seleccione una sede</option>
            {sites.map((site) => <option key={site.id} value={site.id}>{site.nombre} · {site.ciudad}</option>)}
          </select>
        </label>
        <label>
          Código
          <input
            value={form.codigo}
            onChange={(event) => setForm((current) => ({ ...current, codigo: event.target.value.toUpperCase() }))}
            placeholder="Ej.: BOD-PRINCIPAL"
            maxLength={32}
            required={!editing}
            disabled={saving}
          />
        </label>
        <label>
          Nombre
          <input value={form.nombre} onChange={(event) => setForm((current) => ({ ...current, nombre: event.target.value }))} required disabled={saving} />
        </label>
        <label>
          Tipo
          <select value={form.tipo} onChange={(event) => setType(event.target.value as InventoryWarehouseType)} disabled={saving}>
            {Object.entries(typeLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="warehouse-form__description">
          Descripción
          <textarea value={form.descripcion ?? ""} onChange={(event) => setForm((current) => ({ ...current, descripcion: event.target.value }))} rows={2} disabled={saving} />
        </label>
        <label className="warehouse-form__check">
          <input type="checkbox" checked={form.permiteDispensacion} disabled={form.tipo === "NO_CONFORMES" || saving} onChange={(event) => setForm((current) => ({ ...current, permiteDispensacion: event.target.checked }))} />
          Permite dispensación
        </label>
        <div className="warehouse-form__actions">
          {editing && <button type="button" className="inventory-secondary-button" onClick={reset} disabled={saving}>Cancelar</button>}
          <button type="submit" className="inventory-primary-button" disabled={saving || !sites.length}>{saving ? "Guardando..." : editing ? "Guardar cambios" : "Registrar bodega"}</button>
        </div>
      </form>

      <div className="inventory-table-wrapper warehouse-admin__table">
        <table className="inventory-table">
          <thead><tr><th>Código</th><th>Bodega</th><th>Sede</th><th>Tipo</th><th>Dispensación</th><th>Estado</th><th>Actualización</th><th>Acciones</th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={8}>Cargando bodegas...</td></tr> : warehouses.length === 0 ? <tr><td colSpan={8}>No hay bodegas registradas.</td></tr> : warehouses.map((warehouse) => (
              <tr key={warehouse.id}>
                <td>{warehouse.codigo ?? <span className="warehouse-admin__legacy">Sin código histórico</span>}</td>
                <td><strong>{warehouse.nombre}</strong>{warehouse.descripcion && <small>{warehouse.descripcion}</small>}</td>
                <td>{warehouse.sede.nombre}<small>{warehouse.sede.ciudad}</small></td>
                <td>{typeLabel[warehouse.tipo]}</td>
                <td>{warehouse.permiteDispensacion ? "Sí" : "No"}</td>
                <td><span className={`warehouse-status ${warehouse.activa ? "warehouse-status--active" : "warehouse-status--inactive"}`}>{warehouse.activa ? "Activa" : "Inactiva"}</span></td>
                <td>{formatDate(warehouse.updatedAt)}</td>
                <td className="warehouse-admin__actions">
                  <button type="button" className="inventory-secondary-button" onClick={() => beginEdit(warehouse)} disabled={saving}>Editar</button>
                  <button
                    type="button"
                    className={`warehouse-action-button ${warehouse.activa ? "warehouse-action-button--warning" : "warehouse-action-button--positive"}`}
                    onClick={() => void toggleStatus(warehouse)}
                    disabled={saving}
                  >
                    {warehouse.activa ? "Desactivar" : "Activar"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
