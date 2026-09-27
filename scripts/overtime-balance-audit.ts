// Reproducible ordinary-input diagnostics. Deaths and navigation timeouts are
// reported, never hidden by healing, teleporting or deleting opponents.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import Matter from 'matter-js';
import { Game, type Input } from '../src/game.ts';
import { OVERTIME_BUILDS, overtimeBuild } from '../src/overtime-balance.ts';
import { MOD_REQUIRES, isFusion, loadCheckpoint, rewardMods, seeded } from '../src/rules.ts';
import { playRoom } from '../tests/room-pilot.ts';
import { playCampaign } from '../tests/campaign-pilot.ts';
import { isBoss } from '../src/enemies.ts';

const suite = process.argv[2] ?? 'rooms';
const output = process.argv[3] ?? '.release-assets/overtime-balance-' + suite + '.json';
const results: unknown[] = [];
function start(build: string, stage: number, seed = 'OT-BALANCE-0') {
  const common = Matter.Common as typeof Matter.Common & { _nextId: number; _seed: number };
  common._nextId = common._seed = 0;
  Math.random = seeded(seed + ':particles');
  const g = new Game(),
    save = overtimeBuild(build, stage, seed);
  if (!loadCheckpoint(save)) throw new Error('Invalid audit checkpoint');
  g.startTest(save);
  return g;
}
function record(g: Game, extra: Record<string, unknown>) {
  const r = {
    ...extra,
    mode: g.mode,
    clear: g.clear,
    room: g.stage + 1,
    seconds: Math.round(g.elapsed * 100) / 100,
    hp: g.hp,
    kills: g.kills,
    remaining: g.enemies.map((e) => ({ kind: e.kind, hp: Math.round(e.hp) })),
    player: { ...g.player.position },
    mods: [...g.mods],
  };
  results.push(r);
  console.log(JSON.stringify(r));
}
for (const build of Object.keys(OVERTIME_BUILDS)) {
  if (suite === 'rooms') {
    for (const stage of [0, 3, 4, 7, 8, 11, 12, 15, 16, 19]) {
      const g = start(build, stage);
      let taken = 0,
        peak = g.enemies.length;
      const damage = g.damagePlayer.bind(g),
        tick = g.tick.bind(g);
      g.damagePlayer = (...args) => {
        const hp = g.hp;
        damage(...args);
        taken += Math.max(0, hp - g.hp);
      };
      g.tick = (...args) => {
        tick(...args);
        peak = Math.max(peak, g.enemies.length);
      };
      playRoom(g, 90);
      record(g, { build, taken, peak });
    }
  } else if (suite === 'campaign' || suite === 'areas') {
    for (const stage of suite === 'areas' ? [0, 4, 8, 12, 16] : [0])
      for (const seed of suite === 'areas' ? ['OT-BALANCE-0'] : ['OT-BALANCE-0', 'OT-BALANCE-1']) {
        const g = start(build, stage, seed);
        let failure: string | undefined;
        try {
          playCampaign(g, {
            pathMods: [...OVERTIME_BUILDS[build]],
            seconds: suite === 'areas' ? 300 : 1200,
            stop: (game) => suite === 'areas' && game.stage >= stage + 4,
          });
        } catch (e) {
          failure = String(e);
        }
        record(g, {
          build,
          seed,
          startRoom: stage + 1,
          failure,
          completed: g.mode === 'won' || (suite === 'areas' && g.stage >= stage + 4),
        });
      }
  } else if (suite === 'camp' || suite === 'positions') {
    for (const stage of [3, 7, 11, 15, 19])
      for (const position of suite === 'camp' ? ['entrance'] : ['corner', 'cover', 'above']) {
        const g = start(build, stage),
          boss = g.enemies.find((e) => isBoss(e.kind))!;
        if (position !== 'entrance') {
          const candidates =
            position === 'corner'
              ? [{ x: 1940, y: 720 }]
              : g.level.solids
                  .filter((s) => s.w >= 70 && s.y > 90 && s.y < 650)
                  .map((s) => ({
                    x: s.x + s.w / 2,
                    y: position === 'above' ? s.y - 18 : s.y + s.h + 30,
                  }))
                  .filter(
                    (p) =>
                      !g.solidBodies.some(
                        (b) =>
                          p.x + 14 > b.bounds.min.x &&
                          p.x - 14 < b.bounds.max.x &&
                          p.y + 17 > b.bounds.min.y &&
                          p.y - 17 < b.bounds.max.y,
                      ),
                  );
          candidates.sort((a, b) =>
            position === 'above'
              ? a.y - b.y
              : Math.abs(a.x - boss.body.position.x) - Math.abs(b.x - boss.body.position.x),
          );
          if (!candidates.length) continue;
          Matter.Body.setPosition(g.player, candidates[0]);
          Matter.Body.setVelocity(g.player, { x: 0, y: 0 });
        }
        const initial = { ...g.player.position };
        const states = new Set<string>();
        // Position suites start at a free diagnostic anchor; all following motion
        // comes from ordinary physics and firing. No health or enemy overrides.
        for (let frame = 0; frame < 60 * 60 && !g.clear && g.mode === 'playing'; frame++) {
          const input: Input = {
            left: false,
            right: false,
            jump: false,
            jumpHeld: false,
            fire: true,
            aim: { ...boss.body.position },
          };
          states.add(boss.state);
          g.tick(1 / 60, input);
        }
        record(g, { build, position, initial, states: [...states] });
      }
  } else if (suite === 'rewards') {
    for (const stage of [0, 8, 16]) {
      const { mods } = overtimeBuild(build, stage);
      let aligned = 0;
      for (let seed = 0; seed < 500; seed++) {
        const offers = rewardMods(mods, 3, seeded('OT-REWARD-' + seed), { stage, overtime: true });
        if (offers.some((m) => !!MOD_REQUIRES[m.id] || isFusion(m.id))) aligned++;
      }
      results.push({ build, stage, aligned, samples: 500 });
    }
  } else throw new Error('Expected rooms, campaign, areas, camp, positions or rewards');
}
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, JSON.stringify({ suite, results }, null, 2) + '\n');
