import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/predict": "http://127.0.0.1:8000",
      "/prediction": "http://127.0.0.1:8000",
      "/features": "http://127.0.0.1:8000",
      "/model": "http://127.0.0.1:8000",
      "/plots": "http://127.0.0.1:8000",
      "/static": "http://127.0.0.1:8000"
    }
  }
});

