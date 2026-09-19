// Offline balance measurements. The pilot uses normal inputs and real health.
// These are reproducible bot results, not estimates of human win rates.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import Matter from 'matter-js';
import { Game, type Input } from '../src/game.ts';
import { MODS, rewardMods, seeded, validBuild, type Checkpoint } from '../src/rules.ts';
import { BRANCH_TEST_BUILDS, branchTestFromUrl, maxCombos } from '../src/branch-builds.ts';
import { playRoom } from '../tests/room-pilot.ts';
import { playCampaign } from '../tests/campaign-pilot.ts';
import { dailyForDate } from '../src/daily.ts';

export const BALANCE_BUILDS: Record<string, string[]> = {
  utility: [
    'light',
    'fold',
    'countershot',
    'ricochet',
    'pierce',
    'split',
    'leech',
    'landing',
    'vector',
    'tether',
    'capacitor',
    'reserve-cell',
  ],
  balanced: [
    'magnum',
    'light',
    'kick',
    'rapid',
    'airshot',
    'leech',
    'pierce',
    'ricochet',
    'scatter',
    'countershot',
  ],
  precision: [
    'magnum',
    'rapid',
    'deadeye',
    'airshot',
    'light',
    'leech',
    'execute',
    'rivet',
    'fracture',
    'deadlock',
    'capacitor',
    'reserve-cell',
    'rail-spike',
  ],
  volley: [
    'magnum',
    'rapid',
    'scatter',
    'crossfire',
    'airshot',
    'leech',
    'burst',
    'convergence',
    'afterimage',
    'parallax',
    'pierce',
    'ricochet',
    'light',
  ],
  demolition: [
    'magnum',
    'airshot',
    'leech',
    'shellshock',
    'rapid',
    'aftershock',
    'light',
    'scatter',
    'fuse',
    'linked-fuse',
    'chain-reaction',
    'blast-surf',
    'burst',
  ],
  beam: [
    'magnum',
    'rapid',
    'cutting-torch',
    'light',
    'leech',
    'burst',
    'scatter',
    'airshot',
    'pulse-chamber',
    'countershot',
  ],
  cryogenic: [
    'magnum',
    'rapid',
    'coolant-rounds',
    'deep-freeze',
    'light',
    'leech',
    'pierce',
    'airshot',
    'icebreaker',
    'cinder',
    'thermal-shock',
  ],
  stasis: [
    'magnum',
    'rapid',
    'suspension',
    'scatter',
    'light',
    'leech',
    'crosshatch',
    'airshot',
    'thread-the-needle',
    'pierce',
    'ricochet',
  ],
};
export function buildAt(name: string, stage: number, seed: string) {
  const mods: string[] = [];
  for (let i = 0; i < stage; i++) {
    const pool = rewardMods(mods, MODS.length, seeded(seed + ':build:' + i), { stage: i });
    const priorities = BALANCE_BUILDS[name];
    const next = priorities.map((id) => pool.find((m) => m.id === id)).find(Boolean) ?? pool[0];
    mods.push(next!.id);
  }
  if (!validBuild(mods)) throw Error('Invalid audit build');
  return mods;
}
export function measure(g: Game, seconds = 90) {
  let taken = 0,
    peakShots = 0,
    peakParticles = 0,
    peakEnemies = g.enemies.length;
  const damage = g.damagePlayer.bind(g),
    tick = g.tick.bind(g);
  g.damagePlayer = (...args) => {
    const hp = g.hp;
    damage(...args);
    taken += Math.max(0, hp - g.hp);
  };
  g.tick = (...args) => {
    const hp = g.hp,
      before = taken;
    tick(...args);
    // Crushing and falling can end a run directly, outside damagePlayer.
    taken += Math.max(0, hp - g.hp - (taken - before));
    peakShots = Math.max(peakShots, g.shots.length);
    peakParticles = Math.max(peakParticles, g.particles.length);
    peakEnemies = Math.max(peakEnemies, g.enemies.length);
  };
  const at = g.time,
    health = g.hp;
  const result = playRoom(g, seconds);
  g.damagePlayer = damage;
  g.tick = tick;
  const healed = g.hp - health + taken;
  return {
    clear: result.clear,
    mode: g.mode,
    seconds: +(g.time - at).toFixed(2),
    startHp: health,
    endHp: +g.hp.toFixed(2),
    taken: +taken.toFixed(2),
    healed: +healed.toFixed(2),
    peakShots,
    peakParticles,
    peakEnemies,
    remaining: g.enemies.map((e) => ({ kind: e.kind, hp: +e.hp.toFixed(1), max: e.maxHp })),
    cause: g.deathCause,
  };
}
function resetPhysics() {
  const c = Matter.Common as typeof Matter.Common & { _nextId: number; _seed: number };
  c._nextId = 0;
  c._seed = 0;
  Math.random = seeded('balance-particles');
}
function objectivePilot() {
  let drop: { x: number; bottom: number } | undefined;
  return (g: Game): Input | undefined => {
    if (g.mode !== 'playing' || !g.areaEvents.terminalReady) return;
    const p = g.player.position;
    if (drop && p.y > drop.bottom + 25) drop = undefined;
    if (!drop && p.y < g.areaEvents.site.y - 65) {
      const shelf = g.solidBodies.find(
        (b) =>
          b.bounds.min.y > p.y &&
          b.bounds.min.y < p.y + 40 &&
          p.x > b.bounds.min.x &&
          p.x < b.bounds.max.x,
      );
      if (shelf)
        drop = {
          x:
            p.x - shelf.bounds.min.x < shelf.bounds.max.x - p.x
              ? shelf.bounds.min.x - 45
              : shelf.bounds.max.x + 45,
          bottom: shelf.bounds.max.y,
        };
    }
    const dx = (drop?.x ?? g.areaEvents.site.x) - p.x;
    const blocked = Math.abs(g.player.velocity.x) < 0.3 && Math.abs(dx) > 35;
    const obstacle = g.props.items.find(
      (prop) =>
        Math.abs(prop.body.position.x - p.x) < 120 &&
        Math.abs(prop.body.position.y - p.y) < 75 &&
        (prop.body.position.x - p.x) * dx > 0,
    );
    return {
      left: dx < -18,
      right: dx > 18,
      jump:
        (Math.abs(dx) < 50 && Math.abs(p.y - g.areaEvents.site.y) < 60) || (blocked && g.grounded),
      jumpHeld: true,
      fire: blocked && (!g.grounded || !!obstacle),
      aim: obstacle?.body.position ?? { x: p.x, y: p.y + 300 },
    };
  };
}
function campaign(seed: string, policy: string, startStage = 0) {
  resetPhysics();
  const g = new Game();
  if (startStage)
    g.startTest({
      version: 6,
      seed,
      stage: startStage,
      hp: 100,
      mods: buildAt(policy, startStage, seed),
      kills: 0,
      elapsed: 0,
    });
  else g.start(seed);
  const rooms: unknown[] = [],
    choices: unknown[] = [];
  let key = '',
    at = 0,
    hp = g.hp,
    taken = 0,
    peak = 0,
    info = {},
    error: string | undefined;
  const finish = (completed = false) => {
    if (key)
      rooms.push({
        ...info,
        seconds: +(g.time - at).toFixed(2),
        startHp: hp,
        endHp: +g.hp.toFixed(2),
        taken: +taken.toFixed(2),
        healed: +(g.hp - hp + taken).toFixed(2),
        peakEnemies: peak,
        clear: completed || g.clear,
      });
  };
  const observe = () => {
    const next = `${g.stage}:${g.detour}:${g.escape?.phase ?? ''}`;
    if (key !== next) {
      finish(true);
      key = next;
      at = g.time;
      hp = g.hp;
      taken = 0;
      peak = 0;
      info = {
        stage: g.stage,
        layout: g.level.id,
        detour: g.detour,
        escape: g.escape?.phase,
        event: g.areaEvents.active,
        mods: [...g.mods],
      };
    }
    peak = Math.max(peak, g.enemies.length);
  };
  observe();
  const damage = g.damagePlayer.bind(g),
    tick = g.tick.bind(g);
  g.damagePlayer = (...args) => {
    const before = g.hp;
    damage(...args);
    taken += Math.max(0, before - g.hp);
  };
  g.tick = (...args) => {
    const hp = g.hp,
      before = taken;
    tick(...args);
    taken += Math.max(0, hp - g.hp - (taken - before));
    observe();
  };
  try {
    playCampaign(g, {
      pathMods: [],
      seconds: 1200,
      beforeInput: objectivePilot(),
      stop: () => g.time - at > 180,
      chooseUpgrade: () => {
        const priorities = BALANCE_BUILDS[policy];
        const id = priorities?.find((id) => g.offers.some((m) => m.id === id)) ?? g.offers[0].id;
        choices.push({ stage: g.stage, offers: g.offers.map((m) => m.id), chosen: id });
        return id;
      },
    });
  } catch (e) {
    error = String(e);
  }
  finish();
  return {
    suite,
    seed,
    policy,
    startStage,
    mode: g.mode,
    stage: g.stage,
    seconds: +g.time.toFixed(2),
    hp: +g.hp.toFixed(2),
    cause: g.deathCause,
    error,
    position: { ...g.player.position },
    terminal: g.areaEvents.terminalReady ? g.areaEvents.site : undefined,
    rooms,
    choices,
    remaining: g.enemies.map((e) => ({
      kind: e.kind,
      hp: Math.round(e.hp),
      state: e.state,
      position: { ...e.body.position },
      velocity: { ...e.body.velocity },
      target: e.target,
      timer: e.timer,
    })),
  };
}
const suite = process.argv[2] ?? 'bosses';
const output = process.argv[3] ?? 'balance-results/' + suite + '.json';
mkdirSync(dirname(output), { recursive: true });
const results: unknown[] = [];
const filter = new RegExp(process.env.BALANCE_FILTER ?? '');
const save = (r: unknown) => {
  results.push(r);
  writeFileSync(output, JSON.stringify(results, null, 2));
  console.log(JSON.stringify(r));
};
if (suite === 'bosses') {
  for (const build of Object.keys(BALANCE_BUILDS))
    for (const seed of ['path-run-65', 'path-run-66', 'path-run-67'])
      for (const stage of [3, 7, 11, 15, 19]) {
        if (!filter.test(`${build}:${seed}:${stage}`)) continue;
        resetPhysics();
        const g = new Game();
        const mods = buildAt(build, stage, seed);
        const p: Checkpoint = { version: 6, seed, stage, hp: 100, mods, kills: 0, elapsed: 0 };
        g.startTest(p);
        const boss = g.enemies.find((e) => e.maxHp > 500)?.kind;
        save({ suite, build, seed, stage, boss, mods, ...measure(g) });
      }
} else if (suite === 'campaign') {
  for (const seed of ['path-run-65', 'path-run-66', 'path-run-67'])
    for (const policy of ['utility', 'ordinary', 'precision'])
      if (filter.test(seed + ':' + policy)) save(campaign(seed, policy));
  for (const date of ['2026-09-19', '2026-09-20', '2026-09-21'])
    if (filter.test(date + ':daily')) save(campaign(dailyForDate(date)!.seed, 'daily'));
} else if (suite === 'areas') {
  for (const seed of ['path-run-65', 'path-run-66'])
    for (const policy of ['utility', 'balanced', 'precision'])
      for (const startStage of [4, 8, 12, 16])
        if (filter.test(`${seed}:${policy}:${startStage}`))
          save(campaign(seed, policy, startStage));
} else if (suite === 'branches') {
  for (const build of Object.keys(BRANCH_TEST_BUILDS))
    for (const room of ['room', 'boss']) {
      if (!filter.test(build + ':' + room)) continue;
      resetPhysics();
      const g = new Game();
      g.startTest(
        branchTestFromUrl(
          new URL('https://audit/?test=branches&build=' + build + '&room=' + room),
        )!,
      );
      save({ suite, build, room, mods: g.mods, ...measure(g) });
    }
} else if (suite === 'max') {
  // Cover every branch choice and weapon/path pair without mistaking impossible
  // 47+ upgrade stress builds for ordinary nineteen-pick campaign builds.
  const covered = new Set<string>();
  for (const combo of maxCombos()) {
    const tags = [combo.path + ':' + combo.weapon, ...combo.choices];
    if (tags.every((tag) => covered.has(tag))) continue;
    tags.forEach((tag) => covered.add(tag));
    resetPhysics();
    const g = new Game();
    g.startTest(
      branchTestFromUrl(
        new URL('https://audit/?test=branches&combo=' + combo.code + '&room=boss'),
      )!,
    );
    save({ suite, combo: combo.code, mods: g.mods.length, ...measure(g, 60) });
  }
} else throw Error('Unknown audit suite');
