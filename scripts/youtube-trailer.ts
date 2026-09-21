import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { Renderer } from '../src/render.ts';
import { GAME_VERSION } from '../src/version.ts';
import { TrailerIntro, introAudio, INTRO_SECONDS, FOOTSTEPS } from './trailer-intro.ts';
import { planEdit, sourceFrame, type Beat, type EditShot } from './trailer-edit.ts';
import { trailerSound, INTRO_FOLEY_GAIN, type SoundCue, type BeamFrame } from './trailer-sound.ts';
import { mixTrailer } from './trailer-mix.ts';
import { endingTiming, drawEnding } from './trailer-ending.ts';
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
const beatMap: { sourceIn: number; bpm: number; beats: Beat[] } = JSON.parse(
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
const frameAtBeat = (b: number) => beatMap.beats[b].frame;
const introFrames = Math.round(INTRO_SECONDS * FPS);
const edit: EditShot[] = JSON.parse(readFileSync('docs/trailer/edit-plan.json', 'utf8'));
const scenes = edit.map((shot) => ({
  ...shot,
  start: introFrames + shot.start,
  end: introFrames + shot.end,
}));
const endStart = introFrames + frameAtBeat(52),
  ending = endingTiming(endStart),
  total = ending.endFrame,
  duration = total / FPS;
const final = resolve(out, 'Recoil-Foundry-Launch-Trailer.mp4');
if (process.argv.includes('--mix-only')) {
  const mix = mixTrailer(ffmpeg, work, music, final, duration, MUSIC_START, INTRO_SECONDS, ending);
  const capture = JSON.parse(readFileSync(resolve(out, 'capture.json'), 'utf8'));
  capture.audioMix = mix;
  capture.intro.gainBeforeMix = INTRO_FOLEY_GAIN;
  writeFileSync(resolve(out, 'capture.json'), JSON.stringify(capture, null, 2) + '\n');
  console.log('Remixed trailer', mix);
  process.exit(0);
}
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
const context = new CaptureAudio();
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
  const visibleLength = Math.min(scene.end, ending.breathFrame) - scene.start;
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
      if (frame < ending.breathFrame) qualityFrames.push(metric);
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
    r.scale = 2.05 + 0.1 * ease(local / len) + punch;
    r.draw(((tick + 1) * 1000) / FPS);
    const ax = (g.aim.x - r.camera.x) * r.scale,
      ay = (g.aim.y - r.camera.y) * r.scale;
    if (frame < ending.breathFrame && ax > 35 && ax < W - 35 && ay > 65 && ay < H - 35)
      targetOnscreenFrames++;
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
      if (frame >= ending.breathFrame) {
        c.fillStyle = '#000000';
        c.fillRect(0, 0, W, H);
      }
      if (sample) await review(frame, take.name, index);
      if (sequenceAt.includes(local))
        await reviewSequence(index, sequenceAt.indexOf(local), frame, take.name);
      await writeFrame();
    }
  }
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
    fromBeat: scene.fromBeat,
    toBeat: scene.toBeat,
    retiming: scene.points,
  });
}
const endingSamples = [0, 0.15, 0.7, 1.3, 1.9, 3.8, 5.9, 6.6, 7.4].map(
  (s) => endStart + Math.round(s * FPS),
);
const endingSheet = createCanvas(1440, 900),
  ec = endingSheet.getContext('2d');
for (let frame = endStart; frame < total; frame++) {
  const sample = frame === endStart + 3 * FPS;
  const endingSample = endingSamples.indexOf(frame);
  if (!storyboard || sample || endingSample >= 0) {
    drawEnding(c, frame, ending);
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

const data = trailerSound(cues, beams, duration, ending);
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
const mix = mixTrailer(ffmpeg, work, music, final, duration, MUSIC_START, INTRO_SECONDS, ending);
writeFileSync(
  resolve(out, 'capture.json'),
  JSON.stringify(
    {
      version: GAME_VERSION,
      revision: 6,
      width: W,
      height: H,
      fps: FPS,
      seconds: duration,
      frames: total,
      cameraScale: [2.05, 2.21],
      playback:
        'Original fixed-step simulation, gently retimed between actual combat events and measured musical transients',
      bpm: BPM,
      audioMix: mix,
      effects: data.audit,
      effectsLevels,
      beatSync: syncAudit,
      ending: {
        ...ending,
        method:
          'Four single-beat combat cuts, 12-frame picture and audio pause, downbeat wordmark impact, delayed CTA and link, 1.2-second fade and 0.5-second black tail',
        sound:
          'Original rising industrial air, metal impact and factory room tail; licensed music downbeat resolves through a short echo tail',
      },
      music: {
        title: 'Resonance',
        artist: 'Scott Buckley',
        source: 'https://www.scottbuckley.com.au/library/resonance/',
        license: 'CC BY 4.0',
        sourceIn: MUSIC_START,
        sourceOut: MUSIC_START + endStart / FPS - INTRO_SECONDS + 0.8,
        timelineStart: INTRO_SECONDS,
        edit: 'Excerpt, fades, EQ, brief ducking beneath effects, starts on first combat cut; pause before title downbeat; final accent tapered with echo tail',
      },
      intro: {
        seconds: INTRO_SECONDS,
        method:
          'Editorial animation using game scenery, outfit and weapon renderer; keyframed walk, lighting and camera; original synthesized factory ambience, footsteps, relay and weapon clicks',
        footsteps: FOOTSTEPS,
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
