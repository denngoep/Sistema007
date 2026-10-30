import "./Footer.css";

import logoSistema007 from "../../assets/logo-sistema007.png";

function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="footer-content">
        <a className="footer-brand" href="#inicio">
          <img
            src={logoSistema007}
            alt="Símbolo de Sistema007"
            className="footer-logo"
          />

          <div className="footer-brand-info">
            <span className="footer-brand-name">
              Sistema<span>007</span>
            </span>
          </div>
        </a>

        <nav className="footer-links" aria-label="Navegación del pie de página">
          <a href="#inicio">Inicio</a>
          <a href="#caracteristicas">Características</a>
          <a href="#nosotros">Nosotros</a>
          <a href="#contacto">Contacto</a>
        </nav>
      </div>

      <div className="footer-bottom">
        <p>© {currentYear} Sistema007. Todos los derechos reservados.</p>
      </div>
    </footer>
  );
}

export default Footer;
