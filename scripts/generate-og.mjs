/**
 * generate-og.mjs — renders assets/og.svg → public/og.png (1200×630).
 * Runs as `prebuild`. Idempotent: skips when the PNG is newer than the
 * SVG source, so Docker builds reuse the committed artifact instead of
 * depending on container font availability.
 */
import { existsSync, statSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = resolve(root, 'assets/og.svg');
const out = resolve(root, 'public/og.png');

if (!existsSync(src)) {
  console.error(`[og] missing source: ${src}`);
  process.exit(1);
}

if (existsSync(out) && statSync(out).mtimeMs >= statSync(src).mtimeMs) {
  console.log('[og] public/og.png is up to date — skipping render');
  process.exit(0);
}

try {
  const { default: sharp } = await import('sharp');
  mkdirSync(dirname(out), { recursive: true });
  await sharp(src, { density: 144 }).resize(1200, 630).png({ compressionLevel: 9 }).toFile(out);
  console.log('[og] rendered public/og.png (1200×630)');
} catch (error) {
  console.error('[og] render failed:', error instanceof Error ? error.message : error);
  process.exit(1);
}
