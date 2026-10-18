import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { Renderer } from '../src/render.ts';
import { GAME_VERSION } from '../src/version.ts';
import {
  PROMO_TEMPLATES,
  startTake,
  surveyTakes,
  actionInput,
  recordAction,
  takeQuality,
  usableAction,
  type Take,
  type ActionFrame,
} from './trailer-scenes.ts';
import {
  planEdit,
  sourceFrame,
  type Beat,
  type EditShot,
  type ClosingMusic,
} from './trailer-edit.ts';
import { endingTiming, drawEnding } from './trailer-ending.ts';
import { trailerSound, type SoundCue, type BeamFrame } from './trailer-sound.ts';
import { mixTrailer } from './trailer-mix.ts';
import { drawThumbnail } from './trailer-thumbnail.ts';

// Reproducible current-game captures. The older 2.98 trailer stays intact.
const metadata = resolve('docs/trailer-5.6.0');
const out = resolve(process.env.TRAILER_OUT ?? '../../YouTube Trailer 5.6.0');
const work = resolve(out, 'production');
mkdirSync(metadata, { recursive: true });
mkdirSync(work, { recursive: true });
const json = (path: string, value: unknown) =>
  writeFileSync(path, JSON.stringify(value, null, 2) + '\n');
const takePath = resolve(metadata, 'action-takes.json');
const montage = [
  ['recoil', 0, 0, 4],
  ['shotgun', 0, 4, 8],
  ['nails', 0, 8, 12],
  ['prism', 0, 12, 16],
  ['pinwheel', 0, 16, 20],
  ['turf', 0, 20, 24],
  ['saw', 0, 24, 28],
  ['twinbore', 0, 28, 32],
  ['cluster', 0, 32, 36],
  ['carbine', 0, 36, 40],
  ['storm', 0, 40, 44],
  ['loader', 0, 44, 48],
  ['prism', 1, 48, 52],
  ['pinwheel', 1, 52, 56],
  ['saw', 1, 56, 58],
  ['turf', 1, 58, 60],
  ['repeater', 0, 60, 62],
  ['cluster', 1, 62, 64],
] as const;
if (process.argv.includes('--survey')) {
  const name = process.argv.find((arg) => arg.startsWith('--name='))?.slice(7);
  const takes: Record<string, Take[]> = existsSync(takePath)
    ? JSON.parse(readFileSync(takePath, 'utf8'))
    : {};
  for (const template of PROMO_TEMPLATES) {
    if (name && name !== template.name) continue;
    Object.assign(takes, surveyTakes([template.name], PROMO_TEMPLATES));
    json(takePath, takes);
  }
  process.exit(0);
}
const map: { sourceIn: number; bpm: number; beats: Beat[]; closing: ClosingMusic } = JSON.parse(
  readFileSync(resolve(metadata, 'music-beats.json'), 'utf8'),
);
const takes: Record<string, Take[]> = JSON.parse(readFileSync(takePath, 'utf8'));
const planPath = resolve(metadata, 'edit-plan.json');
if (process.argv.includes('--plan')) {
  json(planPath, planEdit(takes, map.beats, montage));
  process.exit(0);
}
const edit: EditShot[] = JSON.parse(readFileSync(planPath, 'utf8'));
const native = createRequire(resolve('.media-tools/canvas/package.json'));
const audio = createRequire(resolve('.media-tools/audio/package.json'));
const { createCanvas, GlobalFonts, loadImage } = native('@napi-rs/canvas');
const { RenderingAudioContext } = audio('web-audio-engine');
for (const [file, family] of [
  ['arial.ttf', 'Release Sans'],
  ['arialbd.ttf', 'Release Bold'],
  ['consola.ttf', 'Release Mono'],
])
  if (
    !GlobalFonts.registerFromPath(
      resolve(process.env.MEDIA_FONT_DIR ?? 'C:/Windows/Fonts', file),
      family,
    )
  )
    throw new Error(`Missing ${file}`);
