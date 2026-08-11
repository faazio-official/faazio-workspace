/**
 * One-off asset optimization:
 *  - Convert the 6 large PNGs in src/assets/ to WebP (quality 80, same dims)
 *  - Delete the corrupt welcome_illustration.png stub
 *  - Move the 2 Food AVIFs from the repo-root duplicate assets/ into src/assets/food/
 *  - Delete the duplicate root assets/ PNGs + SVG (now fully consolidated into src/assets/)
 */
import { readdirSync, mkdirSync, renameSync, unlinkSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const ROOT = process.cwd();
const SRC_ASSETS = join(ROOT, 'src', 'assets');
const ROOT_ASSETS = join(ROOT, 'assets');
const FOOD_ASSETS = join(SRC_ASSETS, 'food');

const PNG_TARGETS = [
  'location_access_page.png',
  'phone_auth_background.png',
  'welcome_illustration_1.png',
  'welcome_illustration_2.png',
  'welcome_illustration_3.png',
  'welcome_illustration_4.png',
];

const out = (label, msg) => console.log(`[optimize-assets] ${label}: ${msg}`);

for (const file of PNG_TARGETS) {
  const input = join(SRC_ASSETS, file);
  if (!existsSync(input)) {
    out('skip', `${file} not found`);
    continue;
  }
  const output = input.replace(/\.png$/, '.webp');
  const { size } = await sharp(input).webp({ quality: 80 }).toFile(output);
  const original = (await import('node:fs')).statSync(input).size;
  unlinkSync(input);
  out('converted', `${file} (${(original / 1024).toFixed(0)} KB -> ${(size / 1024).toFixed(0)} KB)`);
}

const corrupt = join(SRC_ASSETS, 'welcome_illustration.png');
if (existsSync(corrupt)) {
  unlinkSync(corrupt);
  out('deleted', 'corrupt welcome_illustration.png stub');
}

mkdirSync(FOOD_ASSETS, { recursive: true });
for (const file of readdirSync(ROOT_ASSETS)) {
  if (file.endsWith('.avif')) {
    renameSync(join(ROOT_ASSETS, file), join(FOOD_ASSETS, file));
    out('moved', `${file} -> src/assets/food/`);
  } else if (file.endsWith('.png') || file.endsWith('.svg')) {
    unlinkSync(join(ROOT_ASSETS, file));
    out('deleted', `duplicate root asset ${file}`);
  }
}

out('done', 'asset optimization complete');
