import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { Renderer } from '../src/render.ts';
import { GAME_VERSION } from '../src/version.ts';
import {
  TrailerIntro,
  introAudio,
  INTRO_SECONDS,
  INTRO_AUDIO_TAIL,
  FOOTSTEPS,
} from './trailer-intro.ts';
import { decodeFootstep } from './trailer-foley.ts';
import {
  planEdit,
  sourceFrame,
  type Beat,
  type EditShot,
  type ClosingMusic,
} from './trailer-edit.ts';
import { trailerSound, INTRO_FOLEY_GAIN, type SoundCue, type BeamFrame } from './trailer-sound.ts';
import { mixTrailer } from './trailer-mix.ts';
import { endingTiming, drawEnding } from './trailer-ending.ts';
import { drawThumbnail } from './trailer-thumbnail.ts';
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
const surveyName = process.argv.find((arg) => arg.startsWith('--survey-name='))?.split('=')[1];
if (surveyName) {
  const previous = JSON.parse(readFileSync(takesPath, 'utf8'));
  writeFileSync(
    takesPath,
    JSON.stringify({ ...previous, ...surveyTakes([surveyName]) }, null, 2) + '\n',
  );
  process.exit(0);
}
if (process.argv.includes('--survey')) {
  writeFileSync(takesPath, JSON.stringify(surveyTakes(), null, 2) + '\n');
  process.exit(0);
}
const takes: Record<string, Take[]> = JSON.parse(readFileSync(takesPath, 'utf8'));
const beatMap: { sourceIn: number; bpm: number; beats: Beat[]; closing: ClosingMusic } = JSON.parse(
  readFileSync('docs/trailer/music-beats.json', 'utf8'),
);
if (process.argv.includes('--edit-survey')) {
  writeFileSync(
    'docs/trailer/edit-plan.json',
    JSON.stringify(planEdit(takes, beatMap.beats), null, 2) + '\n',
  );
  process.exit(0);
}
const W = 1920,
  H = 1080,
  FPS = 60,
  BPM = beatMap.bpm,
  MUSIC_START = beatMap.sourceIn;
const introFrames = Math.round(INTRO_SECONDS * FPS);
const edit: EditShot[] = JSON.parse(readFileSync('docs/trailer/edit-plan.json', 'utf8'));
const scenes = edit.map((shot) => ({
  ...shot,
  start: introFrames + shot.start,
  end: introFrames + shot.end,
}));
const endStart = introFrames + beatMap.closing.titleFrame,
  ending = endingTiming(endStart, introFrames + beatMap.closing.subtitleFrame),
  total = ending.endFrame,
  duration = total / FPS;
const final = resolve(out, 'Recoil-Foundry-Launch-Trailer.mp4');
if (process.argv.includes('--mix-only')) {
  const mix = mixTrailer(
    ffmpeg,
    work,
    music,
    final,
    duration,
    MUSIC_START,
    INTRO_SECONDS,
    ending,
    beatMap.closing,
  );
  const capture = JSON.parse(readFileSync(resolve(out, 'capture.json'), 'utf8'));
  capture.audioMix = mix;
  capture.intro.gainBeforeMix = INTRO_FOLEY_GAIN;
  writeFileSync(resolve(out, 'capture.json'), JSON.stringify(capture, null, 2) + '\n');
  console.log('Remixed trailer', mix);
  process.exit(0);
}
const introOnly = process.argv.includes('--intro-only');
const storyboard =
  process.argv.includes('--storyboard') || process.argv.includes('--thumbnail-only') || introOnly;
if (!storyboard && (!ffmpeg || !existsSync(music)))
  throw new Error('Set FFMPEG and provide the licensed music file (TRAILER_MUSIC).');
const canvas = createCanvas(W, H),
  c = canvas.getContext('2d');
