import { cpSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "dist");

mkdirSync(dist, { recursive: true });

// manifest.json
cpSync(resolve(root, "manifest.json"), resolve(dist, "manifest.json"));
console.log("Copied: manifest.json");

// icons/ (PNG only — SVG is a source file)
mkdirSync(resolve(dist, "icons"), { recursive: true });
for (const size of [16, 32, 48, 128]) {
  cpSync(resolve(root, `icons/icon${size}.png`), resolve(dist, `icons/icon${size}.png`));
}
console.log("Copied: icons/");

// _locales/
cpSync(resolve(root, "_locales"), resolve(dist, "_locales"), { recursive: true });
console.log("Copied: _locales/");

// popup.html
cpSync(resolve(root, "src/popup.html"), resolve(dist, "popup.html"));
console.log("Copied: popup.html");

// options.html
cpSync(resolve(root, "src/options.html"), resolve(dist, "options.html"));
console.log("Copied: options.html");

console.log("Assets copy complete.");
