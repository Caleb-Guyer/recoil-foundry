// Reproducible balance evidence, not an estimate of human win rates.
import { mkdirSync, writeFileSync } from 'node:fs';
import Matter from 'matter-js';
import { Game, type Input } from '../src/game.ts';
import { seeded, validBuild, loadCheckpoint, type Checkpoint } from '../src/rules.ts';
import { switchboardTestFromUrl } from '../src/switchboard-layout.ts';
import { playCampaign } from '../tests/campaign-pilot.ts';
import { dodgePilot } from '../tests/combat-pilot.ts';
import { withParents, completeBuild } from '../src/branch-builds.ts';
import { OVERTIME_LIFT, OVERTIME_STEPS } from '../src/escape-layout.ts';
import { assertFiniteWorld, stabilityCounts } from '../src/stability-scenarios.ts';
import assert from 'node:assert/strict';

const suite = process.argv[2] ?? 'routes';
const results: unknown[] = [];
const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: false,
  fire: false,
  aim: { x: 1000, y: 400 },
};
const forks = {
  orders: ['spoof', 'standing-orders', 'priority-target'],
  cross: ['spoof', 'cross-talk', 'dead-switch'],
};
function reset() {
  const common = Matter.Common as typeof Matter.Common & { _nextId: number; _seed: number };
  common._nextId = common._seed = 0;
  Math.random = seeded('dead-signal-audit-particles');
}
function report(row: unknown) {
  results.push(row);
  console.log(JSON.stringify(row));
  mkdirSync('.release-assets', { recursive: true });
  writeFileSync(
    `.release-assets/dead-signal-${suite}.json`,
    JSON.stringify(results, null, 2) + '\n',
  );
}
function observe(g: Game) {
  const rooms: any[] = [];
  let row: any;
  const start = () => {
    row = {
      stage: g.stage,
      layout: g.level.id,
      mirror: g.level.mirrored,
      start: g.time,
      startHp: g.hp,
      mods: [...g.mods],
      taken: 0,
      maxAllies: 0,
      maxShots: 0,
      reboots: 0,
      clear: false,
    };
    rooms.push(row);
  };
  start();
  const damage = g.damagePlayer.bind(g),
    tick = g.tick.bind(g);
  g.damagePlayer = (...args) => {
    const hp = g.hp;
    damage(...args);
    row.taken += Math.max(0, hp - g.hp);
  };
  g.tick = (...args) => {
    if (row.stage !== g.stage || row.layout !== g.level.id) start();
    const hp = g.hp,
      taken = row.taken;
    tick(...args);
    row.taken += Math.max(0, hp - g.hp - (row.taken - taken));
    row.endHp = g.hp;
    row.seconds = +(g.time - row.start).toFixed(2);
    row.healed = +(g.hp - row.startHp + row.taken).toFixed(2);
    row.clear ||= g.clear || g.mode === 'upgrade';
    row.maxAllies = Math.max(row.maxAllies, g.factions.allies.length);
    row.maxShots = Math.max(row.maxShots, g.shots.length);
    row.reboots = Math.max(row.reboots, g.spoof.reboots);
  };
  return rooms;
}
if (suite === 'routes') {
  for (const core of ['pierce', 'cutting-torch', 'shellshock'])
    for (const fork of ['orders', 'cross'] as const)
      for (let index = 0; index < 2; index++)
        for (const region of ['annex', 'cooling'] as const) {
          reset();
          const seed = `DEAD-SIGNAL-${core}-${fork}-${index}`;
          const mods = ['magnum', 'rapid', 'light', 'leech', core, ...forks[fork]];
          const save: Checkpoint = {
            version: 6,
            seed,
            stage: 8,
            hp: 100,
            mods,
            kills: 0,
            elapsed: 0,
            region,
            annexVersion: 5,
          };
          if (!loadCheckpoint(save) || !validBuild(mods)) throw Error('Invalid route fixture');
          const g = new Game();
          g.start(seed, save);
          const rooms = observe(g);
          const priority = [
            'airshot',
            'kick',
            'landing',
            'ricochet',
            'scatter',
            'burst',
            'countershot',
          ];
          playCampaign(g, {
            pathMods: [core],
            seconds: 300,
            stop: (g) => g.stage >= 12,
            chooseUpgrade: (g) =>
              priority.find((id) => g.offers.some((m) => m.id === id)) ?? g.offers[0].id,
          });
          report({
            seed,
            core,
            fork,
            region,
            completed: g.stage >= 12,
            stage: g.stage,
            mode: g.mode,
            hp: g.hp,
            seconds: g.time,
            cause: g.deathCause,
            position: g.player.position,
            rooms,
            remaining: g.enemies.map((e) => ({ kind: e.kind, hp: e.hp, pos: e.body.position })),
          });
        }
} else if (suite === 'cheese') {
  const positions = [
    { x: 35, y: 722 },
    { x: 1965, y: 722 },
    { x: 1000, y: 40 },
    ...[
      [420, 650],
      [695, 550],
      [1000, 460],
      [1305, 550],
      [1560, 650],
    ].flatMap(([x, y]) => [
      { x, y: y - 19 },
      { x, y: y + 42 },
      { x, y: 722 },
    ]),
  ];
  for (const build of ['gun', 'counter', 'portal', 'subversion'])
    for (const mirror of [false, true])
      for (const pos of positions) {
        reset();
        const save = switchboardTestFromUrl(
          new URL(`https://test/?test=switchboard&build=${build}&mirror=${+mirror}`),
        )!;
        const g = new Game();
        g.startTest(save);
        const e = g.enemies[0];
        // These probes deliberately grant impossible free hover/perfect aim.
        // Only initial player placement/static support is changed; boss, health,
        // shots and physical cover stay real. Not counted as ordinary-input runs.
        Matter.Body.setPosition(g.player, pos);
        Matter.Body.setStatic(g.player, true);
        if (build === 'portal') {
          g.portals.place({ x: 270, y: 740 });
          g.portals.place({ x: 1730, y: 740 });
        }
        const rooms = observe(g);
        for (let i = 0; i < 60 * 90 && g.mode === 'playing'; i++)
          g.tick(1 / 60, { ...idle, fire: true, aim: { ...e.body.position } });
        report({ build, mirror, pos, mode: g.mode, hp: g.hp, boss: e.hp, seconds: g.time, rooms });
      }
} else if (suite === 'boss-builds') {
  const families = {
    gun: ['pierce'],
    beam: ['cutting-torch', 'burst'],
    shell: ['shellshock', 'aftershock'],
    counter: ['countershot', 'breach'],
    portal: ['fold', 'rewire'],
  };
  for (const [family, wanted] of Object.entries(families))
    for (const fork of ['orders', 'cross'] as const)
      for (const maximal of [false, true])
        for (const mirror of [false, true]) {
          reset();
          let mods = withParents(
            [],
            ['magnum', 'rapid', 'light', 'leech', ...wanted, ...forks[fork]],
          )!;
          if (!mods) throw Error('Invalid family: ' + family);
          if (maximal) mods = completeBuild(mods)!;
          const s = switchboardTestFromUrl(
            new URL(`https://test/?test=switchboard&mirror=${+mirror}`),
          )!;
          s.mods = mods;
          const g = new Game();
          g.startTest(s);
          const e = g.enemies[0],
            rooms = observe(g);
          let input = idle;
          if (family === 'portal') {
            g.portals.place({ x: 270, y: 740 });
            g.portals.place({ x: 1730, y: 740 });
          }
          for (let i = 0; i < 60 * 150 && g.mode === 'playing'; i++) {
            if (i % 6 === 0) input = { ...idle, ...dodgePilot(g, e) };
            g.tick(1 / 60, input);
          }
          report({
            family,
            fork,
            maximal,
            mirror,
            mods,
            mode: g.mode,
            hp: g.hp,
            boss: e.hp,
            phase: e.phase,
            seconds: g.time,
            rooms,
          });
        }
} else if (suite === 'campaigns' || suite === 'campaigns-extra' || suite === 'overtime') {
  const priority = [
    'leech',
    'countershot',
    'magnum',
    'rapid',
    'scatter',
    'airshot',
    'pierce',
    'ricochet',
    'light',
    'burst',
    'backblast',
    'spoof',
    'standing-orders',
    'priority-target',
    'deadeye',
    'execute',
    'fracture',
    'banker',
    'capacitor',
    'reserve-cell',
    'rail-spike',
  ];
  const seeds =
    suite === 'campaigns-extra'
      ? Array.from({ length: 24 }, (_, i) => `DEAD-SIGNAL-FULL-${i + 11}`)
      : suite === 'overtime'
        ? ['DEAD-SIGNAL-FULL-0']
        : [
            'path-run-67',
            ...Array.from({ length: 11 }, (_, i) => `DEAD-SIGNAL-FULL-${i}`),
            ...Array.from(
              { length: 14 },
              (_, i) => `RF-D84-2026-09-${String(i + 15).padStart(2, '0')}`,
            ),
          ];
  for (const seed of seeds) {
    reset();
    const g = new Game();
    g.start(seed);
    const rooms = observe(g);
    let error: string | undefined;
    let liftStep = 0,
      previous = 6600,
      stuck = 0;
    try {
      playCampaign(g, {
        pathMods: [],
        region: 'annex',
        seconds: 1200,
        beforeInput: (g) => {
          if (g.mode === 'reforge') {
            g.reforge.choose(0);
            return idle;
          }
          if (
            suite === 'overtime' &&
            g.canOvertime &&
            g.escape?.phase === 'route' &&
            g.player.position.x > 6550
          ) {
            const path = [
              ...OVERTIME_STEPS.map((s) => ({ x: s.x + s.w / 2, y: s.y - 18 })),
              { x: OVERTIME_LIFT.x, y: OVERTIME_LIFT.y - 18 },
            ];
            const p = g.player.position,
              target = path[Math.min(liftStep, path.length - 1)],
              dx = target.x - p.x;
            if (g.grounded && Math.abs(dx) < 22 && Math.abs(p.y - target.y) < 8) liftStep++;
            stuck = Math.abs(p.x - previous) < 0.4 ? stuck + 1 : 0;
            previous = p.x;
            const move = Math.abs(dx) > 8 ? Math.sign(dx) : 0;
            const blocked =
              move &&
              Matter.Query.ray(g.solidBodies, p, { x: p.x + move * 50, y: p.y }, 24).length > 0;
            return {
              ...idle,
              jumpHeld: true,
              left: move < 0,
              right: move > 0,
              jump: g.grounded && (p.y - target.y > 45 || !!blocked || stuck > 12),
            };
          }
        },
        stop: () =>
          rooms.at(-1).seconds > 180 ||
          (suite === 'overtime' && !!g.overtime && (g.stage > 0 || g.clear)),
        chooseUpgrade: (g) =>
          priority.find((id) => g.offers.some((m) => m.id === id)) ?? g.offers[0].id,
      });
    } catch (e) {
      error = String(e);
    }
    report({
      seed,
      error,
      region: g.region,
      overtime: g.overtime,
      mode: g.mode,
      stage: g.stage,
      hp: g.hp,
      mods: g.mods,
      seconds: g.time,
      cause: g.deathCause,
      position: g.player.position,
      rooms,
      remaining: g.enemies.map((e) => ({ kind: e.kind, hp: e.hp, pos: e.body.position })),
    });
  }
} else if (suite === 'restarts') {
  const g = new Game();
  const save = switchboardTestFromUrl(new URL('https://test/?test=switchboard&build=counter'))!;
  save.mods = completeBuild(withParents(save.mods, forks.cross)!)!;
  let baseline: ReturnType<typeof stabilityCounts> | undefined;
  for (let cycle = 0; cycle < 20; cycle++) {
    reset();
    g.startTest(save);
    const fresh = stabilityCounts(g);
    if (baseline) assert.deepEqual(fresh, baseline, 'Restart retained world objects');
    baseline = fresh;
    const peaks = { ...fresh };
    const e = g.enemies[0];
    let input = idle;
    for (let i = 0; i < 60 * 20 && g.mode === 'playing'; i++) {
      if (i % 6 === 0) input = { ...idle, ...dodgePilot(g, e) };
      g.tick(1 / 60, input);
      assertFiniteWorld(g);
      for (const key of Object.keys(peaks) as (keyof typeof peaks)[])
        peaks[key] = Math.max(peaks[key], stabilityCounts(g)[key]);
    }
    report({ cycle, baseline, peaks, hp: g.hp, seconds: g.time, mode: g.mode });
  }
} else throw Error('Unknown suite: ' + suite);
