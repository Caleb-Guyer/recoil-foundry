import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { Renderer } from '../src/render.ts';
import { Sound } from '../src/audio.ts';
import { seeded } from '../src/rules.ts';
import { GAME_VERSION } from '../src/version.ts';
import { TrailerIntro, introAudio, INTRO_SECONDS, FOOTSTEPS } from './trailer-intro.ts';
import {
  actionInput,
  recordAction,
  startTake,
  surveyTakes,
  takeQuality,
  usableAction,
  type ActionFrame,
  type Take,
} from './trailer-scenes.ts';

// Actual engine captures, editorial camera/cuts, licensed recorded music.
// See docs/trailer/music-license.md for the source and required attribution.
const native = createRequire(resolve(process.env.MEDIA_MODULE_ROOT!, 'package.json'));
const audio = createRequire(resolve('.media-tools/audio/package.json'));
const { createCanvas, GlobalFonts, loadImage } = native('@napi-rs/canvas');
const { RenderingAudioContext } = audio('web-audio-engine');
for (const [file, family] of [
  ['arial.ttf', 'Release Sans'],
  ['arialbd.ttf', 'Release Bold'],
  ['consola.ttf', 'Release Mono'],
]) {
  if (!GlobalFonts.registerFromPath(resolve(process.env.MEDIA_FONT_DIR!, file), family))
    throw new Error(`Missing font ${file}`);
}
Object.defineProperty(globalThis, 'devicePixelRatio', { value: 1 });
const ffmpeg = process.env.FFMPEG!;
const music = resolve(process.env.TRAILER_MUSIC ?? '.media-tools/music/resonance.mp3');
const out = resolve(process.env.TRAILER_OUT ?? '../recoil-foundry-trailer');
const work = resolve(out, 'work-action');
mkdirSync(work, { recursive: true });
const takesPath = resolve(process.env.TRAILER_TAKES ?? 'docs/trailer/action-takes.json');
if (process.argv.includes('--survey')) {
  writeFileSync(takesPath, JSON.stringify(surveyTakes(), null, 2) + '\n');
  process.exit(0);
}
const takes: Record<string, Take[]> = JSON.parse(readFileSync(takesPath, 'utf8'));
const W = 1920,
  H = 1080,
  FPS = 60,
  BPM = 100,
  MUSIC_START = 163.276;
const frameAtBeat = (b: number) => Math.round(((b * 60) / BPM) * FPS);
const introFrames = Math.round(INTRO_SECONDS * FPS);
const montage = [
  ['cluster', 0, 0, 2],
  ['pinwheel', 0, 2, 6],
  ['scatter', 0, 6, 10],
  ['prism', 0, 10, 14],
  ['turf', 0, 14, 18],
  ['saw', 2, 18, 22],
  ['cluster', 1, 22, 26],
  ['pinwheel', 1, 26, 30],
  ['loader', 0, 30, 34],
  ['storm', 0, 34, 38],
  ['scatter', 2, 38, 42],
  ['prism', 1, 42, 45],
  ['saw', 1, 45, 48],
  ['turf', 1, 48, 50],
  ['cluster', 2, 50, 52],
  ['pinwheel', 2, 52, 54],
] as const;
const scenes = montage.map(([name, choice, from, to]) => ({
  take: takes[name][choice],
  start: introFrames + frameAtBeat(from),
  end: introFrames + frameAtBeat(to),
}));
const endStart = introFrames + frameAtBeat(54),
  total = introFrames + frameAtBeat(62),
  duration = total / FPS;
const introOnly = process.argv.includes('--intro-only');
const storyboard = process.argv.includes('--storyboard') || introOnly;
if (!storyboard && (!ffmpeg || !existsSync(music)))
  throw new Error('Set FFMPEG and provide the licensed music file (TRAILER_MUSIC).');
const canvas = createCanvas(W, H),
  c = canvas.getContext('2d');
canvas.getBoundingClientRect = () => ({ width: W, height: H });
const poster = createCanvas(W, H);
const sheet = createCanvas(1280, Math.ceil((scenes.length + 1) / 3) * 270),
  sc = sheet.getContext('2d');
