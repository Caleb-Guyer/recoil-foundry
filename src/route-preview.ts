import type { Checkpoint, RouteChoice } from './rules.ts';
import type { Level } from './levels.ts';
import { routeRemasterTraits } from './route-remaster.ts';

export interface RoutePreview {
  readonly route: RouteChoice;
  readonly stage: number;
  readonly level: Level;
  readonly checkpoint: Checkpoint;
}

// No enemy roster or inferred difficulty appears in a route invitation.
// Authored traits describe actual machinery; other routes describe real solids.
export function routePreviewTraits(level: Level): readonly [string, string] {
  const authored = routeRemasterTraits(level);
  const featurePresent = (tag: string) => {
    switch (tag) {
      case 'Valve vent':
        return !!level.vents?.length;
      case 'Cargo lift':
        return !!level.hazards?.some((hazard) => hazard.kind === 'lift');
      case 'Coolant pools':
        return !!level.coolant?.length;
      case 'Lift fan':
        return !!level.fans?.length;
      default:
        return false;
    }
  };
  // Job outcomes can shut down machinery while preserving the room's identity.
  // Describe that resolved level, rather than reintroducing the authored hazard.
  if (authored && featurePresent(authored[1])) return authored;
  const raised = level.solids.filter((s) => s.y < 580 && s.w >= 100 && s.h <= 48).length;
  const cover = level.solids.filter((s) => s.h >= 45 && s.y + s.h >= 735).length;
  const footing = raised >= 2 ? 'Upper ledges' : cover >= 2 ? 'Low cover' : 'Open floor';
  const feature = level.coolant?.length
    ? 'Coolant pools'
    : level.vents?.length
      ? 'Pressure valves'
      : level.fans?.length
        ? 'Airflow'
        : level.hazards?.some((h) => h.kind === 'lift')
          ? 'Moving lift'
          : level.setpiece?.props.some((p) => p.kind === 'cover')
            ? 'Breakable cover'
            : cover >= 2
              ? 'Broken sightlines'
              : 'Open sightlines';
  return [authored?.[0] ?? footing, feature];
}

// Include the resolved level, not merely a route label: authored encounters,
// mirrors and future revisions can share a room name but have different terrain.
export function routePreviewKey(preview: RoutePreview): string {
  return JSON.stringify([
    preview.checkpoint.seed,
    preview.stage,
    preview.route,
    preview.level,
    preview.checkpoint.areaEvent,
    preview.checkpoint.factory,
    preview.checkpoint.shutdown,
  ]);
}
