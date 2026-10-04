import type { Game, Shot } from './game.ts';
import type { Vec } from './rules.ts';
import { INTERCEPTOR_WEAPONS } from './interceptor-weapons.ts';
import { roundFeel } from './combat-feel.ts';

export interface ProjectileLight {
  pos: Vec;
  radius: number;
  strength: number;
  color: string;
}
export const PROJECTILE_LIGHT_LIMIT = 96;
export function shotLight(s: Shot, mods: readonly string[]): Omit<ProjectileLight, 'pos'> | null {
  if (s.life <= 0 || s.meltTransit) return null;
  let color = '#f6d49a',
    radius = 38,
    strength = 0.7;
  if (s.enemyAmmo) {
    color = INTERCEPTOR_WEAPONS[s.enemyAmmo.kind].color;
    radius = s.enemyAmmo.kind === 'capacitor' ? 80 : s.enemyAmmo.kind === 'fuse' ? 60 : 38;
  } else if (!s.friendly && s.supportCharged) {
    color = '#efc477';
    radius = 48;
  } else if (!s.friendly) {
    color = '#f28a79';
    radius = s.blade ? 26 : 34;
  } else if (s.allied) {
    color = '#6bb7ff';
    radius = 38;
  } else if (s.rail) {
    color = '#b7e4ef';
    radius = 90;
    strength = 0.9;
  } else if (s.molten) {
    color = '#ffb86c';
    radius = 75;
    strength = 0.85;
  } else if (s.charged || s.counter) {
    color = '#d7ebad';
    radius = 68;
    strength = 0.85;
  } else if (s.shell) {
    color = '#f1ad61';
    radius = 60;
  } else if (s.massDriver) {
    color = '#d6c39e';
    radius = 42;
  } else if (s.blade) {
    color = '#b1d8df';
    radius = 26;
  } else if (s.stasis) {
    color = '#c3b4f0';
    radius = 46;
  } else if (mods.includes('coolant-rounds')) {
    color = '#9bdbe5';
    radius = 48;
  } else if (mods.includes('arc-coil')) {
    color = '#96d7ff';
    radius = 54;
  } else if (s.reflected || s.banks > 0) {
    color = '#9dccb5';
    radius = 42;
  } else if (roundFeel(s) === 'nail') {
    color = '#b5d4d0';
    radius = 28;
    strength = 0.55;
  }
  if (s.fragment) {
    radius *= 0.45;
    strength *= 0.65;
  }
  if (s.echo) strength *= 0.55;
  if (s.stasis?.phase === 'parked' || s.stasis?.phase === 'queued') {
    radius *= 0.65;
    strength *= 0.65;
  }
  return { color, radius, strength };
}

export function projectileLights(
  g: Game,
  view: { x: number; y: number; w: number; h: number },
): ProjectileLight[] {
  const result: ProjectileLight[] = [];
  const add = (pos: Vec, radius: number, color: string, strength = 0.75) => {
    if (
      result.length >= PROJECTILE_LIGHT_LIMIT ||
      !Number.isFinite(pos.x) ||
      !Number.isFinite(pos.y)
    )
      return;
    if (
      pos.x + radius < view.x ||
      pos.x - radius > view.x + view.w ||
      pos.y + radius < view.y ||
      pos.y - radius > view.y + view.h
    )
      return;
    result.push({ pos, radius, color, strength });
  };
  // Illuminate the actual traced beam, including banks, stopping at its hit.
  if (g.torch.active) {
    const color = g.mods.includes('coolant-rounds')
      ? '#9bdbe5'
      : g.mods.includes('arc-coil')
        ? '#96d7ff'
        : '#ffb86c';
    for (const s of [...g.torch.segments, ...g.torch.rear]) {
      const length = Math.hypot(s.b.x - s.a.x, s.b.y - s.a.y),
        steps = Math.max(1, Math.ceil(length / 80));
      for (let i = 0; i <= steps && result.length < 32; i++)
        add(
          { x: s.a.x + ((s.b.x - s.a.x) * i) / steps, y: s.a.y + ((s.b.y - s.a.y) * i) / steps },
          72,
          color,
          0.82,
        );
    }
  }
  for (const a of g.arcs.effects.slice(-8)) {
    add(a.a, 55, '#96d7ff');
    add(a.b, 55, '#96d7ff');
  }
  for (const s of g.grind.saws) if (s.life > 0) add(s.pos, 28, '#e8bb76', 0.55);
  for (const s of g.ballistics.shells.slice(-8)) if (s.at > g.time) add(s.pos, 28, '#f1ad61', 0.6);
  // Threats get a place in the budget even during large friendly volleys.
  const shots = g.shots.slice(-256);
  for (const s of [...shots.filter((s) => !s.friendly), ...shots.filter((s) => s.friendly)]) {
    const light = shotLight(s, g.mods);
    if (light) add(s.pos, light.radius, light.color, light.strength);
    if (result.length === PROJECTILE_LIGHT_LIMIT) break;
  }
  return result;
}
