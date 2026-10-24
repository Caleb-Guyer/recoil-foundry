import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import Matter from 'matter-js';
import { Game, type Input } from '../src/game.ts';
import {
  COMBAT_FOCUS_IDS,
  combatFocusTestFromUrl,
  combatFocusWaypoints,
  type CombatFocusScene,
} from '../src/combat-focus-test.ts';
import { advanceCombatCamera, combatCameraTarget, type CameraMode } from '../src/combat-camera.ts';
import { incomingEdgeCues, type CombatView } from '../src/combat-readability.ts';
import { dodgePilot } from '../tests/combat-pilot.ts';
import { loadCheckpoint } from '../src/rules.ts';
import { GAME_VERSION } from '../src/version.ts';

// Ordinary inputs only. The fixture supplies its authored initial placement;
// this audit never changes health, AI, physics, enemies or warning clocks.
const reportPath = resolve(process.argv[2] ?? 'combat-focus-audit.json');
const seconds = Math.max(20, Math.min(180, Number(process.argv[3]) || 90));
const renderDirectory = process.argv.find((a) => a.startsWith('--render='))?.slice(9);
const viewports = [
  [1280, 720],
  [960, 600],
  [480, 720],
] as const;
const modes: CameraMode[] = ['follow', 'steady', 'wide'];
const sourceFiles = [
  'src/game.ts',
  'src/rules.ts',
  'src/levels.ts',
  'src/combat-camera.ts',
  'src/combat-readability.ts',
  'src/render.ts',
  'src/combat-focus-test.ts',
  'src/enemy-remaster.ts',
  'src/hazards.ts',
  'scripts/combat-focus-audit.ts',
];
const sourceHashes = Object.fromEntries(
  sourceFiles.map((p) => [
    p,
    createHash('sha256')
      .update(readFileSync(resolve(p)))
      .digest('hex'),
  ]),
);
const snapshots = (g: Game) =>
  JSON.stringify({
    save: g.checkpointSnapshot(),
    player: { p: g.player.position, v: g.player.velocity },
    enemies: g.enemies.map((e) => ({
      id: e.id,
      hp: e.hp,
      state: e.state,
      timer: e.timer,
      p: e.body.position,
      v: e.body.velocity,
    })),
    rounds: g.shots,
    props: g.props.items.map((p) => ({ hp: p.hp, p: p.body.position, v: p.body.velocity })),
    hazards: g.hazards.items.map((h) => ({ p: h.body.position, phase: h.phase, timer: h.timer })),
  });
const finite = (g: Game) =>
  [
    g.hp,
    g.time,
    ...[g.player, ...g.enemies.map((e) => e.body), ...g.props.items.map((p) => p.body)].flatMap(
      (b) => [b.position.x, b.position.y, b.velocity.x, b.velocity.y],
    ),
    ...g.shots.flatMap((s) => [s.pos.x, s.pos.y, s.vel.x, s.vel.y, s.life]),
  ].every(Number.isFinite);
const base: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: true,
  fire: false,
  aim: { x: 1000, y: 700 },
};
function input(
  g: Game,
  scene: CombatFocusScene,
  mirror: boolean,
  state: { node: number; boost?: boolean },
) {
  const p = g.player.position,
    v = g.player.velocity,
    route = combatFocusWaypoints(scene, mirror);
  if (scene === 'climb' || scene === 'descent') {
    const target = route[state.node];
    if (target && g.grounded && Math.abs(p.x - target.x) < 120 && Math.abs(p.y - target.y) < 14) {
      state.node++;
      state.boost = true;
    }
    const t = route[state.node];
    if (!t) return { ...base, aim: { x: p.x, y: p.y + 300 } };
    let x = t.x,
      fire = false;
    if (scene === 'climb') {
      const platform = g.level.solids.find(
        (s) => Math.abs(s.y - t.y - 18) < 1 && t.x >= s.x && t.x <= s.x + s.w,
      );
      if (platform && p.y > t.y - 35) {
        const side = p.x < platform.x + platform.w / 2 ? -1 : 1;
        x = side < 0 ? platform.x - 48 : platform.x + platform.w + 48;
      }
      if (p.y < t.y - 45) state.boost = false;
      if (p.y > t.y + 130) state.boost = true;
      fire = state.boost !== false && !g.grounded && p.y > t.y - 55 && v.y > -10;
    } else fire = !g.grounded && v.y > 13;
    const dir = Math.abs(x - p.x) < 6 ? -Math.sign(v.x) : Math.sign(x - p.x - v.x * 5);
    return {
      ...base,
      left: dir < 0,
      right: dir > 0,
      jump: scene === 'climb' && g.grounded && p.y > t.y - 25,
      fire,
      aim: { x: p.x, y: p.y + 400 },
    };
  }
  const target = [...g.enemies]
    .filter((e) => e.hp > 0 && e.spawn <= 0)
    .sort(
      (a, b) =>
        Math.hypot(a.body.position.x - p.x, a.body.position.y - p.y) -
        Math.hypot(b.body.position.x - p.x, b.body.position.y - p.y),
    )[0];
  if (!target || g.time < 4.3) return { ...base, aim: { x: mirror ? 1900 : 100, y: 724 } };
  return { ...base, ...dodgePilot(g, target, true), fire: scene !== 'cover' || g.time > 9 };
}
const rows: Record<string, unknown>[] = [];
const pictures: Record<string, unknown>[] = [];
let render:
  | ((g: Game, scene: CombatFocusScene, mirror: boolean, label: string) => void)
  | undefined;
