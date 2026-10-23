import { writeFileSync } from 'node:fs';
import { Game, type Input } from '../src/game.ts';
import { enemyRemasterTestFromUrl, ENEMY_ENCOUNTERS } from '../src/enemy-encounters.ts';
import { STARTING_GUN_IDS } from '../src/starting-guns.ts';
import { GAME_VERSION } from '../src/version.ts';

// Scripted ordinary controls, not a human difficulty or retention measurement.
const rows = [];
for (const encounter of Object.keys(ENEMY_ENCOUNTERS))
  for (const gun of STARTING_GUN_IDS)
    for (const mirror of [0, 1]) {
      const checkpoint = enemyRemasterTestFromUrl(
        new URL(
          `https://test/?test=enemies&encounter=${encounter}&gun=${gun}&mirror=${mirror}&v=1`,
        ),
      )!;
      const g = new Game();
      let writes = 0;
      g.onCheckpoint = () => writes++;
      g.startTest(checkpoint);
      let frames = 0,
        peakParticles = 0,
        peakBodies = 0,
        seenWarnings = 0,
        lastState = new Map<number, string>();
      for (; frames < 3600 && g.mode === 'playing' && !g.clear; frames++) {
        const p = g.player.position;
        const target = [...g.enemies].sort(
          (a, b) =>
            Math.hypot(a.body.position.x - p.x, a.body.position.y - p.y) -
            Math.hypot(b.body.position.x - p.x, b.body.position.y - p.y),
        )[0];
        const dest = target?.body.position ?? { x: 1300, y: 722 };
        const high = p.y - dest.y > 90;
        const launch = high ? dest.x - (p.x < dest.x ? 150 : -150) : dest.x;
        const dx = launch - p.x;
        const needLaunch = high && Math.abs(dx) < 180;
        const tooClose = !high && target && Math.abs(dest.x - p.x) < 150;
        const move = tooClose
          ? -Math.sign(dest.x - p.x)
          : Math.abs(dx) > 220 || high
            ? Math.sign(dx)
            : 0;
        const pressure = target?.remaster && target.state === 'windup';
        const blocked = g.solidBodies.some(
          (b) =>
            b.bounds.min.x < p.x + move * 65 + 14 &&
            b.bounds.max.x > p.x + move * 65 - 14 &&
            b.bounds.min.y < p.y + 10 &&
            b.bounds.max.y > p.y - 10,
        );
        const input: Input = {
          left: move < 0,
          right: move > 0,
          jump: g.grounded && (blocked || !!pressure || needLaunch || frames % 150 === 0),
          jumpHeld: true,
          fire: true,
          aim: needLaunch ? { x: p.x, y: p.y + 500 } : { x: dest.x, y: dest.y },
        };
        g.tick(1 / 60, input);
        peakParticles = Math.max(peakParticles, g.particles.length);
        peakBodies = Math.max(peakBodies, g.engine.world.bodies.length);
        for (const e of g.enemies) {
          if (e.remaster && e.state === 'windup' && lastState.get(e.id) !== 'windup')
            seenWarnings++;
          lastState.set(e.id, e.state);
          if (!Number.isFinite(e.body.position.x + e.body.position.y + e.hp))
            throw Error('Nonfinite enemy');
        }
        if (!Number.isFinite(p.x + p.y + g.hp)) throw Error('Nonfinite player');
      }
      if (writes) throw Error('Preset wrote campaign progress');
      rows.push({
        encounter,
        gun,
        mirror,
        seconds: +(frames / 60).toFixed(2),
        result: g.clear ? 'clear' : g.mode === 'dead' ? 'death' : g.mode,
        health: g.hp,
        kills: g.kills,
        player: { ...g.player.position },
        remaining: g.enemies.map((e) => ({
          kind: e.kind,
          pos: { ...e.body.position },
          state: e.state,
        })),
        seenWarnings,
        peakParticles,
        peakBodies,
        checkpointWrites: writes,
      });
    }
const report = {
  version: GAME_VERSION,
  scope:
    '36 deterministic ordinary-input attempts; scripted aiming/movement, not human play or a general difficulty rating',
  attempts: rows.length,
  clears: rows.filter((r) => r.result === 'clear').length,
  deaths: rows.filter((r) => r.result === 'death').length,
  timeouts: rows.filter((r) => r.result === 'playing').length,
  rows,
};
const json = JSON.stringify(report, null, 2) + '\n';
if (process.argv[2]) writeFileSync(process.argv[2], json);
else process.stdout.write(json);
