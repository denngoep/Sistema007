export type UserRole =
  | "ADMINISTRADOR"
  | "MEDICO"
  | "ENFERMERO"
  | "AUXILIAR_ENFERMERIA"
  | "RECEPCION_ADMISIONES"
  | "REGENTE_FARMACIA"
  | "AUXILIAR_FARMACIA"
  | "QUIMICO_FARMACEUTICO";

export interface User {
  id: number;
  nombre: string;
  correo: string;
  rol: UserRole;
  activo: boolean;
  intentosFallidos: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserRequest {
  nombre: string;
  correo: string;
  password: string;
  rol: UserRole;
}

export interface CreateUserResponse {
  message: string;
  user: User;
}

const API_URL = "http://localhost:3000";

export async function getUsers(): Promise<User[]> {
  const response = await fetch(`${API_URL}/users`);

  if (!response.ok) {
    throw new Error("No fue posible consultar los usuarios");
  }

  return response.json();
}

export async function createUser(
  userData: CreateUserRequest,
): Promise<CreateUserResponse> {
  const response = await fetch(`${API_URL}/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(userData),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      Array.isArray(data.message)
        ? data.message.join(", ")
        : data.message || "No fue posible registrar el usuario",
    );
  }

  return data;
}
