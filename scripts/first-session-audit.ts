// Technical opening probes, never independent players or enjoyment ratings.
import { mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game } from '../src/game.ts';
import { validBuild, seeded } from '../src/rules.ts';
import { playCampaign } from '../tests/campaign-pilot.ts';

const output = '.release-assets/first-session-3.0.2.json';
const rows: unknown[] = [];
const originalRandom = Math.random;
try {
  for (let index = 1; index <= 5; index++) {
    // Identical pilot and leftmost legal card policy, five different normal seeds.
    const common = Matter.Common as typeof Matter.Common & { _nextId: number; _seed: number };
    common._nextId = common._seed = 0;
    Math.random = seeded(`opening-particles-${index}`);
    const g = new Game();
    g.start(`OPENING-302-${index}`);
    assert(!g.testRun && !g.practice && g.mods.length === 0 && g.hp === 100);
    const rewards: { room: number; health: number; offers: string[]; chosen: string }[] = [];
    const rooms: { room: number; layout: string; enteredAt: number; health: number }[] = [];
    let previousStage = -1;
    playCampaign(g, {
      pathMods: [],
      seconds: 240,
      stop: (run) => run.stage >= 3,
      beforeInput: (run) => {
        if (run.stage !== previousStage) {
          previousStage = run.stage;
          rooms.push({
            room: run.stage + 1,
            layout: run.level.id,
            enteredAt: run.time,
            health: run.hp,
          });
        }
        return undefined;
      },
      chooseUpgrade: (run) => {
        assert(run.offers.length === 3);
        assert(new Set(run.offers.map((m) => m.id)).size === 3);
        for (const m of run.offers)
          assert(validBuild([...run.mods, m.id]), `Illegal offer ${m.id}`);
        const chosen = run.offers[0].id;
        rewards.push({
          room: run.stage + 1,
          health: run.hp,
          offers: run.offers.map((m) => m.id),
          chosen,
        });
        return chosen;
      },
    });
    assert(validBuild(g.mods));
    const row = {
      seed: g.seed,
      outcome: g.mode === 'dead' ? 'died' : g.stage >= 3 ? 'reached-room-4' : 'time-limit',
      room: g.stage + 1,
      seconds: g.time,
      health: g.hp,
      kills: g.kills,
      shots: g.shotCount,
      build: g.mods,
      rooms,
      rewards,
    };
    rows.push(row);
    console.log(JSON.stringify(row));
  }
} finally {
  Math.random = originalRandom;
}
mkdirSync('.release-assets', { recursive: true });
writeFileSync(
  output,
  JSON.stringify(
    {
      version: '3.0.2',
      scope:
        'Five normal campaign starts; stop at room 4, death, or 240 simulated seconds. Ordinary-input expert pilot, first offered card, no combat overrides. Not human sessions.',
      rows,
    },
    null,
    2,
  ) + '\n',
);
