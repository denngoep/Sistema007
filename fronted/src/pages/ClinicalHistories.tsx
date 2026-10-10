import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getPatients, type Patient } from "../services/patients.service";
import "../styles/ClinicalHistories.css";

function ClinicalHistories() {
  const navigate = useNavigate();

  const [patients, setPatients] = useState<Patient[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadPatients = async () => {
      try {
        setLoading(true);
        setError("");

        const response = await getPatients();
        setPatients(response);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "No fue posible consultar los pacientes",
        );
      } finally {
        setLoading(false);
      }
    };

    loadPatients();
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
        patient.nombres.toLowerCase().includes(value) ||
        patient.apellidos.toLowerCase().includes(value) ||
        fullName.includes(value)
      );
    });
  }, [patients, search]);

  const handleOpenClinicalHistory = (patientId: number) => {
    navigate(`/clinical-history/patient/${patientId}`);
  };

  return (
    <main className="clinical-histories-page">
      <header className="clinical-histories-header">
        <div>
          <span className="clinical-histories-label">Módulo clínico</span>
          <h1>Historia clínica</h1>
          <p>
            Consulta la historia clínica del paciente y accede a la información
            necesaria para su atención.
          </p>
        </div>

        <button
          type="button"
          className="clinical-histories-back-button"
          onClick={() => navigate("/dashboard")}
        >
          Volver al inicio
        </button>
      </header>

      <section className="clinical-histories-search-section">
        <div className="clinical-histories-search-heading">
          <div>
            <h2>Buscar paciente</h2>
            <p>
              Localiza al paciente por número de documento, nombre o apellido.
            </p>
          </div>

          <span className="clinical-histories-count">
            {patients.length} {patients.length === 1 ? "paciente" : "pacientes"}
          </span>
        </div>

        <div className="clinical-histories-search-box">
          <label htmlFor="clinical-history-search">
            Documento, nombre o apellido
          </label>

          <input
            id="clinical-history-search"
            type="search"
            placeholder="Ej. 1234567890 o nombre del paciente"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      </section>

      <section className="clinical-histories-results">
        <div className="clinical-histories-results-heading">
          <div>
            <h2>Pacientes</h2>
            <p>Selecciona un paciente para ingresar a su historia clínica.</p>
          </div>

          {!loading && !error && (
            <span>
              {filteredPatients.length}{" "}
              {filteredPatients.length === 1 ? "resultado" : "resultados"}
            </span>
          )}
        </div>

        {loading && (
          <div className="clinical-histories-message">
            Consultando pacientes...
          </div>
        )}

        {!loading && error && (
          <div className="clinical-histories-message clinical-histories-error">
            {error}
          </div>
        )}

        {!loading && !error && filteredPatients.length === 0 && (
          <div className="clinical-histories-message">
            No se encontraron pacientes con la búsqueda realizada.
          </div>
        )}

        {!loading && !error && filteredPatients.length > 0 && (
          <div className="clinical-histories-list">
            {filteredPatients.map((patient) => (
              <article
                key={patient.id}
                className="clinical-histories-patient-card"
              >
                <div className="clinical-histories-patient-avatar">
                  {patient.nombres.charAt(0).toUpperCase()}
                  {patient.apellidos.charAt(0).toUpperCase()}
                </div>

                <div className="clinical-histories-patient-main">
                  <strong>
                    {patient.nombres} {patient.apellidos}
                  </strong>

                  <span>
                    {patient.tipoDocumento} {patient.numeroDocumento}
                  </span>
                </div>

                <div className="clinical-histories-patient-contact">
                  <span>Teléfono</span>
                  <strong>{patient.telefono || "No registrado"}</strong>
                </div>

                <div className="clinical-histories-patient-contact">
                  <span>Correo</span>
                  <strong>{patient.correo || "No registrado"}</strong>
                </div>

                <button
                  type="button"
                  className="clinical-histories-open-button"
                  onClick={() => handleOpenClinicalHistory(patient.id)}
                >
                  Abrir historia clínica
                </button>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

export default ClinicalHistories;
