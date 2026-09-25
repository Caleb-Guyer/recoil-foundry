import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { Renderer } from '../src/render.ts';
import { Sound } from '../src/audio.ts';
import { Music } from '../src/music.ts';
import { annexMusicNotes } from '../src/annex-score.ts';
import { GAME_VERSION } from '../src/version.ts';
import { seeded } from '../src/rules.ts';
import { actionInput, recordAction, takeQuality } from './trailer-scenes.ts';
import {
  startSignalTake,
  beatFrame,
  INTRO_BEATS,
  TITLE_BEAT,
  TEASER_FRAMES,
  TEASER_BPM,
  type SignalTake,
} from './dead-signal-scenes.ts';

// Offline real-engine captures. Camera/editing do not alter combat. The close-up
// opening observes a live, idle room; no enemies, shots or damage are fabricated.
const native = createRequire(resolve(process.env.MEDIA_MODULE_ROOT!, 'package.json'));
const audio = createRequire(resolve('.media-tools/audio/package.json'));
const { createCanvas, GlobalFonts } = native('@napi-rs/canvas');
const { RenderingAudioContext } = audio('web-audio-engine');
for (const [file, family] of [
  ['arial.ttf', 'Release Sans'],
  ['arialbd.ttf', 'Release Bold'],
  ['consola.ttf', 'Release Mono'],
])
  if (!GlobalFonts.registerFromPath(resolve(process.env.MEDIA_FONT_DIR!, file), family))
    throw Error(`Missing font ${file}`);
Object.defineProperty(globalThis, 'devicePixelRatio', { value: 1 });
class CaptureAudio extends RenderingAudioContext {
  constructor() {
    super({ sampleRate: 48000, numberOfChannels: 2, blockSize: 128 });
  }
  get state() {
    return 'running';
  }
}
Object.defineProperty(globalThis, 'AudioContext', { value: CaptureAudio });
const out = resolve(process.env.SIGNAL_MEDIA_OUT ?? '../recoil-foundry-dead-signal-launch');
const work = resolve(out, 'review');
mkdirSync(work, { recursive: true });
const W = 1920,
  H = 1080,
  FPS = 60,
  rate = 48000,
  duration = TEASER_FRAMES / FPS;
const introEnd = beatFrame(INTRO_BEATS),
  titleStart = beatFrame(TITLE_BEAT);
const candidates: Record<string, SignalTake[]> = JSON.parse(
  readFileSync('docs/launch/dead-signal/takes.json', 'utf8'),
);
const order = ['transmission', 'climb', 'orders', 'cross-talk'];
const cuts = [6, 10, 18, 26, 34].map(beatFrame);
const takes = order.map((name, i) => {
  const source = candidates[name][0];
  if (!source) throw Error(`No usable capture for ${name}`);
  return {
    ...source,
    start: i === 2 ? source.reboots![0] - beatFrame(2) : source.start,
    length: cuts[i + 1] - cuts[i],
  };
});
const canvas = createCanvas(W, H),
  c = canvas.getContext('2d');
canvas.getBoundingClientRect = () => ({ width: W, height: H });
const sheet = createCanvas(1600, 1250),
  sc = sheet.getContext('2d');
sc.fillStyle = '#0d0e14';
sc.fillRect(0, 0, 1600, 1250);
const samples = [
  24,
  100,
  180,
  ...cuts
    .slice(0, -1)
    .flatMap((at, i) => [at + 12, at + Math.floor((cuts[i + 1] - at) * 0.5), cuts[i + 1] - 12]),
  titleStart + 5,
  titleStart + 85,
];
const cues: { frame: number; kind: string }[] = [],
  manifest: object[] = [];
const storyboard = process.argv.includes('--storyboard');
const encoder = storyboard
  ? null
  : spawn(
      process.env.FFMPEG!,
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
        '-pix_fmt',
        'yuv420p',
        '-color_range',
        'tv',
        '-colorspace',
        'bt709',
        '-color_trc',
        'bt709',
        '-color_primaries',
        'bt709',
        '-movflags',
        '+faststart',
        resolve(work, 'picture.mp4'),
      ],
      { stdio: ['pipe', 'ignore', 'inherit'] },
    );
