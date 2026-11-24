import { buildDossier } from './vendor/makefun-game.ts';
import { cpSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const out =
  process.env.MAKEFUN_OUTPUT_DIR && isAbsolute(process.env.MAKEFUN_OUTPUT_DIR)
    ? process.env.MAKEFUN_OUTPUT_DIR
    : '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  })
);