Object.defineProperty(globalThis, 'devicePixelRatio', { value: 1, configurable: true });
class CaptureAudio extends RenderingAudioContext {
  constructor() {
    super({ sampleRate: 48000, numberOfChannels: 2, blockSize: 128 });
  }
  get state() {
    return 'running';
  }
}
Object.defineProperty(globalThis, 'AudioContext', { value: CaptureAudio, configurable: true });
const ffmpeg =
  process.env.FFMPEG ??
  resolve('.media-tools/python/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe');
const music = resolve(process.env.TRAILER_MUSIC ?? '.media-tools/music/resonance.mp3');
const musicHash = createHash('sha256').update(readFileSync(music)).digest('hex');
if (musicHash !== '264be9c44c32419b6de70f0ac24c92f81401419419c8fb111b8e19e62261331b')
  throw new Error('Music does not match the measured source recording');
const storyboard = process.argv.includes('--storyboard');
const W = 1920,
  H = 1080,
  FPS = 60;
const ending = endingTiming(map.closing.titleFrame, map.closing.subtitleFrame);
const total = ending.endFrame,
  duration = total / FPS;
const canvas = createCanvas(W, H),
  c = canvas.getContext('2d');
canvas.getBoundingClientRect = () => ({ width: W, height: H });
const poster = createCanvas(W, H),
  plate = createCanvas(W, H);
const sheet = createCanvas(1600, Math.ceil((edit.length + 1) / 4) * 250),
  sc = sheet.getContext('2d');
sc.fillStyle = '#081115';
sc.fillRect(0, 0, sheet.width, sheet.height);
const sequences = Array.from({ length: Math.ceil(edit.length / 4) }, () => createCanvas(1920, 840));
const cues: SoundCue[] = [],
  beams: BeamFrame[] = [];
const manifest: object[] = [],
  sync: object[] = [];
let posterScore = -Infinity;
const video = storyboard
  ? null
  : spawn(
      ffmpeg,
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
        `${W}x${H}`,
        '-framerate',
        String(FPS),
        '-i',
        'pipe:0',
        '-an',
        '-c:v',
        'libx264',
        '-preset',
        'fast',
        '-crf',
        '17',
        '-profile:v',
        'high',
        '-pix_fmt',
        'yuv420p',
        '-g',
        '30',
        '-bf',
        '2',
        '-flags',
        '+cgop',
        '-colorspace',
        'bt709',
        '-color_trc',
        'bt709',
        '-color_primaries',
        'bt709',
        '-x264-params',
        'colorprim=bt709:transfer=bt709:colormatrix=bt709',
        '-movflags',
        '+faststart',
        resolve(work, 'picture.mp4'),
      ],
      { stdio: ['pipe', 'ignore', 'inherit'] },
    );
const encoded = video ? once(video, 'exit') : null;
if (video)
  video.stdin.on('error', (error) => {
    console.error('Encoder input:', error.message);
  });
