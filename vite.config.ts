import { defineConfig } from "vite";
import { resolve } from "path";

// Each JS entry is built separately to avoid Rollup IIFE + multi-input limitation.
// Set BUILD_ENTRY env var: "content" | "background" | "popup"
const entry = process.env["BUILD_ENTRY"] ?? "content";

// Vite 8's native config loader does not inject __dirname; import.meta.dirname is the replacement.
const rootDir = import.meta.dirname;

const entryMap: Record<string, string> = {
  background: resolve(rootDir, "src/background.ts"),
  content:    resolve(rootDir, "src/content.ts"),
  popup:      resolve(rootDir, "src/popup.ts"),
  options:    resolve(rootDir, "src/options.ts"),
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
    alias: { "@": resolve(rootDir, "src") },
  },
});
