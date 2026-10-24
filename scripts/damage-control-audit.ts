import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { Game, type Input } from '../src/game.ts';
import { DAMAGE_CONTROL_IDS, damageControlTestFromUrl } from '../src/damage-control-test.ts';
import { damageCauseText } from '../src/damage-cause.ts';
import { damageHealthTrail } from '../src/damage-control.ts';
import { rematchEntry, roomRematchSnapshot, RoomRematch } from '../src/room-rematch.ts';
import { rematchDamageHtml } from '../src/damage-summary-view.ts';
import { ReplayBuffer, replayHitsInBuffer, type ReplayHit } from '../src/death-replay.ts';
import { playRoom } from '../tests/room-pilot.ts';
import { GAME_VERSION } from '../src/version.ts';

const destination = resolve(process.argv[2] ?? 'damage-control-audit.json');
const images = process.argv.find((a) => a.startsWith('--render='))?.slice(9);
const sourceFiles = [
  'src/game.ts',
  'src/damage-control.ts',
  'src/damage-feedback-art.ts',
  'src/damage-control-test.ts',
  'src/room-rematch.ts',
  'src/room-rematch-view.ts',
  'src/damage-summary-view.ts',
  'src/death-replay.ts',
  'src/death-replay-capture.ts',
  'src/death-replay-view.ts',
  'scripts/damage-control-audit.ts',
];
const sourceHashes = Object.fromEntries(
  sourceFiles.map((p) => [
    p,
    createHash('sha256')
      .update(readFileSync(resolve(p)))
      .digest('hex'),
  ]),
);
const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: false,
  fire: false,
  aim: { x: 100, y: 724 },
};
const rows: Record<string, unknown>[] = [];
const captures: Record<string, unknown>[] = [];
const physical = (g: Game) =>
  JSON.stringify({
    save: g.checkpointSnapshot(),
    damage: g.damageControl.summary(),
    hits: g.damageControl.hits,
    player: { p: g.player.position, v: g.player.velocity },
    enemies: g.enemies.map((e) => ({
      id: e.id,
      hp: e.hp,
      state: e.state,
      timer: e.timer,
      p: e.body.position,
      v: e.body.velocity,
    })),
    shots: g.shots,
  });
