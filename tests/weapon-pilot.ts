import type { Game, Input } from '../src/game.ts';
import { beamRecoilForecast } from './beam-pilot.ts';
import { direction, type Vec } from '../src/rules.ts';
import { firstSolid } from '../src/collisions.ts';

/** Send ordinary weapon-specific controls without changing combat or physics.
 * Bellows is pumped; a Switchjack damage pass lets the bolt hit rather than
 * sacrificing it for a jump. Dedicated mechanism tests exercise its jumps. */
export function weaponPilotInput(g: Game, input: Input): Input {
  if (!input.fire || !g.experimentalWeapons.kind) return input;
  if (g.startingGun === 'bellows') {
    const lifting = !g.grounded && input.aim.y > g.player.position.y + 120;
    // Pump against the visible chamber state rather than a wall-clock rhythm
    // that can drift into the gun's recovery window and lose every other pop.
    const pressure = lifting ? 0.17 : 0.57;
    return {
      ...input,
      fire: g.time < g.shootAt || g.experimentalWeapons.pressure < pressure,
      firePressed: false,
    };
  }
  if (g.startingGun === 'switchjack')
    return {
      ...input,
      fire: Math.floor(g.time * 60) % 8 < 4 && !g.experimentalWeapons.bolt,
      firePressed: false,
    };
  if (g.startingGun === 'debt-collector')
    return { ...input, fire: g.experimentalWeapons.debt < 0.4, firePressed: false };
  return input;
}

/** Forecast the recoil paid by the player's visible manual vent rhythm.
 * Stored kicks already include their original grounded/airborne scaling. */
export function debtRecoilForecast(g: Game) {
  let reserve = g.experimentalWeapons.debt * 24,
    time = g.time,
    nextVent = g.experimentalWeapons.flash - 0.04,
    shootAt = g.shootAt,
    burst = g.burstRemaining,
    burstAt = g.burstAt,
    charged = g.gun.landing && g.landingReady;
  const beam = g.torch.equipped ? beamRecoilForecast(g) : null;
  return (dt: number, wantsFire: boolean, ground: boolean) => {
    const fire = wantsFire && reserve / 24 < 0.4;
    time += dt;
    let impulse = 0,
      shot = false;
    const vent = () => {
      impulse += reserve;
      reserve = 0;
      nextVent = time + 0.16;
    };
    if ((!fire && reserve > 0 && burst === 0) || (reserve >= 24 && time >= nextVent)) vent();
    let captured = 0;
    if (beam) {
      const emission = beam(dt, fire, charged);
      captured = emission.impulse * (ground ? 0.21 * g.toolroom.groundScale : 1);
      if (emission.spentLanding) charged = false;
    } else {
      if (burst > 0 && time >= burstAt) {
        burst--;
        burstAt = time + g.gun.interval * 0.3;
        shot = true;
      } else if (fire && time >= shootAt && burst === 0) {
        shootAt = time + g.gun.interval * (g.gun.burstCount === 3 ? 3.1 : 1);
        burst = g.gun.burstCount - 1;
        burstAt = time + g.gun.interval * 0.3;
        shot = true;
      }
      if (shot) {
        captured =
          g.gun.recoil * (ground ? 0.21 * g.toolroom.groundScale : 1) * (charged ? 1.25 : 1);
        charged = false;
      }
    }
    reserve = Math.min(24, reserve + captured);
    if (reserve >= 24 && time >= nextVent) vent();
    return { impulse, shot };
  };
}

/** Damage-first Switchjack inputs let the one visible bolt hit. Forecast that
 * finite flight instead of inventing automatic shots while its beacon is live. */
export function switchjackRecoilForecast(g: Game) {
  const live = g.experimentalWeapons.bolt;
  let bolt = live
    ? { pos: { ...live.pos }, vel: { ...live.vel }, life: live.life, radius: live.radius }
    : null;
  let time = g.time,
    held = g.experimentalWeapons.holding,
    shootAt = g.shootAt,
    burst = g.burstRemaining,
    burstAt = g.burstAt;
  const bodies = [
    ...g.solidBodies,
    ...g.enemies.filter((e) => e.hp > 0 && e.spawn <= 0).map((e) => e.body),
  ];
  return (dt: number, wantsFire: boolean, p: Vec, aim: Vec) => {
    const fire = wantsFire && Math.floor(time * 60) % 8 < 4 && !bolt;
    const pressed = fire && !held;
    held = fire;
    time += dt;
    let shot = false,
      first = false;
    if (burst > 0 && time >= burstAt) {
      burst--;
      burstAt = time + g.gun.interval * 0.3;
      shot = true;
    } else if (pressed && time >= shootAt && burst === 0) {
      shootAt = time + g.gun.interval * (g.gun.burstCount === 3 ? 3.1 : 1);
      burst = g.gun.burstCount - 1;
      burstAt = time + g.gun.interval * 0.3;
      shot = first = true;
    }
    if (first) {
      const d = direction(p, aim),
        speed = g.gun.projectileSpeed;
      bolt = {
        pos: { x: p.x + d.x * 26, y: p.y - 3 + d.y * 26 },
        vel: { x: d.x * speed, y: d.y * speed },
        life: 1.1,
        radius: 2.5,
      };
    }
    if (bolt) {
      const end = { x: bolt.pos.x + bolt.vel.x * dt * 60, y: bolt.pos.y + bolt.vel.y * dt * 60 };
      bolt.life -= dt;
      if (bolt.life <= 0 || firstSolid(bolt.pos, end, { x: bolt.radius, y: bolt.radius }, bodies))
        bolt = null;
      else bolt.pos = end;
    }
    return { impulse: shot ? g.gun.recoil : 0, shot };
  };
}

/** Independent test-pilot forecast of a visible pneumatic cycle. The ordinary
 * automatic-gun forecast would dodge with a kick before Bellows actually fires. */
export function bellowsRecoilForecast(g: Game) {
  let pressure = g.experimentalWeapons.pressure,
    held = g.experimentalWeapons.holding,
    shootAt = g.shootAt,
    burst = g.burstRemaining,
    burstAt = g.burstAt,
    time = g.time;
  return (dt: number, wantsFire: boolean, lifting: boolean) => {
    const fire = wantsFire && (time < shootAt || pressure < (lifting ? 0.17 : 0.57));
    const released = held && !fire;
    held = fire;
    time += dt;
    if (burst > 0) {
      if (time < burstAt) return { impulse: 0, tug: 0, shot: false };
      burst--;
      burstAt = time + g.gun.interval * 0.3;
      return { impulse: g.gun.recoil, tug: 0, shot: true };
    }
    if (fire) pressure = Math.min(1, Math.max(0.12, pressure + dt / 0.7));
    if (time < shootAt) {
      if (released) pressure = 0;
      return { impulse: 0, tug: fire ? 0.035 * dt * 60 : 0, shot: false };
    }
    if (released && pressure > 0) {
      pressure = 0;
      shootAt = time + g.gun.interval * (g.gun.burstCount === 3 ? 3.1 : 1);
      burst = g.gun.burstCount - 1;
      burstAt = time + g.gun.interval * 0.3;
      return { impulse: g.gun.recoil, tug: 0, shot: true };
    }
    return { impulse: 0, tug: fire ? 0.035 * dt * 60 : 0, shot: false };
  };
}
