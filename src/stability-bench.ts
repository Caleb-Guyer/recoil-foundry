import './stability-bench.css';
import { Game } from './game.ts';
import { Renderer } from './render.ts';
import { Sound } from './audio.ts';
import { musicScene } from './music-score.ts';
import { DeathReplay, ReplayView } from './death-replay-view.ts';
import { TimingStats } from './performance-stats.ts';
import {
  STABILITY_CASES,
  startStabilityCase,
  stabilityInput,
  stabilityCounts,
  assertFiniteWorld,
} from './stability-scenarios.ts';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
$('diagnostics').innerHTML = `
<header><a href="./">← Game</a><h1>Stability test</h1><p>Isolated late-game presets. Contains encounter spoilers. No progress or settings are saved or uploaded.</p>
<div class="bench-controls"><label>Duration <select id="duration"><option value="30">Quick · 3 minutes</option><option value="120">Soak · 12 minutes</option></select></label><label><input id="reduced" type="checkbox"> Reduced effects</label><label><input id="record" type="checkbox" checked> Replay capture</label><label><input id="audio" type="checkbox" checked> Audio</label><button id="start">Start test</button><button id="pause-test" hidden>Pause</button><button id="stop" hidden>Stop</button><button id="export" disabled>Download report</button><button id="clip" disabled>Review clip</button></div>
<p id="status" role="status">Keep this tab visible. Results describe this browser and machine, not other hardware.</p><p id="environment"></p></header>
<main><canvas id="bench-canvas" aria-label="Automated isolated combat test"></canvas><pre id="report" aria-label="Performance measurements">Ready.</pre></main><dialog id="replay-dialog"><div id="replay-root"></div></dialog>`;
const game = new Game(),
  canvas = $<HTMLCanvasElement>('bench-canvas'),
  renderer = new Renderer(canvas, game),
  sound = new Sound(),
  replay = new DeathReplay();
sound.effectsVolume = sound.musicVolume = 0.25;
game.onSound = (kind) => sound.play(kind);
let view: ReplayView | null = null;
let completed = false;
let running = false,
  paused = false,
  last = 0,
  activeMs = 0,
  accumulator = 0,
  tick = 0,
  hudAt = 0;
let caseIndex = 0,
  secondsPerCase = 30,
  sceneMs = 0,
  retries = 0,
  clears = 0,
  droppedSteps = 0,
  portalCases = 0;
let record = true,
  options = { reduced: false, replay: true, audio: true };
let intervals = new TimingStats(),
  simulation = new TimingStats(),
  drawing = new TimingStats(),
  capture = new TimingStats(),
  transitions = new TimingStats();
let peaks = stabilityCounts(game);
let samples: {
  seconds: number;
  heapBytes: number | null;
  replayBytes: number;
  effects: number;
  music: number;
  visibility: DocumentVisibilityState;
  focused: boolean;
  audioState: AudioContextState | 'unavailable';
}[] = [];
let nextSample = 0;
const results: ReturnType<typeof result>[] = [],
  errors: string[] = [];
