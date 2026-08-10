import "./Features.css";

function Features() {
  return (
    <section className="features" id="caracteristicas">
      <div className="features-header">
        <span>CAPACIDADES DEL SISTEMA</span>

        <h2>
          Una plataforma para gestionar el proceso farmacéutico de principio a
          fin
        </h2>

        <p>
          Sistema007 integra los procesos clínicos, administrativos y
          farmacéuticos para mejorar la seguridad, el control y la trazabilidad
        </p>
      </div>

      <div className="features-grid">
        <article className="feature-card">
          <h3>Gestión de pacientes</h3>
          <p>
            Centraliza la información del paciente y facilita su consulta
            durante los diferentes procesos asitenciales.
          </p>
        </article>

        <article className="feature-card">
          <h3>Dispensación segura</h3>
          <p>
            Valida la formulación, registra la entrega y genera trazabilidad
            para reducir errores y evitar dispensaciones duplicadas.
          </p>
        </article>

        <article className="feature-card">
          <h3>Inventario y medicamentos</h3>
          <p>
            Controla existencias, lotes, vencimientos y movimientos del
            inventario en tiempo real.
          </p>
        </article>

        <article className="feature-card">
          <h3>Reporte y trazabilidad</h3>
          <p>
            Permite consultar la información necesaria para seguimiento,
            auditoría y toma de decisiones.
          </p>
        </article>
      </div>
    </section>
  );
}

export default Features;
