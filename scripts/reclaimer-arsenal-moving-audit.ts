import Matter from 'matter-js';
import { writeFileSync } from 'node:fs';
import { Game, type Input } from '../src/game.ts';
import {
  reclaimerPressureTestFromUrl,
  prepareReclaimerPressureTest,
} from '../src/reclaimer-pressure-test.ts';

// Deterministic moving inputs, never a replacement for human balance testing.
// Initial room/form/build selection is setup. All fight health, damage, physics,
// upgrades, weapon callbacks and enemy behavior remain the normal live systems.
const rows: Record<string, unknown>[] = [];
const started = performance.now();
for (const overtime of [false, true])
  for (const phase of [0, 1, 2])
    for (const mirror of [false, true])
      for (const build of ['standard', 'reported']) {
        const f = reclaimerPressureTestFromUrl(
          new URL(
            `https://test.invalid/?test=reclaimer&phase=${phase + 1}&fight=${overtime ? 'overtime' : 'campaign'}&mirror=${Number(mirror)}&build=${build}&v=1`,
          ),
        )!;
        f.checkpoint.seed = f.checkpoint.seed.replace('RF-C107-', 'RF-C108-');
        const g = new Game();
        g.startTest(f.checkpoint);
        prepareReclaimerPressureTest(g, f);
        const e = g.finale.enemy!,
          cinema = g.finale.cinema!,
          a = cinema.arsenal;
        const initialHp = e.hp,
          t0 = g.time;
        let taken = 0,
          hits = 0,
          travel = 0,
          bossTravel = 0,
          maxBossStep = 0,
          finite = true,
          n = 0;
        let previous = { ...g.player.position },
          previousBoss = { ...e.body.position };
        const signatures = new Set<string>(),
          attacks = new Set<string>();
        g.onDamage = (hit) => {
          taken += hit.damage;
          hits++;
        };
        g.onSound = (cue) => {
          if (cue.startsWith('arsenal-')) signatures.add(cue);
        };
        for (; n < 180 * 60 && g.mode === 'playing' && cinema.combat && e.hp > 0; n++) {
          // Cruise between visible lanes, jump periodically, and aim at the actual
          // hull. No body position or velocity is edited after setup.
          const t = g.time - t0;
          const desired = 1000 + Math.sin(t * 0.55) * 650;
          const dx = desired - g.player.position.x - g.player.velocity.x * 5;
          const jumping =
            n % 105 === 0 || (a.dash?.state === 'warning' && a.dash.left < 0.3 && g.grounded);
          const input: Input = {
            left: dx < -12,
            right: dx > 12,
            jump: jumping,
            jumpHeld: n % 105 < 16,
            fire: true,
            aim: { ...e.body.position },
          };
          g.tick(1 / 60, input);
          travel += Math.hypot(g.player.position.x - previous.x, g.player.position.y - previous.y);
          const step = Math.hypot(
            e.body.position.x - previousBoss.x,
            e.body.position.y - previousBoss.y,
          );
          // Hidden cinematic staging after depletion is deliberately not a combat step.
          if (cinema.combat) {
            bossTravel += step;
            maxBossStep = Math.max(maxBossStep, step);
          }
          previous = { ...g.player.position };
          previousBoss = { ...e.body.position };
          if (e.state === 'windup') attacks.add(e.interceptor!.move);
          if (
            ![
              g.hp,
              e.hp,
              g.time,
              ...Object.values(g.player.position),
              ...Object.values(e.body.position),
              ...Object.values(g.player.velocity),
              ...Object.values(e.body.velocity),
            ].every(Number.isFinite)
          ) {
            finite = false;
            break;
          }
        }
        const depleted = e.hp <= 0 || !cinema.combat;
        rows.push({
          phase: phase + 1,
          overtime,
          mirror,
          build,
          seed: g.seed,
          gun: g.startingGun,
          mods: g.mods.length,
          simulatedSeconds: Number((g.time - t0).toFixed(3)),
          frames: n,
          hits,
          taken,
          playerHp: Number(g.hp.toFixed(2)),
          formHpStart: initialHp,
          formHpEnd: Number(Math.max(0, e.hp).toFixed(2)),
          damageDealt: Number((initialHp - Math.max(0, e.hp)).toFixed(2)),
          formDepleted: depleted,
          playerDeath: g.mode === 'dead',
          timeout: n === 180 * 60,
          finite,
          travel: Number(travel.toFixed(2)),
          bossTravel: Number(bossTravel.toFixed(2)),
          maxCombatBossStep: Number(maxBossStep.toFixed(3)),
          gunShots: g.shotCount,
          completedBossAttacks: e.attacks,
          signatureCues: [...signatures],
          gunAttackKinds: [...attacks],
        });
        Matter.Composite.clear(g.engine.world, false);
        Matter.Engine.clear(g.engine);
      }
const report = {
  version: '5.28.0',
  note: 'Twenty-four deterministic moving-input native simulations, not human win-rate estimates. Uses legal Service pistol and reported Twinbore beam builds at original health. After selecting each form, the driver only moves, periodically jumps, aims and fires using normal inputs. No health, damage, attack timing or physics overrides.',
  fixtures: rows.length,
  formDepleted: rows.filter((r) => r.formDepleted).length,
  playerDeaths: rows.filter((r) => r.playerDeath).length,
  timeouts: rows.filter((r) => r.timeout).length,
  nonFinite: rows.filter((r) => !r.finite).length,
  withoutDamageDealt: rows.filter((r) => !(Number(r.damageDealt) > 0)).length,
  withoutPlayerMovement: rows.filter((r) => !(Number(r.travel) > 100)).length,
  withoutBossActivity: rows.filter(
    (r) =>
      !(Number(r.bossTravel) > 100) &&
      !(Number(r.completedBossAttacks) > 0) &&
      !(r.signatureCues as string[]).length,
  ).length,
  standard: {
    depleted: rows.filter((r) => r.build === 'standard' && r.formDepleted).length,
    deaths: rows.filter((r) => r.build === 'standard' && r.playerDeath).length,
  },
  reported: {
    depleted: rows.filter((r) => r.build === 'reported' && r.formDepleted).length,
    deaths: rows.filter((r) => r.build === 'reported' && r.playerDeath).length,
  },
  totalHits: rows.reduce((s, r) => s + Number(r.hits), 0),
  totalDamageTaken: Number(rows.reduce((s, r) => s + Number(r.taken), 0).toFixed(2)),
  totalDamageDealt: Number(rows.reduce((s, r) => s + Number(r.damageDealt), 0).toFixed(2)),
  wallSeconds: Number(((performance.now() - started) / 1000).toFixed(3)),
  rows,
};
const output = process.argv.find((a) => a.endsWith('.json'));
if (output) writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ ...report, rows: undefined }));
if (
  report.timeouts ||
  report.nonFinite ||
  report.withoutDamageDealt ||
  report.withoutPlayerMovement ||
  report.withoutBossActivity
)
  process.exitCode = 1;