async function writeFrame() {
  if (video && !video.stdin.write(Buffer.from(c.getImageData(0, 0, W, H).data)))
    await once(video.stdin, 'drain');
}
function caption(text: string, alpha: number) {
  c.save();
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.globalAlpha = alpha;
  const shade = c.createLinearGradient(0, 0, 0, 300);
  shade.addColorStop(0, 'rgba(5,12,16,.75)');
  shade.addColorStop(1, 'rgba(5,12,16,0)');
  c.fillStyle = shade;
  c.fillRect(0, 0, W, 300);
  c.fillStyle = '#e9eadc';
  c.font = '74px "Release Bold"';
  c.textAlign = 'left';
  text.split('\n').forEach((line, n) => c.fillText(line, 94, 124 + n * 82));
  c.restore();
}
const ease = (x: number) => {
  x = Math.max(0, Math.min(1, x));
  return x * x * (3 - 2 * x);
};
const labels: Record<number, string> = {
  0: 'EVERY SHOT\nMOVES YOU.',
  3: 'ONE GUN.\nYOUR BUILD.',
  11: 'CLOCK OUT\nALIVE.',
};
async function still(frame: number, label: string, index: number) {
  const png = canvas.toBuffer('image/png');
  writeFileSync(resolve(work, `frame-${String(frame).padStart(4, '0')}.png`), png);
  const image = await loadImage(png);
  sc.drawImage(image, (index % 4) * 400, Math.floor(index / 4) * 250, 400, 225);
  sc.fillStyle = '#e9eadc';
  sc.font = '15px "Release Mono"';
  sc.fillText(
    `${(frame / FPS).toFixed(2)}s · ${label}`,
    (index % 4) * 400 + 8,
    Math.floor(index / 4) * 250 + 243,
  );
}
const scales: Record<string, number> = {
  recoil: 2.4,
  shotgun: 2.25,
  nails: 2.35,
  prism: 1.95,
  pinwheel: 2.2,
  turf: 1.95,
  saw: 2.25,
  twinbore: 2.2,
  cluster: 2.15,
  carbine: 2.25,
  storm: 2.15,
  loader: 2.15,
  repeater: 2.25,
};
let last:
  | { g: ReturnType<typeof startTake>; r: Renderer; take: Take; cursor: number; scale: number }
  | undefined;