const started = performance.now();
if (renderDirectory) {
  mkdirSync(renderDirectory, { recursive: true });
  const native = createRequire(resolve('.media-tools/canvas/package.json'));
  const { createCanvas } = native('@napi-rs/canvas');
  Object.defineProperty(globalThis, 'OffscreenCanvas', {
    value: function (w: number, h: number) {
      return createCanvas(w, h);
    },
    configurable: true,
  });
  Object.defineProperty(globalThis, 'devicePixelRatio', { value: 1, configurable: true });
  const { Renderer } = await import('../src/render.ts');
  render = (g, scene, mirror, label) => {
    for (const [width, height] of viewports) {
      const sheet = createCanvas(1440, Math.round((480 * height) / width) + 28),
        ctx = sheet.getContext('2d');
      ctx.fillStyle = '#10191d';
      ctx.fillRect(0, 0, sheet.width, sheet.height);
      for (const [column, mode] of modes.entries()) {
        const canvas = createCanvas(width, height);
        canvas.getBoundingClientRect = () => ({ width, height });
        const renderer = new Renderer(canvas, g);
        renderer.cameraMode = mode;
        renderer.reset();
        const before = snapshots(g),
          previous = g.rng;
        let randomCalls = 0;
        g.rng = () => {
          randomCalls++;
          return previous();
        };
        renderer.draw(1000);
        g.rng = previous;
        if (snapshots(g) !== before || randomCalls)
          throw Error('Native renderer mutated ' + scene + '/' + mode);
        const view = { ...renderer.camera, w: width / renderer.scale, h: height / renderer.scale };
        const cues = incomingEdgeCues(
          g.shots,
          g.player.position,
          view,
          g.time,
          g.solidBodies,
          28 / renderer.scale,
          g.enemies,
        );
        const name = `${scene}-${mirror ? 'mirror' : 'normal'}-${label}-${width}x${height}-${mode}.png`;
        writeFileSync(resolve(renderDirectory, name), canvas.toBuffer('image/png'));
        ctx.drawImage(canvas, column * 480, 28, 480, (480 * height) / width);
        ctx.fillStyle = '#dfe5dc';
        ctx.font = '14px monospace';
        ctx.fillText(
          `${mode} · ${scene} · ${g.time.toFixed(2)}s · cues ${cues.length}`,
          column * 480 + 8,
          19,
        );
        pictures.push({
          file: name,
          scene,
          mirror,
          label,
          width,
          height,
          mode,
          scale: renderer.scale,
          camera: renderer.camera,
          cues,
          nonmutating: true,
        });
      }
      writeFileSync(
        resolve(
          renderDirectory,
          `${scene}-${mirror ? 'mirror' : 'normal'}-${label}-${width}x${height}-comparison.png`,
        ),
        sheet.toBuffer('image/png'),
      );
    }
  };
}
for (const scene of COMBAT_FOCUS_IDS)
  for (const mirror of [false, true]) {
    const spec = combatFocusTestFromUrl(
      new URL(
        `https://audit/?test=focus&scene=${scene}&mirror=${Number(mirror)}&camera=follow&v=1`,
      ),
    )!;
    if (!loadCheckpoint(spec.checkpoint)) throw Error('Invalid checkpoint ' + scene);
    const g = new Game();
    let progressWrites = 0;
    g.onCheckpoint = () => progressWrites++;
    g.onCommendation = () => progressWrites++;
    g.onCampaignClear = () => progressWrites++;
    g.startTest(spec.checkpoint);
    if (g.level.id !== 'combat-focus-' + scene) throw Error('Missing production fixture hook');
    const initialGun = JSON.stringify(g.gun),
      state = { node: 0 };
    let minY = g.player.position.y,
      maxY = minY,
      minVy = 0,
      maxVy = 0,
      valid = true,
      occluded = 0,
      open = 0,
      cueFrames = 0,
      tellFrames = 0,
      shotFrames = 0,
      nonmutating = true,
      captured = false,
      capturedShot = false;
    const geometries = [
      g.player,
      ...g.enemies.map((e) => e.body),
      ...g.props.items.map((p) => p.body),
    ].map((b) => ({
      p: { ...b.position },
      hits: g.terrain.filter(
        (t) =>
          Math.min(b.bounds.max.x, t.bounds.max.x) - Math.max(b.bounds.min.x, t.bounds.min.x) >
            0.5 &&
          Math.min(b.bounds.max.y, t.bounds.max.y) - Math.max(b.bounds.min.y, t.bounds.min.y) > 0.5,
      ).length,
    }));
    const cameraStates = viewports.flatMap(([width, height]) =>
      modes.map((mode) => ({
        width,
        height,
        mode,
        frame: combatCameraTarget({
          width,
          height,
          worldWidth: g.worldWidth,
          worldTop: g.worldTop,
          player: g.player.position,
          velocity: g.player.velocity,
          aim: g.aim,
          mode,
        }),
        minScale: Infinity,
        maxScale: 0,
        visible: true,
        bounded: true,
        cues: 0,
        tells: 0,
        shots: 0,
        maxShotAge: 0,
      })),
    );
    if (scene === 'cover') render?.(g, scene, mirror, 'blocked');
    for (let n = 0; n < seconds * 60 && g.mode === 'playing'; n++) {
      const command = input(g, scene, mirror, state);
      g.tick(1 / 60, command);
      valid &&= finite(g);
      minY = Math.min(minY, g.player.position.y);
      maxY = Math.max(maxY, g.player.position.y);
      minVy = Math.min(minVy, g.player.velocity.y);
      maxVy = Math.max(maxVy, g.player.velocity.y);
      const before = snapshots(g);
      let cuesAtDesktop = false,
        agedShot = false;
      for (const c of cameraStates) {
        c.frame = advanceCombatCamera(
          c.frame,
          {
            width: c.width,
            height: c.height,
            worldWidth: g.worldWidth,
            worldTop: g.worldTop,
            player: g.player.position,
            velocity: g.player.velocity,
            aim: g.aim,
            mode: c.mode,
          },
          1 / 60,
        );
        c.minScale = Math.min(c.minScale, c.frame.scale);
        c.maxScale = Math.max(c.maxScale, c.frame.scale);
        const view: CombatView = {
          x: c.frame.x,
          y: c.frame.y,
          w: c.width / c.frame.scale,
          h: c.height / c.frame.scale,
        };
        c.visible &&=
          g.player.position.x >= view.x &&
          g.player.position.x <= view.x + view.w &&
          g.player.position.y >= view.y &&
          g.player.position.y <= view.y + view.h;
        c.bounded &&=
          view.x >= -0.01 &&
          view.y >= g.worldTop - 0.01 &&
          view.x + view.w <= g.worldWidth + 0.01 &&
          view.y + view.h <= 835.01;
        const cues = incomingEdgeCues(
          g.shots,
          g.player.position,
          view,
          g.time,
          g.solidBodies,
          28 / c.frame.scale,
          g.enemies,
        );
        for (const cue of cues)
          if (cue.phase === 'shot') {
            const shot = g.shots.find((s) => s.id === cue.source);
            const age = shot?.launch ? g.time - shot.launch.at : 0;
            c.maxShotAge = Math.max(c.maxShotAge, age);
            if (age > 0.42) agedShot = true;
          }
        c.cues += Number(cues.length > 0);
        c.tells += Number(cues.some((q) => q.phase === 'tell'));
        c.shots += Number(cues.some((q) => q.phase === 'shot'));
        if (c.width === 1280 && c.mode === 'follow') {
          cuesAtDesktop = cues.length > 0;
          cueFrames += Number(cues.length > 0);
          tellFrames += Number(cues.some((q) => q.phase === 'tell'));
          shotFrames += Number(cues.some((q) => q.phase === 'shot'));
        }
      }
      nonmutating &&= snapshots(g) === before;
      if (scene === 'cover') {
        const e = g.enemies[0];
        if (e) {
          const blocked =
            Math.hypot(
              g.lineEnd(e.body.position, g.player.position, 5).x - g.player.position.x,
              g.lineEnd(e.body.position, g.player.position, 5).y - g.player.position.y,
            ) > 1;
          occluded += Number(blocked);
          open += Number(!blocked);
        }
      }
      const sample =
        scene === 'climb'
          ? g.player.position.y < 200 && g.player.velocity.y < -4
          : scene === 'descent'
            ? g.player.velocity.y > 8 && g.player.position.y > -20
            : cuesAtDesktop;
      if (!capturedShot && agedShot && (scene === 'crossfire' || scene === 'cover')) {
        render?.(g, scene, mirror, 'projectile');
        capturedShot = true;
      }
      if (!captured && sample) {
        render?.(
          g,
          scene,
          mirror,
          scene === 'climb' ? 'climbing' : scene === 'descent' ? 'falling' : 'incoming',
        );
        captured = true;
      }
      if (!valid) break;
      if (scene === 'climb' && state.node >= combatFocusWaypoints(scene, mirror).length) break;
      if (scene === 'descent' && g.grounded && g.player.position.y > 690) break;
      if ((scene === 'crossfire' || scene === 'cover') && g.clear) break;
    }
    if (!captured) render?.(g, scene, mirror, 'final');
    const goal =
      scene === 'climb'
        ? state.node >= combatFocusWaypoints(scene, mirror).length
        : scene === 'descent'
          ? g.grounded && g.player.position.y > 690
          : g.clear;
    const row = {
      scene,
      mirror,
      outcome: goal ? 'goal' : g.hp <= 0 ? 'death' : !valid ? 'non-finite' : 'timeout',
      seconds: g.time,
      hp: g.hp,
      kills: g.kills,
      nodes: state.node,
      minY,
      maxY,
      minVy,
      maxVy,
      finite: valid,
      progressWrites,
      gunUnchanged: initialGun === JSON.stringify(g.gun),
      geometryIssues: geometries.filter((p) => p.hits),
      cameraNonmutating: nonmutating,
      cueFrames,
      tellFrames,
      shotFrames,
      coverOccludedFrames: occluded,
      coverOpenFrames: open,
      cameraStates,
      position: { ...g.player.position },
      remaining: g.enemies.map((e) => ({ kind: e.kind, hp: e.hp, p: e.body.position })),
    };
    rows.push(row);
    console.log(
      JSON.stringify({
        scene,
        mirror,
        outcome: row.outcome,
        time: g.time,
        hp: g.hp,
        nodes: state.node,
        minY,
        cues: cueFrames,
      }),
    );
    Matter.Composite.clear(g.engine.world, false);
    Matter.Engine.clear(g.engine);
  }