const sequences = Array.from({ length: Math.ceil(scenes.length / 4) }, () =>
  createCanvas(1920, 840),
);
sc.fillStyle = '#071015';
sc.fillRect(0, 0, sheet.width, sheet.height);
const ease = (x: number) => {
  const t = Math.max(0, Math.min(1, x));
  return t * t * (3 - 2 * t);
};

class CaptureAudio extends RenderingAudioContext {
  constructor() {
    super({ sampleRate: 48000, numberOfChannels: 2, blockSize: 128 });
  }
  get state() {
    return 'running';
  }
}
Object.defineProperty(globalThis, 'AudioContext', { value: CaptureAudio });
Math.random = seeded('RF-ACTION-TRAILER-AUDIO');
const sound = new Sound();
sound.unlock();
sound.musicEnabled = false;
if (!sound.context) throw new Error('Audio initialization failed');
const context = sound.context as unknown as CaptureAudio;
// Keep the offline graph active across effect gaps without adding audible content.
const keeper = context.createOscillator(),
  zero = context.createGain();
zero.gain.value = 0;
keeper.connect(zero);
zero.connect(sound.master!);
keeper.start();
const introBuffer = context.createBuffer(2, Math.ceil((INTRO_SECONDS + 0.12) * 48000), 48000);
introAudio().forEach((channel, index) => introBuffer.getChannelData(index).set(channel));
const introVoice = context.createBufferSource();
introVoice.buffer = introBuffer;
introVoice.connect(context.destination);
introVoice.start(0);

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
        '18',
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
const manifest: object[] = [],
  reviewFrames: object[] = [];
const rejected: string[] = [];

function caption(text: string, alpha: number) {
  c.save();
  c.globalAlpha = alpha;
  const shade = c.createLinearGradient(0, 0, 0, 300);
  shade.addColorStop(0, 'rgba(5,12,16,.8)');
  shade.addColorStop(1, 'rgba(5,12,16,0)');
  c.fillStyle = shade;
  c.fillRect(0, 0, W, 300);
  c.fillStyle = '#e9eadc';
  c.font = '86px "Release Bold"';
  c.textAlign = 'left';
  c.fillText(text, 76, 172);
  c.restore();
}
function card(t: number) {
  c.drawImage(poster, 0, 0);
  c.fillStyle = 'rgba(7,16,20,.9)';
  c.fillRect(0, 0, W, H);
  c.save();
  c.globalAlpha = ease(t / 0.18);
  c.textAlign = 'center';
  c.fillStyle = '#e9eadc';
  c.font = '214px "Release Bold"';
  c.fillText('RECOIL', W / 2, 420);
  c.fillStyle = '#acc3b6';
  c.font = '70px "Release Mono"';
  c.fillText('F O U N D R Y', W / 2, 521);
  c.fillStyle = '#e9eadc';
  c.font = '41px "Release Sans"';
  c.fillText('One gun. All recoil.', W / 2, 632);
  c.fillStyle = '#acc3b6';
  c.fillRect(W / 2 - 40, 694, 80, 3);
  c.fillStyle = '#e9eadc';
  c.font = '40px "Release Bold"';
  c.fillText('PLAY FREE IN YOUR BROWSER', W / 2, 787);
  c.fillStyle = '#acc3b6';
  c.font = '31px "Release Mono"';
  c.fillText('caleb-guyer.itch.io/recoil-foundry', W / 2, 852);
  c.restore();
}
async function review(frame: number, label: string, index: number) {
  const file = `work-action/frame-${String(frame).padStart(4, '0')}.png`;
  const png = canvas.toBuffer('image/png');
  writeFileSync(resolve(out, file), png);
  const still = await loadImage(png);
  sc.drawImage(still, (index % 3) * 426, Math.floor(index / 3) * 270, 426, 240);
  sc.font = '17px "Release Mono"';
  sc.fillStyle = '#e9eadc';
  sc.fillText(
    `${(frame / FPS).toFixed(1)}s · ${label}`,
    (index % 3) * 426 + 10,
    Math.floor(index / 3) * 270 + 261,
  );
  reviewFrames.push({ seconds: frame / FPS, file });
}
async function writeFrame() {
  if (video && !video.stdin.write(Buffer.from(c.getImageData(0, 0, W, H).data)))
    await once(video.stdin, 'drain');
}
async function reviewSequence(index: number, sample: number, frame: number, label: string) {
  const still = await loadImage(canvas.toBuffer('image/png'));
  const ctx = sequences[Math.floor(index / 4)].getContext('2d');
  const x = sample * 320,
    y = (index % 4) * 210;
  ctx.drawImage(still, x, y, 320, 180);
  ctx.fillStyle = '#071015';
  ctx.fillRect(x, y + 180, 320, 30);
  ctx.font = '15px "Release Mono"';
  ctx.fillStyle = '#e9eadc';
  ctx.fillText(`${index + 1}. ${label} ${(frame / FPS).toFixed(2)}s`, x + 8, y + 201);
}
const intro = new TrailerIntro(canvas);
const introSamples = [0.25, 0.9, 1.5, 2.1, 2.74, 3.98, 4.66, 5.3, 5.8].map((s) =>
  Math.round(s * FPS),
);
const introSheet = createCanvas(1280, 810),
  ic = introSheet.getContext('2d');
