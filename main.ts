// Pipe Panic! — submission entrypoint.
// Copies game/ and screenshots/ into the output directory and writes
// dossier.json exactly as the kit library buildDossier writes it.
import { cpSync, mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { buildDossier } from "./vendor/makefun-game.ts";

const root = dirname(fileURLToPath(import.meta.url));
const outName = process.env.MAKEFUN_OUTPUT_DIR || "/output";
const outDir = isAbsolute(outName) ? outName : resolve(root, outName);

mkdirSync(outDir, { recursive: true });
cpSync(join(root, "game"), join(outDir, "game"), { recursive: true });
cpSync(join(root, "screenshots"), join(outDir, "screenshots"), { recursive: true });
writeFileSync(
  join(outDir, "dossier.json"),
  buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
console.log(`wrote ${outDir} (dossier.json via buildDossier)`);