for (const [index, shot] of edit.entries()) {
  const take = shot.take,
    g = startTake(take),
    r = new Renderer(canvas, g);
  const base = scales[take.name];
  r.scale = base;
  r.reset();
  for (let tick = 0; tick < take.start; tick++) {
    g.tick(1 / FPS, actionInput(g, tick, take.style));
    if (tick >= take.start - 45) r.draw(((tick + 1) * 1000) / FPS);
  }
  const initialHp = g.hp,
    initialKills = g.kills;
  let cursor = take.start,
    output = shot.start,
    kinds: string[] = [];
  g.onSound = (kind) => {
    cues.push({ frame: output, kind });
    kinds.push(kind);
  };
  const metrics: ActionFrame[] = [],
    len = shot.end - shot.start;
  const samples = Array.from({ length: 6 }, (_, n) => Math.round((n * (len - 1)) / 5));
  let visible = 0;
  console.log(
    `Shot ${index + 1}/${edit.length}: ${take.name}, ${take.start}, ${(len / FPS).toFixed(2)}s`,
  );
  for (let local = 0; local < len; local++) {
    const frame = shot.start + local,
      target = take.start + Math.round(sourceFrame(shot.points, local));
    output = frame;
    while (cursor <= target) {
      kinds = [];
      const wasTorch = g.torch.active;
      const metric = recordAction(g, actionInput(g, cursor, take.style));
      metrics.push(metric);
      if (g.torch.active && !wasTorch) kinds.push('beam-start');
      if (g.torch.active && metric.damage > 2) kinds.push('beam-hit');
      for (const p of shot.points.filter(
        (p) => p.kind !== 'end' && take.start + p.source === cursor,
      )) {
        if (!kinds.includes(p.kind) || local !== p.output)
          throw new Error(`Missing/off-beat ${p.kind} in shot ${index + 1}`);
        sync.push({
          shot: index + 1,
          kind: p.kind,
          beat: p.beat,
          frame,
          expectedFrame: shot.start + p.output,
          errorFrames: 0,
        });
      }
      cursor++;
    }
    if (g.mode !== 'playing' || g.clear || g.hp <= 0)
      throw new Error(`Capture ended in shot ${index + 1}`);
    if (g.torch.active) beams.push({ frame, heat: g.torch.heat });
    const punch = Math.max(
      0,
      ...shot.points
        .filter((p) => p.kind !== 'end' && p.output <= local)
        .map((p) => 0.035 * Math.exp(-(local - p.output) / 6)),
    );
    r.scale = base + 0.05 * ease(local / len) + punch;
    r.draw(((target + 1) * 1000) / FPS);
    const ax = (g.aim.x - r.camera.x) * r.scale,
      ay = (g.aim.y - r.camera.y) * r.scale;
    if (ax > 35 && ax < W - 35 && ay > 65 && ay < H - 35) visible++;
    const mid = local === Math.floor(len / 2);
    if (
      ['scatter', 'cluster', 'twinbore', 'shotgun'].includes(take.name) &&
      local > 12 &&
      local < len - 12
    ) {
      const p = r.toCanvas(g.player.position),
        score = g.particles.length + Math.min(40, g.shots.length) * 2;
      if (p.x > W * 0.3 && p.x < W * 0.7 && p.y > 180 && p.y < 900 && score > posterScore) {
        posterScore = score;
        poster.getContext('2d').putImageData(c.getImageData(0, 0, W, H), 0, 0);
      }
    }
    const text = labels[index];
    if (text) caption(text, ease(local / 6) * (1 - ease((local - len + 14) / 14)));
    if (frame === 0 || frame === 12 || frame === 36 || frame === 72)
      writeFileSync(resolve(work, `hook-${frame}.png`), canvas.toBuffer('image/png'));
    if (mid) await still(frame, take.name, index);
    if (samples.includes(local)) {
      const sample = samples.indexOf(local),
        ctx = sequences[Math.floor(index / 4)].getContext('2d');
      ctx.drawImage(
        await loadImage(canvas.toBuffer('image/png')),
        sample * 320,
        (index % 4) * 210,
        320,
        180,
      );
      ctx.fillStyle = '#081115';
      ctx.fillRect(sample * 320, (index % 4) * 210 + 180, 320, 30);
      ctx.fillStyle = '#e9eadc';
      ctx.font = '14px "Release Mono"';
      ctx.fillText(
        `${index + 1}. ${take.name} ${(frame / FPS).toFixed(2)}s`,
        sample * 320 + 8,
        (index % 4) * 210 + 201,
      );
    }
    if (!storyboard) await writeFrame();
  }
  const quality = takeQuality(metrics),
    onScreen = visible / len;
  if (!usableAction(quality, len) || onScreen < 0.75)
    throw new Error(`Unusable shot ${index + 1}: ${JSON.stringify({ quality, onScreen })}`);
  manifest.push({
    ...take,
    timelineStart: shot.start / FPS,
    seconds: len / FPS,
    initialHp,
    finalHp: g.hp,
    kills: g.kills - initialKills,
    quality,
    onScreen,
    retiming: shot.points,
  });
  last = { g, r, take, cursor, scale: r.scale };
}
const endingFrames = [
  ending.impactFrame,
  ending.subtitleFrame,
  ending.linkFrame + 18,
  ending.fadeStartFrame,
  ending.fadeStartFrame + 36,
  ending.endFrame - 12,
];
const endingSheet = createCanvas(1440, 600),
  ec = endingSheet.getContext('2d');
