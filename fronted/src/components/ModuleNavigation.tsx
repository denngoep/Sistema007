import { useEffect, useState, type ReactNode } from "react";
import { ChevronDown, FileText, Home, LogOut, Menu, Package, Pill, Stethoscope, Users, type LucideIcon } from "lucide-react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import type { UserRole } from "../services/users.service";
import { subscribeUserPermissions } from "../services/users.service";
import { isAdminSupervisionEnabled } from "./admin-supervision";
import ThemeToggle from "./ThemeToggle";
import "../styles/ModuleNavigation.css";

type SessionUser = { nombre?: string; rol?: UserRole };
type NavigationItem = { label: string; to: string; show: boolean };
type NavigationGroup = { id: string; label: string; icon: LucideIcon; items: NavigationItem[]; show: boolean };

const pharmacy: UserRole[] = ["REGENTE_FARMACIA", "QUIMICO_FARMACEUTICO", "AUXILIAR_FARMACIA"];
const inventory: UserRole[] = ["ADMINISTRADOR", ...pharmacy];
const clinical: UserRole[] = ["ADMINISTRADOR", "MEDICO", "ENFERMERO"];
const inventoryManagement: UserRole[] = ["REGENTE_FARMACIA", "QUIMICO_FARMACEUTICO"];

function titleForPath(pathname: string) {
  if (pathname === "/users/new") return ["Nuevo usuario", "Administración de usuarios"];
  if (/^\/users\/\d+\/edit$/.test(pathname)) return ["Editar usuario", "Administración de usuarios"];
  if (pathname === "/patients/new") return ["Nuevo paciente", "Registro de pacientes"];
  if (/^\/patients\/\d+\/edit$/.test(pathname)) return ["Editar paciente", "Registro de pacientes"];
  if (pathname.startsWith("/users")) return ["Usuarios", "Administración de usuarios"];
  if (pathname.startsWith("/patients")) return ["Pacientes", "Consulta y registro de pacientes"];
  if (pathname.startsWith("/clinical-history")) return ["Historia clínica", "Atenciones, diagnósticos y formulaciones"];
  if (pathname.startsWith("/inventory")) return ["Inventario", "Control de existencias y movimientos"];
  if (pathname.startsWith("/dispensations")) return ["Dispensación", "Entregas y trazabilidad farmacéutica"];
  if (pathname.startsWith("/reports")) return ["Reportes", "Consultas y exportaciones"];
  return ["Panel principal", "Inicio / Vista general"];
}

function itemIsActive(item: NavigationItem, location: ReturnType<typeof useLocation>) {
  const [path, query] = item.to.split("?");
  if (location.pathname !== path) return !query && location.pathname.startsWith(`${path}/`);
  if (!query) return !location.search || location.search === "?section=home";
  return location.search === `?${query}`;
}

