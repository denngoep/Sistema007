export const USER_ROLES = [
  "ADMINISTRADOR", "MEDICO", "ENFERMERO", "AUXILIAR_ENFERMERIA",
  "RECEPCION_ADMISIONES", "REGENTE_FARMACIA", "AUXILIAR_FARMACIA",
  "QUIMICO_FARMACEUTICO",
] as const;
export type UserRole = (typeof USER_ROLES)[number];

export interface User {
  servicioId: number | null;
  esCoordinador: boolean;
  servicio: Service | null;
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
  servicioId?: number;
  nombre: string;
  correo: string;
  password: string;
  rol: UserRole;
}

export interface CreateUserResponse {
  message: string;
  user: User;
}

export interface UpdateUserRequest {
  nombre?: string;
  correo?: string;
  password?: string;
  rol?: UserRole;
}

export interface UpdateUserResponse {
  message: string;
  user: User;
}

export interface UpdateUserStatusResponse {
  message: string;
  user: User;
}
export interface UserPage { users: User[]; total: number; page: number; limit: number; totalPages: number; }

const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:3000").replace(/\/$/, "");

export interface Service { id: number; codigo: string; nombre: string; activo: boolean }
export interface UserManagementPermissions {
  canManageUsers: boolean;
  isAdmin: boolean;
  userId: number;
  allowedRoles: UserRole[];
  servicio: Service | null;
  services: Service[];
  functionalTestAccess?: boolean;
}

export async function getUserPermissions(): Promise<UserManagementPermissions> {
  const response = await fetch(`${API_URL}/users/permissions`, { headers: getAuthHeaders(), cache: 'no-store' });
  return handleResponse<UserManagementPermissions>(response, 'No fue posible consultar los permisos', false);
}

const PERMISSIONS_CHANGED = 'users-permissions-changed';
export class UserRequestError extends Error {
  readonly status: number;
  constructor(message: string, status: number) { super(message); this.status = status; }
}

// Recheck open screens without trusting role/coordinator data in localStorage.
export function subscribeUserPermissions(
  onPermissions: (value: UserManagementPermissions) => void,
  onError: () => void,
) {
  let active = true;
  let generation = 0;
  const refresh = () => {
    const current = ++generation;
    const token = localStorage.getItem('token');
    getUserPermissions().then(value => {
      if (!active || current !== generation) return;
      if (token !== localStorage.getItem('token')) { onError(); return; }
      onPermissions(value);
    }).catch(() => { if (active && current === generation) onError(); });
  };
  const visible = () => { if (document.visibilityState === 'visible') refresh(); };
  window.addEventListener('focus', refresh);
  window.addEventListener('storage', refresh);
  window.addEventListener(PERMISSIONS_CHANGED, refresh);
  document.addEventListener('visibilitychange', visible);
  const timer = window.setInterval(visible, 30000);
  refresh();
  return () => {
    active = false;
    window.clearInterval(timer);
    window.removeEventListener('focus', refresh);
    window.removeEventListener('storage', refresh);
    window.removeEventListener(PERMISSIONS_CHANGED, refresh);
    document.removeEventListener('visibilitychange', visible);
  };
}

export async function updateUserScope(id: number, scope: { servicioId: number | null; esCoordinador: boolean }): Promise<UpdateUserResponse> {
  const response = await fetch(`${API_URL}/users/${id}/scope`, {
    method: 'PATCH', headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify(scope),
  });
  return handleResponse<UpdateUserResponse>(response, 'No fue posible actualizar el alcance');
}

// Obtiene el token JWT guardado al iniciar sesión.
function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem("token");

  if (!token) {
    throw new Error("Tu sesión no está disponible. Inicia sesión nuevamente.");
  }

  return {
    Authorization: `Bearer ${token}`,
  };
}

// Procesa los errores devueltos por el backend.
async function handleResponse<T>(
  response: Response,
  defaultMessage: string,
  notifyPermissions = true,
): Promise<T> {
  const data: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const statusMessages: Record<number, string> = {
      403: 'No tienes autorización para esta operación. Tus permisos pueden haber cambiado.',
      404: 'Usuario no encontrado o fuera de tu alcance autorizado.',
      409: 'La operación entra en conflicto con otro registro. Revisa los datos y vuelve a intentarlo.',
    };
    let message = statusMessages[response.status] ?? defaultMessage;

    if (typeof data === "object" && data !== null && "message" in data) {
      const errorMessage = data.message;

      if (Array.isArray(errorMessage)) {
        message = errorMessage.join(", ");
      } else if (typeof errorMessage === "string") {
        message = errorMessage;
      }
    }

    if (response.status === 401) {
      message = "Tu sesión ha expirado o no es válida. Inicia sesión nuevamente.";
    }
    if (notifyPermissions && [401, 403, 404].includes(response.status) && typeof window !== 'undefined') {
      window.dispatchEvent(new Event(PERMISSIONS_CHANGED));
    }
    throw new UserRequestError(message, response.status);
  }

  return data as T;
}

// CONSULTAR USUARIOS
export async function getUsers(): Promise<User[]> {
  const response = await fetch(`${API_URL}/users`, {
    method: "GET",
    headers: getAuthHeaders(),
  });

  return handleResponse<User[]>(
    response,
    "No fue posible consultar los usuarios",
  );
}

export async function searchUsers(filters: { search?: string; rol?: string; estado?: string; page: number; limit: number }): Promise<UserPage> {
  const query = new URLSearchParams(); Object.entries(filters).forEach(([key, value]) => { if (value !== undefined && String(value) !== "") query.set(key, String(value)); });
  return handleResponse<UserPage>(await fetch(`${API_URL}/users/search?${query}`, { headers: getAuthHeaders(), cache: 'no-store' }), 'No fue posible consultar los usuarios');
}

export async function getUser(id: number): Promise<User> {
  const response = await fetch(`${API_URL}/users/${id}`, { headers: getAuthHeaders() });
  return handleResponse<User>(response, 'Usuario no encontrado o fuera de alcance');
}

// CREAR USUARIO
export async function createUser(
  userData: CreateUserRequest,
): Promise<CreateUserResponse> {
  const response = await fetch(`${API_URL}/users`, {
    method: "POST",
    headers: {
      ...getAuthHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(userData),
  });

  return handleResponse<CreateUserResponse>(
    response,
    "No fue posible registrar el usuario",
  );
}

// ACTUALIZAR USUARIO
export async function updateUser(
  id: number,
  userData: UpdateUserRequest,
): Promise<UpdateUserResponse> {
  const response = await fetch(`${API_URL}/users/${id}`, {
    method: "PATCH",
    headers: {
      ...getAuthHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(userData),
  });

  return handleResponse<UpdateUserResponse>(
    response,
    "No fue posible actualizar el usuario",
  );
}

// ACTIVAR O DESACTIVAR USUARIO
export async function updateUserStatus(
  id: number,
  activo: boolean,
): Promise<UpdateUserStatusResponse> {
  const response = await fetch(`${API_URL}/users/${id}/status`, {
    method: "PATCH",
    headers: {
      ...getAuthHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ activo }),
  });

  return handleResponse<UpdateUserStatusResponse>(
    response,
    "No fue posible actualizar el estado del usuario",
  );
}
