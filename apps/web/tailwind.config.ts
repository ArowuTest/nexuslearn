import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#1d1a3e",
        cream: "#fdf8ef",
        sun: "#ffb830",
        coral: "#ff6b6b",
        leaf: "#3ecf8e",
        sky: "#5aa9ff",
        grape: "#8d6bff",
        lagoon: "#19c2c8",
      },
      fontFamily: {
        display: ["Atkinson Hyperlegible", "system-ui", "sans-serif"],
        body: ["Atkinson Hyperlegible", "system-ui", "sans-serif"],
      },
      boxShadow: {
        pop: "0 6px 0 rgba(29,26,62,0.16)",
        card: "0 12px 40px rgba(29,26,62,0.10)",
      },
      borderRadius: {
        blob: "2rem",
      },
    },
  },
  plugins: [],
};
export default config;
