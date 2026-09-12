import React from "react";
import { Sun, Moon } from "@phosphor-icons/react";
import { useTheme } from "../lib/theme";

interface ThemeToggleProps {
  className?: string;
  /** Shows "Light mode"/"Dark mode" next to the icon - for a full-width row
   * (sidebar, mobile sheet); omit for a bare icon-only button. */
  showLabel?: boolean;
}

/** Sun/moon icon button that flips the app's light/dark theme - see
 * src/lib/theme.ts for the shared state this reads and writes. */
export default function ThemeToggle({ className = "", showLabel = false }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className={`flex items-center rounded-xl transition-colors cursor-pointer ${className}`}
    >
      {isDark ? <Sun className="w-4 h-4 shrink-0" /> : <Moon className="w-4 h-4 shrink-0" />}
      {showLabel && <span>{isDark ? "Light mode" : "Dark mode"}</span>}
    </button>
  );
}
