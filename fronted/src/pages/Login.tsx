import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import ReCAPTCHA from "react-google-recaptcha";

import { loginUser } from "../services/auth.service";

import "../styles/Login.css";

function Login() {
  const navigate = useNavigate();

  const captchaRef = useRef<ReCAPTCHA>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;

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

      localStorage.setItem("token", response.token);
      localStorage.setItem("user", JSON.stringify(response.user));

      navigate("/dashboard");
    } catch (error) {
      if (error instanceof Error) {
        setMessage(error.message);
      } else {
        setMessage("No fue posible iniciar sesión");
      }

      // Reiniciar CAPTCHA después de un intento fallido.
      captchaRef.current?.reset();
      setCaptchaToken(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-page">
      <section className="login-card">
        <h1>Sistema007</h1>

        <p>Inicia sesión para acceder a la plataforma</p>

        <form onSubmit={handleSubmit}>
          <label htmlFor="email">Correo electrónico</label>

          <input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="correo@sistema007.com"
            required
          />

          <label htmlFor="password">Contraseña</label>

          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Ingresa tu contraseña"
            required
          />

          <div
            style={{
              display: "flex",
              justifyContent: "center",
              margin: "20px 0",
            }}
          >
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

          {message && <div className="login-message">{message}</div>}

          <button type="submit" disabled={loading || !captchaToken}>
            {loading ? "Ingresando..." : "Iniciar sesión"}
          </button>
        </form>

        <button
          type="button"
          className="back-button"
          onClick={() => navigate("/")}
        >
          Volver al inicio
        </button>
      </section>
    </main>
  );
}

export default Login;
