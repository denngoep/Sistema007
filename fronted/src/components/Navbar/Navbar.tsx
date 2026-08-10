import "./Navbar.css";

function Navbar() {
  return (
    <header className="navbar">
      <div className="logo">Sistema007</div>

      <nav className="menu">
        <a href="#">Inicio</a>
        <a href="#">Características</a>
        <a href="#">Nosotros</a>
        <a href="#">Contacto</a>
      </nav>

      <button className="btn-login">Iniciar sesión</button>
    </header>
  );
}

export default Navbar;
