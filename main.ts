// Pipe Panic! packaging entrypoint, run by the platform as `node main.ts`.
//
// It copies game/ and screenshots/ into the output directory and writes
// dossier.json there. All paths are resolved from THIS file's location, never
// from the current working directory, and nothing is ever written into the
// repository directory.
//
// Output directory rule (the important one): MAKEFUN_OUTPUT_DIR may be an
// ABSOLUTE path (the grader passes /output). An absolute value is used
// exactly as given and is never joined underneath the repository. A relative
// value is resolved against this file's directory, not the caller's cwd.
import { cpSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

const rawOut = process.env.MAKEFUN_OUTPUT_DIR ?? "out";
const outDir = isAbsolute(rawOut) ? rawOut : resolve(here, rawOut);

mkdirSync(outDir, { recursive: true });
cpSync(join(here, "game"), join(outDir, "game"), { recursive: true });
cpSync(join(here, "screenshots"), join(outDir, "screenshots"), { recursive: true });

const shots = readdirSync(join(here, "screenshots"))
  .filter((name) => /\.(jpe?g|png)$/i.test(name))
  .sort();

const dossier = {
  schema: "makefun/dossier/v1",
  title: "Pipe Panic!",
  cover: shots[0],
  screenshots: shots,
};
writeFileSync(join(outDir, "dossier.json"), JSON.stringify(dossier, null, 2) + "\n");
console.log(`Pipe Panic! packaged into ${outDir}`);
