import archiver from "archiver";
import { createWriteStream, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = resolve(__dirname, "../dist");
const outputZip = resolve(distDir, "soma0sd_NotionExport.zip");

if (!existsSync(distDir)) {
  console.error("dist/ does not exist. Run `npm run build:ext` first.");
  process.exit(1);
}

const output = createWriteStream(outputZip);
const archive = archiver("zip", { zlib: { level: 9 } });

output.on("close", () => {
  console.log(`ZIP created: ${outputZip} (${archive.pointer()} bytes)`);
});
archive.on("error", (err) => { throw err; });

archive.pipe(output);
archive.glob("**/*", { cwd: distDir, ignore: ["*.zip"] });
archive.finalize();
