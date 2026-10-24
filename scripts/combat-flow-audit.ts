import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import Matter from 'matter-js';
import { Game } from '../src/game.ts';
import { ENEMY_STATS } from '../src/enemies.ts';
import { loadCheckpoint, validSavedBuild } from '../src/rules.ts';
import { STARTING_GUN_IDS } from '../src/starting-guns.ts';
import { COMBAT_FLOW_IDS } from '../src/combat-flow-rooms.ts';
import { combatFlowTestFromUrl } from '../src/combat-flow-test.ts';
import { playRoom } from '../tests/room-pilot.ts';
import { GAME_VERSION } from '../src/version.ts';

// Read-only observations around the ordinary-input room pilot. No health,
// enemy, weapon, world, timer or warning values are changed by this audit.
const reportPath = resolve(process.argv[2] ?? 'combat-flow-audit.json');
const seconds = Math.max(15, Math.min(240, Number(process.argv[3]) || 90));
const option = (name: string) =>
  process.argv.find((arg) => arg.startsWith('--' + name + '='))?.split('=')[1];
const nativeOnly = process.argv.includes('--native-only');
const buildsOnly = process.argv.includes('--builds-only');
const smoke = process.argv.includes('--smoke');
const rooms = COMBAT_FLOW_IDS.filter((id) => !option('room') || id === option('room'));
const guns = STARTING_GUN_IDS.filter((id) => !option('gun') || id === option('gun'));
const mirrors = option('mirror') ? [option('mirror') === '1'] : [false, true];
const renderDirectory = option('render');
const rows: Record<string, unknown>[] = [];
const unsupported: string[] = [];
const geometry: Record<string, unknown>[] = [];
const started = performance.now();
const sourceFiles = [
  'package.json',
  'src/game.ts',
  'src/levels.ts',
  'src/rules.ts',
  'src/combat-flow-rooms.ts',
  'src/combat-flow-rules.ts',
  'src/combat-flow-test.ts',
  'src/reinforcements.ts',
  'src/encounter-pacing.ts',
  'src/starting-guns.ts',
  'tests/room-pilot.ts',
  'tests/combat-pilot.ts',
  'scripts/combat-flow-audit.ts',
];
const sourceHashes = Object.fromEntries(
  sourceFiles.map((path) => [
    path,
    createHash('sha256')
      .update(readFileSync(resolve(path)))
      .digest('hex'),
  ]),
);
mkdirSync(dirname(reportPath), { recursive: true });

const finiteGame = (g: Game) =>
  [
    g.hp,
    g.time,
    ...[g.player, ...g.enemies.map((e) => e.body), ...g.props.items.map((p) => p.body)].flatMap(
      (body) => [body.position.x, body.position.y, body.velocity.x, body.velocity.y, body.angle],
    ),
    ...g.shots.flatMap((shot) => [shot.pos.x, shot.pos.y, shot.vel.x, shot.vel.y, shot.life]),
  ].every(Number.isFinite);
const overlap = (a: Matter.Bounds, b: Matter.Bounds) =>
  Math.min(a.max.x, b.max.x) - Math.max(a.min.x, b.min.x) > 0.5 &&
  Math.min(a.max.y, b.max.y) - Math.max(a.min.y, b.min.y) > 0.5;