ic.fillStyle = '#071015';
ic.fillRect(0, 0, 1280, 810);
for (let frame = 0; frame < introFrames; frame++) {
  intro.draw(frame / FPS);
  const index = introSamples.indexOf(frame);
  if (index >= 0) {
    const png = canvas.toBuffer('image/png');
    const file = `work-action/intro-${String(frame).padStart(4, '0')}.png`;
    writeFileSync(resolve(out, file), png);
    const still = await loadImage(png);
    const x = (index % 3) * 426,
      y = Math.floor(index / 3) * 270;
    ic.drawImage(still, x, y, 426, 240);
    ic.fillStyle = '#e9eadc';
    ic.font = '17px "Release Mono"';
    ic.fillText(`${(frame / FPS).toFixed(2)}s · cold open`, x + 10, y + 261);
    reviewFrames.push({ seconds: frame / FPS, file });
  }
  if (!storyboard) {
    await writeFrame();
    context.processTo((frame + 1) / FPS);
  }
}
writeFileSync(resolve(out, 'intro-contact-sheet.png'), introSheet.toBuffer('image/png'));
if (introOnly) {
  context.processTo(INTRO_SECONDS + 0.12);
  writeFileSync(
    resolve(work, 'intro-preview.wav'),
    Buffer.from(await context.encodeAudioData(context.exportAsAudioData(), { bitDepth: 24 })),
  );
  console.log('Cold-open storyboard and Foley preview ready');
  process.exit(0);
}
for (const [index, scene] of scenes.entries()) {
  sound.updateTorch(false);
  const take = scene.take,
    g = startTake(take),
    r = new Renderer(canvas, g);
  r.scale = 2.05;
  r.reset();
  // Run up to the chosen highlight using the same controls used during scouting.
  for (let tick = 0; tick < take.start; tick++) {
    g.tick(1 / FPS, actionInput(g, tick, take.style));
    if (tick >= take.start - 45) r.draw(((tick + 1) * 1000) / FPS);
  }
  const initialHealth = g.hp,
    initialKills = g.kills;
  g.onSound = (kind) => {
    if (!storyboard) sound.play(kind);
  };
  console.log(
    `Shot ${index + 1}/${scenes.length}: ${take.name}, ${take.seed}, frame ${take.start}`,
  );
  const len = scene.end - scene.start;
  const qualityFrames: ActionFrame[] = [];
  const sequenceAt = Array.from({ length: 6 }, (_, n) => Math.round((n * (len - 1)) / 5));
  let targetOnscreenFrames = 0;
  for (let local = 0; local < len; local++) {
    const frame = scene.start + local,
      tick = take.start + local;
    qualityFrames.push(recordAction(g, actionInput(g, tick, take.style)));
    if (g.mode !== 'playing' || g.clear)
      throw new Error(`Highlight ended: ${take.name} ${tick} ${g.mode}`);
    sound.updateTorch(g.torch.active, g.torch.heat);
    const sample = local === Math.floor(len / 2);
    // Draw every frame even in storyboard mode so the review uses the final camera.
    r.scale = 2.05 + 0.1 * ease(local / len);
    r.draw(((tick + 1) * 1000) / FPS);
    const ax = (g.aim.x - r.camera.x) * r.scale,
      ay = (g.aim.y - r.camera.y) * r.scale;
    if (ax > 35 && ax < W - 35 && ay > 65 && ay < H - 35) targetOnscreenFrames++;
    if (!storyboard || sample || sequenceAt.includes(local)) {
      c.setTransform(1, 0, 0, 1, 0, 0);
      if (index === 0 && sample)
        poster.getContext('2d').putImageData(c.getImageData(0, 0, W, H), 0, 0);
      // The small original HUD remains grounded in this take's actual state.
      c.fillStyle = '#40504d';
      c.fillRect(36, 34, 162, 7);
      c.fillStyle = '#e9eadc';
      c.fillRect(36, 34, (162 * Math.max(0, g.hp)) / 100, 7);
      c.font = '18px "Release Mono"';
      c.textAlign = 'right';
      c.fillStyle = '#b0bbb4';
      c.fillText(`${String(g.stage + 1).padStart(2, '0')} / 20`, W - 42, 44);
      c.textAlign = 'left';
      if (index === 0) caption('ONE GUN.', ease(local / 6));
      if (index === 2)
        caption('100 WAYS TO BUILD IT.', ease(local / 6) * (1 - ease((local - len + 16) / 16)));
      if (index === 6)
        caption('MAKE SOME ROOM.', ease(local / 6) * (1 - ease((local - len + 16) / 16)));
      if (sample) await review(frame, take.name, index);
      if (sequenceAt.includes(local))
        await reviewSequence(index, sequenceAt.indexOf(local), frame, take.name);
      await writeFrame();
    }
    if (!storyboard) context.processTo((frame + 1) / FPS);
  }
  const quality = takeQuality(qualityFrames);
  const targetOnscreenFraction = targetOnscreenFrames / len;
  if (!usableAction(quality, len) || targetOnscreenFraction < 0.75)
    rejected.push(`Shot ${index + 1}: ${JSON.stringify({ quality, targetOnscreenFraction })}`);
  manifest.push({
    ...take,
    timelineStart: scene.start / FPS,
    seconds: len / FPS,
    initialHealth,
    finalHealth: g.hp,
    killsDuringClip: g.kills - initialKills,
    layout: g.level.name,
    quality,
    targetOnscreenFraction,
  });
}
sound.updateTorch(false);
for (let frame = endStart; frame < total; frame++) {
  const sample = frame === endStart + FPS;
  if (!storyboard || sample) {
    card((frame - endStart) / FPS);
    if (sample) await review(frame, 'play free', scenes.length);
    await writeFrame();
  }
  if (!storyboard) context.processTo((frame + 1) / FPS);
}
writeFileSync(resolve(out, 'action-contact-sheet.png'), sheet.toBuffer('image/png'));
for (const [index, sequence] of sequences.entries())
  writeFileSync(resolve(out, `action-sequence-${index + 1}.png`), sequence.toBuffer('image/png'));
