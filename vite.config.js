import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import { examplesAssetsPlugin } from "./scripts/serve-examples-assets.mjs";
import { readFileSync } from "node:fs";

export default defineConfig({
  plugins: [solid(), examplesAssetsPlugin(), {
    name: "third-party-notices",
    generateBundle() {
      // This project uses .generated as publicDir, so public/ is not copied.
      this.emitFile({ type: "asset", fileName: "third-party-notices.txt",
        source: readFileSync(new URL("./public/third-party-notices.txt", import.meta.url), "utf8") });
    },
  }],
  publicDir: ".generated",
  server: { host: "127.0.0.1", port: 5173, strictPort: true },
  preview: { host: "127.0.0.1", port: 4173, strictPort: true },
});