const encoded = encoder ? once(encoder, 'exit') : null;
const smooth = (v: number) => {
  const x = Math.max(0, Math.min(1, v));
  return x * x * (3 - 2 * x);
};
async function output(frame: number) {
  const i = samples.indexOf(frame);
  if (i >= 0) {
    const x = (i % 4) * 400,
      y = Math.floor(i / 4) * 250;
    sc.drawImage(canvas, x, y, 400, 225);
    sc.fillStyle = '#c9c7c5';
    sc.font = '17px "Release Mono"';
    sc.fillText(`${(frame / FPS).toFixed(2)}s`, x + 12, y + 244);
    writeFileSync(
      resolve(work, `frame-${String(frame).padStart(4, '0')}.png`),
      canvas.toBuffer('image/png'),
    );
  }
  if (encoder && !encoder.stdin.write(Buffer.from(c.getImageData(0, 0, W, H).data)))
    await once(encoder.stdin, 'drain');
}
function hud(g: ReturnType<typeof startSignalTake>) {
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.fillStyle = '#40504d';
  c.fillRect(30, 30, 130, 6);
  c.fillStyle = '#e9eadc';
  c.fillRect(30, 30, (130 * Math.max(0, g.hp)) / 100, 6);
  c.font = '15px "Release Mono"';
  c.textAlign = 'right';
  c.fillStyle = '#a7aaa8';
  c.fillText(`${String(g.stage + 1).padStart(2, '0')} / 20`, W - 60, 40);
  c.fillRect(W - 36, 27, 3, 13);
  c.fillRect(W - 28, 27, 3, 13);
  c.textAlign = 'left';
}
// Close-up of the actual junction and its port. The dark room comes alive as its
// real transmission begins at 2.4 s, followed by the first cut on the downbeat.
const opening = startSignalTake(takes[0]),
  plate = createCanvas(W, H);