canvas.getBoundingClientRect = () => ({ width: W, height: H });
const poster = createCanvas(W, H);
if (process.argv.includes('--thumbnail-only')) {
  const shot = scenes[9];
  const frame = shot.start + Math.floor((shot.end - shot.start) / 2);
  const source = await loadImage(resolve(work, `frame-${String(frame).padStart(4, '0')}.png`));
  drawThumbnail(c, source);
  writeFileSync(resolve(out, 'Recoil-Foundry-YouTube-Thumbnail.png'), canvas.toBuffer('image/png'));
  process.exit(0);
}
const endingPlate = createCanvas(W, H);
const transitionSamples = [
  -0.3,
  -0.2,
  -0.1,
  -1 / 60,
  0,
  2 / 60,
  4 / 60,
  8 / 60,
  (ending.subtitleFrame - endStart - 1) / FPS,
  (ending.subtitleFrame - endStart) / FPS,
  (ending.subtitleFrame - endStart + 2) / FPS,
  (ending.subtitleFrame - endStart + 6) / FPS,
].map((s) => endStart + Math.round(s * FPS));
const transitionSheet = createCanvas(1600, 750),
  tc = transitionSheet.getContext('2d');
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
const context = new CaptureAudio();
const footsteps = Array.from({ length: 5 }, (_, i) =>
  decodeFootstep(readFileSync(`docs/trailer/foley/footstep_concrete_00${i}.wav`)),
);
const cues: SoundCue[] = [],
  beams: BeamFrame[] = [];
const syncAudit: {
  shot: number;
  kind: string;
  beat: number;
  frame: number;
  expectedFrame: number;
  errorFrames: number;
}[] = [];
const introBuffer = context.createBuffer(
  2,
  Math.ceil((INTRO_SECONDS + INTRO_AUDIO_TAIL) * 48000),
  48000,
);
introAudio(footsteps).forEach((channel, index) => introBuffer.getChannelData(index).set(channel));
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
  const shade = c.createLinearGradient(0, 0, 0, 340);
  shade.addColorStop(0, 'rgba(5,12,16,.78)');
  shade.addColorStop(1, 'rgba(5,12,16,0)');
  c.fillStyle = shade;
  c.fillRect(0, 0, W, 340);
  c.fillStyle = '#e9eadc';
  c.font = '72px "Release Bold"';
  c.textAlign = 'left';
  text.split('\n').forEach((line, n) => c.fillText(line, 96, 132 + n * 78));
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
async function reviewTransition(frame: number) {
  const index = transitionSamples.indexOf(frame);
  if (index < 0) return;
  const png = canvas.toBuffer('image/png');
  const file = `work-action/transition-${frame}.png`;
  writeFileSync(resolve(out, file), png);
  const still = await loadImage(png);
  const x = (index % 4) * 400,
    y = Math.floor(index / 4) * 250;
  tc.drawImage(still, x, y, 400, 225);
  tc.fillStyle = '#071015';
  tc.fillRect(x, y + 225, 400, 25);
  tc.font = '15px "Release Mono"';
  tc.fillStyle = '#e9eadc';
  tc.fillText(`${(frame / FPS).toFixed(3)}s · transition`, x + 8, y + 243);
  reviewFrames.push({ seconds: frame / FPS, file });
}
const intro = new TrailerIntro(canvas);
// Rehearse the exact incoming shot, including the live camera and recoil shake.
const openingCanvas = createCanvas(W, H);
openingCanvas.getBoundingClientRect = () => ({ width: W, height: H });
const openingGame = startTake(scenes[0].take),
  openingRenderer = new Renderer(openingCanvas, openingGame);
openingRenderer.scale = 2.4;
openingRenderer.reset();
for (let tick = 0; tick < scenes[0].take.start; tick++) {
  openingGame.tick(1 / FPS, actionInput(openingGame, tick, scenes[0].take.style));
  if (tick >= scenes[0].take.start - 45) openingRenderer.draw(((tick + 1) * 1000) / FPS);
}
openingGame.tick(1 / FPS, actionInput(openingGame, scenes[0].take.start, scenes[0].take.style));
openingRenderer.scale = 2.455;
openingRenderer.draw(((scenes[0].take.start + 1) * 1000) / FPS);
intro.match = {
  player: openingRenderer.toCanvas(openingGame.player.position),
  scale: openingRenderer.scale,
  aimAngle: Math.atan2(
    openingGame.aim.y - openingGame.player.position.y,
    openingGame.aim.x - openingGame.player.position.x,
  ),
  velocityX: openingGame.player.velocity.x,
};
let openingAudit: object | undefined;
const openingSamples = [
  4.0,
  4.2,
  4.4,
  4.6,
  4.7,
  4.8 - 1 / 60,
  4.8,
  4.8 + 1 / 60,
  4.9,
  5.0,
  5.1,
  5.2,
].map((s) => Math.round(s * FPS));
const openingSheet = createCanvas(1600, 750),
  oc = openingSheet.getContext('2d');
