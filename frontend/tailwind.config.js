/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"DM Sans"', "system-ui", "-apple-system", "sans-serif"],
        display: ['"Bricolage Grotesque"', '"DM Sans"', "system-ui", "sans-serif"],
      },
      colors: {
        // Violet "studio" palette
        primary: {
          50: "#f4f1ff", 100: "#e9e3ff", 200: "#d3c8ff", 300: "#b3a0ff", 400: "#9078ff",
          500: "#7757f5", 600: "#6339e6", 700: "#5229c7", 800: "#4425a0", 900: "#2f1a6e",
        },
        // Neutrals tinted toward violet-ink instead of flat grey
        gray: {
          50: "#f7f6fb", 100: "#efedf6", 200: "#e0dded", 300: "#c8c4dc", 400: "#9b97b5",
          500: "#77728f", 600: "#5a5575", 700: "#433f5c", 800: "#2a2744", 900: "#1a1730", 950: "#100e20",
        },
        ink: "#150f2e",
      },
      boxShadow: {
        card: "0 1px 2px 0 rgba(40,25,90,0.05), 0 8px 24px -12px rgba(40,25,90,0.14)",
        "card-hover": "0 2px 4px 0 rgba(40,25,90,0.06), 0 14px 32px -12px rgba(40,25,90,0.22)",
        glow: "0 8px 24px -6px rgba(99,57,230,0.55)",
      },
      borderRadius: {
        xl2: "1rem",
      },
    },
  },
  plugins: [],
}
