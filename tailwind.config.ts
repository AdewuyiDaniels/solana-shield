import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0a0b0d",
        panel: "#0f1114",
        raised: "#15181c",
        line: "#23272e",
        line2: "#343a43",
        mute: "#99a1ab",
        dim: "#6a7079",
        safe: "#45d19a",
        warn: "#e6b04a",
        danger: "#ef5f6b",
      },
      fontFamily: {
        sans: [
          "ui-sans-serif",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Inter",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Consolas",
          "Liberation Mono",
          "monospace",
        ],
      },
    },
  },
  plugins: [],
};
export default config;
