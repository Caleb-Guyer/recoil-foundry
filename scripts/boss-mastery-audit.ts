import { writeFileSync } from 'node:fs';
import Matter from 'matter-js';
import { Game } from '../src/game.ts';
import { getLevel } from '../src/levels.ts';
import { testCheckpoint } from '../src/practice.ts';
import { availableMods, seeded } from '../src/rules.ts';
import { dodgePilot } from '../tests/combat-pilot.ts';
import { playRoom } from '../tests/room-pilot.ts';
const results = [];
for (const kind of ['loader', 'crane'] as const)
  for (const mirror of [false, true])
    for (const build of ['round', 'beam']) {
      Matter.Common._nextId = Matter.Common._seed = 0;
      Math.random = seeded('boss-mastery-audit');
      const seed = Array.from({ length: 100 }, (_, i) => 'mastery-' + i).find((s) => {
        const l = getLevel(s, 3);
        return l.spawns[0].kind === kind && !!l.mirrored === mirror;
      })!;
      const g = new Game(),
        save = testCheckpoint(seed, 3);
      save.mods =
        build === 'beam' ? ['cutting-torch', 'magnum', 'kick'] : ['magnum', 'rapid', 'kick'];
      const chosen: string[] = [];
      for (const id of save.mods) {
        if (!availableMods(chosen).some((m) => m.id === id))
          throw new Error('Illegal audit upgrade: ' + id);
        chosen.push(id);
      }
      g.start(seed, save);
      const awards: string[] = [];
      g.onCommendation = (id) => awards.push(id);
      const e = g.enemies[0];
      let qualified = false,
        vaults = 0,
        recoveryHits = 0,
        last = '',
        launched = -1;
      // Observe accepted evidence; these wrappers do not change state or inputs.
      const ram = g.commendations.mastery.loaderRam.bind(g.commendations.mastery);
      g.commendations.mastery.loaderRam = (...args) => {
        ram(...args);
        qualified ||= g.commendations.mastery['loads'].has(e);
      };
      const hit = g.commendations.mastery.hit.bind(g.commendations.mastery);
      g.commendations.mastery.hit = (...args) => {
        hit(...args);
        if (g.commendations.mastery['clearances'].has(e)) {
          qualified = true;
          recoveryHits++;
        }
      };
      for (let n = 0; n < 7200 && g.mode === 'playing' && !g.clear; n++) {
        const p = g.player.position;
        let input = {
          left: false,
          right: false,
          jump: false,
          jumpHeld: true,
          fire: false,
          aim: { ...e.body.position },
        };
        if (qualified && kind === 'loader') {
          playRoom(g, 110);
          break;
        } else if (kind === 'loader' && mirror) {
          input.right = p.x < 950;
          input.left = p.x > 1050;
          input.jump = g.grounded && p.x < 800;
          input.fire = p.x < 800 && p.y > 550 && !g.grounded;
          input.aim = { x: p.x, y: p.y + 400 };
        } else if (kind === 'crane') {
          const rig = e.crane!;
          const state = e.state + ':' + e.attack + ':' + e.attacks;
          if (process.argv.includes('--trace') && state !== last)
            console.log(
              JSON.stringify({
                kind,
                mirror,
                build,
                time: g.time,
                state,
                player: p,
                from: rig.from,
                to: rig.to,
                grounded: g.grounded,
              }),
            );
          last = state;
          const sweep = e.attack === 'sweep' && (e.state === 'windup' || e.state === 'rush');
          if (sweep) {
            if (e.state === 'windup' && e.timer < 0.15 && launched !== e.attacks) {
              input.jump = true;
              input.fire = true;
              input.aim = { x: p.x, y: p.y + 400 };
              launched = e.attacks;
              vaults++;
            } else if (!g.grounded && e.state === 'windup' && launched === e.attacks) {
              input.fire = true;
              input.aim = { x: p.x, y: p.y + 400 };
            }
          } else if (e.state === 'recover') input.fire = true;
          else if (e.attack === 'flak' || e.attack === 'slam')
            input = { ...input, ...dodgePilot(g, e, qualified) };
          else input.fire = qualified;
        }
        g.tick(1 / 60, input);
      }
      const result = {
        kind,
        mirror,
        build,
        seed,
        qualified,
        vaults,
        recoveryHits,
        awards,
        clear: g.clear,
        mode: g.mode,
        hp: +g.hp.toFixed(1),
        seconds: +g.elapsed.toFixed(2),
      };
      results.push(result);
      console.log(JSON.stringify(result));
    }
writeFileSync(
  new URL('../.release-assets/boss-mastery-input-audit.json', import.meta.url),
  JSON.stringify({ ordinaryInputs: true, alteredCombatState: false, results }, null, 2),
);
