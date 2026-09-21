import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { Game } from '../src/game.ts';
import { Renderer } from '../src/render.ts';
import { Sound } from '../src/audio.ts';
import { seeded, validBuild, type Checkpoint } from '../src/rules.ts';
import { withParents } from '../src/branch-builds.ts';
import { GAME_VERSION } from '../src/version.ts';

// Reproducible trailer: actual game simulation, renderer, score and sound effects.
// Checkpoints select legal builds; player health, physics and enemy AI remain active.
const native = createRequire(resolve(process.env.MEDIA_MODULE_ROOT!, 'package.json'));
const audio = createRequire(resolve('.media-tools/audio/package.json'));
const { createCanvas, GlobalFonts } = native('@napi-rs/canvas');
const { RenderingAudioContext } = audio('web-audio-engine');
for (const [file, family] of [
  ['arial.ttf', 'Release Sans'],
  ['arialbd.ttf', 'Release Bold'],
  ['consola.ttf', 'Release Mono'],
])
  GlobalFonts.registerFromPath(resolve(process.env.MEDIA_FONT_DIR!, file), family);
Object.defineProperty(globalThis, 'devicePixelRatio', { value: 1 });
const ffmpeg = process.env.FFMPEG!;
if (!ffmpeg) throw new Error('Set FFMPEG to the encoder executable');
const out = resolve(process.env.TRAILER_OUT ?? '../recoil-foundry-trailer');
const work = resolve(out, 'work');
mkdirSync(work, { recursive: true });
const W = 1920,
  H = 1080,
  FPS = 60,
  BPM = 104;
const frameAtBeat = (beat: number) => Math.round(((beat * 60) / BPM) * FPS);
const ends = [8, 10, 20, 30, 40, 50, 60].map(frameAtBeat);
const total = ends.at(-1)!;
const build = (wanted: string[]) => {
  const mods = withParents([], wanted);
  if (!mods || !validBuild(mods)) throw new Error(`Invalid trailer build: ${wanted}`);
  return mods;
};
const scenes = [
  {
    name: 'recoil-flight',
    stage: 2,
    mods: build(['kick']),
    seed: 'TRAILER-FLIGHT-3',
    start: 0,
    end: ends[0],
    hook: true,
  },
  {
    name: 'scattershot',
    stage: 6,
    mods: build(['magnum', 'kick', 'rapid', 'scatter', 'ricochet', 'airshot']),
    seed: 'TRAILER-SCATTER-3',
    start: ends[1],
    end: ends[2],
  },
  {
    name: 'prism',
    stage: 10,
    mods: build(['cutting-torch', 'prism-array', 'scatter', 'pierce', 'airshot', 'light', 'kick']),
    seed: 'TRAILER-PRISM-11',
    start: ends[2],
    end: ends[3],
  },
  {
    name: 'pinwheel',
    stage: 6,
    mods: build(['crossfire', 'pinwheel', 'scatter', 'rapid', 'airshot', 'kick']),
    seed: 'TRAILER-VOLLEY-10',
    start: ends[3],
    end: ends[4],
  },
  {
    name: 'cluster',
    stage: 10,
    mods: build([
      'shellshock',
      'cluster-shell',
      'aftershock',
      'blast-surf',
      'airshot',
      'light',
      'kick',
    ]),
    seed: 'TRAILER-CLUSTER-9',
    start: ends[4],
    end: ends[5],
  },
];
function start(scene: (typeof scenes)[number], seed = scene.seed) {
  if (scene.mods.length > scene.stage) throw new Error('Build exceeds the room reward budget');
  Math.random = seeded(seed + '-fx');
  const g = new Game();
  const save: Checkpoint = {
    version: 5,
    seed,
    stage: scene.stage,
    hp: 100,
    mods: scene.mods,
    kills: 0,
    elapsed: 0,
  };
  g.startTest(save);
  if (!scene.hook) for (let tick = 0; tick < 100; tick++) g.tick(1 / FPS, controls(g, tick));
  return g;
}
function controls(g: Game, tick: number, hook = false) {
  const p = g.player.position;
  if (hook && tick < 82) {
    return {
      left: false,
      right: true,
      jump: g.grounded && tick < 45,
      jumpHeld: true,
      fire: tick >= 45 && tick < 50,
      aim: { x: p.x - 110, y: p.y + 500 },
    };
  }
  const nearest = g.enemies
    .filter((e) => e.hp > 0)
    .sort(
      (a, b) =>
        Math.hypot(a.body.position.x - p.x, a.body.position.y - p.y) -
        Math.hypot(b.body.position.x - p.x, b.body.position.y - p.y),
    )[0];
  const aim = nearest ? { ...nearest.body.position } : { x: p.x + 500, y: p.y };
  const dx = aim.x - p.x;
  return {
    left: dx < -220,
    right: dx > 220,
    jump:
      g.grounded && (tick % 170 === 30 || (Math.abs(g.player.velocity.x) < 1 && tick % 35 === 0)),
    jumpHeld: false,
    fire: tick % 90 < 78 && !(aim.y - p.y > 100 && p.y < 510 && g.player.velocity.y < 2),
    aim,
  };
}

