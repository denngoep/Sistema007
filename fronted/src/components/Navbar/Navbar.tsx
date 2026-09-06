import { useNavigate } from "react-router-dom";
import "./Navbar.css";

function Navbar() {
  const navigate = useNavigate();

  return (
    <header className="navbar">
      <div className="logo">Sistema007</div>

      <nav className="menu">
        <a href="#">Inicio</a>
        <a href="#">Características</a>
        <a href="#">Nosotros</a>
        <a href="#">Contacto</a>
      </nav>

      <button className="btn-login" onClick={() => navigate("/login")}>
        Iniciar sesión
      </button>
    </header>
  );
}

export default Navbar;
