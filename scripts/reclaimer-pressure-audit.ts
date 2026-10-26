import Matter from 'matter-js';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { Game, type Input } from '../src/game.ts';
import { finaleTestFromUrl } from '../src/final-arsenal.ts';
import { uprisingTestFromUrl } from '../src/uprising-test.ts';
import { type UprisingFinale, UPRISING_FINALES } from '../src/uprising-model.ts';
import { withParents } from '../src/branch-builds.ts';
import {
  reclaimerPressureTestFromUrl,
  prepareReclaimerPressureTest,
} from '../src/reclaimer-pressure-test.ts';

export const ISSUE_10_MODS = [
  'airshot',
  'cutting-torch',
  'thermal-runaway',
  'deadeye',
  'rivet',
  'leech',
  'recoil-runner',
  'execute',
  'heat-relay',
  'cinder',
  'spoof',
  'heat-exchanger',
  'fracture',
  'insulated-line',
  'capacitor',
  'far-sight',
  'flashpoint',
  'deadlock',
  'reserve-cell',
  'field-patch',
  'light',
  'scrap-armor',
] as const;

export interface FinaleCampOptions {
  phase: 0 | 1 | 2;
  mirror?: boolean;
  overtime?: boolean;
  outcome?: UprisingFinale;
  reportedBuild?: boolean;
  revision?: 97 | 107 | 108;
}
export function finaleCampRoom(options: FinaleCampOptions) {
  const { phase, mirror = false, overtime = false, outcome = 'isolated' } = options;
  if ((options.revision ?? 107) >= 107) {
    const fixture = reclaimerPressureTestFromUrl(
      new URL(
        `https://test.invalid/?test=reclaimer&v=1&phase=${phase + 1}&mirror=${Number(mirror)}` +
          `&fight=${overtime ? 'overtime' : 'campaign'}&route=${overtime ? 'standard' : outcome}` +
          `&build=${options.reportedBuild ? 'reported' : 'standard'}`,
      ),
    );
    if (!fixture) throw new Error('Invalid current Reclaimer fixture');
    if (options.revision === 108)
      fixture.checkpoint.seed = fixture.checkpoint.seed.replace('RF-C107-', 'RF-C108-');
    const g = new Game();
    g.startTest(fixture.checkpoint);
    if (!prepareReclaimerPressureTest(g, fixture))
      throw new Error('Missing current cinematic boss');
    if (g.uprising.finale !== (overtime ? null : outcome))
      throw new Error('Incorrect current route outcome');
    return { g, e: g.finale.enemy!, cinema: g.finale.cinema! };
  }
  const cp = finaleTestFromUrl(
    new URL(
      'https://test.invalid/?test=finale&v=3&phase=' +
        (phase + 1) +
        '&mirror=' +
        Number(mirror) +
        (overtime ? '&fight=overtime' : ''),
    ),
  )!;
  cp.seed = cp.seed.replace('RF-C97-', 'RF-C' + (options.revision ?? 107) + '-');
  const route = uprisingTestFromUrl(
    new URL('https://test.invalid/?test=uprising&route=' + outcome + '&v=2'),
  )!;
  cp.uprising = route.uprising;
  if (outcome === 'isolated') {
    // Exact successful route from issue #10, including both sabotage objectives.
    cp.uprising!.choices = ['rail-heist', 'core-sabotage', 'crew-relief', 'signal-cut'];
    cp.uprising!.outcomes = cp.uprising!.choices.map((route) => ({ route, result: 'success' }));
  }
  if (options.reportedBuild) {
    cp.startingGun = 'twinbore';
    cp.mods = withParents([], [...ISSUE_10_MODS])!;
    if (!cp.mods) throw new Error('Issue #10 build no longer satisfies upgrade prerequisites');
  }
  const g = new Game();
  g.startTest(cp);
  const cinema = g.finale.cinema;
  if (!cinema || !g.finale.enemy) throw new Error('Missing cinematic boss');
  // Fixture setup only. Combat below uses unmodified movement, collisions,
  // damage, AI and health. No attack override pins the boss to one move.
  g.level.mirrored = mirror;
  cinema.enterForm(phase);
  if (g.uprising.finale !== (overtime ? null : outcome)) throw new Error('Incorrect route outcome');
  return { g, e: g.finale.enemy, cinema };
}
export function finaleCampSpots(g: Game) {
  const points = [
    { name: 'left-floor', x: 28, y: 722 },
    { name: 'right-floor', x: 1972, y: 722 },
    { name: 'reported-right-floor', x: g.level.mirrored ? 2000 - 1530 : 1530, y: 722 },
  ];
  for (const [i, s] of g.level.solids.entries())
    for (const offset of [24, s.w / 2, s.w - 24]) {
      const point = { name: `shelf-${i}-${offset}`, x: s.x + offset, y: s.y - 18 };
      const b = g.player.bounds;
      const halfW = (b.max.x - b.min.x) / 2;
      const halfH = (b.max.y - b.min.y) / 2;
      if (
        !g.solidBodies.some(
          (body) =>
            point.x + halfW > body.bounds.min.x &&
            point.x - halfW < body.bounds.max.x &&
            point.y + halfH > body.bounds.min.y &&
            point.y - halfH < body.bounds.max.y,
        )
      )
        points.push(point);
    }
  return points;
}
export function runFinaleCamp(
  options: FinaleCampOptions,
  spot: { name?: string; x: number; y: number },
  { seconds = 20, firing = false, stopAfterHit = true } = {},
) {
  const { g, e, cinema } = finaleCampRoom(options);
  Matter.Body.setPosition(g.player, { x: spot.x, y: spot.y });
  Matter.Body.setVelocity(g.player, { x: 0, y: 0 });
  const started = g.time;
  const hp = e.hp;
  let taken = 0,
    hits = 0,
    firstHit: number | null = null,
    bossTravel = 0,
    maxStep = 0,
    pursuitTravel = 0,
    maxPursuitStep = 0;
  let last = { ...e.body.position },
    maxDx = 0,
    maxDy = 0;
  const origin = { ...last };
  g.onDamage = (hit) => {
    taken += hit.damage;
    hits++;
    firstHit ??= g.time - started;
  };
  const attacks = new Set<string>();
  const struck = new Set<string>();
  for (let n = 0; n < seconds * 60 && g.mode === 'playing' && cinema.combat && e.hp > 0; n++) {
    const dx = spot.x - g.player.position.x - g.player.velocity.x * 5;
    const input: Input = {
      left: dx < -8,
      right: dx > 8,
      jump: false,
      jumpHeld: false,
      fire: firing,
      aim: { ...e.body.position },
    };
    const pursuing = e.attack === 'vault' && cinema.pursuit.route.length > 0;
    g.tick(1 / 60, input);
    const step = Math.hypot(e.body.position.x - last.x, e.body.position.y - last.y);
    bossTravel += step;
    maxStep = Math.max(maxStep, step);
    if (pursuing) {
      pursuitTravel += step;
      maxPursuitStep = Math.max(maxPursuitStep, step);
    }
    maxDx = Math.max(maxDx, Math.abs(e.body.position.x - origin.x));
    maxDy = Math.max(maxDy, Math.abs(e.body.position.y - origin.y));
    last = { ...e.body.position };
    if (e.state === 'windup') attacks.add(e.interceptor!.move);
    if (g.finale.strike) struck.add(g.finale.strike.kind);
    if (
      ![
        g.hp,
        e.hp,
        g.time,
        ...Object.values(e.body.position),
        ...Object.values(g.player.position),
      ].every(Number.isFinite)
    )
      throw new Error('Non-finite simulation');
    if (stopAfterHit && hits > 0) break;
  }
  const result = {
    ...options,
    spot,
    firing,
    seconds: g.time - started,
    taken,
    hits,
    firstHit,
    bossDamage: hp - e.hp,
    bossHp: e.hp,
    bossTravel,
    maxDx,
    maxDy,
    maxStep,
    pursuitTravel,
    maxPursuitStep,
    attacks: [...attacks],
    strikes: [...struck],
    hp: g.hp,
    player: { ...g.player.position },
    boss: { ...e.body.position },
    mode: g.mode,
    bossState: e.state,
    form: cinema.state,
  };
  Matter.Engine.clear(g.engine);
  Matter.Composite.clear(g.engine.world, false);
  return result;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const results: ReturnType<typeof runFinaleCamp>[] = [];
  const wide = process.argv.includes('--wide');
  const baseline = process.argv.includes('--baseline');
  const arsenal = process.argv.includes('--arsenal');
  const started = performance.now();
  for (const overtime of [false, true])
    for (const phase of [0, 1, 2] as const)
      for (const mirror of [false, true])
        for (const outcome of overtime ? (['isolated'] as const) : UPRISING_FINALES) {
          const options = {
            phase,
            mirror,
            overtime,
            outcome,
            revision: baseline ? 97 : arsenal ? 108 : 107,
          } as const;
          const fixture = finaleCampRoom(options);
          const spots = finaleCampSpots(fixture.g);
          Matter.Engine.clear(fixture.g.engine);
          Matter.Composite.clear(fixture.g.engine.world, false);
          for (const spot of wide ? spots : spots.slice(0, 3)) {
            const row = runFinaleCamp(options, spot, { seconds: 20 });
            results.push(row);
            if (row.taken === 0) console.log(JSON.stringify(row));
          }
        }
  const report = {
    note: 'Native deterministic camping simulations, not observed human playtests. Setup selects a form and starting position. During combat only ordinary inputs hold the horizontal position, compensate recoil and optionally fire. Original health, physics, attack damage and warnings remain active.',
    cases: results.length,
    untouched: results.filter((r) => r.taken === 0).length,
    safeKills: results.filter((r) => r.taken === 0 && r.bossHp <= 0).length,
    slowestFirstHit: Math.max(...results.flatMap((r) => (r.firstHit === null ? [] : [r.firstHit]))),
    wallSeconds: (performance.now() - started) / 1000,
    results,
  };
  const output = process.argv.find((arg) => arg.endsWith('.json'));
  if (output) writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ ...report, results: undefined }));
  if (report.untouched && !baseline) process.exitCode = 1;
}
