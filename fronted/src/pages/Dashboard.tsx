import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/Dashboard.css";

type IconName =
  | "home"
  | "users"
  | "patient"
  | "clinical"
  | "inventory"
  | "dispensation"
  | "reports"
  | "logout"
  | "menu"
  | "arrow";

type MenuItem = {
  id: string;
  icon: IconName;
  label: string;
  description: string;
  path?: string;
  disabled?: boolean;
};

function DashboardIcon({ name, size = 20 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, React.ReactNode> = {
    home: (
      <>
        <path d="m3 10 9-7 9 7" />
        <path d="M5 9v12h14V9" />
        <path d="M9 21v-7h6v7" />
      </>
    ),
    users: (
      <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </>
    ),
    patient: (
      <>
        <circle cx="12" cy="7" r="4" />
        <path d="M5 21v-2a7 7 0 0 1 14 0v2" />
        <path d="M19 5h4M21 3v4" />
      </>
    ),
    clinical: (
      <>
        <rect x="5" y="3" width="14" height="18" rx="2" />
        <path d="M9 3.5h6" />
        <path d="M12 9v6M9 12h6" />
      </>
    ),
    inventory: (
      <>
        <path d="m3 7 9-4 9 4-9 4-9-4Z" />
        <path d="M3 7v10l9 4 9-4V7" />
        <path d="M12 11v10" />
      </>
    ),
    dispensation: (
      <>
        <rect x="3" y="8" width="18" height="8" rx="4" />
        <path d="m9 8 6 8" />
      </>
    ),
    reports: (
      <>
        <path d="M4 3h12l4 4v14H4z" />
        <path d="M16 3v5h4" />
        <path d="M8 17v-4M12 17V9M16 17v-6" />
      </>
    ),
    logout: (
      <>
        <path d="M10 17l5-5-5-5" />
        <path d="M15 12H3" />
        <path d="M12 3h6a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3h-6" />
      </>
    ),
    menu: (
      <>
        <path d="M4 6h16M4 12h16M4 18h16" />
      </>
    ),
    arrow: (
      <>
        <path d="M5 12h14M13 6l6 6-6 6" />
      </>
    ),
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

const menuItems: MenuItem[] = [
  {
    id: "dashboard",
    icon: "home",
    label: "Inicio",
    description: "Vista general del sistema",
    path: "/dashboard",
  },
  {
    id: "users",
    icon: "users",
    label: "Usuarios",
    description: "Administración de usuarios",
    path: "/users",
  },
  {
    id: "patients",
    icon: "patient",
    label: "Pacientes",
    description: "Registro y consulta de pacientes",
    path: "/patients",
  },
  {
    id: "clinical-history",
    icon: "clinical",
    label: "Historia clínica",
    description: "Atenciones y formulaciones",
    path: "/clinical-history",
  },
  {
    id: "inventory",
    icon: "inventory",
    label: "Inventario",
    description: "Control de medicamentos",
    disabled: true,
  },
  {
    id: "dispensations",
    icon: "dispensation",
    label: "Dispensación",
    description: "Entrega y trazabilidad",
    disabled: true,
  },
  {
    id: "reports",
    icon: "reports",
    label: "Reportes",
    description: "Consulta de información",
    disabled: true,
  },
];

function Dashboard() {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const [user] = useState<{
    nombre?: string;
    rol?: string;
  } | null>(() => {
    try {
      const saved = localStorage.getItem("user");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const userName = user?.nombre || "Usuario";

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  const handleNavigation = (item: MenuItem) => {
    if (!item.disabled && item.path) {
      navigate(item.path);
    }
  };

  const availableModules = menuItems.filter(
    (item) => item.path && item.id !== "dashboard",
  );

  return (
    <main
      className={`dashboard-page ${
        sidebarOpen ? "sidebar-expanded" : "sidebar-collapsed"
      }`}
    >
      <aside className="dashboard-sidebar">
        <div className="sidebar-brand">
          <div className="brand-logo">S</div>

          {sidebarOpen && (
            <div className="brand-text">
              <strong>
                Sistema<span>007</span>
              </strong>
              <small>Gestión clínica y farmacéutica</small>
            </div>
          )}
        </div>

        <div className="sidebar-menu-area">
          {sidebarOpen && (
            <span className="sidebar-section-title">MENÚ PRINCIPAL</span>
          )}

          <nav className="sidebar-navigation" aria-label="Menú principal">
            {menuItems.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`sidebar-item ${
                  item.id === "dashboard" ? "sidebar-item-active" : ""
                } ${item.disabled ? "sidebar-item-disabled" : ""}`}
                onClick={() => handleNavigation(item)}
                disabled={item.disabled}
                title={item.label}
                aria-current={item.id === "dashboard" ? "page" : undefined}
              >
                <span className="sidebar-icon">
                  <DashboardIcon name={item.icon} />
                </span>

                {sidebarOpen && (
                  <>
                    <span className="sidebar-label">{item.label}</span>

                    {item.disabled && (
                      <span className="sidebar-status">Próx.</span>
                    )}
                  </>
                )}
              </button>
            ))}
          </nav>
        </div>

        <div className="sidebar-footer">
          <button
            type="button"
            className="sidebar-logout"
            onClick={handleLogout}
            title="Cerrar sesión"
          >
            <span className="sidebar-icon">
              <DashboardIcon name="logout" />
            </span>
            {sidebarOpen && <span>Cerrar sesión</span>}
          </button>
        </div>
      </aside>

      <section className="dashboard-workspace">
        <header className="workspace-header">
          <div className="workspace-header-left">
            <button
              type="button"
              className="sidebar-toggle"
              onClick={() => setSidebarOpen((value) => !value)}
              aria-label={
                sidebarOpen ? "Contraer menú lateral" : "Expandir menú lateral"
              }
              aria-expanded={sidebarOpen}
            >
              <DashboardIcon name="menu" size={21} />
            </button>

            <div className="workspace-title">
              <h1>Panel principal</h1>
              <p>Inicio / Vista general</p>
            </div>
          </div>

          <div className="workspace-user">
            <div className="user-avatar">
              {userName.charAt(0).toUpperCase()}
            </div>

            <div className="user-information">
              <strong>{userName}</strong>
              <span>{user?.rol || "Usuario del sistema"}</span>
            </div>
          </div>
        </header>

        <div className="workspace-content">
          <section className="welcome-panel">
            <div className="welcome-content">
              <span className="welcome-label">PANEL DE CONTROL</span>
              <h2>Bienvenido a Sistema007</h2>
              <p>
                Gestiona los procesos clínicos y farmacéuticos desde un entorno
                organizado y seguro.
              </p>
            </div>

            <div className="welcome-decoration" aria-hidden="true">
              <span className="decoration-circle" />
              <span className="decoration-line" />
            </div>
          </section>

          <section className="dashboard-summary">
            <div className="summary-heading">
              <div>
                <h3>Accesos rápidos</h3>
                <p>Selecciona un módulo para comenzar a trabajar.</p>
              </div>
            </div>

            <div className="summary-grid">
              {availableModules.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="summary-card"
                  onClick={() => handleNavigation(item)}
                >
                  <span className="summary-card-icon">
                    <DashboardIcon name={item.icon} size={23} />
                  </span>

                  <span className="summary-card-content">
                    <strong>{item.label}</strong>
                    <small>{item.description}</small>
                  </span>

                  <span className="summary-card-arrow">
                    <DashboardIcon name="arrow" size={18} />
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section className="dashboard-pending">
            <div className="pending-heading">
              <h3>Próximamente</h3>
              <p>Módulos que se encuentran en desarrollo.</p>
            </div>

            <div className="pending-list">
              {menuItems
                .filter((item) => item.disabled)
                .map((item) => (
                  <div className="pending-item" key={item.id}>
                    <span className="pending-icon">
                      <DashboardIcon name={item.icon} size={19} />
                    </span>
                    <span>{item.label}</span>
                    <small>En desarrollo</small>
                  </div>
                ))}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

export default Dashboard;