plate.getBoundingClientRect = () => ({ width: W, height: H });
const introRenderer = new Renderer(plate, opening);
introRenderer.scale = 1.04;
introRenderer.reduced = true;
let frame = 0;
opening.onSound = (kind) => {
  if (kind.startsWith('signal')) cues.push({ frame, kind });
};
for (; frame < introEnd; frame++) {
  opening.tick(1 / FPS, {
    left: false,
    right: false,
    jump: false,
    jumpHeld: false,
    fire: false,
    aim: { x: 60, y: 722 },
  });
  introRenderer.draw(((frame + 1) * 1000) / FPS);
  const j = introRenderer.toCanvas(opening.annex.junction),
    p = introRenderer.toCanvas(opening.annex.port);
  const mid = { x: (j.x + p.x) / 2, y: (j.y + p.y) / 2 };
  const width = 780 - 60 * smooth(frame / introEnd),
    height = (width * H) / W;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.fillStyle = '#080810';
  c.fillRect(0, 0, W, H);
  c.drawImage(plate, mid.x - width / 2, mid.y - height / 2, width, height, 0, 0, W, H);
  c.fillStyle = `rgba(7,7,14,${0.3 * (1 - smooth(frame / introEnd))})`;
  c.fillRect(0, 0, W, H);
  c.save();
  c.globalAlpha = smooth((frame - 20) / 25) * (1 - smooth((frame - 148) / 30));
  c.textAlign = 'center';
  c.fillStyle = '#dfded7';
  c.font = '40px "Release Mono"';
  c.fillText('T H E   S H I F T   E N D E D .', W / 2, H - 110);
  c.restore();
  if (frame < 28) {
    c.fillStyle = `rgba(0,0,0,${1 - smooth(frame / 28)})`;
    c.fillRect(0, 0, W, H);
  }
  await output(frame);
}
const screenshots = [
  { shot: 0, name: '01-transmission.png' },
  { shot: 1, name: '02-recoil-climb.png' },
  { shot: 2, name: '03-subversion.png' },
];
for (let shot = 0; shot < takes.length; shot++) {
  const take = takes[shot],
    g = startSignalTake(take),
    renderer = new Renderer(canvas, g);
  renderer.scale = 2.12;
  renderer.reset();
  const qualityFrames: ReturnType<typeof recordAction>[] = [],
    reboots: number[] = [],
    scored: { frame: number; score: number; png: Buffer }[] = [];
  let visibleBlue = 0;
  g.onSound = (kind) => {
    if (frame >= cuts[shot] && frame < cuts[shot + 1]) cues.push({ frame, kind });
  };
  // Pre-roll has the same physics and ordinary inputs, but no emitted audio.
  const onSound = g.onSound;
  g.onSound = () => {};
  for (let tick = 0; tick < take.start + take.length; tick++) {
    if (tick === take.start) g.onSound = onSound;
    const oldReboots = g.spoof.reboots;
    const metric = recordAction(g, actionInput(g, tick, take.style));
    if (g.mode !== 'playing' || g.clear || g.hp <= 0)
      throw Error(`Take ended early: ${take.name}/${tick}`);
    if (tick >= take.start - 60) renderer.draw(((tick + 1) * 1000) / FPS);
    if (tick < take.start) continue;
    if (g.spoof.reboots > oldReboots) reboots.push(frame);
    qualityFrames.push(metric);
    const liveBlue = g.factions.allies.filter((e) => {
      const p = renderer.toCanvas(e.body.position);
      return p.x > 65 && p.x < W - 65 && p.y > 70 && p.y < H - 65;
    }).length;
    if (liveBlue) visibleBlue++;
    const player = renderer.toCanvas(g.player.position);
    if (player.x < 10 || player.x > W - 10 || player.y < 10 || player.y > H - 10)
      throw Error('Player outside the editorial camera');
    hud(g);
    if (
      screenshots.some((s) => s.shot === shot) &&
      tick % 3 === 0 &&
      tick >= take.start + 20 &&
      g.time - g.hurtAt >= 0.75
    ) {
      const colorTargets = g.enemies.filter((e) => {
        const p = renderer.toCanvas(e.body.position);
        return p.x > 60 && p.x < W - 60 && p.y > 70 && p.y < H - 65;
      }).length;
      const rising = shot === 1 && g.player.velocity.y < -2 && g.aim.y > g.player.position.y + 50;
      const score =
        metric.score +
        colorTargets * 12 +
        (shot === 2 ? liveBlue * 100 : 0) +
        (shot === 0 && g.annex.transmission?.phase === 'charging' ? 120 : 0) +
        (rising ? 250 : 0);
      if (!scored.length || score > scored[0].score)
        scored[0] = { frame, score, png: canvas.toBuffer('image/png') };
    }
    await output(frame++);
  }
  const quality = takeQuality(qualityFrames);
  if (
    quality.blockedFireFrames ||
    quality.longestStallFrames > 24 ||
    quality.visibleFraction < 0.55
  )
    throw Error(`Rejected ${take.name}: ${JSON.stringify(quality)}`);
  if (shot === 2 && (!reboots.length || visibleBlue < 60))
    throw Error('Blue conversion is missing from its hero shot');
  const still = screenshots.find((s) => s.shot === shot);
  if (still) {
    if (!scored[0]) throw Error('Missing still');
    writeFileSync(resolve(out, still.name), scored[0].png);
  }
  manifest.push({
    ...take,
    quality,
    screenStart: cuts[shot] / FPS,
    screenEnd: cuts[shot + 1] / FPS,
    reboots,
    visibleBlue,
    health: g.hp,
    screenshot: still ? { file: still.name, frame: scored[0].frame } : undefined,
  });
  console.log('Captured', shot, take.name, quality, visibleBlue);
}
for (; frame < TEASER_FRAMES; frame++) {
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.fillStyle = '#0d0c13';
  c.fillRect(0, 0, W, H);
  const t = (frame - titleStart) / FPS;
  c.save();
  c.globalAlpha = 1 - smooth((t - 2.9) / 1.1);
  c.textAlign = 'center';
  c.fillStyle = '#a39cae';
  c.font = '25px "Release Mono"';
  c.fillText('R E C O I L   F O U N D R Y', W / 2, 335);
  c.fillStyle = '#eee9df';
  c.font = '134px "Release Bold"';
  c.fillText('DEAD SIGNAL', W / 2, 510);
  c.fillStyle = '#e8bb76';
  c.fillRect(W / 2 - 31, 555, 62, 3);
  c.font = '30px "Release Sans"';
  c.fillText('The orders didn’t.', W / 2, 630);
  c.globalAlpha *= smooth((t - 60 / TEASER_BPM) / 0.25);
  c.fillStyle = '#aaa3b3';
  c.font = '22px "Release Mono"';
  c.fillText('A FREE CONTENT UPDATE · PLAY NOW', W / 2, 744);
  c.font = '23px "Release Sans"';
  c.fillText('caleb-guyer.itch.io/recoil-foundry', W / 2, 801);
  c.restore();
  if (frame === titleStart + 90)
    writeFileSync(resolve(out, 'Dead-Signal-Teaser-Cover.png'), canvas.toBuffer('image/png'));
  if (t > 2.9) {
    c.fillStyle = `rgba(0,0,0,${smooth((t - 2.9) / 1.1)})`;
    c.fillRect(0, 0, W, H);
  }
  await output(frame);
}
writeFileSync(resolve(work, 'contact-sheet.png'), sheet.toBuffer('image/png'));
writeFileSync(
  resolve(out, 'capture.json'),
  JSON.stringify(
    {
      version: GAME_VERSION,
      width: W,
      height: H,
      fps: FPS,
      seconds: duration,
      method:
        'Actual Game/Renderer, legal preset builds, scripted controls, ordinary damage/collision. Editorial camera and cuts. No boss footage.',
      music: 'Original Orders After Hours — trailer arrangement, 112 BPM, final D-minor resolution',
      cuts: cuts.map((f) => ({ frame: f, seconds: f / FPS })),
      scenes: manifest,
      cues,
    },
    null,
    2,
  ) + '\n',
);
if (storyboard) process.exit(0);
encoder!.stdin.end();
if ((await encoded!)[0] !== 0) throw Error('Video encode failed');