const rectangle = (x: number, y: number, w: number, h: number) => ({
  min: { x, y },
  max: { x: x + w, y: y + h },
});
function physicalIssues(g: Game) {
  const issues: string[] = [],
    terrain = g.level.solids.map((s) => rectangle(s.x, s.y, s.w, s.h)),
    props = g.props.items.map((p) => p.body.bounds),
    actors = [
      { label: 'entrance', bounds: rectangle(127, 662, 26, 36) },
      { label: 'exit', bounds: rectangle(1840, 590, 160, 150) },
      ...g.level.spawns.map((s, i) => {
        const { w, h } = ENEMY_STATS[s.kind];
        return { label: i + ':' + s.kind, bounds: rectangle(s.x - w / 2, s.y - h / 2, w, h) };
      }),
    ];
  for (const actor of actors)
    for (const [i, solid] of [...terrain, ...props].entries())
      if (overlap(actor.bounds, solid)) issues.push(actor.label + ' overlaps solid ' + i);
  for (const [i, prop] of props.entries())
    for (const [j, solid] of terrain.entries())
      if (overlap(prop, solid)) issues.push('prop ' + i + ' overlaps terrain ' + j);
  for (let i = 0; i < g.level.spawns.length; i++)
    for (let j = i + 1; j < g.level.spawns.length; j++)
      if (overlap(actors[i + 2].bounds, actors[j + 2].bounds))
        issues.push('spawn ' + i + ' overlaps spawn ' + j);
  return issues;
}
function checkpoint(
  room: string,
  variant: number,
  mirror: boolean,
  gun: string,
  build: string,
  route?: string,
) {
  const url = new URL(
    'https://audit.invalid/?test=flow&room=' +
      room +
      '&variant=' +
      variant +
      '&mirror=' +
      Number(mirror) +
      '&gun=' +
      gun +
      '&build=' +
      build +
      '&v=1' +
      (route ? '&route=' + route : ''),
  );
  const cp = combatFlowTestFromUrl(url);
  if (!cp) return { url, cp };
  if (!loadCheckpoint(cp) || !validSavedBuild(cp.mods))
    throw Error('Invalid audit checkpoint ' + url.href);
  return { url, cp };
}
function writeProgress(inProgress: boolean) {
  const report = {
    version: GAME_VERSION,
    checkedAtUtc: new Date().toISOString(),
    sourceHashes,
    note: 'Deterministic ordinary-input simulations with real health, AI, collision, ammunition and warning timing. These are not observed human playtests or human win rates. Advanced builds that exceed the real room reward budget are listed as unsupported fixtures rather than granted extra upgrades.',
    inProgress,
    secondsPerTrial: seconds,
    wallSeconds: Math.round((performance.now() - started) / 100) / 10,
    attempts: rows.length,
    clears: rows.filter((r) => r.outcome === 'clear').length,
    deaths: rows.filter((r) => r.outcome === 'death').length,
    timeouts: rows.filter((r) => r.outcome === 'timeout').length,
    nonFinite: rows.filter((r) => !r.finite).length,
    gunMutations: rows.filter((r) => !r.unchangedGun).length,
    incompleteClears: rows.filter(
      (r) =>
        r.outcome === 'clear' &&
        ((r.beats as number[]).length !== 3 || r.kills !== r.expectedEnemies || r.pending),
    ).length,
    progressWrites: rows.reduce((sum, r) => sum + Number(r.progressWrites), 0),
    geometryFailures: geometry.filter((g) => (g.issues as string[]).length > 0).length,
    unsupportedFixtures: unsupported,
    geometry,
    runs: rows,
  };
  writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
  return report;
}

