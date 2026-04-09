import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import reactCompiler from "babel-plugin-react-compiler";
import { tanstackRouter } from "@tanstack/router-plugin/vite";

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true,
    }),
    react({
      babel: {
        plugins: [reactCompiler],
      },
    }),
    tailwindcss(),
  ],

  server: {
    port: 1420,
    strictPort: true,
  },
  resolve: {
    alias: {
      // Allow absolute imports from the `src` directory
      "@": "/src",
    },
  },
  test: {
    globals: true,
    environment: "happy-dom",
    setupFiles: "./src/setupTests.ts",
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
    },
  },
}));
