import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: "#0a0a0b",
        foreground: "#fafafa",
        card: "#141416",
        "card-foreground": "#fafafa",
        border: "#27272a",
        primary: {
          DEFAULT: "#06b6d4",
          foreground: "#0a0a0b",
        },
        secondary: {
          DEFAULT: "#27272a",
          foreground: "#fafafa",
        },
        muted: {
          DEFAULT: "#18181b",
          foreground: "#a1a1aa",
        },
        destructive: {
          DEFAULT: "#ef4444",
          foreground: "#fafafa",
        },
      },
      borderRadius: {
        lg: "0.75rem",
        xl: "1rem",
        "2xl": "1.5rem",
      },
      keyframes: {
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "fade-out": { from: { opacity: "1" }, to: { opacity: "0" } },
        "slide-in-right": { from: { transform: "translateX(100%)" }, to: { transform: "translateX(0)" } },
        "zoom-in": { from: { transform: "scale(0.95)" }, to: { transform: "scale(1)" } },
        "slide-in-bottom": { from: { transform: "translateY(10px)" }, to: { transform: "translateY(0)" } },
      },
      animation: {
        "fade-in": "fade-in 0.2s ease-out",
        "fade-out": "fade-out 0.2s ease-out",
        "slide-in-right": "slide-in-right 0.2s ease-out",
        "zoom-in": "zoom-in 0.2s ease-out",
        "slide-in-bottom": "slide-in-bottom 0.2s ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
