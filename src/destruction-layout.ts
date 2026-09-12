import type { Level, Solid } from './levels.ts';
import { sample, seeded } from './rules.ts';

// Only optional shelves and isolated, low obstacles can fail. Stairs, tall
// towers, arena boundaries, machinery and extraction remain structural.
export function breakableSolids(level: Level, seed: string, stage: number): Solid[] {
  if (level.freight || level.detour || level.id === 'last-flight') return [];
  const optional = level.solids.filter((s) => {
    if (s.x < 280 || s.x + s.w > 1740 || s.y < 350 || s.w > 330) return false;
    if (level.magnets?.some((m) => m.x >= s.x - 65 && m.x <= s.x + s.w + 65)) return false;
    if (s.h <= 28) {
      // The rival's upper gantries anchor its recoil approaches and prevent
      // uninterrupted overhead firing. Its low cover can still break.
      if (level.id === 'relay-roof') return false;
      // Waypoints on a shelf identify it as a necessary part of the jump route.
      return !level.route.some(
        (p) => p.x >= s.x && p.x <= s.x + s.w && Math.abs(p.y + 20 - s.y) < 12,
      );
    }
    if (level.routeChoice === 'high' || s.h > 130 || s.y + s.h !== 740) return false;
    // Preserve approach steps on either side of anything too tall to jump
    // directly from the floor. Removing several selected pieces stays safe.
    return !level.solids.some(
      (other) =>
        other !== s &&
        other.y < 600 &&
        other.y + other.h >= s.y &&
        other.x < s.x + s.w + 180 &&
        other.x + other.w > s.x - 180,
    );
  });
  const rng = seeded(seed + ':breakable:' + stage + ':' + level.id);
  const wall = sample(
    optional.filter((s) => s.h > 28),
    1,
    rng,
  );
  const ledges = sample(
    optional.filter((s) => s.h <= 28),
    level.boss ? 1 : 2,
    rng,
  );
  return [...wall, ...ledges];
}