if (process.argv.includes('--survey')) {
  for (const scene of scenes) {
    const candidates = [];
    for (let i = 0; i < 16; i++) {
      const seed = `${scene.seed.split('-').slice(0, -1).join('-')}-${i}`;
      const g = start(scene, seed);
      let minY = 9999,
        maxX = 0,
        shots = 0;
      for (let tick = 0; tick < scene.end - scene.start; tick++) {
        g.tick(1 / FPS, controls(g, tick + (scene.hook ? 0 : 100), scene.hook));
        minY = Math.min(minY, g.player.position.y);
        maxX = Math.max(maxX, g.player.position.x);
        shots = Math.max(shots, g.shots.length);
        if (g.mode !== 'playing') break;
      }
      candidates.push({
        seed,
        hp: Math.round(g.hp),
        kills: g.kills,
        minY: Math.round(minY),
        maxX: Math.round(maxX),
        shots,
        alive: g.mode === 'playing',
        clear: g.clear,
      });
    }
    console.log(scene.name, JSON.stringify(candidates));
  }
  process.exit(0);
}

class TrailerAudio extends RenderingAudioContext {
  constructor() {
    super({ sampleRate: 48000, numberOfChannels: 2, blockSize: 128 });
  }
  // RenderingAudioContext suspends between processTo calls. Game scheduling still
  // uses its actual sample clock and its original voice budgets at every step.
  get state() {
    return 'running';
  }
}
Object.defineProperty(globalThis, 'AudioContext', { value: TrailerAudio });
Math.random = seeded('RF-TRAILER-AUDIO');
const sound = new Sound();
sound.unlock();
if (!sound.context || !sound.music) throw new Error('Audio initialization failed');
const context = sound.context as unknown as TrailerAudio;
sound.effectsVolume = 0.8;
sound.musicOutput!.gain.value = 2.8;
// This offline engine can disable a filter after its last short source ends.
// A zero-gain source keeps the score graph active without adding any sound.
const keeper = context.createOscillator(),
  zero = context.createGain();
