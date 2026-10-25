import type { Vec } from './rules.ts';

interface BossCueBase {
  /** Actual tell completion; never a separate presentation clock. */
  readonly progress: number;
  readonly active: boolean;
  /** Seconds until this committed lane releases its next pending round. */
  readonly fireIn?: number;
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
        /** Exact swept axis-aligned rectangular body, including its endpoint hulls. */
        readonly kind: 'hull';
        readonly from: Vec;
        readonly to: Vec;
        readonly halfWidth: number;
        readonly halfHeight: number;
      }
    | {
        readonly kind: 'fan';
        readonly from: Vec;
        readonly ends: readonly Vec[];
        readonly width: number;
      }
  );
export interface BossRemasterVisual {
  readonly kind:
    | 'loader'
    | 'crane'
    | 'press'
    | 'kiln'
    | 'condenser'
    | 'sorter'
    | 'turbine'
    | 'boss';
  readonly center: Vec;
  readonly phase: number;
  readonly stage: 'startup' | 'transition' | 'combat' | 'destroyed';
  readonly progress: number;
  readonly age?: number;
  readonly exposed?: boolean;
  readonly warnings: readonly BossRemasterCue[];
}
