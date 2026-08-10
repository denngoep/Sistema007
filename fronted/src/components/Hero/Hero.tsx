import "./Hero.css";
import heroImage from "../../assets/hero-sistema007.png";

function Hero() {
  return (
    <section className="hero">
      <div className="hero-text">
        <h1>Gestión farmacéutica inteligente</h1>

        <p>
          Plataforma desarrollada para optimizar la dispensación de
          medicamentos, mejorar la trazabilidad y fortalecer la seguridad del
          paciente.
        </p>

        <div className="hero-buttons">
          <button className="btn-primary">Iniciar sesión</button>
          <button className="btn-secondary">Conocer más</button>
        </div>
      </div>

      <div className="hero-image">
        <img src={heroImage} alt="Sistema007" />
      </div>
    </section>
  );
}

export default Hero;
