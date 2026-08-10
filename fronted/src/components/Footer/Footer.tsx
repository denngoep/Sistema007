import "./Footer.css";

function Footer() {
  return (
    <footer className="footer">
      <div className="footer-content">
        <div className="footer-brand">
          <h3>Sistema007</h3>
          <p>Gestión farmacéutica inteligente, segura y trazable.</p>
        </div>

        <div className="footer-links">
          <a href="#">Inicio</a>
          <a href="#caracteristicas">Características</a>
          <a href="#">Nosotros</a>
          <a href="#">Contacto</a>
        </div>
      </div>

      <div className="footer-bottom">
        <p>© 2026 Sistema007. Todos los derechos reservados.</p>
      </div>
    </footer>
  );
}

export default Footer;
