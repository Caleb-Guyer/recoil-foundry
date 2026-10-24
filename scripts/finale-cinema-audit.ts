import { writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { Game, type Input } from '../src/game.ts';
import { finaleTestFromUrl } from '../src/final-arsenal.ts';
import { STARTING_GUN_IDS } from '../src/starting-guns.ts';
import { playRoom } from '../tests/room-pilot.ts';

// No state edits after start: ordinary movement, jumping and firing from the
// existing test-room pilot. A form break ends its trial before the next battle.
// The fixed earned-upgrade preview builds are fixtures, not a win-rate sample.
const seconds = Math.max(10, Math.min(300, Number(process.argv[3]) || 120));
const runs: Record<string, unknown>[] = [];
const arenaAware = process.argv.includes('--arena-aware');
const started = performance.now();
const input = (g: Game, move = 0): Input => ({
  left: move < 0,
  right: move > 0,
  jump: false,
  jumpHeld: false,
  fire: false,
  aim: { ...g.player.position },
});
const finiteGame = (g: Game) =>
  [
    g.hp,
    g.time,
    ...[g.player, ...g.enemies.map((e) => e.body)].flatMap((body) => [
      body.position.x,
      body.position.y,
      body.velocity.x,
      body.velocity.y,
    ]),
    ...g.shots.flatMap((shot) => [shot.pos.x, shot.pos.y, shot.vel.x, shot.vel.y, shot.life]),
  ].every(Number.isFinite);

for (const overtime of process.argv.includes('--seamless-only') ? [] : [false, true]) {
  for (const phase of [0, 1, 2]) {
    for (const gun of STARTING_GUN_IDS) {
      for (const mirror of [false, true]) {
        const url = new URL(
          'https://test/?test=finale&v=3&phase=' +
            (phase + 1) +
            '&mirror=' +
            Number(mirror) +
            (overtime ? '&fight=overtime' : ''),
        );
        const cp = finaleTestFromUrl(url)!;
        if (!cp) throw Error('Invalid audit checkpoint ' + url.href);
        cp.startingGun = gun;
        const g = new Game();
        g.start(cp.seed, cp, null, cp);
        const director = g.finale.cinema;
        if (!director) throw Error('Cinematic finale not installed for ' + cp.seed);
        const wallStart = performance.now();
        const firstState = director.state;
        const firstPosition = { ...g.player.position };
        let approachFrames = 0;
        // Phase-one previews intentionally open on the real walk-in. Trigger it
        // by walking toward the visible machine, with neither a teleport nor fire.
        while (!director.combat && director.state !== 'complete' && approachFrames < 45 * 60) {
          g.tick(1 / 60, input(g, mirror ? -1 : 1));
          approachFrames++;
        }
        const approach = {
          initial: firstState,
          reachedCombat: director.combat,
          seconds: approachFrames / 60,
          startX: firstPosition.x,
          endX: g.player.position.x,
          hp: g.hp,
        };
        const moves = new Set<string>();
        const states = new Set<string>([director.state]);
        const strikes = new Set<string>();
        let maxShots = 0,
          maxCharges = 0,
          maxSaws = 0,
          maxQueued = 0;
        let finite = finiteGame(g),
          frames = 0,
          travel = 0,
          healthLost = 0;
        let last = { ...g.player.position },
          lastHp = g.hp;
        let lowestBossHp = g.finale.enemy!.hp;
        const startingBossHp = lowestBossHp;
        const battleTime = g.time;
        const observe = () => {
          frames++;
          states.add(director.state);
          travel += Math.hypot(g.player.position.x - last.x, g.player.position.y - last.y);
          healthLost += Math.max(0, lastHp - g.hp);
          last = { ...g.player.position };
          lastHp = g.hp;
          const e = g.finale.enemy;
          if (e?.interceptor) {
            if (e.state === 'windup' && e.attack !== 'vault') moves.add(e.interceptor.move);
            maxCharges = Math.max(maxCharges, e.interceptor.charges.length);
            maxSaws = Math.max(maxSaws, e.interceptor.saws.length);
            maxQueued = Math.max(
              maxQueued,
              e.interceptor.queue.length + e.interceptor.echoes.length,
            );
            lowestBossHp = Math.min(lowestBossHp, e.hp);
          }
          if (g.finale.strike) strikes.add(g.finale.strike.kind);
          maxShots = Math.max(maxShots, g.shots.length);
          finite &&= finiteGame(g);
          return !finite || !director.combat || director.phase !== phase;
        };
        const result = director.combat
          ? playRoom(g, seconds, observe, { arenaAware })
          : {
              clear: false,
              hp: g.hp,
              kills: g.kills,
              time: g.time,
              shots: g.shotCount,
              player: { ...g.player.position },
            };
        const fightState = director.state;
        const broken =
          !director.combat && !['approach', 'boarding'].includes(fightState) && g.hp > 0;
        let transitionFrames = 0,
          transitionTravel = 0;
        const transitionStart = { ...g.player.position };
        const transitionHp = g.hp;
        while (
          broken &&
          !director.combat &&
          director.state !== 'complete' &&
          transitionFrames < 15 * 60
        ) {
          const direction =
            (Math.floor(transitionFrames / 60) % 2 === 0 ? 1 : -1) * (mirror ? -1 : 1);
          g.tick(1 / 60, input(g, direction));
          transitionFrames++;
          states.add(director.state);
          transitionTravel = Math.max(
            transitionTravel,
            Math.hypot(
              g.player.position.x - transitionStart.x,
              g.player.position.y - transitionStart.y,
            ),
          );
          finite &&= finiteGame(g);
        }
        const timedOut = !broken && g.hp > 0 && approach.reachedCombat;
        const row = {
          fight: overtime ? 'overtime' : 'campaign',
          phase: phase + 1,
          gun,
          mirror,
          seed: cp.seed,
          approach,
          outcome: !approach.reachedCombat
            ? 'approach-blocked'
            : !finite
              ? 'non-finite'
              : broken
                ? 'form-broken'
                : g.hp <= 0
                  ? 'death'
                  : 'timeout',
          hp: result.hp,
          healthLost: Math.round(healthLost * 100) / 100,
          battleSeconds: Math.round((result.time - battleTime) * 100) / 100,
          frames,
          shots: result.shots,
          travel: Math.round(travel),
          startingBossHp,
          lowestBossHp,
          bossDamage: Math.round((startingBossHp - lowestBossHp) * 100) / 100,
          moves: [...moves],
          strikes: [...strikes],
          states: [...states],
          maxShots,
          maxCharges,
          maxSaws,
          maxQueued,
          finite,
          transition: broken
            ? {
                from: fightState,
                to: director.state,
                seconds: transitionFrames / 60,
                travel: transitionTravel,
                hpUnchanged: transitionHp === g.hp,
                reached: director.combat || director.state === 'complete',
                nextHp: g.finale.enemy?.hp ?? null,
                nextMaxHp: g.finale.enemy?.maxHp ?? null,
              }
            : null,
          possibleSoftlock:
            !approach.reachedCombat ||
            (timedOut && lowestBossHp >= startingBossHp) ||
            (broken && !director.combat && director.state !== 'complete'),
          wallMs: Math.round(performance.now() - wallStart),
        };
        runs.push(row);
        if (process.argv[2])
          writeFileSync(
            process.argv[2],
            JSON.stringify({ inProgress: true, runs }, null, 2) + '\n',
          );
        console.log(
          JSON.stringify({
            attempt: runs.length,
            fight: row.fight,
            phase: row.phase,
            gun,
            mirror,
            outcome: row.outcome,
            hp: row.hp,
            time: row.battleSeconds,
            damage: row.bossDamage,
            moves: row.moves.length,
            wallMs: row.wallMs,
          }),
        );
      }
    }
  }
}
const journeys: Record<string, unknown>[] = [];
for (const overtime of [false, true])
  for (const gun of STARTING_GUN_IDS)
    for (const mirror of [false, true]) {
      const cp = finaleTestFromUrl(
        new URL(
          'https://test/?test=finale&v=3&mirror=' +
            Number(mirror) +
            (overtime ? '&fight=overtime' : ''),
        ),
      )!;
      cp.startingGun = gun;
      const g = new Game();
      g.start(cp.seed, cp, null, cp);
      const director = g.finale.cinema!;
      const damageEvents: Record<string, unknown>[] = [];
      const ordinaryDamage = g.damagePlayer.bind(g);
      g.damagePlayer = (...args: Parameters<Game['damagePlayer']>) => {
        const before = g.hp;
        const snapshot = {
          time: Math.round(g.time * 100) / 100,
          phase: director.phase + 1,
          cause: args[2] ?? { type: 'unknown' },
          player: { ...g.player.position },
          arena: g.finale.strike
            ? {
                kind: g.finale.strike.kind,
                left: g.finale.strike.left,
                fired: g.finale.strike.fired,
              }
            : null,
          move: g.finale.enemy?.interceptor?.move,
        };
        ordinaryDamage(...args);
        if (g.hp < before) damageEvents.push({ ...snapshot, damage: before - g.hp, hp: g.hp });
      };
      let approachFrames = 0;
      while (!director.combat && approachFrames < 45 * 60) {
        g.tick(1 / 60, input(g, mirror ? -1 : 1));
        approachFrames++;
      }
      const states = new Set<string>([director.state]);
      const phases = new Set<number>();
      const moves = new Set<string>();
      const phaseHp: Record<string, number> = {};
      let finite = finiteGame(g),
        maxShots = 0;
      const fightStart = g.time;
      const result = playRoom(
        g,
        Math.max(180, seconds * 3),
        () => {
          states.add(director.state);
          if (director.combat) {
            phases.add(director.phase + 1);
            phaseHp[director.phase + 1] ??= g.hp;
            const e = g.finale.enemy;
            if (e?.interceptor && e.state === 'windup' && e.attack !== 'vault')
              moves.add(e.interceptor.move);
          }
          finite &&= finiteGame(g);
          maxShots = Math.max(maxShots, g.shots.length);
          return !finite || director.state === 'complete';
        },
        { arenaAware },
      );
      // Some room helpers stop at clear before the finale's visual aftermath is done.
      let endingFrames = 0;
      while (
        g.hp > 0 &&
        !director.combat &&
        director.state !== 'complete' &&
        endingFrames < 15 * 60
      ) {
        g.tick(1 / 60, input(g));
        endingFrames++;
        states.add(director.state);
      }
      const row = {
        fight: overtime ? 'overtime' : 'campaign',
        gun,
        mirror,
        outcome: director.state === 'complete' ? 'complete' : g.hp <= 0 ? 'death' : 'timeout',
        hp: g.hp,
        battleSeconds: Math.round((g.time - fightStart) * 100) / 100,
        phases: [...phases],
        states: [...states],
        phaseHp,
        damageEvents,
        deathCause: g.deathCause,
        moves: [...moves],
        shots: result.shots,
        maxShots,
        finite,
      };
      journeys.push(row);
      if (process.argv[2])
        writeFileSync(
          process.argv[2],
          JSON.stringify({ inProgress: true, runs, journeys }, null, 2) + '\n',
        );
      console.log(
        JSON.stringify({
          journey: journeys.length,
          ...row,
          moves: row.moves.length,
          states: undefined,
          damageEvents: undefined,
        }),
      );
    }
const report = {
  pilot: arenaAware ? 'arena-aware' : 'baseline',
  note: 'Deterministic ordinary-input pilot simulations with the existing preview builds, real health, damage and physics; not observed human playtests or a human win-rate estimate. Phase trials start independently; seamless journeys preserve all health attrition across forms. Neither uses healing, invulnerability or enemy HP edits during combat. Damage logging wraps and calls the original damagePlayer unchanged.',
  secondsPerForm: seconds,
  wallSeconds: Math.round((performance.now() - started) / 100) / 10,
  attempts: runs.length,
  formBreaks: runs.filter((r) => r.outcome === 'form-broken').length,
  deaths: runs.filter((r) => r.outcome === 'death').length,
  timeouts: runs.filter((r) => r.outcome === 'timeout').length,
  nonFinite: runs.filter((r) => !r.finite).length,
  approachBlocked: runs.filter((r) => r.outcome === 'approach-blocked').length,
  possibleSoftlocks: runs.filter((r) => r.possibleSoftlock).length,
  runs,
  journeys: {
    attempts: journeys.length,
    completions: journeys.filter((r) => r.outcome === 'complete').length,
    deaths: journeys.filter((r) => r.outcome === 'death').length,
    timeouts: journeys.filter((r) => r.outcome === 'timeout').length,
    nonFinite: journeys.filter((r) => !r.finite).length,
    runs: journeys,
  },
};
if (process.argv[2]) writeFileSync(process.argv[2], JSON.stringify(report, null, 2) + '\n');
console.log(
  JSON.stringify({ ...report, runs: undefined, journeys: { ...report.journeys, runs: undefined } }),
);
if (
  report.nonFinite ||
  report.approachBlocked ||
  report.possibleSoftlocks ||
  report.journeys.nonFinite ||
  report.journeys.timeouts
)
  process.exitCode = 1;
