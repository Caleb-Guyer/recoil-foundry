import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { Game } from '../src/game.ts';
import { Renderer } from '../src/render.ts';
import { testCheckpoint } from '../src/practice.ts';
import { stabilityInput } from '../src/stability-scenarios.ts';
import { seeded } from '../src/rules.ts';
import { GAME_VERSION } from '../src/version.ts';

// Offline capture of the real game renderer and simulation. No browser automation,
// invulnerability or invented combat. Optional native tools are not shipped to players.
const require = createRequire(
  process.env.MEDIA_MODULE_ROOT
    ? resolve(process.env.MEDIA_MODULE_ROOT, 'package.json')
    : import.meta.url,
);
const { createCanvas, GlobalFonts } = require('@napi-rs/canvas');
if (process.env.MEDIA_FONT_DIR) {
  GlobalFonts.registerFromPath(resolve(process.env.MEDIA_FONT_DIR, 'arial.ttf'), 'Release Sans');
  GlobalFonts.registerFromPath(resolve(process.env.MEDIA_FONT_DIR, 'arialbd.ttf'), 'Release Bold');
  GlobalFonts.registerFromPath(resolve(process.env.MEDIA_FONT_DIR, 'consola.ttf'), 'Release Mono');
}
Object.defineProperty(globalThis, 'devicePixelRatio', { value: 1 });
const width = 1280,
  height = 720,
  fps = 30;
const out = resolve('public/media');
mkdirSync(out, { recursive: true });
const scenes = [
  { name: 'loading-docks', seed: 'MEDIA-DOCKS-3', stage: 1 },
  { name: 'furnace-halls', seed: 'MEDIA-FURNACE-4', stage: 4 },
  { name: 'cooling-works', seed: 'MEDIA-COOLING-7', stage: 8 },
];
const encoder = process.env.FFMPEG
  ? spawn(
      process.env.FFMPEG,
      [
        '-hide_banner',
        '-loglevel',
        'error',
        '-y',
        '-f',
        'rawvideo',
        '-pixel_format',
        'rgba',
        '-video_size',
        `${width}x${height}`,
        '-framerate',
        String(fps),
        '-i',
        'pipe:0',
        '-an',
        '-c:v',
        'libx264',
        '-preset',
        'fast',
        '-crf',
        '21',
        '-pix_fmt',
        'yuv420p',
        '-movflags',
        '+faststart',
        resolve(out, 'gameplay.mp4'),
      ],
      { stdio: ['pipe', 'ignore', 'inherit'] },
    )
  : null;
const encoded = encoder ? once(encoder, 'exit') : null;
const manifest: object[] = [];
let poster: ReturnType<typeof createCanvas>;
for (const scene of scenes) {
  Math.random = seeded(scene.seed + '-effects');
  const canvas = createCanvas(width, height);
  canvas.getBoundingClientRect = () => ({ width, height });
  const game = new Game();
  game.startTest(testCheckpoint(scene.seed, scene.stage));
  const renderer = new Renderer(canvas, game);
  renderer.reset();
  let saved = false;
  for (let tick = 0; tick < 360; tick++) {
    game.tick(1 / 60, stabilityInput(game, tick));
    if (game.mode !== 'playing')
      throw new Error(`${scene.name} ended before capture: ${game.mode}`);
    if (tick % 2) continue;
    renderer.draw(((tick + 1) * 1000) / 60);
    // The browser's HTML HUD is reproduced from current simulation values.
    const c = canvas.getContext('2d');
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = '#40504d';
    c.fillRect(24, 24, 108, 5);
    c.fillStyle = '#e9eadc';
    c.fillRect(24, 24, (108 * Math.max(0, game.hp)) / 100, 5);
    c.font = '12px "Release Mono", monospace';
    c.textAlign = 'right';
    c.fillStyle = '#b0bbb4';
    c.fillText(`${String(game.stage + 1).padStart(2, '0')} / 20`, width - 50, 31);
    c.fillRect(width - 27, 21, 2, 10);
    c.fillRect(width - 22, 21, 2, 10);
    if (tick === 240) {
      writeFileSync(resolve(out, `${scene.name}.png`), canvas.toBuffer('image/png'));
      if (!poster) {
        poster = createCanvas(width, height);
        poster.getContext('2d').drawImage(canvas, 0, 0);
      }
      saved = true;
    }
    if (encoder && !encoder.stdin.write(Buffer.from(c.getImageData(0, 0, width, height).data)))
      await once(encoder.stdin, 'drain');
  }
  if (!saved) throw new Error('Missing screenshot');
  manifest.push({ ...scene, mods: game.mods, finalHealth: game.hp, seconds: 6 });
}
if (encoder) {
  encoder.stdin.end();
  const [code] = await encoded!;
  if (code !== 0) throw new Error(`Video encoder exited ${code}`);
}
const card = createCanvas(1200, 630),
  c = card.getContext('2d');
c.drawImage(poster!, 0, 0, 1200, 675);
const shade = c.createLinearGradient(0, 0, 950, 0);
shade.addColorStop(0, 'rgba(7,16,20,.98)');
shade.addColorStop(1, 'rgba(7,16,20,.15)');
c.fillStyle = shade;
c.fillRect(0, 0, 1200, 630);
c.fillStyle = '#e9eadc';
c.font = '106px "Release Bold", sans-serif';
c.fillText('RECOIL', 65, 244);
c.fillStyle = '#acc3b6';
c.font = '40px "Release Mono", monospace';
c.fillText('F O U N D R Y', 69, 307);
c.fillStyle = '#e9eadc';
c.font = '27px "Release Sans", sans-serif';
c.fillText('One gun. All recoil.', 70, 414);
c.fillStyle = '#b3c2bc';
c.font = '19px "Release Sans", sans-serif';
c.fillText('A physics roguelike. Play free in your browser.', 70, 455);
c.fillStyle = '#aac2ae';
c.fillRect(70, 528, 48, 3);
writeFileSync(resolve(out, 'social-card.png'), card.toBuffer('image/png'));
writeFileSync(
  resolve(out, 'capture.json'),
  JSON.stringify(
    {
      version: GAME_VERSION,
      method:
        'Actual Game / Renderer; scripted inputs; preset checkpoints; no invulnerability; silent',
      width,
      height,
      fps,
      scenes: manifest,
    },
    null,
    2,
  ) + '\n',
);
console.log(
  `Captured ${scenes.length} scenes${encoder ? ' and 18 seconds of silent gameplay' : ''}.`,
);
