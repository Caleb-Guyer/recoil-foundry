import type { Game, Input } from '../../src/game.ts';
import { weaponPilotInput } from '../weapon-pilot.ts';
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
  if (g.startingGun === 'switchjack' && g.recoil.kind === 'launch') return pilotSwitchLaunch(g);
  if (g.startingGun === 'switchjack' && g.recoil.kind === 'airborne') return pilotSwitchAirborne(g);
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
    let controls: Input = {
      left: dir < 0,
      right: dir > 0,
      jump: g.grounded && (g.recoil.kind === 'airborne' || (g.time >= g.shootAt && p.y > y - 25)),
      jumpHeld: true,
      fire,
      aim,
    };
    if (g.startingGun === 'bellows' && fire) {
      // Short pumps buy frequent lift; the full intake is useful in combat,
      // whereas waiting for it at every shaft landing wastes the jump's height.
      controls.fire = g.experimentalWeapons.pressure < 0.15;
    } else controls = weaponPilotInput(g, controls);
    trialTick(g, controls);
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

/** Climb with aimed beacons and the ordinary jump key, then land each pad.
 * Aiming above the next landing clears its exposed edge with the whole hull. */
function pilotSwitchLaunch(g: Game) {
  let landing = g.level.route[g.recoil.waypoint] ?? {
    x: g.recoil.exit.x,
    y: g.recoil.exit.floor - 18,
  };
  let aim = { x: landing.x, y: landing.y - 210 };
  for (let frame = 0; frame < 7200 && g.mode === 'playing'; frame++) {
    const p = g.player.position,
      v = g.player.velocity,
      bolt = g.experimentalWeapons.bolt;
    let fire = false,
      jump = false,
      dir = 0;
    if (bolt) {
      // Read the visible beacon's travel, rather than waiting a fixed duration:
      // projectile speed fittings change how soon it clears the landing edge.
      fire =
        Math.hypot(bolt.pos.x - p.x, bolt.pos.y - p.y) >= 275 && Math.floor(g.time * 60) % 4 < 2;
      jump = g.grounded && fire;
    } else if (g.grounded) {
      const next = g.level.route[g.recoil.waypoint] ?? {
        x: g.recoil.exit.x,
        y: g.recoil.exit.floor - 18,
      };
      landing =
        g.level.route.slice(0, g.recoil.waypoint + 1).find((point) => point.y < p.y - 25) ?? next;
      aim = { x: landing.x, y: Math.max(g.worldTop + 45, landing.y - 210) };
      fire = g.time >= g.shootAt && Math.floor(g.time * 60) % 4 < 2;
    } else {
      dir = Math.abs(landing.x - p.x) < 5 ? -Math.sign(v.x) : Math.sign(landing.x - p.x - v.x * 5);
    }
    trialTick(g, { left: dir < 0, right: dir > 0, jump, fire, aim });
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

function pilotSwitchAirborne(g: Game) {
  let lifted = false,
    attempt = g.recoil.attempts;
  for (let frame = 0; frame < 7200 && g.mode === 'playing'; frame++) {
    if (g.recoil.attempts !== attempt) {
      attempt = g.recoil.attempts;
      lifted = false;
    }
    const p = g.player.position,
      v = g.player.velocity,
      bolt = g.experimentalWeapons.bolt;
    const target = g.recoil.targets.find((e) => e.hp > 0);
    let aim = { x: 920, y: -100 },
      fire = false,
      jump = false,
      dir = 0;
    if (!lifted) {
      fire =
        (bolt ? g.time - g.lastShot >= 0.7 : g.grounded && g.time >= g.shootAt) &&
        Math.floor(g.time * 60) % 4 < 2;
      jump = !!bolt && fire && g.grounded;
    } else {
      const x = target ? target.body.position.x - 55 : g.recoil.exit.x;
      dir = Math.abs(x - p.x) < 5 ? -Math.sign(v.x) : Math.sign(x - p.x - v.x * 5);
      aim = target ? { ...target.body.position } : { x: p.x, y: p.y + 500 };
      fire =
        !!target &&
        !bolt &&
        g.time >= g.shootAt &&
        p.y < target.body.position.y + 100 &&
        Math.hypot(aim.x - p.x, aim.y - p.y) < 355 &&
        Math.floor(g.time * 60) % 4 < 2;
      jump = !target && g.grounded;
    }
    const before = { ...p };
    trialTick(g, { left: dir < 0, right: dir > 0, jump, fire, aim });
    if (!lifted && Math.hypot(g.player.position.x - before.x, g.player.position.y - before.y) > 30)
      lifted = true;
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
