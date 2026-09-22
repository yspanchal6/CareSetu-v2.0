/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        sky: { DEFAULT: "#38BDF8" },
        navy: { DEFAULT: "#0B2545", dark: "#0F4C81" },
        lightblue: "#E0F2FE",
        paleblue: "#F0F9FF",
        bg: "#F8FAFC",
        accent: { DEFAULT: "#FACC15", dark: "#EAB308" },
        success: "#22C55E",
        emergency: "#EF4444",
        text: { DEFAULT: "#1E293B", secondary: "#64748B" },
      },
      fontFamily: {
        sans: ["Manrope", "Inter", "system-ui", "sans-serif"],
      },
      borderRadius: {
        card: "14px",
      },
      boxShadow: {
        soft: "0 2px 12px rgba(11,37,69,0.06)",
        card: "0 1px 3px rgba(11,37,69,0.08), 0 1px 2px rgba(11,37,69,0.04)",
      },
      keyframes: {
        pulseRing: {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(56, 189, 248, 0.7)" },
          "50%": { boxShadow: "0 0 0 12px rgba(56, 189, 248, 0)" },
        },
        slideUp: {
          "0%": { transform: "translateY(20px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
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
        slideUp: "slideUp 0.35s ease-out",
        shake: "shake 0.4s ease-in-out",
        fadeIn: "fadeIn 0.25s ease-out",
        greenFlash: "greenFlash 1s ease-out",
        expandRadius: "expandRadius 2.2s ease-out infinite",
      },
    },
  },
  plugins: [],
};