zero.gain.value = 0;
keeper.connect(zero);
zero.connect(sound.music!.bus);
keeper.start();
const video = spawn(
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
const videoDone = once(video, 'exit');
const canvas = createCanvas(W, H),
  c = canvas.getContext('2d');
canvas.getBoundingClientRect = () => ({ width: W, height: H });
let game: Game | null = null,
  renderer: Renderer | null = null;
let current: (typeof scenes)[number] | undefined;
const poster = createCanvas(W, H),
  frames: object[] = [],
  manifest: object[] = [];
const progress = new Set<number>();
const sampleFrames = [1, 3, 5, 8, 11, 14, 17, 20, 23, 26, 28, 30, 33].map((t) =>
  Math.round(t * FPS),
);
const sheet = createCanvas(1280, Math.ceil(sampleFrames.length / 3) * 270);
const sc = sheet.getContext('2d');
sc.fillStyle = '#091216';
sc.fillRect(0, 0, sheet.width, sheet.height);
let shot = 0;
const ease = (x: number) => {
  const t = Math.max(0, Math.min(1, x));
  return t * t * (3 - 2 * t);
};
function label(text: string, alpha: number) {
  c.save();
  c.globalAlpha = alpha;
  const shade = c.createLinearGradient(0, 60, 0, 250);
  shade.addColorStop(0, 'rgba(5,12,16,.86)');
  shade.addColorStop(1, 'rgba(5,12,16,0)');
  c.fillStyle = shade;
  c.fillRect(0, 60, W, 190);
  c.fillStyle = '#e9eadc';
  c.font = '52px "Release Bold"';
  c.fillText(text, 70, 163);
  c.restore();
}
function endCard(t: number) {
  c.drawImage(poster, 0, 0);
  c.fillStyle = 'rgba(7,16,20,.91)';
  c.fillRect(0, 0, W, H);
  c.save();
  c.globalAlpha = ease(t / 0.4);
  c.textAlign = 'center';
  c.fillStyle = '#e9eadc';
  c.font = '208px "Release Bold"';
  c.fillText('RECOIL', W / 2, 430);
  c.fillStyle = '#acc3b6';
  c.font = '67px "Release Mono"';
  c.fillText('F O U N D R Y', W / 2, 530);
  c.fillStyle = '#e9eadc';
  c.font = '38px "Release Sans"';
  c.fillText('One gun. All recoil.', W / 2, 641);
  c.fillStyle = '#acc3b6';
  c.fillRect(W / 2 - 40, 709, 80, 3);
  c.fillStyle = '#e9eadc';
  c.font = 'bold 33px "Release Sans"';
  c.fillText('PLAY FREE IN YOUR BROWSER', W / 2, 789);
  c.fillStyle = '#acc3b6';
  c.font = '30px "Release Mono"';
  c.fillText('caleb-guyer.itch.io/recoil-foundry', W / 2, 849);
  c.restore();
}
for (let frame = 0; frame < total; frame++) {
  const t = frame / FPS;
  const scene = scenes.find((s) => frame >= s.start && frame < s.end);
  if (scene && scene !== current) {
    sound.updateTorch(false);
    current = scene;
    game = start(scene);
    renderer = new Renderer(canvas, game);
    renderer.scale = 1.6;
    renderer.reset();
    game.onSound = (kind) => sound.play(kind);
    console.log(`Rendering ${scene.name}: ${scene.seed}; ${scene.mods.join(', ')}`);
  }
  if (scene) {
    const tick = frame - scene.start;
    game!.tick(1 / FPS, controls(game!, tick + (scene.hook ? 0 : 100), scene.hook));
    if (game!.mode !== 'playing')
      throw new Error(`${scene.name} ended at frame ${tick}: ${game!.mode}`);
    sound.updateTorch(game!.torch.active, game!.torch.heat);
    renderer!.draw(((tick + 1) * 1000) / FPS);
    c.setTransform(1, 0, 0, 1, 0, 0);
    if (scene.name === 'recoil-flight' && tick === 160)
      poster.getContext('2d').drawImage(canvas, 0, 0);
    // Reproduce the browser's minimal HTML HUD from the real simulation state.
    c.fillStyle = '#40504d';
    c.fillRect(36, 36, 162, 7);
    c.fillStyle = '#e9eadc';
    c.fillRect(36, 36, (162 * Math.max(0, game!.hp)) / 100, 7);
    c.font = '18px "Release Mono"';
    c.textAlign = 'right';
    c.fillStyle = '#b0bbb4';
    c.fillText(`${String(game!.stage + 1).padStart(2, '0')} / 20`, W - 75, 46);
    c.fillRect(W - 40, 31, 3, 15);
    c.fillRect(W - 33, 31, 3, 15);
    c.textAlign = 'left';
    if (scene.name === 'recoil-flight') {
      label('SHOOT DOWN. GO UP.', ease((t - 0.25) / 0.25) * (1 - ease((t - 2.4) / 0.3)));
    }
    if (scene.name === 'scattershot')
      label(
        '100 UPGRADES. BUILD IT YOUR WAY.',
        ease(tick / 15) * (1 - ease((tick / FPS - 2.4) / 0.3)),
      );
    if (frame === scene.end - 1)
      manifest.push({
        ...scene,
        seconds: (scene.end - scene.start) / FPS,
        finalHealth: game!.hp,
        kills: game!.kills,
        layout: game!.level.name,
      });
  } else if (frame < ends[1]) {
    c.fillStyle = '#091216';
    c.fillRect(0, 0, W, H);
    c.fillStyle = '#e9eadc';
    c.font = '154px "Release Bold"';
    c.textAlign = 'center';
    c.fillText('ONE GUN.', W / 2, 580);
    c.textAlign = 'left';
  } else {
    sound.updateTorch(false);
    endCard((frame - ends[5]) / FPS);
  }
  sound.updateMusic({
    area: 'furnace',
    room: 'launch-trailer',
    mode: 'playing',
    intensity: Math.min(0.95, 0.55 + t / 70),
    boss: false,
    clear: false,
  });
  context.processTo((frame + 1) / FPS);
  if (sampleFrames.includes(frame)) {
    const path = resolve(work, `frame-${String(frame).padStart(4, '0')}.png`);
    writeFileSync(path, canvas.toBuffer('image/png'));
    sc.drawImage(canvas, (shot % 3) * 426, Math.floor(shot / 3) * 270, 426, 240);
    sc.fillStyle = '#e9eadc';
    sc.font = '17px "Release Mono"';
    sc.fillText(`${t.toFixed(1)} s`, (shot % 3) * 426 + 12, Math.floor(shot / 3) * 270 + 260);
    frames.push({ seconds: t, file: `work/frame-${String(frame).padStart(4, '0')}.png` });
    shot++;
  }
  if (!video.stdin.write(Buffer.from(c.getImageData(0, 0, W, H).data)))
    await once(video.stdin, 'drain');
  const percent = Math.floor((frame / total) * 10) * 10;
  if (!progress.has(percent)) {
    progress.add(percent);
    console.log(`Picture/audio ${percent}%`);
  }
}
video.stdin.end();
const [code] = await videoDone;
if (code !== 0) throw new Error(`Picture encoding failed: ${code}`);
sound.updateTorch(false);
const data = context.exportAsAudioData();
writeFileSync(
  resolve(work, 'mix.wav'),
  Buffer.from(await context.encodeAudioData(data, { bitDepth: 24 })),
);
writeFileSync(resolve(out, 'contact-sheet.png'), sheet.toBuffer('image/png'));
endCard(1);
// Thumbnail matches the video's wordmark, without small URL text.
c.drawImage(poster, 0, 0);
const thumbnailShade = c.createLinearGradient(0, 0, W, 0);
thumbnailShade.addColorStop(0, 'rgba(7,16,20,.9)');
thumbnailShade.addColorStop(0.5, 'rgba(7,16,20,.55)');
thumbnailShade.addColorStop(1, 'rgba(7,16,20,.15)');
c.fillStyle = thumbnailShade;
c.fillRect(0, 0, W, H);
c.fillStyle = '#e9eadc';
c.font = '200px "Release Bold"';
c.fillText('RECOIL', 100, 410);
c.fillStyle = '#acc3b6';
c.font = '70px "Release Mono"';
c.fillText('F O U N D R Y', 106, 524);
c.fillStyle = '#e9eadc';
c.font = '45px "Release Sans"';
c.fillText('One gun. All recoil.', 108, 680);
c.fillStyle = '#acc3b6';
c.fillRect(110, 770, 62, 4);
c.font = '30px "Release Mono"';
c.fillText('OFFICIAL LAUNCH TRAILER', 110, 841);
writeFileSync(resolve(out, 'Recoil-Foundry-YouTube-Thumbnail.png'), canvas.toBuffer('image/png'));
const duration = total / FPS;
const final = resolve(out, 'Recoil-Foundry-Launch-Trailer.mp4');
console.log('Mastering stereo mix and packaging final MP4...');
const mux = spawnSync(
  ffmpeg,
  [
    '-hide_banner',
    '-y',
    '-i',
    resolve(work, 'picture.mp4'),
    '-i',
    resolve(work, 'mix.wav'),
    '-map',
    '0:v:0',
    '-map',
    '1:a:0',
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
    '-af',
    `loudnorm=I=-16:TP=-1.5:LRA=9,afade=t=in:st=0:d=0.08,afade=t=out:st=${duration - 0.8}:d=0.8`,
    '-t',
    String(duration),
    '-movflags',
    '+faststart',
    '-metadata',
    'title=Recoil Foundry | Official Launch Trailer',
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
      width: W,
      height: H,
      fps: FPS,
      seconds: duration,
      frames: total,
      cameraScale: 1.6,
      combatPreRollFrames: 100,
      music: 'Original in-game Furnace Halls score, continuous editorial mix at its native 104 BPM',
      method:
        'Game + Renderer + Sound + Music; scripted ordinary controls; legal preset checkpoints; no invulnerability or frozen enemies; title/HUD overlays',
      scenes: manifest,
      reviewFrames: frames,
    },
    null,
    2,
  ) + '\n',
);
console.log(`Finished ${final} (${duration.toFixed(2)} seconds)`);
