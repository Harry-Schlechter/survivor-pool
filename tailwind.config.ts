import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        field: "#0b3d2e",
        chalk: "#f5f5f0",
      },
    },
  },
  plugins: [],
};

export default config;
