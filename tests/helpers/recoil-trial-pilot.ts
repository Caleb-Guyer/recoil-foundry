import type { Game, Input } from '../../src/game.ts';
export function trialTick(g: Game, extra: Partial<Input> = {}) {
  g.tick(1 / 60, {
    left: false,
    right: false,
    jump: false,
    jumpHeld: true,
    fire: false,
    aim: { x: g.player.position.x, y: g.player.position.y + 500 },
    ...extra,
  });
}
// Ordinary controls only: real firing, collisions, moving loads and air resets.
export function pilotRecoilTrial(g: Game) {
  let boost = true;
  for (let frame = 0; frame < 7200 && g.mode === 'playing'; frame++) {
    const p = g.player.position,
      v = g.player.velocity;
    let x: number,
      y: number,
      fire = false,
      aim = { x: p.x, y: p.y + 500 };
    if (g.recoil.kind === 'airborne') {
      const t = g.recoil.targets.find((e) => e.hp > 0);
      x = t ? t.body.position.x - 30 : g.recoil.exit.x;
      y = t ? 290 : g.recoil.exit.floor - 90;
      fire = !!t && p.y > 330 && v.y > -9;
      if (t && p.y < 390) {
        fire = true;
        aim = { ...t.body.position };
      }
    } else {
      const point = g.level.route[g.recoil.waypoint],
        h = g.recoil.kind === 'cargo' ? g.hazards.items[g.recoil.waypoint] : undefined;
      x = point?.x ?? g.recoil.exit.x;
      y = h ? h.body.position.y - h.placement.h / 2 - 18 : (point?.y ?? g.recoil.exit.floor - 18);
      if (
        g.recoil.kind === 'launch' &&
        p.y > y + 25 &&
        ((x < 1000 && p.x < 985) || (x > 1000 && p.x > 1015))
      )
        x = 1000;
      if (g.recoil.kind === 'launch' && p.y < y - 35 && g.grounded) x = 1000;
      if (
        g.recoil.kind === 'cargo' &&
        h &&
        p.y > y + 25 &&
        Math.abs(p.x - x) < h.placement.w / 2 + 28
      )
        x += (p.x < x ? -1 : 1) * (h.placement.w / 2 + 35);
      if (p.y < y - 45) boost = false;
      if (p.y > y + 130) boost = true;
      fire = boost && !g.grounded && p.y > y - 55 && (g.startingGun === 'nailgun' || v.y > -9);
    }
    const dir = Math.abs(x - p.x) < 5 ? -Math.sign(v.x) : Math.sign(x - p.x - v.x * 5);
    trialTick(g, {
      left: dir < 0,
      right: dir > 0,
      jump: g.grounded && (g.recoil.kind === 'airborne' || (g.time >= g.shootAt && p.y > y - 25)),
      fire,
      aim,
    });
  }
  return {
    mode: g.mode,
    time: g.time,
    hp: g.hp,
    progress: g.recoil.waypoint,
    attempts: g.recoil.attempts,
    targets: g.recoil.targets.map((e) => e.hp),
    pos: { ...g.player.position },
  };
}
