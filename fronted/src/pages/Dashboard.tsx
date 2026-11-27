import { useEffect, useMemo, useState } from "react";
import { FileText, Package, Pill, Stethoscope, Users, type LucideIcon } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import type { UserRole } from "../services/users.service";
import { subscribeUserPermissions } from "../services/users.service";
import { isAdminSupervisionEnabled } from "../components/admin-supervision";
import systemLogo from "../assets/logo-sistema007.png";
import "../styles/Dashboard.css";

type SessionUser = { nombre?: string; rol?: UserRole };
type DashboardCard = { label: string; description: string; path: string; show: boolean; icon: LucideIcon };

const pharmacy: UserRole[] = ["REGENTE_FARMACIA", "QUIMICO_FARMACEUTICO", "AUXILIAR_FARMACIA"];
const inventory: UserRole[] = ["ADMINISTRADOR", ...pharmacy];

export default function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const [permissions, setPermissions] = useState({ canManageUsers: false, functionalTestAccess: false });
  const user: SessionUser = (() => { try { return JSON.parse(localStorage.getItem("user") || "{}"); } catch { return {}; } })();
  const role = user.rol;
  const functionalTestAccess = permissions.functionalTestAccess;
  const supervision = !functionalTestAccess && isAdminSupervisionEnabled(user);
  useEffect(() => subscribeUserPermissions(
    (value) => setPermissions({ canManageUsers: value.canManageUsers, functionalTestAccess: value.functionalTestAccess === true }),
    () => setPermissions({ canManageUsers: false, functionalTestAccess: false }),
  ), []);
  const cards = useMemo<DashboardCard[]>(() => [
    { label: "Usuarios", description: "Administración de usuarios y coordinación por servicio.", path: "/users", icon: Users, show: permissions.canManageUsers },
    { label: "Pacientes", description: "Registro, consulta y seguimiento de pacientes.", path: "/patients", icon: Users, show: Boolean(role) },
    { label: "Historia clínica", description: role === "ADMINISTRADOR" ? "Consulta y supervisión de atenciones, diagnósticos y formulaciones." : supervision ? "Vista de supervisión sin datos clínicos reales." : "Atenciones, diagnósticos y formulaciones.", path: "/clinical-history", icon: Stethoscope, show: functionalTestAccess || supervision || role === "ADMINISTRADOR" || role === "MEDICO" || role === "ENFERMERO" },
    { label: "Inventario", description: "Recepciones, existencias y movimientos farmacéuticos.", path: "/inventory", icon: Package, show: functionalTestAccess || Boolean(role && inventory.includes(role)) },
    { label: "Dispensación", description: role === "ADMINISTRADOR" ? "Consulta y supervisión de entregas, soportes y trazabilidad." : supervision ? "Vista de supervisión sin entregas ni soportes reales." : "Entregas parciales, soportes y trazabilidad.", path: "/dispensations", icon: Pill, show: functionalTestAccess || supervision || role === "ADMINISTRADOR" || Boolean(role && pharmacy.includes(role)) },
    { label: "Reportes", description: "Consulta y exportación de información farmacéutica.", path: "/reports", icon: FileText, show: Boolean(role && inventory.includes(role)) },
  ], [permissions.canManageUsers, functionalTestAccess, role, supervision]);
  const message = (location.state as { userManagementMessage?: string } | null)?.userManagementMessage;

  return <main className="dashboard-page">
    {message && <p className="dashboard-alert" role="alert">{message}</p>}
    <section className="welcome-panel"><div className="welcome-content"><span className="welcome-label">PANEL DE CONTROL</span><h2>Bienvenido{user.nombre ? `, ${user.nombre}` : ""}</h2><p>Gestiona los procesos clínicos y farmacéuticos desde un entorno organizado y seguro.</p></div><img className="welcome-logo" src={systemLogo} alt="Sistema 007" /></section>
    <section className="dashboard-summary"><div className="summary-heading"><div><h3>Accesos rápidos</h3><p>Selecciona un módulo para comenzar a trabajar.</p></div></div><div className="summary-grid">{cards.filter((card) => card.show).map((card) => { const Icon = card.icon; return <button key={card.path} type="button" className="summary-card" onClick={() => navigate(card.path)}><span className="summary-card-icon"><Icon size={22} strokeWidth={1.9} /></span><span className="summary-card-content"><strong>{card.label}</strong><small>{card.description}</small></span><span className="summary-card-arrow" aria-hidden="true">→</span></button>; })}</div></section>
  </main>;
}
