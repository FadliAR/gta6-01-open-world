// NEON HARBOR — entry point for the make.fun harness (Node 22, stdlib only).
// Copies game/ and screenshots/ into the output directory and writes
// /output/dossier.json with the kit's own buildDossier, byte for byte.
// Deterministic: the same input directory writes the same bytes, every run.
import { cpSync, existsSync, lstatSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function copyTree(src: string, dest: string): void {
  mkdirSync(dest, { recursive: true });
  const entries = readdirSync(src, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1));
  for (const entry of entries) {
    const from = join(src, entry.name);
    const to = join(dest, entry.name);
    const st = lstatSync(from);
    if (st.isSymbolicLink()) throw new Error(`refusing to copy symbolic link: ${from}`);
    if (st.isDirectory()) copyTree(from, to);
    else if (st.isFile()) cpSync(from, to);
    else throw new Error(`refusing to copy special file: ${from}`);
  }
}

function main(): void {
  const gameDir = join(here, 'game');
  const shotsDir = join(here, 'screenshots');
  if (!existsSync(gameDir)) throw new Error('game/: no such directory');
  if (!existsSync(shotsDir)) throw new Error('screenshots/: no such directory');
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  copyTree(gameDir, join(outDir, 'game'));
  copyTree(shotsDir, join(outDir, 'screenshots'));
  const dossier = buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
  });
  writeFileSync(join(outDir, 'dossier.json'), dossier);
  console.log(`wrote ${join(outDir, 'dossier.json')} (${dossier.length} bytes)`);
}

main();
