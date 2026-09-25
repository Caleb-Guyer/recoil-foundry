// Repeatable technical probes; never presented as independent player feedback.
import { mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Input } from '../src/game.ts';
import { seeded, distance, validBuild } from '../src/rules.ts';
import { annexRouteTestFromUrl } from '../src/annex-route.ts';
import { switchboardTestFromUrl } from '../src/switchboard-layout.ts';
import { signalPoint } from '../src/switchboard.ts';
import { dodgePilot } from '../tests/combat-pilot.ts';
import { playCampaign } from '../tests/campaign-pilot.ts';

const suite = process.argv[2] ?? 'boss';
const rows: unknown[] = [];
const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: false,
  fire: false,
  aim: { x: 1000, y: 400 },
};
function reset() {
  const common = Matter.Common as typeof Matter.Common & { _nextId: number; _seed: number };
  common._nextId = common._seed = 0;
  Math.random = seeded('postlaunch-particles');
}
function report(row: unknown) {
  rows.push(row);
  console.log(JSON.stringify(row));
  mkdirSync('.release-assets', { recursive: true });
  writeFileSync(
    `.release-assets/dead-signal-postlaunch-${suite}.json`,
    JSON.stringify(rows, null, 2) + '\n',
  );
}
if (suite === 'exits') {
  for (const x of [1850, 1871, 1890, 1900, 1910, 1930]) {
    reset();
    const g = new Game();
    g.startTest(annexRouteTestFromUrl(new URL('https://test/?test=annex-route'))!);
    Matter.Body.setPosition(g.player, { x, y: 722 });
    Matter.Body.setVelocity(g.player, { x: 0, y: 0 });
    for (let i = 0; i < 90 && g.mode === 'playing'; i++) g.tick(1 / 60, idle);
    report({ x, mode: g.mode, region: g.region, position: g.player.position });
  }
} else if (suite === 'boss' || suite === 'boss-full') {
  for (const [family, core] of Object.entries({
    gun: ['pierce'],
    beam: ['cutting-torch', 'burst'],
    shell: ['shellshock', 'aftershock'],
  }))
    for (const [fork, support] of Object.entries({
      orders: ['spoof', 'standing-orders', 'priority-target'],
      cross: ['spoof', 'cross-talk', 'dead-switch'],
    }))
      for (const mirror of [false, true])
        for (const tactic of ['body', 'junction']) {
          reset();
          const s = switchboardTestFromUrl(
            new URL(`https://test/?test=switchboard&mirror=${+mirror}`),
          )!;
          s.mods = ['magnum', 'rapid', 'light', 'leech', ...core, ...support];
          if (suite === 'boss-full')
            s.mods.push(...['kick', 'airshot', 'landing'].slice(0, 11 - s.mods.length));
          assert(validBuild(s.mods) && s.mods.length <= 11);
          const g = new Game();
          g.startTest(s);
          const e = g.enemies[0];
          const rig = e.switchboard!;
          let input = idle;
          let damage = 0;
          let interruptions = 0;
          const hit = g.damagePlayer.bind(g);
          g.damagePlayer = (...args) => {
            const before = g.hp;
            hit(...args);
            damage += Math.max(0, before - g.hp);
          };
          for (let i = 0; i < 60 * 150 && g.mode === 'playing'; i++) {
            if (i % 6 === 0) {
              input = { ...idle, ...dodgePilot(g, e) };
              if (tactic === 'junction') {
                const visible =
                  rig.cooldown <= 0
                    ? rig.plans
                        .filter((p) => g.switchboard.charging(e, p))
                        .map((p) => signalPoint(g, p.slot, 'junction'))
                        .filter((p) => distance(g.lineEnd(g.player.position, p, 3), p) < 1)
                        .sort(
                          (a, b) => distance(g.player.position, a) - distance(g.player.position, b),
                        )[0]
                    : undefined;
                if (visible && distance(g.player.position, visible) < 800)
                  input.aim = { ...visible };
                else if (family === 'shell' && input.aim.y !== g.player.position.y + 500) {
                  const lead = Math.min(
                    12,
                    distance(g.player.position, e.body.position) / g.gun.projectileSpeed,
                  );
                  input.aim = {
                    x: e.body.position.x + e.body.velocity.x * lead,
                    y: e.body.position.y + e.body.velocity.y * lead,
                  };
                }
              }
            }
            g.tick(1 / 60, input);
            interruptions = Math.max(interruptions, rig.interruptions);
          }
          report({
            family,
            fork,
            mirror,
            tactic,
            mods: s.mods,
            mode: g.mode,
            hp: g.hp,
            bossHp: e.hp,
            seconds: g.time,
            damage,
            interruptions,
          });
        }
} else if (suite === 'routes') {
  for (const [family, core] of Object.entries({
    gun: ['pierce', 'airshot'],
    beam: ['cutting-torch', 'burst'],
    shell: ['shellshock', 'aftershock'],
  }))
    for (let index = 0; index < 2; index++)
      for (const revision of [5, 6] as const) {
        reset();
        const s = annexRouteTestFromUrl(new URL('https://test/?test=annex-route'))!;
        s.seed = `ANNEX-POSTLAUNCH-${family}-${index}`;
        s.annexVersion = revision;
        s.mods = ['magnum', 'rapid', 'light', 'leech', 'kick', ...core];
        assert(validBuild(s.mods) && s.mods.length === 7);
        const g = new Game();
        g.startTest(s);
        // A paired continuation after the already-cleared Furnace fight.
        g.openReward(false, undefined, 'annex');
        const entrance = g.offers.map((m) => m.id);
        const priority = [
          'spoof',
          'standing-orders',
          'priority-target',
          'airshot',
          'pierce',
          'ricochet',
          'countershot',
          'landing',
        ];
        let damage = 0;
        let allies = 0;
        const hit = g.damagePlayer.bind(g);
        g.damagePlayer = (...args) => {
          const before = g.hp;
          hit(...args);
          damage += Math.max(0, before - g.hp);
        };
        playCampaign(g, {
          pathMods: core,
          seconds: 300,
          stop: (g) => g.stage >= 12,
          chooseUpgrade: (g) =>
            priority.find((id) => g.offers.some((m) => m.id === id)) ?? g.offers[0].id,
          beforeInput: (g) => {
            allies = Math.max(allies, g.factions.allies.length);
            return undefined;
          },
        });
        report({
          seed: s.seed,
          family,
          revision,
          entrance,
          mods: g.mods,
          mode: g.mode,
          stage: g.stage,
          hp: g.hp,
          damage,
          seconds: g.time,
          allies,
          completed: g.stage >= 12,
        });
      }
} else throw new Error('Expected exits, boss, boss-full or routes');
