// Copies the shared model + utils into functions/src/shared so Cloud Functions
// deploy as a self-contained package (no workspace links in the upload).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'functions/src/shared');
mkdirSync(out, { recursive: true });
for (const f of ['model.ts', 'utils.ts']) {
  const src = readFileSync(join(root, 'packages/shared/src', f), 'utf8');
  writeFileSync(join(out, f), `// AUTO-GENERATED from packages/shared/src/${f} — do not edit here.\n${src}`);
}
console.log('shared → functions/src/shared');
