import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  downloadDispensationReport,
  getDispensationReport,
  getDispensationReportSites,
} from "../services/dispensations.service";
import type { DispensationReportFilters, DispensationReportRow } from "../services/dispensations.service";
import { downloadInventoryReport, getInventoryReport, getReportWarehouses } from "../services/reports.service";
import type { InventoryReportFilters, WarehouseOption } from "../services/reports.service";
import type { UserRole } from "../services/users.service";
import "../styles/Reports.css";

type ReportTab = "dispensations" | "movements" | "stock";
type SessionUser = { rol?: UserRole };
const PHARMACY_ROLES: UserRole[] = ["REGENTE_FARMACIA", "QUIMICO_FARMACEUTICO", "AUXILIAR_FARMACIA"];
const movementLabels: Record<string, string> = { INGRESO: "Ingreso", TRASLADO: "Traslado", AJUSTE_ENTRADA: "Ajuste de entrada", AJUSTE_SALIDA: "Ajuste de salida", DISPENSACION: "Dispensación", DEVOLUCION_PROVEEDOR: "Devolución a proveedor" };
const supportLabels: Record<string, string> = { PENDIENTE: "Soporte pendiente", REGISTRADO: "Soporte registrado", LEGADO_POR_VERIFICAR: "Registro histórico por verificar" };

function date(value: unknown, withTime = true) {
  if (!value || typeof value !== "string") return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", day: "2-digit", month: "short", year: "numeric", ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}) }).format(parsed);
}
function nested(value: unknown, keys: string[]) {
  let current: unknown = value;
  for (const key of keys) current = typeof current === "object" && current !== null ? (current as Record<string, unknown>)[key] : undefined;
  return current;
}
function text(value: unknown) { return value === null || value === undefined || value === "" ? "—" : String(value); }

