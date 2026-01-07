import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],

  // ✅ obrigatório: assets viram /AgendaP83/assets/... no build
  base: "/AgendaP83/",

  server: {
    port: 5173,
    proxy: {
      // ✅ em DEV, chamadas para /AgendaP83/api vão pro backend local 8311
      "/AgendaP83/api": {
        target: "http://127.0.0.1:8311",
        changeOrigin: true
      },

      // ✅ opcional: compatibilidade se ainda existir código chamando /api puro
      "/api": {
        target: "http://127.0.0.1:8311",
        changeOrigin: true
      }
    }
  },

  build: {
    outDir: path.resolve(__dirname, "../backend/public"),
    emptyOutDir: true
  }
});
