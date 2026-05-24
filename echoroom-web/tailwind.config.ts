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
    },
  },
  plugins: [],
};

export default config;
