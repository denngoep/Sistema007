import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/Dashboard.css";

type MenuItem = {
  id: string;
  icon: string;
  label: string;
  path?: string;
  disabled?: boolean;
};

function Dashboard() {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const userData = localStorage.getItem("user");
  const user = userData ? JSON.parse(userData) : null;

  const menuItems: MenuItem[] = [
    {
      id: "dashboard",
      icon: "⌂",
      label: "Inicio",
      path: "/dashboard",
    },
    {
      id: "users",
      icon: "U",
      label: "Usuarios",
      path: "/users",
    },
    {
      id: "patients",
      icon: "P",
      label: "Pacientes",
      path: "/patients",
    },
    {
      id: "clinical-history",
      icon: "HC",
      label: "Historia clínica",
      disabled: true,
    },
    {
      id: "inventory",
      icon: "I",
      label: "Inventario",
      disabled: true,
    },
    {
      id: "dispensations",
      icon: "D",
      label: "Dispensación",
      disabled: true,
    },
    {
      id: "reports",
      icon: "R",
      label: "Reportes",
      disabled: true,
    },
  ];

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  const handleMenuClick = (item: MenuItem) => {
    if (item.disabled || !item.path) {
      return;
    }

    navigate(item.path);
  };

  return (
    <main
      className={`dashboard-page ${
        sidebarOpen ? "sidebar-expanded" : "sidebar-collapsed"
      }`}
    >
      <aside className="dashboard-sidebar">
        <div className="sidebar-brand">
          <div className="brand-logo">S7</div>

          {sidebarOpen && (
            <div className="brand-text">
              <strong>Sistema007</strong>
              <span>Gestión farmacéutica</span>
            </div>
          )}
        </div>

        <nav className="sidebar-navigation">
          {menuItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`sidebar-item ${
                item.id === "dashboard" ? "sidebar-item-active" : ""
              } ${item.disabled ? "sidebar-item-disabled" : ""}`}
              onClick={() => handleMenuClick(item)}
              title={!sidebarOpen ? item.label : undefined}
            >
              <span className="sidebar-icon">{item.icon}</span>

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

        <div className="sidebar-footer">
          <button
            type="button"
            className="sidebar-logout"
            onClick={handleLogout}
            title={!sidebarOpen ? "Cerrar sesión" : undefined}
          >
            <span className="sidebar-icon">↪</span>
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
              onClick={() => setSidebarOpen((current) => !current)}
              aria-label={
                sidebarOpen ? "Contraer menú lateral" : "Expandir menú lateral"
              }
            >
              ☰
            </button>

            <div>
              <h1>Panel principal</h1>
              <p>Sistema007</p>
            </div>
          </div>

          <div className="workspace-user">
            <div className="user-avatar">
              {(user?.nombre || "U").charAt(0).toUpperCase()}
            </div>

            <div className="user-information">
              <strong>{user?.nombre || "Usuario"}</strong>
              <span>{user?.rol || "Usuario del sistema"}</span>
            </div>
          </div>
        </header>

        <div className="workspace-content">
          <section className="welcome-panel">
            <div>
              <span className="welcome-label">Bienvenido a</span>
              <h2>Sistema007</h2>
              <p>
                Plataforma para la gestión segura y trazable de los procesos
                clínicos, farmacéuticos y de dispensación.
              </p>
            </div>

            <div className="welcome-badge">
              <span>S7</span>
            </div>
          </section>

          <section className="dashboard-summary">
            <div className="summary-heading">
              <h3>Panel de trabajo</h3>
              <p>
                Utiliza el menú lateral para acceder a los módulos habilitados
                según tu perfil.
              </p>
            </div>

            <div className="summary-grid">
              <article className="summary-card">
                <span className="summary-card-code">01</span>
                <div>
                  <h4>Gestión centralizada</h4>
                  <p>
                    Accede a la información del sistema desde un único panel de
                    trabajo.
                  </p>
                </div>
              </article>

              <article className="summary-card">
                <span className="summary-card-code">02</span>
                <div>
                  <h4>Trazabilidad</h4>
                  <p>
                    Mantén el seguimiento de los procesos clínicos,
                    farmacéuticos y administrativos.
                  </p>
                </div>
              </article>

              <article className="summary-card">
                <span className="summary-card-code">03</span>
                <div>
                  <h4>Acceso por perfil</h4>
                  <p>
                    Los módulos disponibles se gestionarán de acuerdo con el rol
                    del usuario autenticado.
                  </p>
                </div>
              </article>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

export default Dashboard;
