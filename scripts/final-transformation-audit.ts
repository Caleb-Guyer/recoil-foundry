import { writeFileSync } from 'node:fs';
import { Game } from '../src/game.ts';
import { finaleTestFromUrl } from '../src/final-arsenal.ts';
import { STARTING_GUNS, type StartingGun } from '../src/starting-guns.ts';
import { playRoom } from '../tests/room-pilot.ts';

const runs: Record<string, unknown>[] = [];
for (const arena of ['relay', 'skybridge', 'crossfire', 'overtime'])
  for (const gun of Object.keys(STARTING_GUNS) as StartingGun[])
    for (const mirror of [0, 1]) {
      const cp = finaleTestFromUrl(
        new URL(
          'https://test/?test=finale&v=2&mirror=' +
            mirror +
            (arena === 'overtime' ? '&fight=overtime' : '&arena=' + arena),
        ),
      )!;
      cp.startingGun = gun;
      const g = new Game();
      g.start(cp.seed, cp, null, cp);
      const moves = new Set<string>();
      let maxShots = 0,
        maxCharges = 0,
        maxSaws = 0,
        finite = true;
      const result = playRoom(g, 180, () => {
        const e = g.enemies.find((e) => e.interceptor);
        if (e?.interceptor) {
          if (e.state === 'windup' && e.attack !== 'vault') moves.add(e.interceptor.move);
          maxCharges = Math.max(maxCharges, e.interceptor.charges.length);
          maxSaws = Math.max(maxSaws, e.interceptor.saws.length);
        }
        maxShots = Math.max(maxShots, g.shots.length);
        finite &&= [g.player, ...g.enemies.map((e) => e.body)].every(
          (b) => Number.isFinite(b.position.x) && Number.isFinite(b.position.y),
        );
        return !finite;
      });
      runs.push({
        arena,
        gun,
        mirror: !!mirror,
        ...result,
        moves: [...moves],
        maxShots,
        maxCharges,
        maxSaws,
        finite,
      });
    }
const report = {
  note: 'Deterministic ordinary-input simulations with real damage and physics; not observed human playtests or a player win-rate estimate.',
  attempts: runs.length,
  clears: runs.filter((r) => r.clear).length,
  deaths: runs.filter((r) => Number(r.hp) <= 0).length,
  timeouts: runs.filter((r) => !r.clear && Number(r.hp) > 0).length,
  nonFinite: runs.filter((r) => !r.finite).length,
  runs,
};
if (process.argv[2]) writeFileSync(process.argv[2], JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ ...report, runs: undefined }));
if (report.nonFinite) process.exitCode = 1;
