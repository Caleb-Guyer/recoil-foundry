import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Store artwork using the established canvas wordmark and an actual engine capture.
// Native rendering dependencies are development tools, not shipped game dependencies.
const require = createRequire(
  process.env.MEDIA_MODULE_ROOT
    ? resolve(process.env.MEDIA_MODULE_ROOT, 'package.json')
    : import.meta.url,
);
const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
if (process.env.MEDIA_FONT_DIR) {
  for (const [file, family] of [
    ['arial.ttf', 'Release Sans'],
    ['arialbd.ttf', 'Release Bold'],
    ['consola.ttf', 'Release Mono'],
  ])
    GlobalFonts.registerFromPath(resolve(process.env.MEDIA_FONT_DIR, file), family);
}
const scene = await loadImage(resolve('public/media/loading-docks.png'));
const out = resolve('docs/itch-io/assets');
mkdirSync(out, { recursive: true });

function wordmark(c, x, y, size) {
  c.fillStyle = '#e9eadc';
  c.font = `${size}px "Release Bold", sans-serif`;
  c.fillText('RECOIL', x, y);
  c.fillStyle = '#acc3b6';
  c.font = `${size * 0.35}px "Release Mono", monospace`;
  c.fillText('F O U N D R Y', x + 4, y + size * 0.61);
}

const cover = createCanvas(1260, 1000),
  c = cover.getContext('2d');
c.fillStyle = '#0a1419';
c.fillRect(0, 0, 1260, 1000);
c.drawImage(scene, 0, 65, 1280, 630, 0, 355, 1260, 620);
const shade = c.createLinearGradient(0, 320, 0, 1000);
shade.addColorStop(0, '#0a1419');
shade.addColorStop(0.38, 'rgba(10,20,25,.08)');
shade.addColorStop(0.8, 'rgba(10,20,25,.05)');
shade.addColorStop(1, 'rgba(10,20,25,.94)');
c.fillStyle = shade;
c.fillRect(0, 320, 1260, 680);
wordmark(c, 82, 245, 184);
c.fillStyle = '#e9eadc';
c.font = '44px "Release Sans", sans-serif';
c.fillText('One gun. All recoil.', 87, 942);
writeFileSync(resolve(out, 'cover.png'), cover.toBuffer('image/png'));

const banner = createCanvas(1600, 450),
  b = banner.getContext('2d');
b.drawImage(scene, 0, 120, 1280, 360, 0, 0, 1600, 450);
const fade = b.createLinearGradient(0, 0, 1600, 0);
fade.addColorStop(0, '#0a1419');
fade.addColorStop(0.45, 'rgba(10,20,25,.95)');
fade.addColorStop(1, 'rgba(10,20,25,.32)');
b.fillStyle = fade;
b.fillRect(0, 0, 1600, 450);
wordmark(b, 85, 210, 143);
b.fillStyle = '#e9eadc';
b.font = '30px "Release Sans", sans-serif';
b.fillText('One gun. All recoil.', 89, 382);
writeFileSync(resolve(out, 'banner.png'), banner.toBuffer('image/png'));
console.log('Created itch.io cover (1260 × 1000) and banner (1600 × 450).');