export default function ModuleNavigation({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("s007-nav-collapsed") === "true");
  const [permissions, setPermissions] = useState({ canManageUsers: false, functionalTestAccess: false });
  const user: SessionUser = (() => { try { return JSON.parse(localStorage.getItem("user") || "{}"); } catch { return {}; } })();
  const role = user.rol;
  const functionalTestAccess = permissions.functionalTestAccess;
  const isAdministrator = role === "ADMINISTRADOR";
  const supervision = !functionalTestAccess && isAdminSupervisionEnabled(user);

  useEffect(() => subscribeUserPermissions(
    (value) => setPermissions({ canManageUsers: value.canManageUsers, functionalTestAccess: value.functionalTestAccess === true }),
    () => setPermissions({ canManageUsers: false, functionalTestAccess: false }),
  ), []);

  const groups: NavigationGroup[] = [
    { id: "users", label: "Usuarios", icon: Users, show: permissions.canManageUsers, items: [{ label: "Administración", to: "/users", show: true }] },
    { id: "patients", label: "Pacientes", icon: Users, show: Boolean(role), items: [{ label: "Consulta de pacientes", to: "/patients", show: true }, { label: "Registrar paciente", to: "/patients/new", show: functionalTestAccess || isAdministrator || role === "RECEPCION_ADMISIONES" }] },
    { id: "clinical", label: "Atención clínica", icon: Stethoscope, show: functionalTestAccess || supervision || Boolean(role && clinical.includes(role)), items: [{ label: "Historias clínicas", to: "/clinical-history", show: true }] },
    { id: "inventory", label: "Inventario", icon: Package, show: functionalTestAccess || Boolean(role && inventory.includes(role)), items: [
      { label: "Resumen", to: "/inventory", show: true },
      { label: "Recepción de productos", to: "/inventory?section=entry", show: functionalTestAccess || supervision || isAdministrator || Boolean(role && inventoryManagement.includes(role)) },
      { label: "Seguimiento de recepciones", to: "/inventory?section=receipts", show: true },
      { label: "Traslados", to: "/inventory?section=transfer", show: functionalTestAccess || supervision || isAdministrator || Boolean(role && pharmacy.includes(role)) },
      { label: "Ajustes", to: "/inventory?section=adjustment", show: functionalTestAccess || supervision || isAdministrator || Boolean(role && inventoryManagement.includes(role)) },
      { label: "Vencimientos", to: "/inventory?section=expiration", show: true },
      { label: "Productos y existencias", to: "/inventory?section=products", show: true },
      { label: "Configuración · Bodegas", to: "/inventory?section=warehouses", show: functionalTestAccess || isAdministrator || Boolean(role && inventoryManagement.includes(role)) },
      { label: "Movimientos", to: "/inventory/movements", show: true },
    ] },
    { id: "dispensations", label: "Dispensación", icon: Pill, show: functionalTestAccess || supervision || isAdministrator || Boolean(role && pharmacy.includes(role)), items: [{ label: "Entregas y soportes", to: "/dispensations", show: true }] },
    { id: "reports", label: "Reportes", icon: FileText, show: Boolean(role && inventory.includes(role)), items: [{ label: "Reportes farmacéuticos", to: "/reports", show: true }] },
  ];
  const activeGroup = groups.find((group) => group.items.some((item) => itemIsActive(item, location)))?.id ?? null;
  const routeKey = `${location.pathname}${location.search}`;
  // A manual expansion/collapse belongs only to the current route. Once the
  // route changes, the matching group opens again without an effect resetting
  // a user's explicit collapse on the current screen.
  const [opened, setOpened] = useState<{ route: string; group: string | null }>({ route: routeKey, group: activeGroup });
  const [title, subtitle] = titleForPath(location.pathname);
  const isOpen = (id: string) =>
    !collapsed && (opened.route === routeKey ? opened.group === id : activeGroup === id);
  const toggleCollapsed = () => setCollapsed((value) => { const next = !value; localStorage.setItem("s007-nav-collapsed", String(next)); return next; });
  const toggleGroup = (groupId: string) => {
    if (collapsed) {
      localStorage.setItem("s007-nav-collapsed", "false");
      setCollapsed(false);
      setOpened({ route: routeKey, group: groupId });
      return;
    }
    setOpened({ route: routeKey, group: isOpen(groupId) ? null : groupId });
  };
  const logout = () => { localStorage.removeItem("token"); localStorage.removeItem("user"); navigate("/login"); };

  return <div className={`module-layout ${collapsed ? "module-layout--collapsed" : ""}`}>
    <aside className="module-navigation" aria-label="Navegación principal">
      <div className="module-navigation__brand"><span className="module-navigation__mark">S</span>{!collapsed && <span><strong>Sistema<span>007</span></strong><small>Gestión clínica y farmacia</small></span>}</div>
      <nav className="module-navigation__menu">
        <NavLink to="/dashboard" className={({ isActive }) => `module-navigation__link ${isActive ? "active" : ""}`}><span className="module-navigation__icon"><Home size={23} /></span>{!collapsed && "Inicio"}</NavLink>
        {groups.filter((group) => group.show).map((group) => { const Icon = group.icon; return <div className={`module-navigation__group ${activeGroup === group.id ? "active-group" : ""}`} key={group.id}>
          <button type="button" className="module-navigation__group-toggle" onClick={() => toggleGroup(group.id)} aria-expanded={isOpen(group.id)} title={group.label}><span className="module-navigation__icon"><Icon size={23} /></span>{!collapsed && <><span>{group.label}</span><ChevronDown className="module-navigation__chevron" size={18} /></>}</button>
          {isOpen(group.id) && <div className="module-navigation__subitems">{group.items.filter((item) => item.show).map((item) => <NavLink key={item.to} to={item.to} className={() => `module-navigation__sublink ${itemIsActive(item, location) ? "active" : ""}`}>{item.label}</NavLink>)}</div>}
        </div>; })}
      </nav>
      <button type="button" className="module-navigation__logout" onClick={logout} title="Cerrar sesión"><span className="module-navigation__icon"><LogOut size={19} /></span>{!collapsed && "Cerrar sesión"}</button>
    </aside>
    <section className="module-workspace"><header className="module-workspace__header"><div className="module-workspace__heading"><button type="button" className="module-workspace__toggle" onClick={toggleCollapsed} aria-label={collapsed ? "Expandir menú lateral" : "Contraer menú lateral"} aria-expanded={!collapsed}><Menu size={20} /></button><div><h1>{title}</h1><p>{subtitle}</p></div></div><div className="module-workspace__user"><ThemeToggle />{supervision && <span className="module-workspace__supervision">Supervisión DEV</span>}<span>{(user.nombre || "Usuario").charAt(0).toUpperCase()}</span><div><strong>{user.nombre || "Usuario"}</strong><small>{role?.replaceAll("_", " ") || "Usuario del sistema"}</small></div></div></header><div className="module-workspace__content">{children}</div></section>
  </div>;
}
