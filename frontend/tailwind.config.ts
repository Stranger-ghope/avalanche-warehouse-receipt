import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        farmer: { light: "#dcfce7", DEFAULT: "#16a34a", dark: "#15803d" },
        agent: { light: "#dbeafe", DEFAULT: "#2563eb", dark: "#1d4ed8" },
        mfi: { light: "#fef3c7", DEFAULT: "#d97706", dark: "#b45309" },
      },
    },
  },
  plugins: [],
};
export default config;