writeFileSync(
  resolve(out, 'shot-review.json'),
  JSON.stringify({ scenes: manifest, rejected }, null, 2) + '\n',
);
if (video) {
  video.stdin.end();
  const [code] = await encoded!;
  if (code !== 0) throw new Error(`Picture encoding failed: ${code}`);
}
if (rejected.length) throw new Error(`Unusable action shots:\n${rejected.join('\n')}`);

// The thumbnail uses action from the same edit and the established game wordmark.
c.drawImage(poster, 0, 0);
const shade = c.createLinearGradient(0, 0, W, 0);
shade.addColorStop(0, 'rgba(7,16,20,.95)');
shade.addColorStop(0.5, 'rgba(7,16,20,.6)');
shade.addColorStop(1, 'rgba(7,16,20,.05)');
c.fillStyle = shade;
c.fillRect(0, 0, W, H);
c.fillStyle = '#e9eadc';
c.font = '200px "Release Bold"';
c.fillText('RECOIL', 100, 405);
c.fillStyle = '#acc3b6';
c.font = '70px "Release Mono"';
c.fillText('F O U N D R Y', 106, 520);
c.fillStyle = '#e9eadc';
c.font = '47px "Release Bold"';
c.fillText('ONE GUN. ALL RECOIL.', 108, 689);
c.fillStyle = '#acc3b6';
c.fillRect(110, 774, 62, 4);
c.font = '30px "Release Mono"';
c.fillText('OFFICIAL LAUNCH TRAILER', 110, 849);
writeFileSync(resolve(out, 'Recoil-Foundry-YouTube-Thumbnail.png'), canvas.toBuffer('image/png'));
if (storyboard) {
  console.log('Storyboard ready');
  process.exit(0);
}

