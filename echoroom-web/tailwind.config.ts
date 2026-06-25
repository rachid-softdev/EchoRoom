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
        "slide-in-right": { from: { transform: "translateX(100%)", opacity: "0" }, to: { transform: "translateX(0)", opacity: "1" } },
        "slide-in-top": { from: { transform: "translateY(-24px)", opacity: "0" }, to: { transform: "translateY(0)", opacity: "1" } },
        "zoom-in": { from: { transform: "scale(0.95)", opacity: "0" }, to: { transform: "scale(1)", opacity: "1" } },
        "slide-in-bottom": { from: { transform: "translateY(24px)", opacity: "0" }, to: { transform: "translateY(0)", opacity: "1" } },
        "pulse-soft": { "0%, 100%": { opacity: "1" }, "50%": { opacity: "0.6" } },
        "audio-bar": {
          "0%, 100%": { transform: "scaleY(0.3)" },
          "50%": { transform: "scaleY(1)" },
        },
        "scale-in": { from: { transform: "scale(0.9)", opacity: "0" }, to: { transform: "scale(1)", opacity: "1" } },
        "marquee": { from: { transform: "translateX(0)" }, to: { transform: "translateX(-100%)" } },
      },
      animation: {
        "fade-in": "fade-in 0.3s ease-out",
        "fade-out": "fade-out 0.2s ease-out",
        "slide-in-right": "slide-in-right 0.3s ease-out",
        "zoom-in": "zoom-in 0.3s ease-out",
        "slide-in-bottom": "slide-in-bottom 0.4s ease-out",
        "slide-in-top": "slide-in-top 0.4s ease-out",
        "pulse-soft": "pulse-soft 2s ease-in-out infinite",
        "audio-bar": "audio-bar 0.8s ease-in-out infinite",
        "scale-in": "scale-in 0.3s ease-out",
"marquee": "marquee 30s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
