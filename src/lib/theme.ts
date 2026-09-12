import { useEffect, useState } from "react";

const STORAGE_KEY = "aziiki_theme";
export type Theme = "light" | "dark";

function readInitialTheme(): Theme {
  // The pre-paint script in index.html already set this on <html> before
  // React ever mounted - read it back rather than re-deriving from
  // localStorage/matchMedia, so this hook's first render always agrees
  // with what's already on screen.
  const attr = document.documentElement.getAttribute("data-theme");
  return attr === "dark" ? "dark" : "light";
}

/**
 * Shared light/dark theme state, backed by a `data-theme` attribute on
 * <html> (which every `dark:` utility class in the app is keyed to - see
 * the @custom-variant in index.css) and persisted to localStorage. Any
 * component can call this; they all read/write the same single source of
 * truth, so a toggle anywhere in the app (main app sidebar, admin portal)
 * affects the whole page immediately.
 */
export function useTheme(): { theme: Theme; toggleTheme: () => void } {
  const [theme, setTheme] = useState<Theme>(readInitialTheme);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Private mode / storage blocked - the toggle still works for the
      // rest of this page load, just won't be remembered next visit.
    }
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  return { theme, toggleTheme };
}
