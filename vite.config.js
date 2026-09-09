import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import { examplesAssetsPlugin } from "./scripts/serve-examples-assets.mjs";

export default defineConfig({
  plugins: [solid(), examplesAssetsPlugin()],
  publicDir: ".generated",
  server: { host: "127.0.0.1", port: 5173, strictPort: true },
  preview: { host: "127.0.0.1", port: 4173, strictPort: true },
});
