import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { EndingTiming } from './trailer-ending.ts';

export function mixTrailer(
  ffmpeg: string,
  work: string,
  music: string,
  final: string,
  duration: number,
  sourceIn: number,
  intro: number,
  ending: EndingTiming,
) {
  const impact = ending.impactFrame / 60,
    musicHit = impact - intro;
  // One continuous excerpt crosses the title downbeat, then resolves into a soft tail.
  // Delayed echoes begin after the hit; there is no gap or overlapping dry downbeat.
  const stems = [
    '[1:a]highpass=f=55,asplit=2[fx][side]',
    '[2:a]volume=0.60,equalizer=f=1900:t=q:w=0.8:g=-2,asplit=2[main][hit]',
    `[main]atrim=duration=${musicHit + 0.8},asetpts=PTS-STARTPTS,afade=t=in:d=0.015,afade=t=out:st=${musicHit + 0.12}:d=0.68,adelay=${intro * 1000}:all=1[body]`,
    `[hit]atrim=start=${musicHit}:end=${musicHit + 0.8},asetpts=PTS-STARTPTS,afade=t=in:d=0.003,afade=t=out:st=0.12:d=0.68,aecho=1:0.22:170|330|590|970:0.32|0.22|0.13|0.07,afade=t=out:st=1.1:d=0.67,adelay=${impact * 1000 + 170}:all=1[resolve]`,
    '[body][resolve]amix=inputs=2:duration=longest:normalize=0,apad[song]',
    '[song][side]sidechaincompress=threshold=0.10:ratio=3:attack=3:release=110:makeup=1[ducked]',
    '[fx][ducked]amix=inputs=2:duration=first:normalize=0',
  ].join(';');
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
      'Isolated original game cues, industrial build and softer title hit, music EQ and brief sidechain ducking, continuous downbeat transition with echo resolution, measured constant gain, peak limiter',
    musicResolution: {
      impact,
      pauseSeconds: 0,
      sourceEnd: sourceIn + musicHit + 0.8,
      echoTailSeconds: 1.14,
    },
    musicGain: 0.6,
    masterGainDb: gainDb,
    inputLufs: Number(measured.input_i),
    inputTruePeak: Number(measured.input_tp),
    sampleRate: 48000,
  };
  writeFileSync(resolve(work, 'mix-audit.json'), JSON.stringify(audit, null, 2) + '\n');
  return audit;
}
