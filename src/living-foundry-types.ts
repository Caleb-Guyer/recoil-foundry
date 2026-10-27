import type { AreaId } from './areas.ts';

/** Read-only visual projection. Never used for collision, rewards or attack timing. */
export interface LivingFoundryFrame {
  area: AreaId;
  variant: 0 | 1 | 2;
  room: string;
  /** Active simulation seconds; frozen by Pause. */
  time: number;
  /** Motor phase: advances only with live power and active simulation time. */
  motion: number;
  power: number;
  coolant: number;
  salvage: number;
  wind: number;
  /** Entry architecture opens through exploration; never takes player input. */
  reveal: number;
  revealing: boolean;
  mirrored: boolean;
}
