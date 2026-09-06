import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { getUsers } from "../services/users.service";
import type { User } from "../services/users.service";

import "../styles/Users.css";

function Users() {
  const navigate = useNavigate();

  const [users, setUsers] = useState<User[]>([]);
  const [message, setMessage] = useState("Cargando usuarios...");

  useEffect(() => {
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

    loadUsers();
  }, []);

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
            <span>{users.length} usuarios encontrados</span>
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

        {!message && users.length > 0 && (
          <div className="users-table-container">
            <table className="users-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Nombre</th>
                  <th>Correo</th>
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
                        <button type="button" className="action-edit">
                          Editar
                        </button>

                        <button type="button" className="action-status">
                          {user.activo ? "Desactivar" : "Activar"}
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
