import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";

import { createUser } from "../services/users.service";
import type { UserRole } from "../services/users.service";

import "../styles/CreateUser.css";

function CreateUser() {
  const navigate = useNavigate();

  const [nombre, setNombre] = useState("");
  const [correo, setCorreo] = useState("");
  const [password, setPassword] = useState("");
  const [rol, setRol] = useState<UserRole | "">("");

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setMessage("");
    setError("");

    if (!rol) {
      setError("Debes seleccionar un rol");
      return;
    }

    setLoading(true);

    try {
      const response = await createUser({
        nombre,
        correo,
        password,
        rol,
      });

      setMessage(response.message);

      setNombre("");
      setCorreo("");
      setPassword("");
      setRol("");
    } catch (error) {
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError("No fue posible registrar el usuario");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="create-user-page">
      <header className="create-user-header">
        <div>
          <h1>Registrar usuario</h1>
          <p>Crea un nuevo usuario para acceder a Sistema007.</p>
        </div>

        <button
          type="button"
          className="create-user-back"
          onClick={() => navigate("/users")}
        >
          Volver a usuarios
        </button>
      </header>

      <section className="create-user-content">
        <div className="create-user-card">
          <div className="create-user-card-title">
            <h2>Información del usuario</h2>
            <p>Ingresa los datos necesarios y asigna el rol correspondiente.</p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="create-user-field">
              <label htmlFor="nombre">Nombre completo</label>

              <input
                id="nombre"
                type="text"
                value={nombre}
                onChange={(event) => setNombre(event.target.value)}
                placeholder="Ej. María González"
                required
              />
            </div>

            <div className="create-user-field">
              <label htmlFor="correo">Correo electrónico</label>

              <input
                id="correo"
                type="email"
                value={correo}
                onChange={(event) => setCorreo(event.target.value)}
                placeholder="usuario@sistema007.com"
                required
              />
            </div>

            <div className="create-user-field">
              <label htmlFor="rol">Rol</label>

              <select
                id="rol"
                value={rol}
                onChange={(event) =>
                  setRol(event.target.value as UserRole | "")
                }
                required
              >
                <option value="">Selecciona un rol</option>
                <option value="ADMINISTRADOR">Administrador</option>
                <option value="MEDICO">Médico</option>
                <option value="ENFERMERO">Enfermero/a</option>
                <option value="AUXILIAR_ENFERMERIA">
                  Auxiliar de Enfermería
                </option>
                <option value="RECEPCION_ADMISIONES">
                  Recepción / Admisiones
                </option>
                <option value="REGENTE_FARMACIA">Regente de Farmacia</option>
                <option value="AUXILIAR_FARMACIA">Auxiliar de Farmacia</option>
                <option value="QUIMICO_FARMACEUTICO">
                  Químico Farmacéutico
                </option>
              </select>
            </div>

            <div className="create-user-field">
              <label htmlFor="password">Contraseña</label>

              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Mínimo 8 caracteres"
                minLength={8}
                required
              />
            </div>

            {message && <div className="create-user-success">{message}</div>}

            {error && <div className="create-user-error">{error}</div>}

            <div className="create-user-actions">
              <button
                type="button"
                className="create-user-cancel"
                onClick={() => navigate("/users")}
              >
                Cancelar
              </button>

              <button
                type="submit"
                className="create-user-submit"
                disabled={loading}
              >
                {loading ? "Registrando..." : "Registrar usuario"}
              </button>
            </div>
          </form>
        </div>
      </section>
    </main>
  );
}

export default CreateUser;
