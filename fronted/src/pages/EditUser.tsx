import { useUserManagement } from '../components/user-management-context';
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useParams, useNavigate } from "react-router-dom";

import { getUser, updateUser, updateUserScope, UserRequestError } from "../services/users.service";
import type { User, UserRole } from "../services/users.service";

import "../styles/EditUser.css";

function EditUser() {
  const permissions = useUserManagement();
  const navigate = useNavigate();
  const { id } = useParams();
  const [user, setUser] = useState<User>();
  const [servicioId, setServicioId] = useState("");
  const [esCoordinador, setEsCoordinador] = useState(false);

  const [nombre, setNombre] = useState(user?.nombre ?? "");
  const [correo, setCorreo] = useState(user?.correo ?? "");
  const [rol, setRol] = useState<UserRole | "">(user?.rol ?? "");
  const [password, setPassword] = useState("");

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    getUser(Number(id)).then(value => {
      if (!active) return;
      setUser(value); setNombre(value.nombre); setCorreo(value.correo); setRol(value.rol);
      setServicioId(value.servicioId?.toString() ?? ""); setEsCoordinador(value.esCoordinador);
    }).catch(() => { if (active) { setUser(undefined); setError('Usuario no encontrado o fuera de alcance'); } });
    return () => { active = false; };
  }, [id]);

  const handleScope = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user || !permissions.isAdmin || loading) return;
    setLoading(true); setError(""); setMessage("");
    try {
      const result = await updateUserScope(user.id, { servicioId: servicioId ? Number(servicioId) : null, esCoordinador });
      setUser(result.user); setMessage(result.message);
    } catch (error) { setError(error instanceof Error ? error.message : 'No fue posible actualizar el alcance'); }
    finally { setLoading(false); }
  };

  if (!user || user.id !== Number(id)) {
    return (
      <main>
        <h1>{error || "Consultando usuario..."}</h1>

        <button type="button" onClick={() => navigate("/users")}>
          Volver a usuarios
        </button>
      </main>
    );
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (loading) return;
    if (!rol || !permissions.allowedRoles.includes(rol)) {
      setError("Selecciona un rol autorizado para tu servicio");
      return;
    }

    setMessage("");
    setError("");
    setLoading(true);

    try {
      const data: {
        nombre: string;
        correo?: string;
        rol: UserRole;
        password?: string;
      } = {
        nombre,
        ...(permissions.isAdmin ? { correo } : {}),
        rol: rol as UserRole,
      };

      if (permissions.isAdmin && password.trim()) {
        data.password = password;
      }

      const response = await updateUser(user.id, data);

      setMessage(response.message);
      setPassword("");
    } catch (error) {
      if (error instanceof UserRequestError && error.status === 404) setUser(undefined);
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
            <p>{permissions.isAdmin
              ? "Puedes modificar el nombre, correo, rol y contraseña."
              : "Puedes modificar el nombre y los roles autorizados de tu servicio. El correo es de solo lectura y la contraseña la gestiona el administrador."}</p>
          </div>

          {permissions.isAdmin && user.id !== permissions.userId && <form className="edit-user-scope" onSubmit={handleScope}>
            <div className="edit-user-field edit-user-scope__field">
              <label htmlFor="servicio">Servicio principal</label>
              <select id="servicio" value={servicioId} onChange={event => setServicioId(event.target.value)}>
                <option value="">Sin asignar</option>
                {permissions.services.map(service => <option key={service.id} value={service.id}>{service.nombre}</option>)}
              </select>
              <label className="edit-user-scope__checkbox"><input type="checkbox" checked={esCoordinador} onChange={event => setEsCoordinador(event.target.checked)} /> Designar coordinador de este servicio</label>
              <p>La coordinación permite administrar usuarios; no concede permisos clínicos ni farmacéuticos.</p>
              <button type="submit" className="edit-user-scope__submit" disabled={loading}>Guardar alcance</button>
            </div>
          </form>}
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
                readOnly={!permissions.isAdmin}
                aria-readonly={!permissions.isAdmin}
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
                {permissions.allowedRoles.map(role => <option key={role} value={role}>{role.replaceAll('_', ' ')}</option>)}
              </select>
            </div>

            {permissions.isAdmin && <div className="edit-user-field">
              <label htmlFor="password">Nueva contraseña</label>

              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Déjala vacía para conservar la actual"
                minLength={8}
              />
            </div>}

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