// Render the original regional score with the production synth. Schedule notes
// against the offline clock, retaining the full eight-bar phrase and resolving
// its last dominant on the exact title frame instead of fading mid-phrase.
const mc = new CaptureAudio(),
  music = new Music(mc, mc.destination);
music.bus.gain.value = 1;
const beat = 60 / TEASER_BPM,
  musicStart = beatFrame(2) / FPS,
  titleTime = titleStart / FPS;
music.note({ part: 'hum', midi: 38, duration: 6, velocity: 0.1 }, 0.02, TEASER_BPM);
let noteStep = 0;
for (let t = 0; t < duration; t += 1 / FPS) {
  mc.processTo(t);
  while (noteStep < 128 && musicStart + (noteStep * beat) / 4 < t + 0.035) {
    const at = musicStart + (noteStep * beat) / 4;
    for (const note of annexMusicNotes(noteStep, 0.9, false, false))
      music.note(note, at, TEASER_BPM);
    noteStep++;
  }
  if (t <= titleTime && t + 1 / FPS > titleTime) {
    music.note({ part: 'kick', duration: 0.55, velocity: 0.65 }, titleTime, TEASER_BPM);
    music.note({ part: 'hum', midi: 38, duration: 6, velocity: 0.28 }, titleTime, TEASER_BPM);
    for (const midi of [50, 62, 65, 69])
      music.note({ part: 'pad', midi, duration: 6, velocity: 0.22 }, titleTime, TEASER_BPM);
    music.note({ part: 'pluck', midi: 74, duration: 3.5, velocity: 0.5 }, titleTime, TEASER_BPM);
  }
}
mc.processTo(duration);
const musicData = mc.exportAsAudioData().channelData;
const samplesCount = (TEASER_FRAMES * rate) / FPS;
const channels = [new Float32Array(samplesCount), new Float32Array(samplesCount)];
for (let ch = 0; ch < 2; ch++)
  for (let i = 0; i < samplesCount; i++) channels[ch][i] = (musicData[ch] ?? musicData[0])[i] * 3.2;
const banks = new Map<string, Float32Array[]>(),
  last = new Map<string, number>(),
  soundAudit: object[] = [];
