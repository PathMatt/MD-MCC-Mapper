import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        western: {
          purple: "#4F2683",
          "purple-secondary": "#82368C",
          silver: "#807F83",
          bg: "#F4F4F6",
          card: "#FFFFFF",
          "text-header": "#2F2E33",
          "text-body": "#4B4B4B",
        },
      },
    },
  },
  plugins: [],
};

export default config;