const data = context.exportAsAudioData();
writeFileSync(
  resolve(work, 'effects.wav'),
  Buffer.from(await context.encodeAudioData(data, { bitDepth: 24 })),
);
const final = resolve(out, 'Recoil-Foundry-Launch-Trailer.mp4');
const mux = spawnSync(
  ffmpeg,
  [
    '-hide_banner',
    '-y',
    '-i',
    resolve(work, 'picture.mp4'),
    '-i',
    resolve(work, 'effects.wav'),
    '-ss',
    String(MUSIC_START),
    '-i',
    music,
    '-filter_complex',
    `[1:a]highpass=f=65,volume=1.6[fx];[2:a]atrim=duration=${duration - INTRO_SECONDS},asetpts=PTS-STARTPTS,volume=0.9,afade=t=in:d=0.03,afade=t=out:st=${duration - INTRO_SECONDS - 0.65}:d=0.65,adelay=${INTRO_SECONDS * 1000}:all=1[song];[song][fx]amix=inputs=2:duration=first:normalize=0,loudnorm=I=-14:TP=-2:LRA=9,volume='if(lt(t,${INTRO_SECONDS}),0.25,1)':eval=frame,aresample=48000[a]`,
    '-map',
    '0:v:0',
    '-map',
    '[a]',
    '-c:v',
    'copy',
    '-c:a',
    'aac',
    '-b:a',
    '384k',
    '-ar',
    '48000',
    '-ac',
    '2',
    '-t',
    String(duration),
    '-movflags',
    '+faststart',
    '-metadata',
    'title=Recoil Foundry | Official Launch Trailer',
    '-metadata',
    'comment=Music: Resonance by Scott Buckley, CC BY 4.0, www.scottbuckley.com.au. Edited excerpt with game sound effects.',
    final,
  ],
  { stdio: ['ignore', 'ignore', 'inherit'] },
);
if (mux.status !== 0) throw new Error('Final mux failed');
writeFileSync(
  resolve(out, 'capture.json'),
  JSON.stringify(
    {
      version: GAME_VERSION,
      revision: 4,
      width: W,
      height: H,
      fps: FPS,
      seconds: duration,
      frames: total,
      cameraScale: [2.05, 2.15],
      playbackSpeed: 1,
      bpm: BPM,
      music: {
        title: 'Resonance',
        artist: 'Scott Buckley',
        source: 'https://www.scottbuckley.com.au/library/resonance/',
        license: 'CC BY 4.0',
        sourceIn: MUSIC_START,
        sourceOut: MUSIC_START + duration - INTRO_SECONDS,
        timelineStart: INTRO_SECONDS,
        edit: 'Excerpt, fades, level adjustment, delayed until the first combat cut, mixed with game effects',
      },
      intro: {
        seconds: INTRO_SECONDS,
        method:
          'Editorial animation using game scenery, outfit and weapon renderer; keyframed walk, lighting and camera; original synthesized factory ambience, footsteps, relay and weapon clicks',
        footsteps: FOOTSTEPS,
        gainAfterNormalization: 0.25,
        music: false,
        cutToAction: INTRO_SECONDS,
      },
      method:
        'Editorial cold open, followed by actual Game, Renderer and Sound; real-time scripted combat inputs, legal checkpoint builds; active health, recoil, collision and enemy AI; editorial zoom/cuts/type; licensed recorded music',
      scenes: manifest,
      reviewFrames,
    },
    null,
    2,
  ) + '\n',
);
console.log(`Finished ${final} (${duration.toFixed(2)} seconds)`);
