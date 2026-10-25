import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";

import "../styles/ForgotPassword.css";

const API_URL = "http://localhost:3000/api/auth";

function PasswordEye({ visible }: { visible: boolean }) {
  return visible ? (
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
  );
}

function ForgotPassword() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [codigo, setCodigo] = useState("");
  const [nuevaPassword, setNuevaPassword] = useState("");
  const [confirmarPassword, setConfirmarPassword] = useState("");

  const [showNuevaPassword, setShowNuevaPassword] = useState(false);
  const [showConfirmarPassword, setShowConfirmarPassword] = useState(false);

  const [paso, setPaso] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // PASO 1: SOLICITAR CÓDIGO POR CORREO
  const solicitarCodigo = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setLoading(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch(`${API_URL}/forgot-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          Array.isArray(data.message)
            ? data.message.join(", ")
            : data.message || "No fue posible solicitar el código",
        );
      }

      setMessage("");
      setPaso(2);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Ocurrió un error al solicitar el código",
      );
    } finally {
      setLoading(false);
    }
  };

  // PASO 2: RESTABLECER CONTRASEÑA
  const restablecerPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setMessage("");
    setError("");

    if (!/^\d{6}$/.test(codigo.trim())) {
      setError("El código debe contener 6 dígitos numéricos.");
      return;
    }

    if (nuevaPassword !== confirmarPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    if (
      nuevaPassword.length < 8 ||
      !/[A-Z]/.test(nuevaPassword) ||
      !/[a-z]/.test(nuevaPassword) ||
      !/[0-9]/.test(nuevaPassword)
    ) {
      setError(
        "La contraseña debe tener mínimo 8 caracteres, una mayúscula, una minúscula y un número.",
      );
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/reset-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim(),
          codigo: codigo.trim(),
          nuevaPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          Array.isArray(data.message)
            ? data.message.join(", ")
            : data.message || "No fue posible cambiar la contraseña",
        );
      }

      setMessage(
        "Tu contraseña fue actualizada correctamente. Ya puedes iniciar sesión.",
      );

      setCodigo("");
      setNuevaPassword("");
      setConfirmarPassword("");
      setPaso(3);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Ocurrió un error al cambiar la contraseña",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="recovery-page">
      <div className="recovery-content">
        {/* IDENTIDAD DE SISTEMA007 */}
        <header className="recovery-brand">
          <h1>
            Sistema<span>007</span>
          </h1>
          <p>Gestión clínica y farmacéutica</p>
        </header>

        {/* TARJETA PRINCIPAL */}
        <section className="recovery-card">
          <div className="recovery-header">
            <h2>
              {paso === 1
                ? "Recuperar contraseña"
                : paso === 2
                  ? "Nueva contraseña"
                  : "Contraseña actualizada"}
            </h2>

            <p>
              {paso === 1
                ? "Ingresa tu correo para recibir un código de verificación."
                : paso === 2
                  ? "Ingresa el código enviado a tu correo."
                  : "Tu cuenta está lista para iniciar sesión."}
            </p>
          </div>

          {/* PASO 1: SOLICITAR CÓDIGO */}
          {paso === 1 && (
            <form className="recovery-form" onSubmit={solicitarCodigo}>
              <label htmlFor="recovery-email">Correo electrónico</label>

              <input
                id="recovery-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Ingresa tu correo registrado"
                autoComplete="email"
                required
              />

              <button
                type="submit"
                className="recovery-submit"
                disabled={loading}
              >
                {loading ? "Enviando..." : "Enviar código"}
              </button>
            </form>
          )}

          {/* PASO 2: NUEVA CONTRASEÑA */}
          {paso === 2 && (
            <form className="recovery-form" onSubmit={restablecerPassword}>
              <label htmlFor="recovery-code">Código de verificación</label>

              <input
                id="recovery-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                pattern="[0-9]{6}"
                value={codigo}
                onChange={(event) =>
                  setCodigo(event.target.value.replace(/\D/g, ""))
                }
                placeholder="Ingresa los 6 dígitos"
                required
              />

              <label htmlFor="nuevaPassword">Nueva contraseña</label>

              <div className="recovery-password-field">
                <input
                  id="nuevaPassword"
                  type={showNuevaPassword ? "text" : "password"}
                  value={nuevaPassword}
                  onChange={(event) => setNuevaPassword(event.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  autoComplete="new-password"
                  minLength={8}
                  required
                />

                <button
                  type="button"
                  className="recovery-password-toggle"
                  onClick={() => setShowNuevaPassword((prev) => !prev)}
                  aria-label={
                    showNuevaPassword
                      ? "Ocultar contraseña"
                      : "Mostrar contraseña"
                  }
                  aria-pressed={showNuevaPassword}
                >
                  <PasswordEye visible={showNuevaPassword} />
                </button>
              </div>

              <label htmlFor="confirmarPassword">
                Confirmar nueva contraseña
              </label>

              <div className="recovery-password-field">
                <input
                  id="confirmarPassword"
                  type={showConfirmarPassword ? "text" : "password"}
                  value={confirmarPassword}
                  onChange={(event) => setConfirmarPassword(event.target.value)}
                  placeholder="Repite la contraseña"
                  autoComplete="new-password"
                  required
                />

                <button
                  type="button"
                  className="recovery-password-toggle"
                  onClick={() => setShowConfirmarPassword((prev) => !prev)}
                  aria-label={
                    showConfirmarPassword
                      ? "Ocultar contraseña"
                      : "Mostrar contraseña"
                  }
                  aria-pressed={showConfirmarPassword}
                >
                  <PasswordEye visible={showConfirmarPassword} />
                </button>
              </div>

              <button
                type="submit"
                className="recovery-submit"
                disabled={loading}
              >
                {loading ? "Actualizando..." : "Cambiar contraseña"}
              </button>

              <button
                type="button"
                className="recovery-secondary"
                onClick={() => {
                  setPaso(1);
                  setCodigo("");
                  setMessage("");
                  setError("");
                }}
              >
                Solicitar otro código
              </button>
            </form>
          )}

          {/* PASO 3: CONFIRMACIÓN */}
          {paso === 3 && (
            <button
              type="button"
              className="recovery-submit"
              onClick={() => navigate("/login")}
            >
              Ir a iniciar sesión
            </button>
          )}

          {/* MENSAJES */}
          {message && (
            <p className="recovery-success" role="status">
              {message}
            </p>
          )}

          {error && (
            <p className="recovery-error" role="alert">
              {error}
            </p>
          )}
        </section>

        {/* VOLVER AL LOGIN */}
        {paso !== 3 && (
          <button
            type="button"
            className="recovery-back"
            onClick={() => navigate("/login")}
          >
            Volver al inicio de sesión
          </button>
        )}
      </div>

      {/* PIE DE PÁGINA */}
      <footer className="recovery-footer">
        Sistema007 © 2026 · Gestión inteligente y segura
      </footer>
    </main>
  );
}

export default ForgotPassword;
