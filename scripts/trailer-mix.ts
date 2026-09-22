import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { EndingTiming } from './trailer-ending.ts';
import type { ClosingMusic } from './trailer-edit.ts';

export function mixTrailer(
  ffmpeg: string,
  work: string,
  music: string,
  final: string,
  duration: number,
  sourceIn: number,
  intro: number,
  ending: EndingTiming,
  closing: ClosingMusic,
) {
  const splice = closing.spliceFrame / 60;
  // Skip seven complete musical phrases into the recording's actual closing passage.
  // The short overlap precedes the aligned barline, preserving the final accents' timing.
  const stems = [
    '[1:a]highpass=f=55,asplit=2[fx][side]',
    '[2:a]volume=0.60,equalizer=f=1900:t=q:w=0.8:g=-2,asplit=2[main][closing]',
    `[main]atrim=duration=${splice},asetpts=PTS-STARTPTS,afade=t=in:d=0.015[body]`,
    `[closing]atrim=start=${closing.sourceIn - sourceIn - closing.crossfadeSeconds}:end=${closing.sourceOut - sourceIn},asetpts=PTS-STARTPTS[resolve]`,
    `[body][resolve]acrossfade=d=${closing.crossfadeSeconds}:c1=tri:c2=tri,adelay=${intro * 1000}:all=1,apad[song]`,
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
      'Original game cues with space for the closing fill; phrase-aligned edit into the original recorded ending, two title accents and natural ring-out; music EQ, brief ducking, measured constant gain and peak limiter',
    musicResolution: {
      impact: ending.impactFrame / 60,
      subtitle: ending.subtitleFrame / 60,
      splice: intro + splice,
      pauseSeconds: 0,
      sourceEnd: closing.sourceOut,
      addedEcho: false,
      naturalEnding: true,
      titleFrameErrorMs: closing.titleFrameErrorMs,
      subtitleFrameErrorMs: closing.subtitleFrameErrorMs,
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