async function reviewOpening(frame: number) {
  const index = openingSamples.indexOf(frame);
  if (index < 0) return;
  const png = canvas.toBuffer('image/png');
  const file = `work-action/opening-${frame}.png`;
  writeFileSync(resolve(out, file), png);
  const x = (index % 4) * 400,
    y = Math.floor(index / 4) * 250;
  oc.drawImage(await loadImage(png), x, y, 400, 225);
  oc.fillStyle = '#071015';
  oc.fillRect(x, y + 225, 400, 25);
  oc.fillStyle = '#e9eadc';
  oc.font = '15px "Release Mono"';
  oc.fillText(`${(frame / FPS).toFixed(3)}s · opening`, x + 8, y + 243);
  reviewFrames.push({ seconds: frame / FPS, file });
}
const introSamples = [0.2, 0.72, 1.24, 1.76, 2.28, 2.8, 3.32, 4.2, 4.783333].map((s) =>
  Math.round(s * FPS),
);
const introSheet = createCanvas(1280, 810),
  ic = introSheet.getContext('2d');
ic.fillStyle = '#071015';
ic.fillRect(0, 0, 1280, 810);
for (let frame = 0; frame < introFrames; frame++) {
  const pose = intro.draw(frame / FPS);
  await reviewOpening(frame);
  if (frame === introFrames - 1) {
    const positionError = Math.hypot(
      pose.player.x - intro.match.player.x,
      pose.player.y - intro.match.player.y,
    );
    const scaleError = Math.abs(pose.scale - intro.match.scale);
    if (positionError > 2 || scaleError > 0.02)
      throw new Error('Opening match cut missed its player alignment');
    openingAudit = {
      outgoing: pose,
      incoming: intro.match,
      positionErrorPixels: positionError,
      scaleError,
      blackGapFrames: 0,
      firstShotFrame: introFrames,
      musicFrame: introFrames,
    };
    writeFileSync(
      resolve(out, 'opening-match-audit.json'),
      JSON.stringify(openingAudit, null, 2) + '\n',
    );
  }
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
  }
}
writeFileSync(resolve(out, 'intro-contact-sheet.png'), introSheet.toBuffer('image/png'));
if (introOnly) {
  context.processTo(INTRO_SECONDS + INTRO_AUDIO_TAIL);
  writeFileSync(
    resolve(work, 'intro-preview.wav'),
    Buffer.from(await context.encodeAudioData(context.exportAsAudioData(), { bitDepth: 24 })),
  );
  console.log('Cold-open storyboard and Foley preview ready');
  process.exit(0);
}
let closingTake:
  | {
      game: ReturnType<typeof startTake>;
      renderer: Renderer;
      take: Take;
      nextTick: number;
      finalTick: number;
      scale: number;
    }
  | undefined;
