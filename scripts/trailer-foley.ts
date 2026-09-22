// The committed CC0 samples are mono, 48 kHz, signed 16-bit PCM WAVs.
export function decodeFootstep(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = (offset: number) => String.fromCharCode(...bytes.subarray(offset, offset + 4));
  if (tag(0) !== 'RIFF' || tag(8) !== 'WAVE') throw new Error('Invalid footstep WAV');
  let validFormat = false;
  for (let offset = 12; offset + 8 <= bytes.length; ) {
    const size = view.getUint32(offset + 4, true),
      start = offset + 8;
    if (start + size > bytes.length) throw new Error('Truncated footstep WAV');
    if (tag(offset) === 'fmt ') {
      validFormat =
        size >= 16 &&
        view.getUint16(start, true) === 1 &&
        view.getUint16(start + 2, true) === 1 &&
        view.getUint32(start + 4, true) === 48000 &&
        view.getUint16(start + 14, true) === 16;
    }
    if (tag(offset) === 'data') {
      if (!validFormat || size % 2) throw new Error('Expected 48 kHz mono PCM16 Foley');
      return Float32Array.from(
        { length: size / 2 },
        (_, i) => view.getInt16(start + i * 2, true) / 32768,
      );
    }
    offset = start + size + (size % 2);
  }
  throw new Error('Missing footstep samples');
}
