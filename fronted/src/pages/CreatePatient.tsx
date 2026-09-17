import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";

import { createPatient } from "../services/patients.service";

import "../styles/CreatePatient.css";

function CreatePatient() {
  const navigate = useNavigate();

  const [tipoDocumento, setTipoDocumento] = useState("CC");
  const [numeroDocumento, setNumeroDocumento] = useState("");
  const [nombres, setNombres] = useState("");
  const [apellidos, setApellidos] = useState("");
  const [fechaNacimiento, setFechaNacimiento] = useState("");
  const [telefono, setTelefono] = useState("");
  const [correo, setCorreo] = useState("");

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setMessage("");
    setError("");
    setLoading(true);

    try {
      const response = await createPatient({
        tipoDocumento,
        numeroDocumento: numeroDocumento.trim(),
        nombres: nombres.trim(),
        apellidos: apellidos.trim(),
        fechaNacimiento,
        telefono: telefono.trim() || undefined,
        correo: correo.trim() || undefined,
      });

      setMessage(response.message);

      setTipoDocumento("CC");
      setNumeroDocumento("");
      setNombres("");
      setApellidos("");
      setFechaNacimiento("");
      setTelefono("");
      setCorreo("");
    } catch (error) {
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError("No fue posible registrar el paciente");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="create-patient-page">
      <header className="create-patient-header">
        <div>
          <span className="create-patient-section-label">Sistema007</span>
          <h1>Registrar paciente</h1>
          <p>
            Ingresa la información necesaria para registrar un nuevo paciente.
          </p>
        </div>

        <button
          type="button"
          className="create-patient-back"
          onClick={() => navigate("/patients")}
        >
          Volver a pacientes
        </button>
      </header>

      <section className="create-patient-content">
        <div className="create-patient-card">
          <div className="create-patient-card-title">
            <h2>Información del paciente</h2>
            <p>
              Los datos de identificación y fecha de nacimiento son
              obligatorios.
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="create-patient-grid">
              <div className="create-patient-field">
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

              <div className="create-patient-field">
                <label htmlFor="numeroDocumento">Número de documento</label>

                <input
                  id="numeroDocumento"
                  type="text"
                  value={numeroDocumento}
                  onChange={(event) => setNumeroDocumento(event.target.value)}
                  placeholder="Ej. 1234567890"
                  required
                />
              </div>

              <div className="create-patient-field">
                <label htmlFor="nombres">Nombres</label>

                <input
                  id="nombres"
                  type="text"
                  value={nombres}
                  onChange={(event) => setNombres(event.target.value)}
                  placeholder="Nombres del paciente"
                  required
                />
              </div>

              <div className="create-patient-field">
                <label htmlFor="apellidos">Apellidos</label>

                <input
                  id="apellidos"
                  type="text"
                  value={apellidos}
                  onChange={(event) => setApellidos(event.target.value)}
                  placeholder="Apellidos del paciente"
                  required
                />
              </div>

              <div className="create-patient-field">
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

              <div className="create-patient-field">
                <label htmlFor="telefono">Teléfono</label>

                <input
                  id="telefono"
                  type="tel"
                  value={telefono}
                  onChange={(event) => setTelefono(event.target.value)}
                  placeholder="Opcional"
                />
              </div>

              <div className="create-patient-field create-patient-field-full">
                <label htmlFor="correo">Correo electrónico</label>

                <input
                  id="correo"
                  type="email"
                  value={correo}
                  onChange={(event) => setCorreo(event.target.value)}
                  placeholder="paciente@correo.com - Opcional"
                />
              </div>
            </div>

            {message && <div className="create-patient-success">{message}</div>}

            {error && <div className="create-patient-error">{error}</div>}

            <div className="create-patient-actions">
              <button
                type="button"
                className="create-patient-cancel"
                onClick={() => navigate("/patients")}
              >
                Cancelar
              </button>

              <button
                type="submit"
                className="create-patient-submit"
                disabled={loading}
              >
                {loading ? "Registrando..." : "Registrar paciente"}
              </button>
            </div>
          </form>
        </div>
      </section>
    </main>
  );
}

export default CreatePatient;