for (const cue of cues) {
  if (cue.frame >= titleStart) continue;
  if (cue.frame - (last.get(cue.kind) ?? -100) < 3) continue;
  last.set(cue.kind, cue.frame);
  if (!banks.has(cue.kind)) {
    Math.random = seeded('signal-teaser:' + cue.kind);
    const s = new Sound();
    s.unlock();
    s.musicEnabled = false;
    if (!s.context) throw Error('No audio engine');
    const ac = s.context as unknown as CaptureAudio;
    s.master!.gain.value = 1;
    const keeper = ac.createOscillator(),
      zero = ac.createGain();
    zero.gain.value = 0;
    keeper.connect(zero);
    zero.connect(s.effects!);
    keeper.start();
    s.play(cue.kind);
    ac.processTo(1.5);
    const raw = ac.exportAsAudioData().channelData;
    const peak = raw.reduce(
      (m: number, ch: Float32Array) => ch.reduce((n, v) => Math.max(n, Math.abs(v)), m),
      0,
    );
    if (!Number.isFinite(peak) || peak < 1e-6) throw Error(`Silent effect ${cue.kind}`);
    const target = cue.kind.startsWith('signal')
      ? 0.24
      : ['shot', 'heavy', 'scatter'].includes(cue.kind)
        ? 0.3
        : cue.kind === 'enemy'
          ? 0.045
          : 0.11;
    banks.set(
      cue.kind,
      raw.map((ch: Float32Array) => Float32Array.from(ch, (v) => (v * target) / peak)),
    );
    soundAudit.push({ kind: cue.kind, sourcePeak: peak, mixPeak: target });
  }
  const bank = banks.get(cue.kind)!,
    at = Math.round((cue.frame * rate) / FPS);
  for (let ch = 0; ch < 2; ch++)
    for (let i = 0; i < bank[ch].length && at + i < samplesCount; i++) {
      const time = (at + i) / rate;
      const release = Math.max(0, Math.min(1, (titleTime + 0.06 - time) / 0.08));
      channels[ch][at + i] += bank[ch][i] * release;
    }
}
const pcm = Buffer.alloc(44 + samplesCount * 4);
pcm.write('RIFF');
pcm.writeUInt32LE(pcm.length - 8, 4);
pcm.write('WAVEfmt ', 8);
pcm.writeUInt32LE(16, 16);
pcm.writeUInt16LE(1, 20);
pcm.writeUInt16LE(2, 22);
pcm.writeUInt32LE(rate, 24);
pcm.writeUInt32LE(rate * 4, 28);
pcm.writeUInt16LE(4, 32);
pcm.writeUInt16LE(16, 34);
pcm.write('data', 36);
pcm.writeUInt32LE(samplesCount * 4, 40);
let max = 0;
for (let i = 0; i < samplesCount; i++)
  for (let ch = 0; ch < 2; ch++) {
    const gain = 1 - smooth((i / rate - (duration - 1.7)) / 1.1),
      v = Math.tanh(channels[ch][i]) * gain;
    if (!Number.isFinite(v)) throw Error('Invalid audio');
    max = Math.max(max, Math.abs(v));
    pcm.writeInt16LE(Math.round(v * 32767), 44 + (i * 2 + ch) * 2);
  }
writeFileSync(resolve(work, 'mix.wav'), pcm);
writeFileSync(
  resolve(work, 'audio-audit.json'),
  JSON.stringify(
    {
      peak: max,
      sounds: soundAudit,
      cueCount: cues.length,
      scoreBpm: TEASER_BPM,
      musicStartSeconds: musicStart,
      titleResolutionSeconds: titleTime,
      lastSilenceSeconds: 0.6,
    },
    null,
    2,
  ) + '\n',
);
const mixed = spawnSync(
  process.env.FFMPEG!,
  [
    '-hide_banner',
    '-y',
    '-i',
    resolve(work, 'picture.mp4'),
    '-i',
    resolve(work, 'mix.wav'),
    '-map',
    '0:v',
    '-map',
    '1:a',
    '-c:v',
    'copy',
    '-c:a',
    'aac',
    '-b:a',
    '256k',
    '-ar',
    '48000',
    '-af',
    'loudnorm=I=-16:TP=-1.5:LRA=9:print_format=json',
    '-t',
    String(duration),
    '-movflags',
    '+faststart',
    '-metadata',
    'title=Recoil Foundry: Dead Signal — Update Trailer',
    '-metadata',
    'comment=Original game music: Orders After Hours. Real engine gameplay; scripted inputs. Dead Signal 3.0 update trailer.',
    resolve(out, 'Recoil-Foundry-Dead-Signal-Teaser.mp4'),
  ],
  { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 },
);
writeFileSync(resolve(work, 'encode.log'), mixed.stderr ?? '');
if (mixed.status !== 0) throw Error('Final mix failed: ' + mixed.stderr);
console.log('Finished Dead Signal update trailer:', out);