for (const [index, scene] of scenes.entries()) {
  const take = scene.take,
    g = startTake(take),
    r = new Renderer(canvas, g);
  const baseScale = (
    {
      recoil: 2.4,
      scatter: 2.25,
      prism: 1.95,
      pinwheel: 2.2,
      turf: 1.95,
      saw: 2.25,
      cluster: 2.15,
      storm: 2.15,
      loader: 2.25,
    } as Record<string, number>
  )[take.name];
  r.scale = baseScale;
  r.reset();
  // Run up to the chosen highlight using the same controls used during scouting.
  for (let tick = 0; tick < take.start; tick++) {
    g.tick(1 / FPS, actionInput(g, tick, take.style));
    if (tick >= take.start - 45) r.draw(((tick + 1) * 1000) / FPS);
  }
  const initialHealth = g.hp,
    initialKills = g.kills;
  let outputFrame = scene.start,
    frameKinds: string[] = [];
  g.onSound = (kind) => {
    cues.push({ frame: outputFrame, kind });
    frameKinds.push(kind);
  };
  console.log(
    `Shot ${index + 1}/${scenes.length}: ${take.name}, ${take.seed}, frame ${take.start}`,
  );
  const len = scene.end - scene.start;
  const visibleLength = len;
  const qualityFrames: ActionFrame[] = [];
  const sequenceAt = Array.from({ length: 6 }, (_, n) => Math.round((n * (len - 1)) / 5));
  let targetOnscreenFrames = 0;
  let sourceCursor = take.start;
  for (let local = 0; local < len; local++) {
    const frame = scene.start + local,
      tick = take.start + Math.round(sourceFrame(scene.points, local));
    outputFrame = frame;
    while (sourceCursor <= tick) {
      frameKinds = [];
      const wasTorch = g.torch.active;
      const metric = recordAction(g, actionInput(g, sourceCursor, take.style));
      qualityFrames.push(metric);
      if (g.torch.active && !wasTorch) frameKinds.push('beam-start');
      if (g.torch.active && metric.damage > 2) frameKinds.push('beam-hit');
      for (const point of scene.points.filter(
        (p) => p.kind !== 'end' && take.start + p.source === sourceCursor,
      )) {
        if (!frameKinds.includes(point.kind))
          throw new Error(`Missing planned ${point.kind} in shot ${index + 1}`);
        const errorFrames = local - point.output;
        if (errorFrames !== 0)
          throw new Error(`Off-beat impact in shot ${index + 1}: ${errorFrames} frames`);
        syncAudit.push({
          shot: index + 1,
          kind: point.kind,
          beat: point.beat!,
          frame,
          expectedFrame: scene.start + point.output,
          errorFrames,
        });
      }
      sourceCursor++;
    }
    if (g.mode !== 'playing' || g.clear)
      throw new Error(`Highlight ended: ${take.name} ${tick} ${g.mode}`);
    if (g.torch.active) beams.push({ frame, heat: g.torch.heat });
    const sample = local === Math.floor(len / 2);
    // Draw every frame even in storyboard mode so the review uses the final camera.
    const punch = Math.max(
      0,
      ...scene.points
        .filter((p) => p.kind !== 'end' && p.output <= local)
        .map((p) => 0.055 * Math.exp(-(local - p.output) / 6)),
    );
    r.scale = baseScale + 0.08 * ease(local / len) + punch;
    r.draw(((tick + 1) * 1000) / FPS);
    const ax = (g.aim.x - r.camera.x) * r.scale,
      ay = (g.aim.y - r.camera.y) * r.scale;
    if (ax > 35 && ax < W - 35 && ay > 65 && ay < H - 35) targetOnscreenFrames++;
    if (!storyboard || sample || sequenceAt.includes(local) || transitionSamples.includes(frame)) {
      c.setTransform(1, 0, 0, 1, 0, 0);
      if (index === 0 && local < 10) {
        c.fillStyle = `rgba(2,8,12,${0.12 * (1 - ease(local / 10))})`;
        c.fillRect(0, 0, W, H);
      }
      if (index === 9 && sample)
        poster.getContext('2d').putImageData(c.getImageData(0, 0, W, H), 0, 0);
      // Hide editorial HUD; the live simulation still has health and damage.
      const captionAlpha = ease(local / 6) * (1 - ease((local - len + 16) / 16));
      if (index === 0)
        caption(
          'EVERY SHOT\nMOVES YOU.',
          ease((local - 12) / 6) * (1 - ease((local - len + 16) / 16)),
        );
      if (index === 2) caption('ONE GUN.\nYOUR BUILD.', captionAlpha);
      if (index === 8) caption('CLOCK OUT\nALIVE.', captionAlpha);
      await reviewTransition(frame);
      await reviewOpening(frame);
      if (sample) await review(frame, take.name, index);
      if (sequenceAt.includes(local))
        await reviewSequence(index, sequenceAt.indexOf(local), frame, take.name);
      await writeFrame();
    }
  }
  if (index === scenes.length - 1)
    closingTake = {
      game: g,
      renderer: r,
      take,
      nextTick: sourceCursor,
      finalTick: sourceCursor - 1,
      scale: r.scale,
    };
  const quality = takeQuality(qualityFrames);
  const targetOnscreenFraction = targetOnscreenFrames / visibleLength;
  if (!usableAction(quality, visibleLength) || targetOnscreenFraction < 0.75)
    rejected.push(`Shot ${index + 1}: ${JSON.stringify({ quality, targetOnscreenFraction })}`);
  manifest.push({
    ...take,
    timelineStart: scene.start / FPS,
    seconds: len / FPS,
    visibleSeconds: visibleLength / FPS,
    initialHealth,
    finalHealth: g.hp,
    killsDuringClip: g.kills - initialKills,
    layout: g.level.name,
    quality,
    targetOnscreenFraction,
    cameraScale: [baseScale, baseScale + 0.135],
    fromBeat: scene.fromBeat,
    toBeat: scene.toBeat,
    retiming: scene.points,
  });
}
const endingSamples = [
  endStart,
  endStart + 12,
  ending.subtitleFrame,
  ending.subtitleFrame + 9,
  ending.ctaFrame + 6,
  ending.linkFrame + 18,
  endStart + 228,
  ending.fadeStartFrame + 30,
  ending.endFrame - 12,
].sort((a, b) => a - b);
const endingSheet = createCanvas(1440, 900),
  ec = endingSheet.getContext('2d');
