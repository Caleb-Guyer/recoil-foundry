import type { Game, Input } from '../src/game.ts';
import { distance } from '../src/rules.ts';
import { dodgePilot } from './combat-pilot.ts';

// Navigate the raised firing lanes with ordinary movement. The combat predictor
// handles visible shots; blocked lanes require releasing recoil and approaching
// for a jump instead of endlessly firing into the same wall.
export function pressurePilot() {
  let room = '',
    stuck = 0,
    lastX = 140,
    advanceUntil = 0,
    blockedFor = 0;
  return (g: Game): Partial<Input> => {
    if (room !== g.level.id) {
      room = g.level.id;
      stuck = 0;
      lastX = g.player.position.x;
      advanceUntil = 0;
      blockedFor = 0;
    }
    const e = g.enemies
      .filter((e) => e.spawn <= 0)
      .sort(
        (a, b) =>
          distance(a.body.position, g.player.position) -
          distance(b.body.position, g.player.position),
      )[0];
    stuck = Math.abs(g.player.position.x - lastX) < 0.2 ? stuck + 1 : 0;
    lastX = g.player.position.x;
    let input: Partial<Input> = e ? dodgePilot(g, e) : {};
    blockedFor =
      e && distance(g.lineEnd(g.player.position, e.body.position), e.body.position) > 1
        ? blockedFor + 1
        : 0;
    if (e && (stuck > 90 || blockedFor > 90 || g.time < advanceUntil)) {
      if (stuck > 90 || blockedFor > 90) {
        advanceUntil = g.time + 1.2;
        stuck = 0;
        blockedFor = 0;
      }
      const dir = Math.sign(e.body.position.x - g.player.position.x);
      input = {
        left: dir < 0,
        right: dir > 0,
        jump: g.grounded,
        fire: false,
        aim: { ...e.body.position },
      };
    }
    return input;
  };
}
