import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { getPatients } from "../services/patients.service";
import type { Patient } from "../services/patients.service";

import "../styles/Patients.css";

function Patients() {
  const navigate = useNavigate();

  const [patients, setPatients] = useState<Patient[]>([]);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("Cargando pacientes...");

  useEffect(() => {
    const loadPatients = async () => {
      try {
        const data = await getPatients();

        setPatients(data);
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
  }, []);

  const filteredPatients = useMemo(() => {
    const value = search.trim().toLowerCase();

    if (!value) {
      return patients;
    }

    return patients.filter((patient) => {
      const fullName = `${patient.nombres} ${patient.apellidos}`.toLowerCase();

      return (
        patient.numeroDocumento.toLowerCase().includes(value) ||
        patient.tipoDocumento.toLowerCase().includes(value) ||
        fullName.includes(value)
      );
    });
  }, [patients, search]);

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
            Consulta y administra la información de los pacientes registrados.
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
              {patients.length}{" "}
              {patients.length === 1
                ? "paciente registrado"
                : "pacientes registrados"}
            </span>
          </div>

          <button
            type="button"
            className="patients-primary-button"
            onClick={() => navigate("/patients/new")}
          >
            Nuevo paciente
          </button>
        </div>

        <div className="patients-search-container">
          <label htmlFor="patient-search">Buscar paciente</label>

          <input
            id="patient-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Documento, nombre o apellido"
          />
        </div>

        {message && <div className="patients-message">{message}</div>}

        {!message && filteredPatients.length === 0 && (
          <div className="patients-empty">
            <h3>No se encontraron pacientes</h3>
            <p>No existen pacientes que coincidan con la búsqueda realizada.</p>
          </div>
        )}

        {!message && filteredPatients.length > 0 && (
          <div className="patients-table-container">
            <table className="patients-table">
              <thead>
                <tr>
                  <th>Documento</th>
                  <th>Paciente</th>
                  <th>Fecha de nacimiento</th>
                  <th>Teléfono</th>
                  <th>Correo</th>
                  <th>Acciones</th>
                </tr>
              </thead>

              <tbody>
                {filteredPatients.map((patient) => (
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

                    <td>
                      <div className="patients-actions">
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

                        <button
                          type="button"
                          className="patient-action-primary"
                          onClick={() =>
                            navigate(`/clinical-history/patient/${patient.id}`)
                          }
                        >
                          Historia clínica
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

export default Patients;
