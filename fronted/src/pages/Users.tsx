import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { getUsers, updateUserStatus } from "../services/users.service";

import type { User, UserRole } from "../services/users.service";

import "../styles/Users.css";

function Users() {
  const navigate = useNavigate();

  const [users, setUsers] = useState<User[]>([]);
  const [message, setMessage] = useState("Cargando usuarios...");
  const [statusMessage, setStatusMessage] = useState("");
  const [updatingUserId, setUpdatingUserId] = useState<number | null>(null);

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

  const loadUsers = async () => {
    try {
      const data = await getUsers();

      setUsers(data);
      setMessage("");
    } catch (error) {
      if (error instanceof Error) {
        setMessage(error.message);
      } else {
        setMessage("No fue posible consultar los usuarios");
      }
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

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
    } catch (error) {
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
              {users.length}{" "}
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

        {message && <div className="users-message">{message}</div>}

        {statusMessage && <div className="users-message">{statusMessage}</div>}

        {!message && users.length > 0 && (
          <div className="users-table-container">
            <table className="users-table">
              <thead>
                <tr>
                  <th>IDENTIFICACIÓN</th>
                  <th>Nombre</th>
                  <th>Correo</th>
                  <th>Rol</th>
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
      </section>
    </main>
  );
}

export default Users;
