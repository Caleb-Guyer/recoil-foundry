import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

export function mixTrailer(
  ffmpeg: string,
  work: string,
  music: string,
  final: string,
  duration: number,
  sourceIn: number,
  intro: number,
) {
  const stems = `[1:a]highpass=f=55,asplit=2[fx][side];[2:a]atrim=duration=${duration - intro},asetpts=PTS-STARTPTS,volume=0.60,equalizer=f=1900:t=q:w=0.8:g=-2,afade=t=in:d=0.015,afade=t=out:st=${duration - intro - 0.65}:d=0.65,adelay=${intro * 1000}:all=1[song];[song][side]sidechaincompress=threshold=0.10:ratio=3:attack=3:release=110:makeup=1[ducked];[fx][ducked]amix=inputs=2:duration=first:normalize=0`;
  const inputs = [
    '-i',
    resolve(work, 'picture.mp4'),
    '-i',
    resolve(work, 'effects.wav'),
    '-ss',
    String(sourceIn),
    '-i',
    music,
  ];
  const analysis = spawnSync(
    ffmpeg,
    [
      '-hide_banner',
      ...inputs,
      '-filter_complex',
      `${stems},loudnorm=I=-14:TP=-2:LRA=9:print_format=json[a]`,
      '-map',
      '[a]',
      '-f',
      'null',
      'NUL',
    ],
    { encoding: 'utf8' },
  );
  if (analysis.status !== 0) throw new Error(analysis.stderr);
  const result = analysis.stderr.match(/\{\s*"input_i"[\s\S]*?\}/)?.[0];
  if (!result) throw new Error('Missing audio loudness measurement');
  const measured = JSON.parse(result);
  // Constant gain preserves the quiet intro. Only the highest transient peaks are limited.
  const gainDb = Math.min(6, -14 - Number(measured.input_i));
  const graph = `${stems},volume=${gainDb}dB,alimiter=limit=0.79:level=false:latency=true,aresample=48000[a]`;
  const mux = spawnSync(
    ffmpeg,
    [
      '-hide_banner',
      '-y',
      ...inputs,
      '-filter_complex',
      graph,
      '-map',
      '0:v:0',
      '-map',
      '[a]',
      '-c:v',
      'copy',
      '-c:a',
      'aac',
      '-b:a',
      '384k',
      '-ar',
      '48000',
      '-ac',
      '2',
      '-t',
      String(duration),
      '-movflags',
      '+faststart',
      '-metadata',
      'title=Recoil Foundry | Official Launch Trailer',
      '-metadata',
      'comment=Music: Resonance by Scott Buckley, CC BY 4.0, www.scottbuckley.com.au. Edited excerpt with game sound effects.',
      final,
    ],
    { encoding: 'utf8' },
  );
  if (mux.status !== 0) throw new Error(mux.stderr);
  const audit = {
    method:
      'Isolated original game cues, transient shaping, distinct beam layer, music EQ and brief sidechain ducking, measured constant gain, peak limiter',
    musicGain: 0.6,
    masterGainDb: gainDb,
    inputLufs: Number(measured.input_i),
    inputTruePeak: Number(measured.input_tp),
    sampleRate: 48000,
  };
  writeFileSync(resolve(work, 'mix-audit.json'), JSON.stringify(audit, null, 2) + '\n');
  return audit;
}