for (let frame = endStart; frame < total; frame++) {
  let liveGameplay = false;
  if (frame < ending.transitionEndFrame) {
    if (!closingTake) throw new Error('Missing final gameplay continuation');
    const { game: g, renderer: r, take } = closingTake;
    const target = closingTake.finalTick + Math.ceil((frame - endStart + 1) / 2);
    g.onSound = (kind) => cues.push({ frame, kind });
    while (closingTake.nextTick <= target) {
      g.tick(1 / FPS, actionInput(g, closingTake.nextTick, take.style));
      closingTake.nextTick++;
    }
    if (g.mode !== 'playing' || g.clear)
      throw new Error('Final action ended during title transition');
    if (g.torch.active) beams.push({ frame, heat: g.torch.heat });
    r.scale = closingTake.scale;
    r.draw((closingTake.nextTick * 1000) / FPS);
    endingPlate.getContext('2d').putImageData(c.getImageData(0, 0, W, H), 0, 0);
    liveGameplay = true;
  }
  const sample = frame === endStart + 3 * FPS;
  const endingSample = endingSamples.indexOf(frame);
  if (!storyboard || sample || endingSample >= 0 || transitionSamples.includes(frame)) {
    drawEnding(c, frame, ending, liveGameplay ? endingPlate : undefined);
    await reviewTransition(frame);
    if (sample) await review(frame, 'play free', scenes.length);
    if (endingSample >= 0) {
      const png = canvas.toBuffer('image/png');
      const file = `work-action/ending-${String(frame).padStart(4, '0')}.png`;
      writeFileSync(resolve(out, file), png);
      const still = await loadImage(png);
      const x = (endingSample % 3) * 480,
        y = Math.floor(endingSample / 3) * 300;
      ec.drawImage(still, x, y, 480, 270);
      ec.fillStyle = '#071015';
      ec.fillRect(x, y + 270, 480, 30);
      ec.font = '17px "Release Mono"';
      ec.fillStyle = '#e9eadc';
      ec.fillText(`${(frame / FPS).toFixed(2)}s · ending`, x + 12, y + 292);
      reviewFrames.push({ seconds: frame / FPS, file });
    }
    await writeFrame();
  }
}
writeFileSync(resolve(out, 'ending-contact-sheet.png'), endingSheet.toBuffer('image/png'));
writeFileSync(resolve(out, 'opening-contact-sheet.png'), openingSheet.toBuffer('image/png'));
writeFileSync(resolve(out, 'transition-contact-sheet.png'), transitionSheet.toBuffer('image/png'));
writeFileSync(resolve(out, 'action-contact-sheet.png'), sheet.toBuffer('image/png'));
for (const [index, sequence] of sequences.entries())
  writeFileSync(resolve(out, `action-sequence-${index + 1}.png`), sequence.toBuffer('image/png'));
writeFileSync(
  resolve(out, 'shot-review.json'),
  JSON.stringify({ scenes: manifest, rejected }, null, 2) + '\n',
);
writeFileSync(resolve(out, 'sync-audit.json'), JSON.stringify(syncAudit, null, 2) + '\n');
writeFileSync(resolve(work, 'sound-cues.json'), JSON.stringify({ cues, beams }, null, 2) + '\n');
if (video) {
  video.stdin.end();
  const [code] = await encoded!;
  if (code !== 0) throw new Error(`Picture encoding failed: ${code}`);
}
if (rejected.length) throw new Error(`Unusable action shots:\n${rejected.join('\n')}`);

// The thumbnail uses action from the same edit and the established game wordmark.
drawThumbnail(c, poster);
writeFileSync(resolve(out, 'Recoil-Foundry-YouTube-Thumbnail.png'), canvas.toBuffer('image/png'));
if (storyboard) {
  console.log('Storyboard ready');
  process.exit(0);
}

