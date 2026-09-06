import { useState } from "react";
import type { FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { updateUser } from "../services/users.service";
import type { User, UserRole } from "../services/users.service";

import "../styles/EditUser.css";

function EditUser() {
  const navigate = useNavigate();
  const location = useLocation();

  const user = location.state?.user as User | undefined;

  const [nombre, setNombre] = useState(user?.nombre ?? "");
  const [correo, setCorreo] = useState(user?.correo ?? "");
  const [rol, setRol] = useState<UserRole | "">(user?.rol ?? "");
  const [password, setPassword] = useState("");

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (!user) {
    return (
      <main>
        <h1>No se encontró el usuario</h1>

        <button type="button" onClick={() => navigate("/users")}>
          Volver a usuarios
        </button>
      </main>
    );
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setMessage("");
    setError("");
    setLoading(true);

    try {
      const data: {
        nombre: string;
        correo: string;
        rol: UserRole;
        password?: string;
      } = {
        nombre,
        correo,
        rol: rol as UserRole,
      };

      if (password.trim()) {
        data.password = password;
      }

      const response = await updateUser(user.id, data);

      setMessage(response.message);
      setPassword("");
    } catch (error) {
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError("No fue posible actualizar el usuario");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="edit-user-page">
      <header className="edit-user-header">
        <div>
          <h1>Editar usuario</h1>
          <p>Actualiza la información del usuario seleccionado.</p>
        </div>

        <button
          type="button"
          className="edit-user-back"
          onClick={() => navigate("/users")}
        >
          Volver a usuarios
        </button>
      </header>

      <section className="edit-user-content">
        <div className="edit-user-card">
          <div className="edit-user-card-title">
            <h2>Información del usuario</h2>
            <p>Puedes modificar el nombre, correo, rol y contraseña.</p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="edit-user-field">
              <label htmlFor="nombre">Nombre completo</label>

              <input
                id="nombre"
                type="text"
                value={nombre}
                onChange={(event) => setNombre(event.target.value)}
                required
              />
            </div>

            <div className="edit-user-field">
              <label htmlFor="correo">Correo electrónico</label>

              <input
                id="correo"
                type="email"
                value={correo}
                onChange={(event) => setCorreo(event.target.value)}
                required
              />
            </div>

            <div className="edit-user-field">
              <label htmlFor="rol">Rol</label>

              <select
                id="rol"
                value={rol}
                onChange={(event) => setRol(event.target.value as UserRole)}
                required
              >
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

            <div className="edit-user-field">
              <label htmlFor="password">Nueva contraseña</label>

              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Déjala vacía para conservar la actual"
                minLength={8}
              />
            </div>

            {message && <div className="edit-user-success">{message}</div>}

            {error && <div className="edit-user-error">{error}</div>}

            <div className="edit-user-actions">
              <button
                type="button"
                className="edit-user-cancel"
                onClick={() => navigate("/users")}
              >
                Cancelar
              </button>

              <button
                type="submit"
                className="edit-user-submit"
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

export default EditUser;