mkdirSync(dirname(reportPath), { recursive: true });
const report = {
  version: GAME_VERSION,
  checkedAtUtc: new Date().toISOString(),
  note: 'Ordinary movement, jump, aim and fire inputs with real health, AI, physics, cover and warnings. Authored initial placement comes only from the production isolated-fixture hook. Native snapshots render identical recorded live states through each production camera mode; no human playtest or human win rate is inferred.',
  sourceHashes,
  wallSeconds: (performance.now() - started) / 1000,
  rows,
  pictures,
  summary: {
    attempts: rows.length,
    goals: rows.filter((r) => r.outcome === 'goal').length,
    deaths: rows.filter((r) => r.outcome === 'death').length,
    timeouts: rows.filter((r) => r.outcome === 'timeout').length,
    nonFinite: rows.filter((r) => !r.finite).length,
    geometryIssues: rows.filter((r) => (r.geometryIssues as unknown[]).length).length,
    progressWrites: rows.reduce((n, r) => n + Number(r.progressWrites), 0),
    mutatingPresentation: rows.filter((r) => !r.cameraNonmutating).length,
    nativeSnapshots: pictures.length,
    cameraViolations: rows
      .flatMap((r) => r.cameraStates as { visible: boolean; bounded: boolean }[])
      .filter((c) => !c.visible || !c.bounded).length,
  },
};
writeFileSync(reportPath, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report.summary));

if (
  report.summary.nonFinite ||
  report.summary.geometryIssues ||
  report.summary.progressWrites ||
  report.summary.mutatingPresentation ||
  report.summary.cameraViolations
)
  throw Error(
    'Combat Focus audit found a stability, geometry, progress or presentation violation.',
  );
