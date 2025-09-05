// eslint.config.js
import js from "@eslint/js";
import nextPlugin from "@next/eslint-plugin-next";

export default [
  js.configs.recommended,
  {
    ignores: ["node_modules", ".next", "dist"],
  },
  {
    plugins: {
      "@next/next": nextPlugin,
    },
    rules: {
      // keep it light to avoid Vercel linting errors
      "react/no-unescaped-entities": "off",
      "@next/next/no-img-element": "off",
    },
  },
];