import { CircleHelp, LogIn, ShieldCheck } from "lucide-react";

import "./Contact.css";

function Contact() {
  return (
    <section className="contact" id="contacto">
      <div className="contact-container">
        <div className="contact-heading">
          <span className="contact-eyebrow">CONTACTO Y ACCESO</span>

          <h2>¿Necesitas acceder a Sistema007?</h2>

          <p>
            Sistema007 está diseñado para el personal autorizado encargado de
            los procesos clínicos y farmacéuticos de la institución.
          </p>
        </div>

        <div className="contact-content">
          <article className="contact-card">
            <div className="contact-icon">
              <LogIn size={23} strokeWidth={1.8} />
            </div>

            <div className="contact-card-text">
              <h3>Acceso a la plataforma</h3>

              <p>
                El acceso a Sistema007 está disponible para usuarios autorizados
                de acuerdo con las funciones y permisos asignados a su rol.
              </p>
            </div>
          </article>

          <article className="contact-card">
            <div className="contact-icon">
              <CircleHelp size={23} strokeWidth={1.8} />
            </div>

            <div className="contact-card-text">
              <h3>Soporte de acceso</h3>

              <p>
                Si presentas inconvenientes con el acceso, comunícate con el
                responsable autorizado de la plataforma en la institución.
              </p>
            </div>
          </article>

          <article className="contact-card">
            <div className="contact-icon">
              <ShieldCheck size={23} strokeWidth={1.8} />
            </div>

            <div className="contact-card-text">
              <h3>Acceso seguro</h3>

              <p>
                El acceso al sistema está protegido y limitado de acuerdo con
                los permisos asignados a cada usuario.
              </p>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}

export default Contact;
