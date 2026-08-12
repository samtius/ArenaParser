import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, "..", "");
  const backendHost = env.BACKEND_HOST || "127.0.0.1";
  const backendPort = env.BACKEND_PORT || "8080";
  return {
    plugins: [react()],
    server: {
      host: env.FRONTEND_HOST || "127.0.0.1",
      port: Number(env.FRONTEND_PORT || 5173),
      proxy: {
        "/api": {
          target: `http://${backendHost}:${backendPort}`,
          changeOrigin: true,
        },
      },
    },
  };
});