for (const room of rooms) {
  const routeChoices = ['switchyard', 'scrap-bridge'].includes(room)
    ? ['low', 'high']
    : [undefined];
  for (const route of option('route')
    ? routeChoices.filter((r) => r === option('route'))
    : routeChoices)
    for (const mirror of mirrors) {
      const selected = option('variant') ? [Number(option('variant'))] : smoke ? [1] : [1, 2, 3];
      for (const variant of selected) {
        const fixture = checkpoint(room, variant, mirror, 'pistol', 'native', route);
        if (!fixture.cp) throw Error('Native fixture missing: ' + fixture.url.href);
        const g = new Game();
        g.startTest(fixture.cp);
        if (!g.level.combatFlow) throw Error('Combat Flow not installed: ' + fixture.url.href);
        geometry.push({
          room,
          variant,
          mirror,
          route,
          level: g.level.id,
          issues: physicalIssues(g),
        });
        Matter.Composite.clear(g.engine.world, false);
        Matter.Engine.clear(g.engine);
      }
      const builds = nativeOnly
        ? ['native']
        : buildsOnly
          ? ['beam', 'blast', 'chain']
          : ['native', 'beam', 'blast', 'chain'];
      for (const build of builds) {
        // Native matrix covers every variant and all six tools. Earned-build
        // probes use the first variant and the selected native tool, normally
        // the pistol; --full-builds expands them to the complete matrix.
        const variants =
          build === 'native' || process.argv.includes('--full-builds') ? selected : [selected[0]];
        const selectedGuns =
          build === 'native' || process.argv.includes('--full-builds') ? guns : guns.slice(0, 1);
        for (const variant of variants)
          for (const gun of selectedGuns) {
            const { cp, url } = checkpoint(room, variant, mirror, gun, build, route);
            if (!cp) {
              if (build === 'native') throw Error('Native fixture missing: ' + url.href);
              unsupported.push(url.search);
              continue;
            }
            const g = new Game();
            let progressWrites = 0;
            g.onCheckpoint = () => progressWrites++;
            g.onCommendation = () => progressWrites++;
            g.onCampaignClear = () => progressWrites++;
            const sounds: Record<string, number> = {};
            g.onSound = (name) => {
              sounds[name] = (sounds[name] ?? 0) + 1;
            };
            g.startTest(cp);
            const initialRoster = g.level.spawns.map((s) => s.kind),
              expectedCount = initialRoster.length,
              initialHp = g.hp,
              initialGun = JSON.stringify(g.gun),
              beats = new Set<number>(),
              arrivals = new Set<number>();
            let finite = finiteGame(g),
              frames = 0,
              damage = 0,
              previousHp = g.hp;
            const warnings = new Set<string>();
            const observe = () => {
              frames++;
              finite &&= finiteGame(g);
              if (g.waves.flowBeat !== null) beats.add(g.waves.flowBeat);
              damage += Math.max(0, previousHp - g.hp);
              previousHp = g.hp;
              for (const e of g.enemies) {
                if (e.fromDoor) arrivals.add(e.id);
                if (e.state === 'windup') warnings.add(e.kind);
              }
              return !finite;
            };
            const wallStart = performance.now();
            const result = playRoom(g, seconds, observe);
            observe();
            const row = {
              room,
              variant,
              mirror,
              route,
              gun,
              build,
              query: url.search,
              seed: cp.seed,
              outcome: g.clear ? 'clear' : g.hp <= 0 ? 'death' : !finite ? 'non-finite' : 'timeout',
              hp: g.hp,
              initialHp,
              damage,
              seconds: Math.round(g.time * 100) / 100,
              wallMs: Math.round(performance.now() - wallStart),
              kills: g.kills,
              expectedEnemies: expectedCount,
              initialRoster,
              beats: [...beats],
              reserveArrivals: arrivals.size,
              warningKinds: [...warnings],
              reinforcementCues: sounds.reinforce ?? 0,
              finite,
              progressWrites,
              unchangedGun: initialGun === JSON.stringify(g.gun),
              deathCause: g.deathCause,
              remaining: result.enemies,
              pending: g.waves.pending,
              player: result.player,
              wavePhase: g.waves.phase,
              doors: g.waves.doors.map((door) => ({
                kind: door.spawn.kind,
                x: door.spawn.x,
                y: door.spawn.y,
                state: door.state,
                timer: door.timer,
                blocked: door.blocked,
                beat: door.flowBeat,
              })),
              props: g.props.items.map((prop) => ({
                kind: prop.kind,
                position: { ...prop.body.position },
              })),
            };
            rows.push(row);
            console.log(
              JSON.stringify({
                run: rows.length,
                room,
                variant,
                mirror,
                route,
                gun,
                build,
                outcome: row.outcome,
                hp: g.hp,
                seconds: row.seconds,
                beats: row.beats,
              }),
            );
            Matter.Composite.clear(g.engine.world, false);
            Matter.Engine.clear(g.engine);
            writeProgress(true);
          }
      }
    }
}

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
  const sheet = createCanvas(1440, rooms.length * 250),
    sc = sheet.getContext('2d');
  sc.fillStyle = '#0c151a';
  sc.fillRect(0, 0, sheet.width, sheet.height);
  for (const [row, room] of rooms.entries())
    for (const [column, variant] of [1, 2, 3].entries()) {
      const cp = checkpoint(room, variant, column === 1, 'pistol', 'native').cp!;
      const g = new Game();
      g.startTest(cp);
      const canvas = createCanvas(1440, 660);
      canvas.getBoundingClientRect = () => ({ width: 1440, height: 660 });
      const renderer = new Renderer(canvas, g);
      renderer.reduced = column === 2;
      const before = JSON.stringify(g.checkpointSnapshot());
      renderer.draw(0, { camera: { x: 0, y: -40 }, scale: 0.72, player: true });
      if (JSON.stringify(g.checkpointSnapshot()) !== before)
        throw Error('Renderer mutated ' + room);
      writeFileSync(
        resolve(renderDirectory, room + '-v' + variant + '.png'),
        canvas.toBuffer('image/png'),
      );
      sc.drawImage(canvas, column * 480, row * 250 + 25, 480, 220);
      sc.fillStyle = '#dce4d9';
      sc.font = '14px monospace';
      sc.fillText(
        room + ' / v' + variant + (column === 1 ? ' mirror' : column === 2 ? ' reduced' : ''),
        column * 480 + 8,
        row * 250 + 18,
      );
      Matter.Composite.clear(g.engine.world, false);
      Matter.Engine.clear(g.engine);
    }
  writeFileSync(
    resolve(renderDirectory, 'combat-flow-render-audit.png'),
    sheet.toBuffer('image/png'),
  );
}
const final = writeProgress(false);
console.log(
  JSON.stringify({
    ...final,
    runs: undefined,
    geometry: undefined,
    unsupportedFixtures: final.unsupportedFixtures.length,
  }),
);
if (
  final.nonFinite ||
  final.timeouts ||
  final.geometryFailures ||
  final.progressWrites ||
  final.gunMutations ||
  final.incompleteClears
)
  process.exitCode = 1;
