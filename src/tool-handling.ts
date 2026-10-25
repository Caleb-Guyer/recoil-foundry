import type { Game } from './game.ts';
import { clamp } from './rules.ts';

export type ToolMechanism = 'carbine' | 'twinbore' | 'repeater';

/** Conversions retain their barrel, flash and ammunition presentation. */
export function nativeMechanism(g: Game): ToolMechanism | null {
  if (
    g.torch.equipped ||
    g.massDriver.equipped ||
    g.gun.shellshock ||
    (g.combatFeel.toolConvertedAt !== null && g.combatFeel.toolConvertedAt === g.lastShot)
  )
    return null;
  return ['carbine', 'twinbore', 'repeater'].includes(g.startingGun)
    ? (g.startingGun as ToolMechanism)
    : null;
}

/** Recover before the next real discharge, including rounds inside a burst. */
export function handlingCycle(age: number, interval: number, burstCount = 1) {
  const cadence =
    (Number.isFinite(interval) && interval > 0 ? interval : 0.1) * (burstCount === 3 ? 0.3 : 1);
  const duration = clamp(cadence * 0.86, 0.001, 0.5);
  const progress = !Number.isFinite(age) || age < 0 ? 1 : clamp(age / duration, 0, 1);
  return { progress, kick: (1 - progress) ** 2 };
}

export function toolHandling(g: Game) {
  const native = nativeMechanism(g),
    { progress, kick } = handlingCycle(g.time - g.lastShot, g.gun.interval, g.gun.burstCount);
  const pressure = native === 'repeater' ? g.combatFeel.pressureAt(g.time) : 0;
  return {
    native,
    kick: native ? kick : 0,
    coilCharge: [0, 1, 2].map((i) => clamp((progress - i * 0.15) / 0.7, 0, 1)),
    twinKick: native === 'twinbore' ? [kick * 4, kick * 4] : [0, 0],
    pressure,
    feed: native === 'repeater' ? g.combatFeel.feedIndex : 0,
    feedTravel: native === 'repeater' ? kick * 3 : 0,
  };
}
