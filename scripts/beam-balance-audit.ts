// Scripted combat evidence, not independent players. Changes only normal input.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import Matter from 'matter-js';
import { Game, type Input } from '../src/game.ts';
import { seeded, distance, validBuild } from '../src/rules.ts';
import { switchboardTestFromUrl } from '../src/switchboard-layout.ts';
import { signalPoint } from '../src/switchboard.ts';
import { dodgePilot } from '../tests/combat-pilot.ts';

const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: false,
  fire: false,
  aim: { x: 1000, y: 400 },
};
const cores: Record<string, string[]> = {
  gun: ['pierce', 'ricochet'],
  shell: ['shellshock', 'aftershock'],
  continuous: ['cutting-torch', 'thermal-runaway'],
  burst: ['cutting-torch', 'burst'],
  pulse: ['cutting-torch', 'burst', 'pulse-chamber'],
  lens: ['cutting-torch', 'charge-lens', 'thermal-runaway'],
  prism: ['cutting-torch', 'prism-array', 'thermal-runaway'],
};
const suites = process.argv[2] ?? 'controls';
const jumpMode = process.argv[3] ?? (suites === 'controls' ? 'tap' : 'held');
assert(['tap', 'held'].includes(jumpMode), 'Expected tap or held jump input');
assert(
  ['controls', 'aware', 'matrix', 'burst-hold'].includes(suites),
  'Expected controls, aware, matrix or burst-hold',
);
const rows: unknown[] = [];
const random = Math.random;
try {
  for (const tier of suites === 'matrix'
    ? ['modest', 'full']
    : [suites === 'burst-hold' ? 'full' : 'modest'])
    for (const fork of ['matrix', 'burst-hold'].includes(suites) ? ['orders', 'cross'] : ['orders'])
      for (const [family, core] of Object.entries(cores).filter(
        ([family]) => suites !== 'burst-hold' || ['burst', 'pulse'].includes(family),
      ))
        for (const mirror of [false, true])
          for (const tactic of ['body', 'junction'])
            for (const policy of suites === 'controls'
              ? ['original', 'committed']
              : ['committed']) {
              const common = Matter.Common as typeof Matter.Common & {
                _nextId: number;
                _seed: number;
              };
              common._nextId = common._seed = 0;
              Math.random = seeded('postlaunch-particles');
              const preset = switchboardTestFromUrl(
                new URL(`https://test/?test=switchboard&mirror=${+mirror}`),
              )!;
              const support =
                fork === 'orders'
                  ? ['spoof', 'standing-orders', 'priority-target']
                  : ['spoof', 'cross-talk', 'dead-switch'];
              preset.mods = ['magnum', 'rapid', 'light', 'leech', ...core, ...support];
              if (tier === 'full')
                preset.mods.push(
                  ...['kick', 'airshot', 'landing'].slice(0, 11 - preset.mods.length),
                );
              assert(validBuild(preset.mods) && preset.mods.length <= 11);
              const g = new Game();
              g.startTest(preset);
              const e = g.enemies[0],
                rig = e.switchboard!;
              let input = idle,
                held = 0,
                active = 0,
                contact = 0,
                releases = 0,
                cancelled = 0,
                priorFire = false;
              let damageTaken = 0,
                damageDealt = 0,
                openingDamage = 0;
              const hitPlayer = g.damagePlayer.bind(g);
              g.damagePlayer = (...args) => {
                const before = g.hp;
                hitPlayer(...args);
                damageTaken += Math.max(0, before - g.hp);
              };
              for (let frame = 0; frame < 9000 && g.mode === 'playing'; frame++) {
                if (frame % 6 === 0) {
                  let aim = { ...e.body.position };
                  if (tactic === 'junction') {
                    const point =
                      rig.cooldown <= 0
                        ? rig.plans
                            .filter((p) => g.switchboard.charging(e, p))
                            .map((p) => signalPoint(g, p.slot, 'junction'))
                            .filter((p) => distance(g.lineEnd(g.player.position, p, 3), p) < 1)
                            .sort(
                              (a, b) =>
                                distance(g.player.position, a) - distance(g.player.position, b),
                            )[0]
                        : undefined;
                    if (point && distance(g.player.position, point) < 800) aim = { ...point };
                  }
                  if (policy === 'original') {
                    input = { ...idle, jumpHeld: jumpMode === 'held', ...dodgePilot(g, e) };
                    if (tactic === 'junction') input.aim = aim;
                  } else {
                    const fire =
                      family === 'lens' ? g.torch.chargeProgress < 1 && !g.torch.emitting : true;
                    if (suites !== 'controls' && family === 'prism') {
                      const dx = aim.x - g.player.position.x,
                        dy = aim.y - g.player.position.y;
                      aim = {
                        x: g.player.position.x + dx * Math.cos(0.09) - dy * Math.sin(0.09),
                        y: g.player.position.y + dx * Math.sin(0.09) + dy * Math.cos(0.09),
                      };
                    }
                    input = {
                      ...idle,
                      // The trajectory forecast models a held, full-height jump.
                      // A released jump is cut by the actual input handler.
                      jumpHeld: jumpMode === 'held',
                      ...dodgePilot(g, e, true, {
                        aim,
                        fire:
                          family === 'lens' || ['controls', 'burst-hold'].includes(suites)
                            ? fire
                            : undefined,
                        beamAware: suites !== 'controls',
                      }),
                    };
                  }
                }
                const pending = (g.torch as unknown as { burstLeft: number }).burstLeft;
                const hp = e.hp,
                  opening = rig.opening > 0,
                  beforeTime = g.time;
                g.tick(1 / 60, input);
                const elapsed = g.time - beforeTime;
                if (elapsed > 0) {
                  if (priorFire && !input.fire) {
                    releases++;
                    cancelled += pending;
                  }
                  priorFire = input.fire;
                }
                const dealt = Math.max(0, hp - e.hp);
                damageDealt += dealt;
                if (opening) openingDamage += dealt;
                held += +input.fire * elapsed;
                active += +g.torch.active * elapsed;
                contact +=
                  +(g.torch.active && g.torch.segments.some((s) => s.enemy === e)) * elapsed;
              }
              const row = {
                seed: preset.seed,
                jumpMode,
                tier,
                fork,
                family,
                mirror,
                tactic,
                policy:
                  suites === 'controls'
                    ? policy
                    : suites === 'burst-hold'
                      ? 'beam-aware-hold'
                      : 'beam-aware',
                mods: preset.mods,
                outcome: g.mode,
                seconds: g.time,
                health: g.hp,
                bossHealth: e.hp,
                damageTaken,
                damageDealt,
                openingDamage,
                held,
                active,
                contact,
                releases,
                cancelled,
                shots: g.shotCount,
                interruptions: rig.interruptions,
              };
              rows.push(row);
              console.log(JSON.stringify(row));
            }
} finally {
  Math.random = random;
}
mkdirSync('.release-assets', { recursive: true });
writeFileSync(
  `.release-assets/beam-balance-${suites}-${jumpMode}.json`,
  JSON.stringify(rows, null, 2) + '\n',
);
