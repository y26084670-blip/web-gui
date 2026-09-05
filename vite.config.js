import { defineConfig } from "vite";
import solid from "vite-plugin-solid";

const agentProxy = () => ({
  "^/agent/rpc$": {
    target: "http://127.0.0.1:8765",
    ws: true,
    changeOrigin: true,
    rewrite: () => "/rpc",
  },
});

export default defineConfig({
  plugins: [solid()],
  publicDir: ".generated",
  server: { host: "127.0.0.1", port: 5173, strictPort: true, proxy: agentProxy() },
  preview: { host: "127.0.0.1", port: 4173, strictPort: true, proxy: agentProxy() },
});
