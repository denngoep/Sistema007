import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import ReCAPTCHA from "react-google-recaptcha";
import { GoogleLogin, GoogleOAuthProvider } from "@react-oauth/google";

import { loginUser } from "../services/auth.service";
import "../styles/Login.css";

type AuthResponse = {
  success: boolean;
  message: string;
  token: string;
  user: {
    id: number;
    nombre: string;
    email: string;
    activo: boolean;
  };
};

function Login() {
  const navigate = useNavigate();
  const captchaRef = useRef<ReCAPTCHA>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  const saveSession = (response: AuthResponse) => {
    localStorage.setItem("token", response.token);
    localStorage.setItem("user", JSON.stringify(response.user));
    navigate("/dashboard");
  };

  // INICIO DE SESIÓN CON CORREO Y CONTRASEÑA
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");

    if (!captchaToken) {
      setMessage("Debes completar la verificación No soy un robot");
      return;
    }

    setLoading(true);

    try {
      const response = await loginUser({
        email,
        password,
        captchaToken,
      });

      saveSession(response);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "No fue posible iniciar sesión",
      );

      captchaRef.current?.reset();
      setCaptchaToken(null);
    } finally {
      setLoading(false);
    }
  };

  // INICIO DE SESIÓN ALTERNATIVO CON GOOGLE
  const handleGoogleLogin = async (credential: string) => {
    setMessage("");
    setGoogleLoading(true);

    try {
      const response = await fetch("http://localhost:3000/api/auth/google", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ credential }),
      });

      const data: unknown = await response.json();

      if (!response.ok) {
        if (typeof data === "object" && data !== null && "message" in data) {
          const errorMessage = data.message;

          throw new Error(
            typeof errorMessage === "string"
              ? errorMessage
              : "No fue posible iniciar sesión con Google",
          );
        }

        throw new Error("No fue posible iniciar sesión con Google");
      }

      const authData = data as AuthResponse;

      if (!authData.token || !authData.user) {
        throw new Error("Respuesta de autenticación inválida");
      }

      saveSession(authData);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "No fue posible iniciar sesión con Google",
      );
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <main className="login-page">
      <div className="login-layout">
        {/* IDENTIDAD INSTITUCIONAL */}
        <header className="login-identity">
          <h1>
            Sistema<span>007</span>
          </h1>
          <p>Gestión clínica y farmacéutica</p>
        </header>

        {/* FORMULARIO */}
        <section className="login-card">
          <div className="login-form-header">
            <h2>Iniciar sesión</h2>
            <p>Acceso a Sistema007</p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="login-field">
              <label htmlFor="email">Correo electrónico</label>

              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Ingresa tu correo electrónico"
                autoComplete="username"
                required
              />
            </div>

            <div className="login-field">
              <label htmlFor="password">Contraseña</label>

              <div className="password-field">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Ingresa tu contraseña"
                  autoComplete="current-password"
                  required
                />

                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword((previous) => !previous)}
                  aria-label={
                    showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
                  }
                  aria-pressed={showPassword}
                >
                  {showPassword ? (
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M3 3l18 18" />
                      <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
                      <path d="M9.9 5.2A10.8 10.8 0 0 1 12 5c5 0 9 4 10 7a12.7 12.7 0 0 1-3.1 4.4" />
                      <path d="M6.2 6.2C4.2 7.5 2.8 9.6 2 12c1 3 5 7 10 7a10.7 10.7 0 0 0 4.1-.8" />
                    </svg>
                  ) : (
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* CAPTCHA */}
            <div className="login-captcha">
              {siteKey ? (
                <ReCAPTCHA
                  ref={captchaRef}
                  sitekey={siteKey}
                  onChange={(token) => {
                    setCaptchaToken(token);
                    setMessage("");
                  }}
                  onExpired={() => setCaptchaToken(null)}
                  onErrored={() => {
                    setCaptchaToken(null);
                    setMessage("Error al verificar el CAPTCHA");
                  }}
                />
              ) : (
                <p>Google reCAPTCHA no está configurado.</p>
              )}
            </div>

            {message && (
              <div className="login-message" role="alert">
                {message}
              </div>
            )}

            {/* ACCIONES */}
            <div className="login-actions">
              <button
                type="button"
                className="login-recovery-button"
                onClick={() => navigate("/forgot-password")}
              >
                ¿Olvidaste tu contraseña?
              </button>

              <button
                type="submit"
                className="login-submit"
                disabled={loading || !captchaToken || googleLoading}
              >
                {loading ? "Ingresando..." : "Iniciar sesión"}
              </button>
            </div>
          </form>

          {/* INICIO DE SESIÓN CON GOOGLE */}
          <div className="login-google-section">
            <div className="login-google-divider">
              <span>O continúa con</span>
            </div>

            {googleClientId ? (
              <GoogleOAuthProvider clientId={googleClientId}>
                <div className="login-google-button">
                  {googleLoading ? (
                    <p>Verificando cuenta de Google...</p>
                  ) : (
                    <GoogleLogin
                      onSuccess={(credentialResponse) => {
                        if (credentialResponse.credential) {
                          void handleGoogleLogin(credentialResponse.credential);
                        } else {
                          setMessage(
                            "Google no devolvió una credencial válida",
                          );
                        }
                      }}
                      onError={() => {
                        setMessage("No fue posible iniciar sesión con Google");
                      }}
                      theme="outline"
                      size="large"
                      text="continue_with"
                      shape="rectangular"
                      width="300"
                    />
                  )}
                </div>
              </GoogleOAuthProvider>
            ) : (
              <p>El inicio de sesión con Google no está configurado.</p>
            )}
          </div>
        </section>

        <button
          type="button"
          className="login-back-link"
          onClick={() => navigate("/")}
        >
          Volver al inicio
        </button>
      </div>

      <footer className="login-footer">
        Sistema007 © {new Date().getFullYear()} · Gestión inteligente y segura
      </footer>
    </main>
  );
}

export default Login;