let native: any, Renderer: any, DeathReplay: any;
if (images) {
  mkdirSync(images, { recursive: true });
  native = createRequire(resolve('.media-tools/canvas/package.json'))('@napi-rs/canvas');
  Object.defineProperty(globalThis, 'devicePixelRatio', { value: 1, configurable: true });
  Object.defineProperty(globalThis, 'OffscreenCanvas', {
    value: function (w: number, h: number) {
      return native.createCanvas(w, h);
    },
    configurable: true,
  });
  Renderer = (await import('../src/render.ts')).Renderer;
  DeathReplay = (await import('../src/death-replay-capture.ts')).DeathReplay;
}
function render(g: Game, scene: string, label: string) {
  if (!images) return;
  for (const [width, height] of [
    [1280, 720],
    [480, 720],
  ])
    for (const reduced of [false, true]) {
      const canvas = native.createCanvas(width, height);
      canvas.getBoundingClientRect = () => ({ width, height });
      const renderer = new Renderer(canvas, g);
      renderer.reduced = reduced;
      renderer.reset();
      const before = physical(g),
        random = g.rng;
      let calls = 0;
      g.rng = () => {
        calls++;
        return random();
      };
      renderer.draw(g.elapsed * 1000);
      g.rng = random;
      if (physical(g) !== before || calls) throw Error('Damage rendering mutated gameplay.');
      const name = `${scene}-${label}-${width}x${height}-${reduced ? 'reduced' : 'normal'}.png`;
      writeFileSync(resolve(images, name), canvas.toBuffer('image/png'));
      captures.push({
        scene,
        label,
        width,
        height,
        reduced,
        file: name,
        hp: g.hp,
        age: g.damageControl.lastHit ? g.time - g.damageControl.lastHit.at : null,
        nonmutating: true,
      });
    }
}
for (const scene of DAMAGE_CONTROL_IDS) {
  const spec = damageControlTestFromUrl(new URL(`https://audit/?test=damage&scene=${scene}&v=1`))!;
  const g = new Game();
  let writes = 0;
  const captureErrors: string[] = [];
  g.onCheckpoint = () => writes++;
  g.onCommendation = () => writes++;
  g.onCampaignClear = () => writes++;
  g.startTest(spec.checkpoint);
  const entry = rematchEntry(g),
    gun = JSON.stringify(g.gun);
  const buffer = new ReplayBuffer<number>();
  let lastFrame = -Infinity,
    firstHit = false,
    recovery = false,
    recovered = false,
    blocked = 0,
    open = 0;
  let nativeReplay: any, canvas: any, renderer: any;
  if (images && scene === 'replay') {
    canvas = native.createCanvas(1280, 720);
    canvas.getBoundingClientRect = () => ({ width: 1280, height: 720 });
    renderer = new Renderer(canvas, g);
    renderer.reset();
    const target = native.createCanvas(854, 480);
    target.toBlob = (done: (blob: Blob | null) => void) =>
      done(new Blob([target.toBuffer('image/jpeg')], { type: 'image/jpeg' }));
    nativeReplay = new DeathReplay(target);
  }
  g.onDamage = (hit) => {
    try {
      if (!firstHit) {
        render(g, scene, 'impact');
        firstHit = true;
      }
      if (nativeReplay) {
        renderer.draw(g.elapsed * 1000);
        nativeReplay.recordHit(
          {
            id: hit.id,
            at: hit.elapsed,
            damage: hit.damage,
            hpBefore: hit.hpBefore,
            hpAfter: hit.hpAfter,
            player: renderer.toCanvas(hit.player),
            ...(hit.origin ? { origin: renderer.toCanvas(hit.origin) } : {}),
            label: damageCauseText(hit.cause),
          },
          canvas,
        );
      }
    } catch (error) {
      captureErrors.push(String(error));
    }
  };
  g.onDeath = (origin) => {
    if (nativeReplay) {
      renderer.draw(g.elapsed * 1000);
      nativeReplay.finish(canvas, g.elapsed, {
        player: renderer.toCanvas(g.player.position),
        ...(origin ? { origin: renderer.toCanvas(origin) } : {}),
        label: damageCauseText(g.deathCause),
      });
    }
  };
  for (let n = 0; n < 3600 && g.mode === 'playing'; n++) {
    g.tick(1 / 60, idle);
    if (g.elapsed - lastFrame >= 1 / 24 || g.mode === 'dead') {
      buffer.add({ at: g.elapsed, data: g.hp, bytes: 4 });
      lastFrame = g.elapsed;
      if (nativeReplay && g.mode === 'playing') {
        renderer.draw(g.elapsed * 1000);
        nativeReplay.capture(canvas, g.elapsed);
      }
    }
    if (scene === 'cover') {
      const e = g.enemies[0];
      if (e) {
        const line = g.lineEnd(e.body.position, g.player.position, 5),
          distance = Math.hypot(line.x - g.player.position.x, line.y - g.player.position.y);
        blocked += Number(distance > 1);
        open += Number(distance <= 1);
      }
    }
    const hit = g.damageControl.lastHit,
      age = hit ? g.time - hit.at : -1;
    if (firstHit && !recovery && age >= 0.4 && age < 0.75) {
      render(g, scene, 'recovery');
      recovery = true;
    }
    if (firstHit && !recovered && age >= 0.76) {
      render(g, scene, 'recovered');
      recovered = true;
    }
    if (
      ![
        g.hp,
        g.time,
        g.player.position.x,
        g.player.position.y,
        g.player.velocity.x,
        g.player.velocity.y,
      ].every(Number.isFinite)
    )
      throw Error('Invalid real simulation.');
  }
  await new Promise((r) => setTimeout(r, 0));
  if (captureErrors.length) throw Error(captureErrors.join('; '));
  const hits: ReplayHit[] = g.damageControl.hits.map((h) => ({
    id: h.id,
    at: h.elapsed,
    damage: h.damage,
    hpBefore: h.hpBefore,
    hpAfter: h.hpAfter,
    player: h.player,
    ...(h.origin ? { origin: h.origin } : {}),
    label: damageCauseText(h.cause),
  }));
  const timeline = replayHitsInBuffer(buffer.frames, hits);
  if (nativeReplay && (!nativeReplay.ready || nativeReplay.hits.length !== 3))
    throw Error('Native replay lost actual hit evidence.');
  const summary = g.damageControl.summary(),
    original = physical(g);
  let rematch: Record<string, unknown> | null = null;
  if (scene === 'replay') {
    const snapshot = roomRematchSnapshot(g, entry);
    if (!snapshot) throw Error('Missing natural death rematch.');
    const session = new RoomRematch(snapshot);
    let privateWrites = 0;
    session.game.onCheckpoint = () => privateWrites++;
    session.game.onCommendation = () => privateWrites++;
    session.game.onCampaignClear = () => privateWrites++;
    if (session.damageResult !== null || session.game.damageControl.summary().hits)
      throw Error('Previous attempt leaked.');
    session.game.setMode('playing');
    playRoom(session.game, 60);
    const result = session.damageResult;
    rematch = {
      outcome: session.game.mode,
      hp: session.game.hp,
      startingHp: session.attemptStartingHp,
      summary: result,
      originalStartingHp: snapshot.startingHp,
      originalSummary: snapshot.damageSummary,
      progressWrites: privateWrites,
      originalUnchanged: physical(g) === original,
    };
    if (result && images)
      writeFileSync(
        resolve(images, 'rematch-endpoint.html'),
        rematchDamageHtml(
          snapshot,
          result,
          session.game.mode as 'won' | 'dead',
          session.attemptStartingHp,
        ),
      );
    session.reset();
    rematch.resetClearsSummary =
      session.damageResult === null && session.game.damageControl.summary().hits === 0;
    if (privateWrites || physical(g) !== original || !rematch.resetClearsSummary)
      throw Error('Private rematch isolation failed.');
    session.dispose();
  }
  const row = {
    scene,
    mode: g.mode,
    hp: g.hp,
    summary,
    healthBudget: spec.checkpoint.hp,
    elapsed: g.elapsed,
    hits: g.damageControl.hits,
    replayWindow: { start: buffer.frames[0]?.at, end: buffer.frames.at(-1)?.at, hits: timeline },
    nativeReplay: nativeReplay
      ? {
          ready: nativeReplay.ready,
          frames: nativeReplay.buffer.frames.length,
          hits: nativeReplay.hits,
        }
      : null,
    blockedFrames: blocked,
    openFrames: open,
    progressWrites: writes,
    gunUnchanged: gun === JSON.stringify(g.gun),
    rematch,
  };
  rows.push(row);
  console.log(
    JSON.stringify({
      scene,
      mode: g.mode,
      elapsed: g.elapsed,
      summary,
      replayHits: timeline.length,
      nativeReplayHits: nativeReplay?.hits.length,
      blocked,
      rematch,
    }),
  );
}
const summary = {
  scenes: rows.length,
  naturalDeaths: rows.filter((r) => r.mode === 'dead').length,
  progressWrites: rows.reduce((n, r) => n + Number(r.progressWrites), 0),
  nativeCaptures: captures.length,
  threeHitReplay:
    (rows.find((r) => r.scene === 'replay')!.replayWindow as { hits: unknown[] }).hits.length === 3,
};
const report = {
  version: GAME_VERSION,
  checkedAtUtc: new Date().toISOString(),
  sourceHashes,
  note: 'All hits arise from real hostile AI/projectile collisions under ordinary idle inputs. The only authored health change is the Replay checkpoint’s54HP starting budget. The private rematch uses ordinary movement, aim, jump and fire with full100HP. Timings are automated checks, not observed player sessions or win-rate claims.',
  rows,
  captures,
  summary,
};
mkdirSync(dirname(destination), { recursive: true });
writeFileSync(destination, JSON.stringify(report, null, 2));
console.log(JSON.stringify(summary));
if (summary.progressWrites || !summary.threeHitReplay || rows.some((r) => !r.gunUnchanged))
  throw Error('Damage Control audit invariant failed.');