const environment = {
  userAgent: navigator.userAgent,
  logicalCores: navigator.hardwareConcurrency,
  deviceMemoryGiB: (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? null,
  viewport: { width: innerWidth, height: innerHeight, pixelRatio: devicePixelRatio },
  canvas: { width: canvas.width, height: canvas.height },
};
$('environment').textContent =
  `${environment.userAgent} · ${innerWidth}×${innerHeight} · ${environment.logicalCores} logical cores`;
function sample() {
  const heapBytes =
    (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ??
    null;
  samples.push({
    seconds: Math.round(activeMs / 1000),
    heapBytes,
    replayBytes: replay.buffer.bytes,
    effects: sound.voices,
    music: sound.music?.voiceCount ?? 0,
    visibility: document.visibilityState,
    focused: document.hasFocus(),
    audioState: sound.context?.state ?? 'unavailable',
  });
  if (samples.length > 180) samples.shift();
}
function result() {
  return {
    scenario: STABILITY_CASES[caseIndex].id,
    scenarioSeconds: Math.round(sceneMs / 100) / 10,
    measuredSeconds: Math.round(Math.max(0, sceneMs - 2000) / 100) / 10,
    fps: intervals.sum ? Math.round((intervals.count * 1_000_000) / intervals.sum) / 1000 : null,
    frameIntervals: intervals.report(),
    simulation: simulation.report(),
    render: drawing.report(),
    replayCapture: capture.report(),
    roomTransitions: transitions.report(),
    retries,
    clears,
    droppedSteps,
    portalPairs: portalCases,
    peaks,
  };
}
function report() {
  return {
    version: '2.96.0',
    generatedAt: new Date().toISOString(),
    status: running
      ? paused
        ? 'paused'
        : 'running'
      : errors.length
        ? 'failed'
        : completed
          ? 'complete'
          : 'stopped',
    environment,
    options,
    secondsPerCase,
    activeSeconds: Math.round(activeMs / 1000),
    methodology:
      'Real game simulation/render/audio/replay. Automatic preset retries after death/clear. First 2 seconds of each scenario excluded from timings. No CPU/GPU throttling. Heap is optional browser-reported JS heap, not total process memory.',
    results: running ? [...results, result()] : results,
    timingWarning:
      results.some((row) => row.frameIntervals.maxMs > 250) || (running && intervals.max > 250)
        ? 'Frame gaps over 250 ms recorded. Inspect frame delivery against work timings, focus, visibility and audio state before making performance claims. No slow samples were discarded.'
        : null,
    peaksSampledEveryMs: 1000,
    memorySamples: samples,
    errors,
    cleanup: running
      ? null
      : {
          replayFrames: replay.buffer.frames.length,
          replayBytes: replay.buffer.bytes,
          effects: sound.voices,
          music: sound.music?.voiceCount ?? 0,
        },
  };
}
function refresh() {
  $('report').textContent = JSON.stringify(report(), null, 2);
}
function resetRoom() {
  const before = performance.now();
  startStabilityCase(game, caseIndex);
  portalCases += Number(game.portals.linked);
  replay.reset();
  sound.resetMusic();
  renderer.reset();
  tick = 0;
  transitions.add(performance.now() - before);
}
function nextCase() {
  intervals = new TimingStats();
  simulation = new TimingStats();
  drawing = new TimingStats();
  capture = new TimingStats();
  transitions = new TimingStats();
  sceneMs = 0;
  retries = clears = droppedSteps = portalCases = 0;
  resetRoom();
  peaks = stabilityCounts(game);
  $('status').textContent =
    `${caseIndex + 1} / ${STABILITY_CASES.length} · ${STABILITY_CASES[caseIndex].name}`;
}
function finish(failed = false) {
  if (!running) return;
  if (failed || sceneMs < secondsPerCase * 1000) results.push(result());
  running = false;
  paused = false;
  if (record)
    replay.finish(canvas, game.elapsed, {
      player: renderer.toCanvas(game.player.position),
      label: 'Stability test capture',
    });
  game.setMode('paused');
  sound.silenceMusic();
  sound.updateTorch(false);
  for (const id of ['start', 'duration', 'reduced', 'record', 'audio'])
    $<HTMLButtonElement>(id).disabled = false;
  $('stop').hidden = $('pause-test').hidden = true;
  $<HTMLButtonElement>('export').disabled = false;
  $('status').textContent = failed
    ? 'Stopped after an error. Download the report.'
    : completed
      ? 'Test complete. Download the report or review the captured clip.'
      : 'Test stopped. Partial measurements are available.';
  refresh();
}
function setPaused(value: boolean) {
  if (!running || paused === value) return;
  paused = value;
  accumulator = 0;
  last = performance.now();
  $('pause-test').textContent = paused ? 'Resume' : 'Pause';
  if (paused) {
    sound.silenceMusic();
    sound.updateTorch(false);
    $('status').textContent = 'Paused. Resume with this tab visible; hidden time is excluded.';
  } else {
    sound.unlock();
    $('status').textContent = `${caseIndex + 1} / 6 · ${STABILITY_CASES[caseIndex].name}`;
  }
  refresh();
}
$('start').onclick = () => {
  view?.dispose();
  view = null;
  $<HTMLDialogElement>('replay-dialog').close();
  results.length = errors.length = samples.length = 0;
  options = {
    reduced: $<HTMLInputElement>('reduced').checked,
    replay: $<HTMLInputElement>('record').checked,
    audio: $<HTMLInputElement>('audio').checked,
  };
  record = options.replay;
  renderer.reduced = options.reduced;
  sound.enabled = options.audio;
  secondsPerCase = Number($<HTMLSelectElement>('duration').value) === 120 ? 120 : 30;
  sound.unlock();
  running = true;
  completed = false;
  paused = false;
  activeMs = accumulator = caseIndex = nextSample = 0;
  last = performance.now();
  environment.viewport = { width: innerWidth, height: innerHeight, pixelRatio: devicePixelRatio };
  environment.canvas = { width: canvas.width, height: canvas.height };
  for (const id of ['start', 'duration', 'reduced', 'record', 'audio', 'export', 'clip'])
    $<HTMLButtonElement>(id).disabled = true;
  $('stop').hidden = $('pause-test').hidden = false;
  $('pause-test').textContent = 'Pause';
  nextCase();
  sample();
  refresh();
};
$('pause-test').onclick = () => setPaused(!paused);
$('stop').onclick = () => finish();
$('export').onclick = () => {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(report(), null, 2)], { type: 'application/json' }),
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = 'recoil-foundry-stability.json';
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};
replay.onReady = () => {
  $<HTMLButtonElement>('clip').disabled = !replay.ready;
  refresh();
};
function closeReplay() {
  view?.dispose();
  view = null;
  $<HTMLDialogElement>('replay-dialog').close();
  $('clip').focus();
}
$('clip').onclick = () => {
  if (!replay.ready) return;
  view?.dispose();
  view = new ReplayView(replay, $('replay-root'));
  $('retry').textContent = 'Close';
  $('retry').onclick = closeReplay;
  $('back').onclick = closeReplay;
  $<HTMLDialogElement>('replay-dialog').showModal();
};
$('replay-dialog').addEventListener('cancel', (e) => {
  e.preventDefault();
  closeReplay();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) setPaused(true);
});
window.addEventListener('blur', () => setPaused(true));
window.addEventListener('pagehide', () => {
  if (running) finish();
  view?.dispose();
});
window.addEventListener('error', (e) => {
  errors.push(e.message);
  finish(true);
});
window.addEventListener('unhandledrejection', (e) => {
  errors.push(String(e.reason));
  finish(true);
});
let size = '';
new ResizeObserver(([entry]) => {
  const next = `${entry.contentRect.width}:${entry.contentRect.height}`;
  if (size && next !== size) setPaused(true);
  size = next;
  renderer.resize();
}).observe(canvas);
function frame(now: number) {
  const elapsed = last ? now - last : 0;
  last = now;
  if (running && !paused) {
    try {
      activeMs += elapsed;
      sceneMs += elapsed;
      const measured = sceneMs > 2000;
      if (measured) intervals.add(elapsed);
      let before = performance.now();
      droppedSteps += Math.floor(Math.max(0, elapsed / 1000 - 0.1) * 60);
      accumulator += Math.min(elapsed / 1000, 0.1);
      let steps = 0;
      while (accumulator >= 1 / 60 && steps < 5) {
        game.tick(1 / 60, stabilityInput(game, tick++));
        accumulator -= 1 / 60;
        steps++;
      }
      if (steps === 5) {
        droppedSteps += Math.floor(accumulator * 60);
        accumulator = 0;
      }
      if (measured) simulation.add(performance.now() - before);
      sound.updateMusic(musicScene(game), true);
      sound.updateTorch(
        game.mode === 'playing' && game.torch.active && game.hitStop <= 0,
        game.torch.heat,
      );
      before = performance.now();
      renderer.draw(now);
      if (measured) drawing.add(performance.now() - before);
      before = performance.now();
      if (record && game.mode === 'playing') replay.capture(canvas, game.elapsed);
      if (measured) capture.add(performance.now() - before);
      if (now - hudAt > 1000) {
        hudAt = now;
        assertFiniteWorld(game);
        const counts = stabilityCounts(game);
        for (const key of Object.keys(counts) as (keyof typeof counts)[])
          peaks[key] = Math.max(peaks[key], counts[key]);
        refresh();
      }
      if (activeMs >= nextSample) {
        sample();
        nextSample = activeMs + 5000;
      }
      if (sceneMs >= secondsPerCase * 1000) {
        results.push(result());
        if (caseIndex === STABILITY_CASES.length - 1) {
          completed = true;
          finish();
        } else {
          caseIndex++;
          nextCase();
        }
      } else if (game.mode === 'dead' || game.mode === 'won' || game.clear) {
        if (game.mode === 'dead') retries++;
        else clears++;
        resetRoom();
      }
    } catch (error) {
      errors.push(String(error));
      finish(true);
    }
  } else if (now - hudAt > 2000 && !running && results.length) {
    hudAt = now;
    refresh();
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
