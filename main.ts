// Pipe Panic! — submission entrypoint.
// Copies game/ and screenshots/ into the output directory and writes a
// dossier.json describing the entry. Plain Node filesystem operations only.
import { cpSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(fileURLToPath(import.meta.url));
const outName = process.env.MAKEFUN_OUTPUT_DIR || "out";
const outDir = join(root, outName);

mkdirSync(join(outDir, "game"), { recursive: true });
mkdirSync(join(outDir, "screenshots"), { recursive: true });
cpSync(join(root, "game"), join(outDir, "game"), { recursive: true });
cpSync(join(root, "screenshots"), join(outDir, "screenshots"), { recursive: true });

const shots = readdirSync(join(root, "screenshots"))
  .filter((f) => /\.(jpg|jpeg|png)$/i.test(f))
  .sort();

const dossier = {
  schema: "makefun/dossier/v1",
  title: "Pipe Panic!",
  cover: shots[0] || "",
  screenshots: shots,
};
writeFileSync(join(outDir, "dossier.json"), JSON.stringify(dossier, null, 2) + "\n");
console.log(`wrote ${outDir} (${shots.length} screenshots, cover ${dossier.cover})`);
