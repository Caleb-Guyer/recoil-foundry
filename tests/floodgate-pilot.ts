import type { Game, Input } from '../src/game.ts';
import { clamp, distance } from '../src/rules.ts';
import { approach } from './uprising-pilot.ts';

// Read the rising water and climb the actual staircase before fighting again.
// This sends ordinary inputs, including shooting an exposed relief valve.
export function floodgateInput(g: Game): Input | undefined {
  const flood = g.floodgate,
    p = g.player.position;
  if (
    g.encounters !== 1 ||
    !flood.active ||
    g.clear ||
    g.mode !== 'playing' ||
    flood.phase === 'idle' ||
    g.player.bounds.max.y < flood.surface - 60
  )
    return;
  const decks = g.terrain
    .slice(4)
    .filter(
      (b) =>
        b.bounds.min.y < g.player.bounds.max.y - 14 &&
        b.bounds.max.x > 40 &&
        b.bounds.min.x < g.worldWidth - 40,
    )
    .map((b) => ({
      x: clamp(p.x, b.bounds.min.x + 35, b.bounds.max.x - 35),
      y: b.bounds.min.y - 20,
    }))
    .sort(
      (a, b) =>
        Math.abs(a.x - p.x) +
        Math.abs(a.y - p.y) * 1.3 -
        Math.abs(b.x - p.x) -
        Math.abs(b.y - p.y) * 1.3,
    );
  const deck = decks[0];
  if (!deck) return;
  const input = approach(g, deck);
  const valve = flood.valves.find(
    (v) => !v.used && distance(p, v) < 800 && distance(g.lineEnd(p, v), v) < 1,
  );
  if (valve && p.y - deck.y < 50) {
    input.fire = true;
    input.aim = valve;
  }
  return input;
}
