export interface LoginRequest {
  email: string;
  password: string;
  captchaToken: string;
}

export interface LoginUser {
  id: number;
  nombre: string;
  email: string;
  activo: boolean;
}

export interface LoginResponse {
  success: boolean;
  message: string;
  token: string;
  user: LoginUser;
}

const API_URL = "http://localhost:3000";

export async function loginUser(
  credentials: LoginRequest,
): Promise<LoginResponse> {
  const response = await fetch(`${API_URL}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(credentials),
  });

  const data = await response.json();

  if (!response.ok) {
    const message = Array.isArray(data.message)
      ? data.message.join(", ")
      : data.message || "No fue posible iniciar sesión";

    throw new Error(message);
  }

  return data;
}
