import React from "react";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";

interface ThemeToggleProps {
  className?: string;
  size?: "sm" | "md";
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  className = "",
  size = "md",
}) => {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  const buttonLabel = isDark ? "Switch to light mode" : "Switch to dark mode";
  const iconSizeClass = size === "sm" ? "w-4 h-4" : "w-4.5 h-4.5";
  const paddingClass = size === "sm" ? "p-1.5" : "p-2";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={buttonLabel}
      title={buttonLabel}
      className={`inline-flex items-center justify-center rounded-xl border transition-colors duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-sky focus-visible:ring-offset-2 ${
        isDark
          ? "bg-slate-800 hover:bg-slate-700 text-amber-300 border-slate-700 focus-visible:ring-offset-slate-900"
          : "bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-navy border-slate-200 focus-visible:ring-offset-white"
      } ${paddingClass} ${className}`}
    >
      {isDark ? (
        <Moon className={`${iconSizeClass} transition-transform duration-200 active:scale-90`} aria-hidden="true" />
      ) : (
        <Sun className={`${iconSizeClass} text-amber-500 transition-transform duration-200 active:scale-90`} aria-hidden="true" />
      )}
    </button>
  );
};

export default ThemeToggle;