for (let frame = ending.impactFrame; frame < total; frame++) {
  let background: CanvasImageSource | undefined;
  if (frame < ending.transitionEndFrame && last) {
    last.g.onSound = (kind) => cues.push({ frame, kind });
    if ((frame - ending.impactFrame) % 2 === 0) {
      last.g.tick(1 / FPS, actionInput(last.g, last.cursor++, last.take.style));
    }
    last.r.scale = last.scale;
    last.r.draw((last.cursor * 1000) / FPS);
    plate.getContext('2d').putImageData(c.getImageData(0, 0, W, H), 0, 0);
    background = plate;
  }
  drawEnding(c, frame, ending, background, 'caleb-guyer.github.io/recoil-foundry');
  if (frame === ending.linkFrame + 18) await still(frame, 'PLAY FREE', edit.length);
  const n = endingFrames.indexOf(frame);
  if (n >= 0) {
    const png = canvas.toBuffer('image/png');
    writeFileSync(resolve(work, `ending-${frame}.png`), png);
    ec.drawImage(await loadImage(png), (n % 3) * 480, Math.floor(n / 3) * 300, 480, 270);
    ec.fillStyle = '#e9eadc';
    ec.font = '16px "Release Mono"';
    ec.fillText(`${(frame / FPS).toFixed(3)}s`, (n % 3) * 480 + 8, Math.floor(n / 3) * 300 + 292);
  }
  if (!storyboard) await writeFrame();
}
writeFileSync(resolve(out, 'Contact-Sheet.png'), sheet.toBuffer('image/png'));
writeFileSync(resolve(out, 'Ending-Review.png'), endingSheet.toBuffer('image/png'));
sequences.forEach((s: any, i: number) =>
  writeFileSync(resolve(work, `sequence-${i + 1}.png`), s.toBuffer('image/png')),
);
writeFileSync(resolve(work, 'thumbnail-gameplay.png'), poster.toBuffer('image/png'));
const thumb = createCanvas(3840, 2160);
drawThumbnail(thumb.getContext('2d'), poster, {
  hook: ['SHOOT DOWN.', 'FLY UP.'],
  label: 'OFFICIAL TRAILER',
});
writeFileSync(resolve(out, 'Recoil-Foundry-YouTube-Thumbnail.png'), thumb.toBuffer('image/png'));
json(resolve(work, 'shot-audit.json'), manifest);
json(resolve(work, 'sync-audit.json'), sync);
json(resolve(work, 'sound-cues.json'), { cues, beams });
if (video) {
  video.stdin.end();
  const [code] = await encoded!;
  if (code !== 0) throw new Error(`Video encoding failed (${code})`);
}
if (storyboard) {
  console.log('Storyboard ready:', out);
  process.exit(0);
}
const sound = trailerSound(cues, beams, duration, ending, [], false),
  context = new CaptureAudio();
writeFileSync(
  resolve(work, 'effects.wav'),
  Buffer.from(await context.encodeAudioData(sound, { bitDepth: 24 })),
);
const effectsLevels = edit.map((shot, index) => {
  let energy = 0,
    peak = 0,
    count = 0;
  for (const ch of sound.channelData)
    for (
      let i = Math.round((shot.start / FPS) * 48000);
      i < Math.round((shot.end / FPS) * 48000);
      i++
    ) {
      energy += ch[i] * ch[i];
      peak = Math.max(peak, Math.abs(ch[i]));
      count++;
    }
  const rmsDb = 20 * Math.log10(Math.sqrt(energy / count));
  if (rmsDb < -33 || peak < 0.15) throw new Error(`Inaudible effects in shot ${index + 1}`);
  return { shot: index + 1, rmsDb, peak };
});
const final = resolve(out, 'Recoil-Foundry-Official-Trailer.mp4');
const mix = mixTrailer(ffmpeg, work, music, final, duration, map.sourceIn, 0, ending, map.closing);
const capture = {
  version: GAME_VERSION,
  createdAt: new Date().toISOString(),
  width: W,
  height: H,
  fps: FPS,
  frames: total,
  seconds: duration,
  shots: manifest,
  beatSync: sync,
  effectsLevels,
  audioMix: mix,
  music: {
    title: 'Resonance',
    artist: 'Scott Buckley',
    license: 'CC BY 4.0',
    source: 'https://www.scottbuckley.com.au/library/resonance/',
    sha256: musicHash,
    sourceIn: map.sourceIn,
    closing: map.closing,
  },
  method:
    'Actual current Game and Renderer. Six starting tools, legal checkpoint builds, ordinary scripted inputs, active health, enemy AI and collisions; source events gently retimed to recorded musical accents. No invulnerability, fabricated attacks, player saves or unlock writes. Opening starts directly in combat; game Sound cues are mixed with licensed recorded music.',
};
json(resolve(out, 'Capture-Manifest.json'), capture);
json(resolve(metadata, 'capture.json'), capture);
console.log(
  `Finished ${final}: ${duration.toFixed(3)}s, ${edit.length} shots, ${sync.length} verified combat accents`,
);
