import { UsersRound, Pill, PackageSearch, ClipboardCheck } from "lucide-react";

import "./Features.css";

const features = [
  {
    Icon: UsersRound,
    number: "01",
    title: "Gestión de pacientes",
    description:
      "Centraliza la información del paciente y facilita su consulta durante los diferentes procesos asistenciales.",
  },
  {
    Icon: Pill,
    number: "02",
    title: "Dispensación segura",
    description:
      "Valida la formulación, registra la entrega y genera trazabilidad para reducir errores y evitar dispensaciones duplicadas.",
  },
  {
    Icon: PackageSearch,
    number: "03",
    title: "Inventario y medicamentos",
    description:
      "Facilita el control de medicamentos, existencias y movimientos asociados al proceso farmacéutico.",
  },
  {
    Icon: ClipboardCheck,
    number: "04",
    title: "Reporte y trazabilidad",
    description:
      "Permite consultar la información necesaria para el seguimiento de los procesos, la auditoría y la toma de decisiones.",
  },
];

function Features() {
  return (
    <section className="features" id="caracteristicas">
      <div className="features-container">
        <div className="features-header">
          <span className="features-eyebrow">CAPACIDADES DEL SISTEMA</span>

          <h2>
            Gestión integral para los
            <span> procesos farmacéuticos</span>
          </h2>

          <p>
            Sistema007 integra procesos clínicos, administrativos y
            farmacéuticos para fortalecer la seguridad, el control y la
            trazabilidad de la información.
          </p>
        </div>

        <div className="features-grid">
          {features.map(({ Icon, number, title, description }) => (
            <article className="feature-card" key={title}>
              <div className="feature-card-top">
                <div className="feature-icon">
                  <Icon size={25} strokeWidth={1.8} />
                </div>

                <span className="feature-number">{number}</span>
              </div>

              <h3>{title}</h3>
              <p>{description}</p>

              <div className="feature-line" />
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export default Features;
