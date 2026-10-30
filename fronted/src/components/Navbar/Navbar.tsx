import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ArrowUpRight,
  House,
  Layers3,
  Building2,
  Mail,
  Menu,
  X,
} from "lucide-react";

import "./Navbar.css";
import logoSistema007 from "../../assets/logo-sistema007.png";

const menuItems = [
  { label: "Inicio", hash: "", Icon: House },
  { label: "Características", hash: "#caracteristicas", Icon: Layers3 },
  { label: "Nosotros", hash: "#nosotros", Icon: Building2 },
  { label: "Contacto", hash: "#contacto", Icon: Mail },
];

function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();

  const [menuOpen, setMenuOpen] = useState(false);

  const activeSection = location.hash || "";

  const handleNavigation = (hash: string) => {
    setMenuOpen(false);

    if (!hash) {
      navigate("/");

      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });

      return;
    }

    const sectionId = hash.replace("#", "");

    navigate(`/${hash}`);

    setTimeout(() => {
      const section = document.getElementById(sectionId);

      if (!section) return;

      const navbar = document.querySelector(".navbar") as HTMLElement | null;

      const navbarHeight = navbar?.offsetHeight ?? 88;

      const sectionPosition =
        section.getBoundingClientRect().top + window.scrollY;

      window.scrollTo({
        top: sectionPosition - navbarHeight,
        behavior: "smooth",
      });
    }, 0);
  };

  return (
    <header className="navbar">
      <a
        className="navbar-brand"
        href="/"
        aria-label="Sistema007 - Inicio"
        onClick={(event) => {
          event.preventDefault();
          handleNavigation("");
        }}
      >
        <img
          src={logoSistema007}
          alt="Símbolo de Sistema007"
          className="navbar-logo"
        />

        <span className="navbar-brand-name">
          Sistema<span>007</span>
        </span>
      </a>

      <nav
        id="navbar-menu"
        className={`menu ${menuOpen ? "menu-open" : ""}`}
        aria-label="Navegación principal"
      >
        {menuItems.map(({ label, hash, Icon }) => (
          <a
            key={label}
            href={`/${hash}`}
            className={
              activeSection === hash ? "menu-link active" : "menu-link"
            }
            aria-current={activeSection === hash ? "page" : undefined}
            onClick={(event) => {
              event.preventDefault();
              handleNavigation(hash);
            }}
          >
            <Icon size={17} strokeWidth={1.9} />
            <span>{label}</span>
          </a>
        ))}
      </nav>

      <div className="navbar-actions">
        <button
          type="button"
          className="btn-login"
          onClick={() => navigate("/login")}
        >
          <span>Iniciar sesión</span>
          <ArrowUpRight size={18} strokeWidth={2} />
        </button>

        <button
          type="button"
          className="navbar-toggle"
          aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
          aria-controls="navbar-menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(!menuOpen)}
        >
          {menuOpen ? <X size={23} /> : <Menu size={23} />}
        </button>
      </div>
    </header>
  );
}

export default Navbar;
