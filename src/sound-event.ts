export type SoundMaterial = 'armor' | 'casing' | 'cover' | 'power' | 'terrain';

export interface SoundOrigin {
  x: number;
  y: number;
  source?: string;
  material?: SoundMaterial;
}

export interface SoundListener {
  x: number;
  y: number;
}

export function validSoundPosition(
  value: SoundListener | null | undefined,
): value is SoundListener {
  return !!value && Number.isFinite(value.x) && Number.isFinite(value.y);
}

// The stereo field remains narrower than hard left/right, and distant warning
// sounds keep enough level to be useful without headphones.
export function spatialMix(
  origin: SoundOrigin | null | undefined,
  listener: SoundListener | null,
  mono = false,
  warning = false,
) {
  if (!validSoundPosition(origin) || !validSoundPosition(listener)) return { pan: 0, gain: 1 };
  const dx = origin.x - listener.x;
  const dy = (origin.y - listener.y) * 0.65;
  const distance = Math.hypot(dx, dy);
  return {
    pan: mono ? 0 : Math.max(-0.85, Math.min(0.85, dx / 700)),
    gain: Math.max(warning ? 0.7 : 0.24, 1 / Math.sqrt(1 + (distance / 950) ** 2)),
  };
}

export function soundCooldownKey(kind: string, origin?: SoundOrigin) {
  if (!validSoundPosition(origin)) return kind;
  // Named emitters retain their cooldown as they move. Unnamed positions still
  // distinguish separate objects, while nearby impacts share a modest limit.
  const source =
    origin.source?.slice(0, 96) || `${Math.round(origin.x / 32)},${Math.round(origin.y / 32)}`;
  return `${kind}\u0000${source}`;
}