const data = trailerSound(cues, beams, duration, ending, footsteps);
const effectsLevels = scenes.map((scene, index) => {
  let sum = 0,
    peak = 0,
    count = 0;
  for (const channel of data.channelData)
    for (
      let i = Math.round((scene.start / FPS) * 48000);
      i < Math.round((scene.end / FPS) * 48000);
      i++
    ) {
      sum += channel[i] * channel[i];
      peak = Math.max(peak, Math.abs(channel[i]));
      count++;
    }
  const rmsDb = 20 * Math.log10(Math.sqrt(sum / count));
  if (rmsDb < -33 || peak < 0.15)
    throw new Error(`Inaudible effects in shot ${index + 1}: ${rmsDb} dB, peak ${peak}`);
  return { shot: index + 1, rmsDb, peak };
});
writeFileSync(
  resolve(work, 'effects.wav'),
  Buffer.from(await context.encodeAudioData(data, { bitDepth: 24 })),
);
writeFileSync(resolve(work, 'effects-audit.json'), JSON.stringify(data.audit, null, 2) + '\n');
const mix = mixTrailer(
  ffmpeg,
  work,
  music,
  final,
  duration,
  MUSIC_START,
  INTRO_SECONDS,
  ending,
  beatMap.closing,
);
writeFileSync(
  resolve(out, 'capture.json'),
  JSON.stringify(
    {
      version: GAME_VERSION,
      revision: 11,
      width: W,
      height: H,
      fps: FPS,
      seconds: duration,
      frames: total,
      cameraScale: [1.95, 2.535],
      playback:
        'Original fixed-step simulation, gently retimed between actual combat events and measured musical transients',
      bpm: BPM,
      audioMix: mix,
      effects: data.audit,
      impactMix: data.impactMix,
      effectsLevels,
      beatSync: syncAudit,
      ending: {
        ...ending,
        method:
          'Final gameplay follows the recorded closing phrase; RECOIL appears fully on its penultimate accent and FOUNDRY on its final accent, with a six-frame trace of the last shot; CTA during the natural ring-out, 1.2-second fade during the natural decay and half-second black tail',
        sound:
          'The original recording supplies the closing fill, both title accents and the natural ring-out. Combat effects ease back before the title; no added rise, title stinger or echo.',
        musicalAccents: [
          {
            word: 'RECOIL',
            frame: endStart,
            sourceSeconds: beatMap.closing.titleSourceSeconds,
            errorMs: beatMap.closing.titleFrameErrorMs,
          },
          {
            word: 'FOUNDRY',
            frame: ending.subtitleFrame,
            sourceSeconds: beatMap.closing.subtitleSourceSeconds,
            errorMs: beatMap.closing.subtitleFrameErrorMs,
          },
        ],
      },
      music: {
        title: 'Resonance',
        artist: 'Scott Buckley',
        source: 'https://www.scottbuckley.com.au/library/resonance/',
        license: 'CC BY 4.0',
        sourceIn: MUSIC_START,
        sourceOut: beatMap.closing.sourceOut,
        segments: [
          {
            sourceIn: MUSIC_START,
            sourceOut: MUSIC_START + beatMap.closing.spliceFrame / FPS,
            timelineStart: INTRO_SECONDS,
          },
          {
            sourceIn: beatMap.closing.sourceIn,
            sourceOut: beatMap.closing.sourceOut,
            timelineStart: INTRO_SECONDS + beatMap.closing.spliceFrame / FPS,
            overlapSeconds: beatMap.closing.crossfadeSeconds,
          },
        ],
        timelineStart: INTRO_SECONDS,
        edit: 'Two phrase-aligned excerpts, 25ms crossfade, entry fade, EQ and brief ducking beneath effects; original final accents and natural ring-out retained',
      },
      intro: {
        seconds: INTRO_SECONDS,
        method:
          'Editorial animation using game scenery, outfit and weapon renderer; shared heel-plant timing with CC0 Kenney concrete footfalls; original factory ambience and mechanical clicks; camera pullback matches the first gameplay shot without a black gap',
        footsteps: FOOTSTEPS,
        footstepSource: 'Kenney Impact Sounds, CC0; see docs/trailer/foley/README.md',
        handoff: openingAudit,
        gainBeforeMix: INTRO_FOLEY_GAIN,
        music: false,
        cutToAction: INTRO_SECONDS,
      },
      method:
        'Editorial cold open, followed by actual Game and Renderer; legal checkpoint builds, active health, recoil, collision and enemy AI; beat-aligned event selection, gentle retiming and camera accents; original game Sound cues remixed with licensed music',
      scenes: manifest,
      reviewFrames,
    },
    null,
    2,
  ) + '\n',
);
console.log(`Finished ${final} (${duration.toFixed(2)} seconds)`);
