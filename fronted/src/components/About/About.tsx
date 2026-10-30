import { HeartPulse, ShieldCheck, Workflow } from "lucide-react";

import "./About.css";

function About() {
  return (
    <section className="about" id="nosotros">
      <div className="about-container">
        <div className="about-heading">
          <span className="about-eyebrow">SOBRE SISTEMA007</span>

          <h2>Tecnología para una gestión farmacéutica más segura</h2>

          <p>
            Sistema007 integra procesos clínicos y farmacéuticos en una sola
            plataforma, facilitando el control de la información y la
            trazabilidad de cada proceso.
          </p>
        </div>

        <div className="about-values">
          <article className="about-value">
            <div className="about-value-icon">
              <HeartPulse size={22} strokeWidth={1.8} />
            </div>

            <div>
              <h3>Seguridad del paciente</h3>
              <p>
                Apoya el control de la atención y la dispensación para reducir
                errores.
              </p>
            </div>
          </article>

          <article className="about-value">
            <div className="about-value-icon">
              <Workflow size={22} strokeWidth={1.8} />
            </div>

            <div>
              <h3>Procesos integrados</h3>
              <p>
                Conecta la información clínica y farmacéutica en un mismo flujo
                de trabajo.
              </p>
            </div>
          </article>

          <article className="about-value">
            <div className="about-value-icon">
              <ShieldCheck size={22} strokeWidth={1.8} />
            </div>

            <div>
              <h3>Control y trazabilidad</h3>
              <p>
                Facilita el seguimiento de los procesos y de la información
                registrada.
              </p>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}

export default About;
