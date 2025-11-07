import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite"; // Tailwind v4 integration

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // ถ้าเคยตั้ง base:"./" เพื่อเปิด file:// ให้เอาออก เพื่อให้ BrowserRouter ทำงานปกติ
  // base: "./",
  server: {
    proxy: {
      "/api": {
        target: process.env.VITE_PROXY_TARGET || "http://localhost:5000",
        changeOrigin: true,
      },
    },
  },
});
