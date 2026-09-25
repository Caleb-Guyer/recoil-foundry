import type { Game } from '../src/game.ts';
import { TORCH } from '../src/torch.ts';

// Test-only forecast of emitted recoil, not a second physics engine. Snapshot
// the current cadence so each candidate move starts at the same real pulse.
// It never writes to the game. Advanced mobility/fusion procs are out of scope.
interface Cadence {
  until: number;
  restartAt: number;
  burstLeft: number;
  burnFrom: number;
  burnUntil: number;
  charging: number;
  chargeHeld: boolean;
  lensLeft: number;
  lensPower: number;
  pulseGain: number;
  period: number;
  recoilBoost: number;
}
export function beamRecoilForecast(g: Game) {
  const source = g.torch as unknown as Cadence;
  const state: Cadence = {
    until: source.until,
    restartAt: source.restartAt,
    burstLeft: source.burstLeft,
    burnFrom: source.burnFrom,
    burnUntil: source.burnUntil,
    charging: source.charging,
    chargeHeld: source.chargeHeld,
    lensLeft: source.lensLeft,
    lensPower: source.lensPower,
    pulseGain: source.pulseGain,
    period: source.period,
    recoilBoost: source.recoilBoost,
  };
  let time = g.time;
  const interval = g.gun.interval,
    lens = g.mods.includes('charge-lens'),
    burst = g.gun.burstCount === 3;
  return (dt: number, held: boolean, landing: boolean) => {
    const start = time;
    time += dt;
    if (!held && !lens) {
      state.charging = state.burstLeft = state.lensLeft = 0;
      state.chargeHeld = false;
      state.burnUntil = -1;
      state.pulseGain = state.recoilBoost = 1;
      return { impulse: 0, spentLanding: false };
    }
    let due = time + 1e-8 >= state.until;
    if (lens) {
      const released = state.chargeHeld && !held;
      state.chargeHeld = held;
      if (!(state.lensLeft > 0 || time < state.burnUntil) && time >= state.restartAt) {
        if (held) state.charging = Math.min(interval * 3, state.charging + dt);
        else if (released && state.charging >= 0.06) {
          state.lensPower = 4 * (state.charging / (interval * 3)) ** 1.2 * (burst ? 0.45 : 1);
          state.lensLeft = burst ? 3 : 1;
          state.until = start;
          state.restartAt =
            start + (state.lensLeft - 1) * interval * 0.45 + interval * (burst ? 1.6 : 1.25);
          state.charging = 0;
        } else if (!held) state.charging = 0;
      }
      due = state.lensLeft > 0 && time + 1e-8 >= state.until;
      if (due) {
        state.burnFrom = state.until;
        state.burnUntil = state.burnFrom + interval * 0.25;
        state.lensLeft--;
        state.until = state.lensLeft ? state.burnFrom + interval * 0.45 : Infinity;
        state.pulseGain = state.lensPower;
      }
    } else if (burst) {
      if (!state.burstLeft && time > state.restartAt + 1e-8) {
        state.until = Math.max(start, state.restartAt);
        state.restartAt = state.until + interval * TORCH.burstCycle;
        state.burstLeft = 3;
      }
      due = state.burstLeft > 0 && time + 1e-8 >= state.until;
      if (due) {
        state.burnFrom = state.until;
        state.burnUntil = state.burnFrom + interval * TORCH.burstWidth;
        state.burstLeft--;
        state.pulseGain = g.mods.includes('pulse-chamber')
          ? state.burstLeft === 0
            ? 1.6
            : 0.7
          : 1;
        state.until = state.burstLeft ? state.burnFrom + interval * TORCH.burstSpacing : Infinity;
      }
    }
    const burn =
      lens || burst
        ? Math.max(0, Math.min(time, state.burnUntil) - Math.max(start, state.burnFrom))
        : dt;
    if (due) {
      state.period = interval * (lens ? 0.25 : burst ? TORCH.burstWidth : 1);
      if (!lens && !burst) state.until = time + state.period;
      state.recoilBoost = landing ? 1.25 : 1;
    }
    return {
      impulse:
        (g.gun.recoil / state.period) * burn * TORCH.thrust * state.pulseGain * state.recoilBoost,
      spentLanding: due,
    };
  };
}
