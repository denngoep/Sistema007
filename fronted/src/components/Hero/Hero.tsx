import { ArrowRight, Plus } from "lucide-react";

import heroImage from "../../assets/hero-sistema007-nuevo.png";
import "./Hero.css";

function Hero() {
  const handleConocerMas = () => {
    document.getElementById("caracteristicas")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  return (
    <section className="hero" id="inicio">
      <img
        src={heroImage}
        alt=""
        className="hero-background-image"
        aria-hidden="true"
      />

      <div className="hero-background-overlay" />

      <div className="hero-content">
        <div className="hero-text">
          <div className="hero-label">
            <span className="hero-label-icon">
              <Plus size={14} strokeWidth={3} />
            </span>

            <span>GESTIÓN CLÍNICA Y FARMACÉUTICA</span>
          </div>

          <h1>
            Gestión farmacéutica
            <span> inteligente y segura.</span>
          </h1>

          <p>Dispensación, inventario y trazabilidad en una sola plataforma.</p>

          <button
            type="button"
            className="hero-more-button"
            onClick={handleConocerMas}
          >
            Conocer más
            <ArrowRight size={18} strokeWidth={2} />
          </button>
        </div>
      </div>

      <div className="hero-scroll-indicator">
        <span>Explora Sistema007</span>
        <div className="hero-scroll-line" />
      </div>
    </section>
  );
}

export default Hero;
