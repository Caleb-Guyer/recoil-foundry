"""Extend the measured Resonance edit by one 16-beat phrase of real music."""
from pathlib import Path
import subprocess
import json, os
import numpy as np

root = Path(__file__).resolve().parents[1]
ffmpeg = Path(os.environ.get('FFMPEG', root / '.media-tools/python/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'))
music = root / '.media-tools/music/resonance.mp3'
old = json.loads((root / 'docs/trailer/music-beats.json').read_text())
rate = 24000
raw = subprocess.check_output([str(ffmpeg), '-v', 'error', '-i', str(music), '-ac', '1', '-ar', str(rate), '-f', 'f32le', 'pipe:1'])
wave = np.frombuffer(raw, dtype='<f4')
size, hop = 1024, 24
begin = int(181 * rate)
end = int(193 * rate)
windows = np.lib.stride_tricks.sliding_window_view(wave[begin:end], size)[::hop]
spectra = np.abs(np.fft.rfft(windows * np.hanning(size), axis=1))
flux = np.maximum(0, np.diff(spectra, axis=0)).sum(axis=1)
times = (begin + (np.arange(len(flux)) + 1) * hop + size / 2) / rate
beats = old['beats'][:32]
for beat in range(32, 48):
    expected = old['sourceIn'] + beat * .6
    candidates = np.flatnonzero(abs(times - expected) < .065)
    index = candidates[np.argmax(flux[candidates])]
    source = float(times[index])
    frame = round((source - old['sourceIn']) * 60)
    beats.append({'beat': beat, 'sourceSeconds': source, 'frame': frame,
                  'strength': float(flux[index]),
                  'frameErrorMs': round((frame / 60 - source + old['sourceIn']) * 1000, 4)})
for beat in old['beats'][32:]:
    beats.append({**beat, 'beat': beat['beat'] + 16, 'frame': beat['frame'] + 576})
closing = {**old['closing'], 'spliceFrame': 1728, 'spliceAtBeat': 48,
           'phraseSkipBeats': 96, 'titleFrame': old['closing']['titleFrame'] + 576,
           'subtitleFrame': old['closing']['subtitleFrame'] + 576,
           'method': 'One additional 16-beat phrase develops the six starting tools. Skip six complete phrases (96 beats / 57.6 seconds) into the recording\'s original ending; retain the measured final accents and natural decay.'}
result = {**old, 'beats': beats, 'closing': closing,
          'analysis': old['analysis'] + ' Extra body beats 32–47 measured at 1 ms hops with a 1024-sample Hann window, positive spectral flux and a ±65 ms search around the 100 BPM grid. No synthesized music or artificial ending.'}
target = root / 'docs/trailer-5.6.0/music-beats.json'
target.parent.mkdir(parents=True, exist_ok=True)
target.write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'beats': len(beats), 'titleSeconds': closing['titleFrame'] / 60,
                  'endSeconds': (closing['titleFrame'] + 288) / 60,
                  'maxAddedBeatErrorMs': max(abs(b['frameErrorMs']) for b in beats[32:48])}))