export default function Reports() {
  const [user] = useState<SessionUser>(() => { try { return JSON.parse(localStorage.getItem("user") || "{}"); } catch { return {}; } });
  const canDispensation = Boolean(user.rol && PHARMACY_ROLES.includes(user.rol));
  const [tab, setTab] = useState<ReportTab>(canDispensation ? "dispensations" : "movements");
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
  const [dispSites, setDispSites] = useState<Array<{ id: number; codigo: string; nombre: string }>>([]);
  const [dispFilters, setDispFilters] = useState<DispensationReportFilters>({ estado: "CONFIRMADA" });
  const [inventoryFilters, setInventoryFilters] = useState<InventoryReportFilters>({ soloConExistencia: "true" });
  const [dispRows, setDispRows] = useState<DispensationReportRow[]>([]);
  const [inventoryRows, setInventoryRows] = useState<Record<string, unknown>[]>([]);
  const [totals, setTotals] = useState({ deliveries: 0, units: 0 });
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [queried, setQueried] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getReportWarehouses().then(setWarehouses).catch(() => setWarehouses([]));
    if (canDispensation) getDispensationReportSites().then(setDispSites).catch(() => setDispSites([]));
  }, [canDispensation]);

  const sites = useMemo(() => Array.from(new Map(warehouses.map((warehouse) => [warehouse.sede.id, warehouse.sede])).values()), [warehouses]);
  const warehousesForSite = inventoryFilters.sedeId ? warehouses.filter((warehouse) => warehouse.sede.id === Number(inventoryFilters.sedeId)) : warehouses;
  const inventoryKind = tab === "stock" ? "stock" : "movements";
  const inventoryType = tab === "movements";

  async function consult() {
    setLoading(true); setError("");
    try {
      if (tab === "dispensations") {
        const result = await getDispensationReport(dispFilters);
        setDispRows(result.rows); setTotals({ deliveries: result.totalEntregas, units: result.totalUnidades });
      } else {
        const result = await getInventoryReport(inventoryKind, inventoryFilters);
        setInventoryRows(inventoryKind === "movements" ? result.movimientos ?? [] : result.existencias ?? []);
      }
      setQueried(true);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No fue posible consultar el reporte."); } finally { setLoading(false); }
  }
  async function download() {
    setDownloading(true); setError("");
    try { if (tab === "dispensations") await downloadDispensationReport(dispFilters, "excel"); else await downloadInventoryReport(inventoryKind, inventoryFilters); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "No fue posible descargar el Excel."); } finally { setDownloading(false); }
  }
  function updateInventory(key: keyof InventoryReportFilters, value: string) { setInventoryFilters((current) => ({ ...current, [key]: value, ...(key === "sedeId" ? { bodegaId: "" } : {}) })); }

  return <main className="reports-page"><header className="reports-header"><div><span>SISTEMA 007 / REPORTES</span><h1>Reportes farmacéuticos</h1><p>Consulta trazabilidad y existencias. Todas las consultas son de solo lectura.</p></div><Link to="/dashboard" className="reports-back">Volver al panel</Link></header><section className="reports-content">
    <div className="reports-tabs" role="tablist">
      {canDispensation && <button role="tab" aria-selected={tab === "dispensations"} className={tab === "dispensations" ? "active" : ""} onClick={() => { setTab("dispensations"); setQueried(false); }}>Dispensación</button>}
      <button role="tab" aria-selected={tab === "movements"} className={tab === "movements" ? "active" : ""} onClick={() => { setTab("movements"); setQueried(false); }}>Movimientos de inventario</button>
      <button role="tab" aria-selected={tab === "stock"} className={tab === "stock" ? "active" : ""} onClick={() => { setTab("stock"); setQueried(false); }}>Existencias</button>
    </div>
    <section className="reports-card"><div className="reports-card__heading"><div><h2>{tab === "dispensations" ? "Dispensaciones realizadas" : tab === "movements" ? "Movimientos registrados" : "Existencias actuales"}</h2><p>{tab === "dispensations" ? "Medicamentos entregados, soporte de recibido y trazabilidad." : tab === "movements" ? "Ingresos, salidas, traslados, ajustes y dispensaciones registrados." : "Cantidades por lote, sede y bodega."}</p></div></div>
      {tab === "dispensations" ? <div className="reports-filters"><label>Desde<input type="date" value={dispFilters.desde ?? ""} onChange={(e) => setDispFilters((v) => ({ ...v, desde: e.target.value }))} /></label><label>Hasta<input type="date" value={dispFilters.hasta ?? ""} onChange={(e) => setDispFilters((v) => ({ ...v, hasta: e.target.value }))} /></label><label>Sede<select value={dispFilters.sedeId ?? ""} onChange={(e) => setDispFilters((v) => ({ ...v, sedeId: e.target.value }))}><option value="">Todas las sedes</option>{dispSites.map((site) => <option key={site.id} value={site.id}>{site.nombre}</option>)}</select></label><label>Medicamento<input value={dispFilters.medicamento ?? ""} onChange={(e) => setDispFilters((v) => ({ ...v, medicamento: e.target.value }))} placeholder="Nombre o concentración" /></label><label>Estado<select value={dispFilters.estado ?? ""} onChange={(e) => setDispFilters((v) => ({ ...v, estado: e.target.value }))}><option value="CONFIRMADA">Confirmadas</option><option value="PENDIENTE">Pendientes</option><option value="ANULADA">Anuladas</option></select></label><label>Soporte<select value={dispFilters.soporte ?? ""} onChange={(e) => setDispFilters((v) => ({ ...v, soporte: e.target.value }))}><option value="">Todos</option><option value="PENDIENTE">Pendientes de soporte</option></select></label></div> : <div className="reports-filters"><label>Sede<select value={inventoryFilters.sedeId ?? ""} onChange={(e) => updateInventory("sedeId", e.target.value)}><option value="">Todas las sedes</option>{sites.map((site) => <option key={site.id} value={site.id}>{site.nombre}</option>)}</select></label><label>Bodega<select value={inventoryFilters.bodegaId ?? ""} onChange={(e) => updateInventory("bodegaId", e.target.value)}><option value="">Todas las bodegas</option>{warehousesForSite.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.nombre}</option>)}</select></label><label>Medicamento, código o lote<input value={inventoryFilters.busqueda ?? ""} onChange={(e) => updateInventory("busqueda", e.target.value)} placeholder="Buscar" /></label>{inventoryType && <><label>Desde<input type="date" value={inventoryFilters.fechaInicio ?? ""} onChange={(e) => updateInventory("fechaInicio", e.target.value)} /></label><label>Hasta<input type="date" value={inventoryFilters.fechaFin ?? ""} onChange={(e) => updateInventory("fechaFin", e.target.value)} /></label><label>Tipo<select value={inventoryFilters.tipo ?? ""} onChange={(e) => updateInventory("tipo", e.target.value)}><option value="">Todos los movimientos</option>{Object.entries(movementLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></>}{tab === "stock" && <label>Existencia<select value={inventoryFilters.soloConExistencia ?? "true"} onChange={(e) => updateInventory("soloConExistencia", e.target.value)}><option value="true">Solo con existencia</option><option value="false">Incluir agotadas</option></select></label>}</div>}
      <div className="reports-actions"><button type="button" className="reports-primary" onClick={() => void consult()} disabled={loading}>{loading ? "Consultando…" : "Consultar"}</button><button type="button" className="reports-secondary" onClick={() => void download()} disabled={downloading}>{downloading ? "Preparando Excel…" : "Descargar Excel"}</button></div>
      {error && <p className="reports-error" role="alert">{error}</p>}
      {tab === "dispensations" && queried && <><div className="reports-summary"><div><span>Entregas</span><strong>{totals.deliveries}</strong></div><div><span>Unidades dispensadas</span><strong>{totals.units}</strong></div><div><span>Filas de trazabilidad</span><strong>{dispRows.length}</strong></div></div>{dispRows.length ? <div className="reports-table-wrap"><table><thead><tr><th>Fecha</th><th>Paciente / ingreso</th><th>Medicamento y lote</th><th>Cantidad</th><th>Sede / responsable</th><th>Estados</th></tr></thead><tbody>{dispRows.map((row, index) => <tr key={`${row.dispensacion}-${row.lote}-${index}`}><td>{date(row.fecha)}</td><td><strong>{row.paciente}</strong><small>{row.documento} · Ingreso {row.ingreso}</small></td><td><strong>{row.medicamento}</strong><small>{row.concentracion} · Lote {row.lote} · Vence {date(row.vencimiento, false)}</small></td><td>{row.cantidad}</td><td>{row.sede}<small>{row.bodega} · {row.responsable}</small></td><td><span className="reports-tag">{movementLabels[row.estadoEntrega] ?? row.estadoEntrega}</span><span className="reports-tag reports-tag--support">{supportLabels[row.estadoSoporte] ?? row.estadoSoporte}</span></td></tr>)}</tbody></table></div> : <Empty />}</>}
      {tab !== "dispensations" && queried && (inventoryRows.length ? <div className="reports-table-wrap"><table><thead><tr>{tab === "movements" ? <><th>Fecha</th><th>Tipo</th><th>Medicamento / lote</th><th>Cantidad</th><th>Origen / destino</th><th>Responsable</th></> : <><th>Medicamento</th><th>Código</th><th>Lote</th><th>Vencimiento</th><th>Sede / bodega</th><th>Existencia</th></>}</tr></thead><tbody>{inventoryRows.map((row, index) => { const lote = nested(row, ["lote"]) as Record<string, unknown> | undefined; const product = nested(row, ["lote", "productoInventario"]) as Record<string, unknown> | undefined; const medicine = nested(row, ["lote", "productoInventario", "medicamento"]) as Record<string, unknown> | undefined; const warehouse = nested(row, ["bodega"]) as Record<string, unknown> | undefined; const origin = nested(row, ["bodegaOrigen"]) as Record<string, unknown> | undefined; const destination = nested(row, ["bodegaDestino"]) as Record<string, unknown> | undefined; return <tr key={`${text(row.id)}-${index}`}>{tab === "movements" ? <><td>{date(row.fechaMovimiento)}</td><td>{movementLabels[text(row.tipo)] ?? text(row.tipo)}</td><td><strong>{text(medicine?.nombre ?? product?.descripcion)}</strong><small>Cód. {text(product?.codigoInterno)} · Lote {text(lote?.numeroLote)}</small></td><td>{text(row.cantidad)}</td><td><small>{text(nested(origin, ["sede", "nombre"]))} / {text(origin?.nombre)} → {text(nested(destination, ["sede", "nombre"]))} / {text(destination?.nombre)}</small></td><td>{text(nested(row, ["usuario", "nombre"]))}</td></> : <><td><strong>{text(medicine?.nombre ?? product?.descripcion)}</strong><small>{text(medicine?.concentracion)}</small></td><td>{text(product?.codigoInterno)}</td><td>{text(lote?.numeroLote)}</td><td>{date(lote?.fechaVencimiento, false)}</td><td>{text(nested(warehouse, ["sede", "nombre"]))}<small>{text(warehouse?.nombre)}</small></td><td>{text(row.cantidad)}</td></>}</tr>; })}</tbody></table></div> : <Empty />)}
    </section></section></main>;
}
function Empty() { return <div className="reports-empty"><strong>No se encontraron resultados</strong><span>Ajusta los filtros o prueba con otro período.</span></div>; }
