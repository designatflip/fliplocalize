import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Metropolis", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        // Flip's real brand orange, pulled from the Communication Hub app.
        brand: {
          50: "#fff5f3",
          100: "#fff5f3",
          200: "#fec183",
          300: "#fe9881",
          500: "#fd6542",
          600: "#d35437",
          700: "#7e3221",
        },
      },
    },
  },
  plugins: [],
};
export default config;
