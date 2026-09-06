import { useNavigate } from "react-router-dom";
import "../styles/Dashboard.css";

function Dashboard() {
  const navigate = useNavigate();

  const userData = localStorage.getItem("user");
  const user = userData ? JSON.parse(userData) : null;

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  return (
    <main className="dashboard-page">
      <header className="dashboard-header">
        <div>
          <h1>Sistema007</h1>
          <p>Gestión farmacéutica inteligente</p>
        </div>

        <div className="dashboard-user">
          <div>
            <span>Bienvenido</span>
            <strong>{user?.nombre || "Usuario"}</strong>
          </div>

          <button type="button" onClick={handleLogout}>
            Cerrar sesión
          </button>
        </div>
      </header>

      <section className="dashboard-main">
        <div className="dashboard-title">
          <h2>Panel principal</h2>
          <p>Selecciona el módulo que deseas gestionar dentro de Sistema007.</p>
        </div>

        <div className="dashboard-grid">
          <article className="dashboard-card">
            <div className="card-icon">U</div>
            <h3>Usuarios</h3>
            <p>
              Consulta, registra, edita y administra el estado de los usuarios.
            </p>
            <button type="button" onClick={() => navigate("/users")}>
              Ingresar
            </button>
          </article>

          <article className="dashboard-card">
            <div className="card-icon">P</div>
            <h3>Pacientes</h3>
            <p>
              Registra, consulta y actualiza la información de los pacientes.
            </p>
            <button type="button">Ingresar</button>
          </article>

          <article className="dashboard-card dashboard-card-disabled">
            <div className="card-icon">HC</div>
            <h3>Historia clínica</h3>
            <p>
              Consulta la historia clínica y la formulación médica del paciente.
            </p>
            <span>Próximamente</span>
          </article>

          <article className="dashboard-card dashboard-card-disabled">
            <div className="card-icon">I</div>
            <h3>Inventario</h3>
            <p>
              Gestiona medicamentos, existencias, lotes y fechas de vencimiento.
            </p>
            <span>Próximamente</span>
          </article>

          <article className="dashboard-card dashboard-card-disabled">
            <div className="card-icon">D</div>
            <h3>Dispensación</h3>
            <p>Gestiona el proceso de validación y entrega de medicamentos.</p>
            <span>Próximamente</span>
          </article>

          <article className="dashboard-card dashboard-card-disabled">
            <div className="card-icon">R</div>
            <h3>Reportes</h3>
            <p>Consulta reportes, trazabilidad y auditoría del sistema.</p>
            <span>Próximamente</span>
          </article>
        </div>
      </section>
    </main>
  );
}

export default Dashboard;
