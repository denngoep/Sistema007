import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { searchPatients } from "../services/patients.service";
import type { Patient } from "../services/patients.service";
import type { UserRole } from "../services/users.service";
import { useFunctionalTestAccess } from "../components/functional-test-access";

import "../styles/Patients.css";

function Patients() {
  const navigate = useNavigate();

  const [patients, setPatients] = useState<Patient[]>([]);
  const [search, setSearch] = useState(""); const [estado, setEstado] = useState(""); const [page, setPage] = useState(1); const [limit, setLimit] = useState(10); const [total, setTotal] = useState(0); const [totalPages, setTotalPages] = useState(0);
  const [message, setMessage] = useState("Cargando pacientes...");

  // Obtener el rol del usuario autenticado.
  const userRole = useMemo(() => {
    try {
      const storedUser = localStorage.getItem("user");

      if (!storedUser) {
        return null;
      }

      const user = JSON.parse(storedUser) as {
        rol?: UserRole;
      };

      return user.rol ?? null;
    } catch {
      return null;
    }
  }, []);

  const functionalTestAccess = useFunctionalTestAccess();

  // Permisos para registrar y editar pacientes.
  const canManagePatients =
    functionalTestAccess || userRole === "ADMINISTRADOR" || userRole === "RECEPCION_ADMISIONES";

  // Permisos para consultar la historia clínica.
  const canViewClinicalHistory =
    functionalTestAccess || userRole === "ADMINISTRADOR" || userRole === "MEDICO" || userRole === "ENFERMERO";

  useEffect(() => {
    const loadPatients = async () => {
      try {
        const data = await searchPatients({ search, estado, page, limit });
        setPatients(data.patients); setTotal(data.total); setTotalPages(data.totalPages);
        setMessage("");
      } catch (error) {
        if (error instanceof Error) {
          setMessage(error.message);
        } else {
          setMessage("No fue posible consultar los pacientes");
        }
      }
    };

    void loadPatients();
  }, [search, estado, page, limit]);

  const formatDate = (date: string) => {
    return new Intl.DateTimeFormat("es-CO", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: "UTC",
    }).format(new Date(date));
  };

  return (
    <main className="patients-page">
      <header className="patients-header">
        <div>
          <span className="patients-section-label">Sistema007</span>

          <h1>Gestión de pacientes</h1>

          <p>
            Consulta la información de los pacientes registrados según los
            permisos de tu rol.
          </p>
        </div>

        <button
          type="button"
          className="patients-back-button"
          onClick={() => navigate("/dashboard")}
        >
          Volver al panel
        </button>
      </header>

      <section className="patients-content">
        <div className="patients-toolbar">
          <div>
            <h2>Pacientes registrados</h2>

            <span>
              {total}{" "}
              {patients.length === 1
                ? "paciente registrado"
                : "pacientes registrados"}
            </span>
          </div>

          {canManagePatients && (
            <button
              type="button"
              className="patients-primary-button"
              onClick={() => navigate("/patients/new")}
            >
              Nuevo paciente
            </button>
          )}
        </div>

        <div className="patients-search-container">
          <label htmlFor="patient-search">Buscar paciente</label>

          <input
            id="patient-search"
            type="search"
            value={search}
            onChange={(event) => { setSearch(event.target.value); setPage(1); }}
            placeholder="Documento, nombre o apellido"
          />
          <select value={estado} onChange={(event) => { setEstado(event.target.value); setPage(1); }}><option value="">Todos los estados</option><option value="ACTIVO">Activos</option><option value="INACTIVO">Inactivos</option></select><select value={limit} onChange={(event) => { setLimit(Number(event.target.value)); setPage(1); }}><option value={10}>10 por página</option><option value={20}>20 por página</option><option value={50}>50 por página</option></select>
        </div>

        {message && <div className="patients-message">{message}</div>}

        {!message && patients.length === 0 && (
          <div className="patients-empty">
            <h3>No se encontraron pacientes</h3>

            <p>No existen pacientes que coincidan con la búsqueda realizada.</p>
          </div>
        )}

        {!message && patients.length > 0 && (
          <div className="patients-table-container">
            <table className="patients-table">
              <thead>
                <tr>
                  <th>Documento</th>
                  <th>Paciente</th>
                  <th>Fecha de nacimiento</th>
                  <th>Teléfono</th>
                  <th>Correo</th>

                  {(canManagePatients || canViewClinicalHistory) && (
                    <th>Acciones</th>
                  )}
                </tr>
              </thead>

              <tbody>
                {patients.map((patient) => (
                  <tr key={patient.id}>
                    <td>
                      <div className="patient-document">
                        <span>{patient.tipoDocumento}</span>

                        <strong>{patient.numeroDocumento}</strong>
                      </div>
                    </td>

                    <td>
                      <strong className="patient-name">
                        {patient.nombres} {patient.apellidos}
                      </strong>
                    </td>

                    <td>{formatDate(patient.fechaNacimiento)}</td>

                    <td>{patient.telefono || "No registrado"}</td>

                    <td>{patient.correo || "No registrado"}</td>

                    {(canManagePatients || canViewClinicalHistory) && (
                      <td>
                        <div className="patients-actions">
                          {canManagePatients && (
                            <button
                              type="button"
                              className="patient-action-secondary"
                              onClick={() =>
                                navigate(`/patients/${patient.id}/edit`, {
                                  state: { patient },
                                })
                              }
                            >
                              Editar
                            </button>
                          )}

                          {canViewClinicalHistory && (
                            <button
                              type="button"
                              className="patient-action-primary"
                              onClick={() =>
                                navigate(
                                  `/clinical-history/patient/${patient.id}`,
                                )
                              }
                            >
                              Historia clínica
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!message && totalPages > 0 && <div className="table-pagination"><button disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</button><span>Página {page} de {totalPages}</span><button disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Siguiente</button></div>}
      </section>
    </main>
  );
}

export default Patients;
