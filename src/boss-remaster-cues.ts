import type { Vec } from './rules.ts';

interface BossCueBase {
  /** Actual tell completion; never a separate presentation clock. */
  readonly progress: number;
  readonly active: boolean;
  readonly locked?: boolean;
}
export type BossRemasterCue = BossCueBase &
  (
    | {
        readonly kind: 'lane';
        /** Horizontal center; the footprint spans x - width / 2 to x + width / 2. */
        readonly x: number;
        readonly width: number;
        readonly top: number;
        readonly bottom: number;
      }
    | { readonly kind: 'segment'; readonly from: Vec; readonly to: Vec; readonly width: number }
    | {
        readonly kind: 'fan';
        readonly from: Vec;
        readonly ends: readonly Vec[];
        readonly width: number;
      }
  );
export interface BossRemasterVisual {
  readonly kind: 'condenser' | 'sorter';
  readonly center: Vec;
  readonly phase: number;
  readonly stage: 'startup' | 'transition' | 'combat' | 'destroyed';
  readonly progress: number;
  readonly age?: number;
  readonly warnings: readonly BossRemasterCue[];
}
