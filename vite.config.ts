import { defineConfig } from "vite";
import { resolve } from "path";

// Each JS entry is built separately to avoid Rollup IIFE + multi-input limitation.
// Set BUILD_ENTRY env var: "content" | "background" | "popup"
const entry = process.env["BUILD_ENTRY"] ?? "content";

const entryMap: Record<string, string> = {
  background: resolve(__dirname, "src/background.ts"),
  content:    resolve(__dirname, "src/content.ts"),
  popup:      resolve(__dirname, "src/popup.ts"),
  options:    resolve(__dirname, "src/options.ts"),
};

export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: false, // assets are copied by copy-assets.mjs before this runs
    target: "es2022",
    minify: false,
    lib: {
      entry: entryMap[entry] ?? entryMap["content"],
      formats: ["iife"],
      name: entry,
      fileName: () => `${entry}.js`,
    },
  },
  resolve: {
    alias: { "@": resolve(__dirname, "src") },
  },
});
