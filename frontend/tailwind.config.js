/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        sky: { DEFAULT: "#0EA5E9", dark: "#0284C7", light: "#E0F2FE" },
        navy: { DEFAULT: "#0B2545", dark: "#07172C", light: "#1E3A5F" },
        primary: {
          50: "#F0F9FF",
          100: "#E0F2FE",
          200: "#BAE6FD",
          300: "#7DD3FC",
          400: "#38BDF8",
          500: "#0EA5E9",
          600: "#0284C7",
          700: "#0369A1",
          800: "#075985",
          900: "#0C4A6E",
        },
        slate: {
          850: "#131C2E",
          950: "#080D1A",
        },
        accent: { DEFAULT: "#FACC15", dark: "#EAB308", light: "#FEF08A" },
        success: { DEFAULT: "#10B981", light: "#D1FAE5", dark: "#047857" },
        warning: { DEFAULT: "#F59E0B", light: "#FEF3C7", dark: "#B45309" },
        error: { DEFAULT: "#EF4444", light: "#FEE2E2", dark: "#B91C1C" },
        emergency: { DEFAULT: "#DC2626", glow: "#F87171", dark: "#991B1B" },
        info: { DEFAULT: "#3B82F6", light: "#DBEAFE" },
      },
      fontFamily: {
        sans: ["Manrope", "Inter", "system-ui", "sans-serif"],
      },
      borderRadius: {
        card: "16px",
        pill: "9999px",
      },
      boxShadow: {
        soft: "0 4px 20px -2px rgba(11,37,69,0.08)",
        card: "0 2px 8px -1px rgba(11,37,69,0.06), 0 1px 3px -1px rgba(11,37,69,0.04)",
        glow: "0 0 20px -3px rgba(14, 165, 233, 0.35)",
        emergency: "0 0 25px -2px rgba(220, 38, 38, 0.4)",
      },
      keyframes: {
        pulseRing: {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(14, 165, 233, 0.6)" },
          "50%": { boxShadow: "0 0 0 14px rgba(14, 165, 233, 0)" },
        },
        slideUp: {
          "0%": { transform: "translateY(16px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        scaleUp: {
          "0%": { transform: "scale(0.95)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        shake: {
          "0%, 100%": { transform: "translateX(0)" },
          "25%": { transform: "translateX(-4px)" },
          "75%": { transform: "translateX(4px)" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        greenFlash: {
          "0%": { backgroundColor: "#D1FAE5" },
          "50%": { backgroundColor: "#10B981", color: "white" },
          "100%": { backgroundColor: "#D1FAE5" },
        },
        expandRadius: {
          "0%": { transform: "scale(0.3)", opacity: "0.9" },
          "100%": { transform: "scale(1)", opacity: "0" },
        },
      },
      animation: {
        pulseRing: "pulseRing 2s infinite",
        slideUp: "slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
        scaleUp: "scaleUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
        shake: "shake 0.4s ease-in-out",
        fadeIn: "fadeIn 0.2s ease-out",
        greenFlash: "greenFlash 1s ease-out",
        expandRadius: "expandRadius 2.2s ease-out infinite",
      },
    },
  },
  plugins: [],
};
