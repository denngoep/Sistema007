import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

type Theme = "light" | "dark";
const key = "s007-theme";

function apply(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(key, theme);
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() =>
    localStorage.getItem(key) === "dark" ? "dark" : "light",
  );
  useEffect(() => apply(theme), [theme]);
  const dark = theme === "dark";
  return <button type="button" className="theme-toggle" aria-label={dark ? "Activar modo claro" : "Activar modo oscuro"} title={dark ? "Activar modo claro" : "Activar modo oscuro"} aria-pressed={dark} onClick={() => setTheme(dark ? "light" : "dark")}>
    {dark ? <Sun size={19} aria-hidden="true" /> : <Moon size={19} aria-hidden="true" />}
  </button>;
}
