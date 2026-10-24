import type { AreaId } from './areas.ts';
import type { Game } from './game.ts';
import { musicScene } from './music-score.ts';
import { successfulUprising } from './uprising-model.ts';

export interface FactoryAudioScene {
  area: AreaId;
  room: string;
  // Supply is separate from machine activity: clearing enemies does not turn
  // the factory off. A blackout, cut circuit or successful sabotage does.
  power: number;
  activity: number;
}

const unit = (n: number) => (Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0);

// This reads the same live systems as physics and the rain/score scene. It has
// no clock, persistence, random draws, or synthetic machinery events.
export function factoryAudioScene(g: Game): FactoryAudioScene | null {
  if (
    g.mode !== 'playing' ||
    !g.level ||
    g.hp <= 0 ||
    g.workshop.active ||
    g.clockOut.active ||
    (g.overtime && g.stage === 19 && g.clear) ||
    g.shutdown.complete ||
    g.escape?.phase === 'extracting'
  )
    return null;
  if (g.finale.active && !g.escape) {
    const score = musicScene(g);
    if (score.rain || score.effectsSilent || score.musicSilent || score.cinema) return null;
  }

  let power = 1;
  if (g.areaEvents.dark) power = 0;
  if (g.shutdown.eligible) {
    if (g.shutdown.chamber) power = unit(1 - (g.shutdown.state?.cycle ?? 0) / 3);
    else if (g.shutdown.state?.disabled.includes(g.stage)) power = 0;
  }
  if (g.uprising.active && successfulUprising(g.uprising.run, 'core-sabotage')) power = 0;

  const player = g.player.position;
  const near = (x: number, y: number) => unit(1 - Math.hypot(x - player.x, y - player.y) / 1100);
  let activity = 0;
  for (const belt of g.conveyors.items)
    activity += near(belt.x + belt.w / 2, belt.y) * Math.min(0.5, Math.abs(belt.speed) * 0.16);
  for (const hazard of g.hazards.items) {
    if (!hazard.visible || !['lift', 'crusher'].includes(hazard.kind)) continue;
    const moving = hazard.kind === 'lift' || ['falling', 'returning'].includes(hazard.state);
    if (moving) activity += near(hazard.body.position.x, hazard.body.position.y) * 0.3;
  }
  for (const vent of g.pressure.items)
    if (vent.phase === 'burst') activity += near(vent.x, vent.y) * 0.35;
  for (const fan of g.crosswind.items)
    activity += near(fan.x, fan.y) * unit(g.crosswind.strength(fan)) * 0.4;

  return {
    area: g.level.area,
    room: g.roomSeed + ':' + g.stage + ':' + g.level.id + (g.escape ? ':escape' : ''),
    power,
    activity: unit(activity) * power,
  };
}
