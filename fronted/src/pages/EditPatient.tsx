import { useState } from "react";
import type { FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { updatePatient } from "../services/patients.service";
import type { Patient } from "../services/patients.service";

import "../styles/EditPatient.css";

function EditPatient() {
  const navigate = useNavigate();
  const location = useLocation();

  const patient = location.state?.patient as Patient | undefined;

  const [tipoDocumento, setTipoDocumento] = useState(
    patient?.tipoDocumento ?? "CC",
  );
  const [numeroDocumento, setNumeroDocumento] = useState(
    patient?.numeroDocumento ?? "",
  );
  const [nombres, setNombres] = useState(patient?.nombres ?? "");
  const [apellidos, setApellidos] = useState(patient?.apellidos ?? "");
  const [fechaNacimiento, setFechaNacimiento] = useState(
    patient?.fechaNacimiento ? patient.fechaNacimiento.substring(0, 10) : "",
  );
  const [telefono, setTelefono] = useState(patient?.telefono ?? "");
  const [correo, setCorreo] = useState(patient?.correo ?? "");

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (!patient) {
    return (
      <main className="edit-patient-page">
        <section className="edit-patient-not-found">
          <h1>No se encontró el paciente</h1>
          <p>
            Regresa al listado de pacientes y selecciona nuevamente la opción
            Editar.
          </p>

          <button type="button" onClick={() => navigate("/patients")}>
            Volver a pacientes
          </button>
        </section>
      </main>
    );
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setMessage("");
    setError("");
    setLoading(true);

    try {
      const response = await updatePatient(patient.id, {
        tipoDocumento,
        numeroDocumento: numeroDocumento.trim(),
        nombres: nombres.trim(),
        apellidos: apellidos.trim(),
        fechaNacimiento,
        telefono: telefono.trim() || undefined,
        correo: correo.trim() || undefined,
      });

      setMessage(response.message);
    } catch (error) {
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError("No fue posible actualizar el paciente");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="edit-patient-page">
      <header className="edit-patient-header">
        <div>
          <span className="edit-patient-section-label">Sistema007</span>
          <h1>Editar paciente</h1>
          <p>Actualiza la información del paciente seleccionado.</p>
        </div>

        <button
          type="button"
          className="edit-patient-back"
          onClick={() => navigate("/patients")}
        >
          Volver a pacientes
        </button>
      </header>

      <section className="edit-patient-content">
        <div className="edit-patient-card">
          <div className="edit-patient-card-title">
            <h2>Información del paciente</h2>
            <p>Modifica únicamente los datos que necesiten ser actualizados.</p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="edit-patient-grid">
              <div className="edit-patient-field">
                <label htmlFor="tipoDocumento">Tipo de documento</label>

                <select
                  id="tipoDocumento"
                  value={tipoDocumento}
                  onChange={(event) => setTipoDocumento(event.target.value)}
                  required
                >
                  <option value="CC">Cédula de ciudadanía</option>
                  <option value="TI">Tarjeta de identidad</option>
                  <option value="CE">Cédula de extranjería</option>
                  <option value="PA">Pasaporte</option>
                  <option value="RC">Registro civil</option>
                  <option value="PEP">PEP</option>
                  <option value="PPT">PPT</option>
                </select>
              </div>

              <div className="edit-patient-field">
                <label htmlFor="numeroDocumento">Número de documento</label>

                <input
                  id="numeroDocumento"
                  type="text"
                  value={numeroDocumento}
                  onChange={(event) => setNumeroDocumento(event.target.value)}
                  required
                />
              </div>

              <div className="edit-patient-field">
                <label htmlFor="nombres">Nombres</label>

                <input
                  id="nombres"
                  type="text"
                  value={nombres}
                  onChange={(event) => setNombres(event.target.value)}
                  required
                />
              </div>

              <div className="edit-patient-field">
                <label htmlFor="apellidos">Apellidos</label>

                <input
                  id="apellidos"
                  type="text"
                  value={apellidos}
                  onChange={(event) => setApellidos(event.target.value)}
                  required
                />
              </div>

              <div className="edit-patient-field">
                <label htmlFor="fechaNacimiento">Fecha de nacimiento</label>

                <input
                  id="fechaNacimiento"
                  type="date"
                  value={fechaNacimiento}
                  onChange={(event) => setFechaNacimiento(event.target.value)}
                  max={new Date().toISOString().split("T")[0]}
                  required
                />
              </div>

              <div className="edit-patient-field">
                <label htmlFor="telefono">Teléfono</label>

                <input
                  id="telefono"
                  type="tel"
                  value={telefono}
                  onChange={(event) => setTelefono(event.target.value)}
                  placeholder="Opcional"
                />
              </div>

              <div className="edit-patient-field edit-patient-field-full">
                <label htmlFor="correo">Correo electrónico</label>

                <input
                  id="correo"
                  type="email"
                  value={correo}
                  onChange={(event) => setCorreo(event.target.value)}
                  placeholder="Opcional"
                />
              </div>
            </div>

            {message && <div className="edit-patient-success">{message}</div>}

            {error && <div className="edit-patient-error">{error}</div>}

            <div className="edit-patient-actions">
              <button
                type="button"
                className="edit-patient-cancel"
                onClick={() => navigate("/patients")}
              >
                Cancelar
              </button>

              <button
                type="submit"
                className="edit-patient-submit"
                disabled={loading}
              >
                {loading ? "Actualizando..." : "Guardar cambios"}
              </button>
            </div>
          </form>
        </div>
      </section>
    </main>
  );
}

export default EditPatient;
