import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{ts,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        card: "var(--card)",
        "card-foreground": "var(--card-foreground)",
        border: "var(--border)",
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
      },
      fontSize: {
        'fluid-hero': 'clamp(2.5rem, 5vw, 4.5rem)',    // 40px → 72px fluid
        'fluid-section': 'clamp(1.5rem, 3vw, 2.25rem)',  // 24px → 36px fluid
        'fluid-body': 'clamp(0.875rem, 1.5vw, 1.125rem)', // 14px → 18px fluid
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
        "slide-in-top": { from: { transform: "translateY(-20px)", opacity: "0" }, to: { transform: "translateY(0)", opacity: "1" } },
        "zoom-in": { from: { transform: "scale(0.95)" }, to: { transform: "scale(1)" } },
        "slide-in-bottom": { from: { transform: "translateY(10px)" }, to: { transform: "translateY(0)" } },
      },
      animation: {
        "fade-in": "fade-in 0.2s ease-out",
        "fade-out": "fade-out 0.2s ease-out",
        "slide-in-right": "slide-in-right 0.2s ease-out",
        "zoom-in": "zoom-in 0.2s ease-out",
        "slide-in-bottom": "slide-in-bottom 0.2s ease-out",
        "slide-in-top": "slide-in-top 0.3s ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
