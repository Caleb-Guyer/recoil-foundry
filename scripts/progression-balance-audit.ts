// Ordinary input, real drafts, carried health and unmodified opponents.
// Bot results are reproducible diagnostics, not estimates of human win rates.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { performance } from 'node:perf_hooks';
import Matter from 'matter-js';
import { Game } from '../src/game.ts';
import { seeded, buildFollowup, validBuild, loadCheckpoint } from '../src/rules.ts';
import { STARTING_GUN_IDS } from '../src/starting-guns.ts';
import { LONGEVITY_IDS } from '../src/longevity.ts';
import { newUprising } from '../src/uprising-model.ts';
import { GAUNTLET_ROUNDS } from '../src/gauntlet-rules.ts';
import { overtimeBuild, OVERTIME_BUILDS } from '../src/overtime-balance.ts';
import { playCampaign } from '../tests/campaign-pilot.ts';
import { playRoom } from '../tests/room-pilot.ts';
import { uprisingInput } from '../tests/uprising-pilot.ts';

const output = process.argv[2] ?? '.release-assets/progression-balance.json';
const suite = process.argv[3] ?? 'all';
const overtimeStyle = process.argv[4] ?? 'volley';
const campaignSeeds = process.argv[5]?.split(',') ?? ['RF-C90-BP-17', 'RF-C90-BP-39'];
if (!['all', 'campaign', 'gauntlet', 'overtime'].includes(suite)) throw new Error('Unknown suite');
if (!Object.hasOwn(OVERTIME_BUILDS, overtimeStyle)) throw new Error('Unknown Overtime build');
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
  'deadeye',
  'execute',
  'banker',
  'kick',
  'landing',
  'capacitor',
  'reserve-cell',
  'fold',
  'scrap-armor',
  'reinforced-plate',
  'field-patch',
  'collimator',
  'overkill-bank',
  'guide-vane',
  'opening-shot',
  'recoil-runner',
];
const results: object[] = [];
const began = performance.now();
function reset(seed: string) {
  Math.random = seeded(seed + ':particles');
  const common = Matter.Common as typeof Matter.Common & { _nextId: number; _seed: number };
  common._nextId = common._seed = 0;
}
function choose(g: Game) {
  return priority.find((id) => g.offers.some((m) => m.id === id)) ?? g.offers[0].id;
}
function observe(g: Game) {
  const rooms: {
    stage: number;
    name: string;
    seconds: number;
    damage: number;
    offers: string[][];
    picked: string[];
  }[] = [];
  const drafts: { stage: number; offers: string[]; followups: number }[] = [];
  const row = () => {
    let r = rooms.at(-1);
    if (!r || r.stage !== g.stage || r.name !== g.level.name) {
      r = { stage: g.stage, name: g.level.name, seconds: 0, damage: 0, offers: [], picked: [] };
      rooms.push(r);
    }
    return r;
  };
  const tick = g.tick.bind(g),
    damage = g.damagePlayer.bind(g),
    select = g.chooseMod.bind(g);
  let draft = '';
  g.tick = (...args) => {
    const r = row(),
      before = g.elapsed;
    tick(...args);
    r.seconds += g.elapsed - before;
    if (g.mode === 'upgrade' && g.offers.length) {
      const key = g.stage + ':' + g.offers.map((m) => m.id).join(',');
      if (key !== draft) {
        draft = key;
        const offers = g.offers.map((m) => m.id);
        r.offers.push(offers);
        drafts.push({
          stage: g.stage,
          offers,
          followups: offers.filter((id) => buildFollowup(id, g.mods)).length,
        });
      }
    }
  };
  g.damagePlayer = (...args) => {
    const before = g.hp;
    damage(...args);
    row().damage += Math.max(0, before - g.hp);
  };
  g.chooseMod = (...args) => {
    row().picked.push(args[0]);
    select(...args);
  };
  return { rooms, drafts };
}
function record(g: Game, detail: Record<string, unknown>, observed?: ReturnType<typeof observe>) {
  const result = {
    ...detail,
    mode: g.mode,
    completed: g.gauntlet.state ? g.gauntlet.state.phase === 'complete' : g.mode === 'won',
    stage: g.stage + 1,
    seconds: Math.round(g.elapsed * 100) / 100,
    hp: g.hp,
    kills: g.kills,
    room: g.level.name,
    cause: g.deathCause,
    mods: [...g.mods],
    player: { ...g.player.position },
    remaining: g.enemies.map((e) => ({ kind: e.kind, hp: Math.round(e.hp) })),
    ...observed,
  };
  results.push(result);
  console.log(
    JSON.stringify({ ...result, rooms: observed?.rooms.length, drafts: observed?.drafts.length }),
  );
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(
    output,
    JSON.stringify(
      {
        version: JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
          .version,
        runtime: process.version,
        note: 'Ordinary-input simulation audit; deaths/timeouts retained. Not human difficulty or browser FPS.',
        wallSeconds: (performance.now() - began) / 1000,
        results,
      },
      null,
      2,
    ) + '\n',
  );
}
console.log('Audit ready: source loaded; six tools, ordinary health, real rewards.');
for (const gun of STARTING_GUN_IDS) {
  if (suite === 'all' || suite === 'campaign')
    for (const seed of campaignSeeds) {
      reset(seed);
      const g = new Game();
      g.start(seed, undefined, null, null, false, 0, true, LONGEVITY_IDS, newUprising(), gun);
      const observed = observe(g);
      let failure: string | undefined;
      try {
        playCampaign(g, {
          pathMods: [],
          seconds: 1200,
          beforeInput: uprisingInput,
          chooseUpgrade: () => choose(g),
        });
      } catch (e) {
        failure = String(e);
      }
      record(g, { suite: 'campaign', gun, seed, failure }, observed);
    }
  if (suite === 'all' || suite === 'gauntlet')
    for (const route of [0, 1] as const) {
      reset('gauntlet-' + gun + '-' + route);
      const g = new Game();
      // Preview bypasses ownership only, uses the actual Gauntlet combat rules.
      if (!g.gauntlet.begin(gun, null, true)) throw new Error('Invalid preview tool');
      let failure: string | undefined;
      try {
        for (let round = 0; round < 5; round++) {
          if (!g.gauntlet.chooseBoss(GAUNTLET_ROUNDS[round][route]))
            throw new Error('Invalid route transition');
          playRoom(g, 180);
          if (!g.clear || g.hp <= 0 || g.gauntlet.state?.phase === 'dead') break;
          if (round < 4) {
            const s = g.gauntlet.state!;
            const id =
              s.hp < 45 ? 'repair' : (priority.find((id) => s.offers.includes(id)) ?? s.offers[0]);
            if (!g.gauntlet.service(id)) throw new Error('Invalid service transition');
          }
        }
      } catch (e) {
        failure = String(e);
      }
      record(g, {
        suite: 'gauntlet',
        gun,
        route,
        phase: g.gauntlet.state?.phase,
        cleared: g.gauntlet.state?.cleared,
        failure,
      });
    }
  if (suite === 'all' || suite === 'overtime') {
    const seed = 'RF-C90-OT-BP-0';
    reset(seed);
    const g = new Game(),
      save = {
        ...overtimeBuild(overtimeStyle, 0, seed),
        startingGun: gun,
        unlocks: [...LONGEVITY_IDS],
      };
    if (!loadCheckpoint(save) || !validBuild(save.mods))
      throw new Error('Invalid overtime diagnostic');
    g.startTest(save);
    const observed = observe(g);
    let failure: string | undefined;
    try {
      playCampaign(g, { pathMods: [], seconds: 1200, chooseUpgrade: () => choose(g) });
    } catch (e) {
      failure = String(e);
    }
    record(
      g,
      {
        suite: 'overtime',
        gun,
        seed,
        fixture: `Legal 19-pick ${overtimeStyle} checkpoint; not a claim about a first lap draft.`,
        failure,
      },
      observed,
    );
  }
}
