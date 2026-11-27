import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { searchUsers, updateUserStatus, UserRequestError } from "../services/users.service";

import type { User, UserRole } from "../services/users.service";

import "../styles/Users.css";
import { useUserManagement } from '../components/user-management-context';

function Users() {
  const permissions = useUserManagement();
  const navigate = useNavigate();

  const [users, setUsers] = useState<User[]>([]);
  const [message, setMessage] = useState("Cargando usuarios...");
  const [statusMessage, setStatusMessage] = useState("");
  const [updatingUserId, setUpdatingUserId] = useState<number | null>(null);
  const [search, setSearch] = useState(""); const [rol, setRol] = useState(""); const [estado, setEstado] = useState("");
  const [page, setPage] = useState(1); const [limit, setLimit] = useState(10); const [total, setTotal] = useState(0); const [totalPages, setTotalPages] = useState(0);
  const [reload, setReload] = useState(0);

  const getRoleName = (rol: UserRole) => {
    const roles: Record<UserRole, string> = {
      ADMINISTRADOR: "Administrador",
      MEDICO: "Médico",
      ENFERMERO: "Enfermero/a",
      AUXILIAR_ENFERMERIA: "Auxiliar de Enfermería",
      RECEPCION_ADMISIONES: "Recepción / Admisiones",
      REGENTE_FARMACIA: "Regente de Farmacia",
      AUXILIAR_FARMACIA: "Auxiliar de Farmacia",
      QUIMICO_FARMACEUTICO: "Químico Farmacéutico",
    };

    return roles[rol];
  };

  useEffect(() => {
    let active = true;
    searchUsers({ search, rol, estado, page, limit }).then(data => {
      if (active) { setUsers(data.users); setTotal(data.total); setTotalPages(data.totalPages); setMessage(""); }
    }).catch(error => {
      if (active) setMessage(error instanceof Error ? error.message : "No fue posible consultar los usuarios");
    });
    return () => { active = false; };
  }, [search, rol, estado, page, limit, reload]);

  const handleStatusChange = async (user: User) => {
    const newStatus = !user.activo;

    setStatusMessage("");
    setUpdatingUserId(user.id);

    try {
      const response = await updateUserStatus(user.id, newStatus);

      setUsers((currentUsers) =>
        currentUsers.map((currentUser) =>
          currentUser.id === user.id
            ? {
                ...currentUser,
                activo: response.user.activo,
              }
            : currentUser,
        ),
      );

      setStatusMessage(response.message);
      setReload((value) => value + 1);
    } catch (error) {
      if (error instanceof UserRequestError && error.status === 404) {
        setUsers(current => current.filter(item => item.id !== user.id));
      }
      if (error instanceof Error) {
        setStatusMessage(error.message);
      } else {
        setStatusMessage("No fue posible actualizar el estado del usuario");
      }
    } finally {
      setUpdatingUserId(null);
    }
  };

  return (
    <main className="users-page">
      <header className="users-header">
        <div>
          <h1>Gestión de usuarios</h1>
          <p>Consulta y administra los usuarios registrados en Sistema007.</p>
        </div>

        <button
          type="button"
          className="users-back-button"
          onClick={() => navigate("/dashboard")}
        >
          Volver al dashboard
        </button>
      </header>

      <section className="users-content">
        <div className="users-toolbar">
          <div>
            <h2>Usuarios registrados</h2>

            <span>
              {total}{" "}
              {users.length === 1
                ? "usuario encontrado"
                : "usuarios encontrados"}
            </span>
          </div>

          <button
            type="button"
            className="users-primary-button"
            onClick={() => navigate("/users/new")}
          >
            Nuevo usuario
          </button>
        </div>

        <div className="users-filters"><input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Buscar nombre o correo" /><select value={rol} onChange={(e) => { setRol(e.target.value); setPage(1); }}><option value="">Todos los roles</option>{Object.entries({ ADMINISTRADOR: "Administrador", MEDICO: "Médico", ENFERMERO: "Enfermero/a", AUXILIAR_ENFERMERIA: "Auxiliar de Enfermería", RECEPCION_ADMISIONES: "Recepción / Admisiones", REGENTE_FARMACIA: "Regente de Farmacia", AUXILIAR_FARMACIA: "Auxiliar de Farmacia", QUIMICO_FARMACEUTICO: "Químico Farmacéutico" }).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><select value={estado} onChange={(e) => { setEstado(e.target.value); setPage(1); }}><option value="">Todos los estados</option><option value="ACTIVO">Activos</option><option value="INACTIVO">Inactivos</option></select><select value={limit} onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}><option value={10}>10 por página</option><option value={20}>20 por página</option><option value={50}>50 por página</option></select></div>

        {message && <div className="users-message">{message}</div>}

        {statusMessage && <div className="users-message">{statusMessage}</div>}
        {!message && users.length === 0 && <p className="users-message" role="status">
          {permissions.isAdmin ? "No hay usuarios registrados para mostrar." : `No hay usuarios ordinarios que puedas administrar en ${permissions.servicio?.nombre ?? 'tu servicio'}. Puedes registrar un nuevo usuario con los roles autorizados.`}
        </p>}

        {!message && users.length > 0 && (
          <div className="users-table-container">
            <table className="users-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Nombre</th>
                  <th>Correo</th>
                  <th>Rol</th>
                  <th>Servicio / Coordinación</th>
                  <th>Estado</th>
                  <th>Intentos fallidos</th>
                  <th>Acciones</th>
                </tr>
              </thead>

              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>{user.id}</td>

                    <td>
                      <strong>{user.nombre}</strong>
                    </td>

                    <td>{user.correo}</td>

                    <td>
                      <span className="role-badge">
                        {getRoleName(user.rol)}
                      </span>
                    </td>

                    <td>{user.servicio?.nombre ?? "Sin asignar"}{user.esCoordinador ? " · Coordinador" : ""}</td>

                    <td>
                      <span
                        className={
                          user.activo
                            ? "status-badge status-active"
                            : "status-badge status-inactive"
                        }
                      >
                        {user.activo ? "Activo" : "Inactivo"}
                      </span>
                    </td>

                    <td>{user.intentosFallidos}</td>

                    <td>
                      <div className="users-actions">
                        <button
                          type="button"
                          className="action-edit"
                          onClick={() =>
                            navigate(`/users/${user.id}/edit`, {
                              state: { user },
                            })
                          }
                        >
                          Editar
                        </button>

                        <button
                          type="button"
                          className="action-status"
                          disabled={updatingUserId === user.id}
                          onClick={() => handleStatusChange(user)}
                        >
                          {updatingUserId === user.id
                            ? "Procesando..."
                            : user.activo
                              ? "Desactivar"
                              : "Activar"}
                        </button>
                      </div>
                    </td>
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

export default Users;
