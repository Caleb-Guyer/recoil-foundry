import './style.css';
import { Game } from './game.ts';
import type { Input } from './game.ts';
import { Renderer } from './render.ts';
import { Sound } from './audio.ts';
import { musicScene } from './music-score.ts';
import { AREAS } from './areas.ts';
import { MODS, loadCheckpoint, STAGES, modPathLabel, buildPath, PATH_NAMES } from './rules.ts';
import type { Checkpoint, Mod } from './rules.ts';
import {
  VICTORIES_KEY,
  PRACTICE_BOSSES,
  loadEncounters,
  testEncounterFromUrl,
} from './practice.ts';
import type { Encounter } from './practice.ts';
import {
  DAILY_BESTS_KEY,
  dailyFromSeed,
  dailyFromUrl,
  dailyLink,
  formatDailyTime,
  isUnsupportedDailySeed,
  loadDailyBests,
  recordDailyWin,
  todayDaily,
} from './daily.ts';
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
function read(key: string): unknown {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null');
  } catch {
    return null;
  }
}
function write(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    $('save-status').textContent = 'Saving unavailable in this browser.';
    return false;
  }
}
const storedCheckpoint = loadCheckpoint(read('rf-checkpoint-v3'));
let unavailableDailySave = !!storedCheckpoint && isUnsupportedDailySeed(storedCheckpoint.seed);
let checkpoint = unavailableDailySave ? null : storedCheckpoint;
const encounters = loadEncounters(read(VICTORIES_KEY));
document.getElementById('app')!.innerHTML = `
<main id="arena">
 <canvas id="game" tabindex="0" aria-label="Recoil Foundry. A and D to move. Space to jump. Mouse to aim and fire. Shoot down in the air to climb."></canvas>
 <div class="hud"><progress id="health" max="100" value="100" aria-label="Health"></progress><div class="run-info"><span id="stage">01 / ${String(STAGES).padStart(2, '0')}</span><button id="pause" class="icon" aria-label="Pause" title="Pause · Esc"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7 5v10M13 5v10"/></svg></button></div></div>
 <section id="title-screen">
  <div class="title-content"><h1><span>RECOIL</span><small>FOUNDRY</small></h1>
   <button id="play" class="primary">Play <span aria-hidden="true">↗</span></button>
   <div class="title-actions"><button id="daily" class="quiet">Daily run</button><button id="continue" class="quiet" ${checkpoint ? '' : 'hidden'}>Continue</button><button id="practice" class="quiet" hidden>Practice</button></div>
   <p class="title-controls"><kbd>A</kbd><kbd>D</kbd> move <i>·</i> <kbd>Space</kbd> jump <i>·</i> Mouse fire</p>
   <p id="title-hint" class="recoil-hint">Shoot down. Go up.</p>
  </div><button id="settings" class="quiet title-settings">Settings</button>
 </section>
 <div class="touch-controls" aria-label="Touch controls"><div><button data-touch="left" aria-label="Move left">←</button><button data-touch="right" aria-label="Move right">→</button></div><div><button id="portal-touch" aria-label="Place portal: select, then tap a surface" aria-pressed="false" hidden>◎</button><button data-touch="jump" aria-label="Jump">↑</button></div></div>
</main><dialog id="modal" aria-labelledby="dialog-title"><div id="dialog-content"></div></dialog><span id="save-status" class="sr-only" role="status"></span>`;
const game = new Game(),
  canvas = $<HTMLCanvasElement>('game'),
  renderer = new Renderer(canvas, game),
  sound = new Sound();
const rawSettings = read('rf-settings-v2');
const prefs = (rawSettings && typeof rawSettings === 'object' ? rawSettings : {}) as {
  sound?: boolean;
  music?: boolean;
  reduced?: boolean;
};
sound.enabled = prefs.sound !== false;
sound.musicEnabled = prefs.music !== false;
renderer.reduced =
  typeof prefs.reduced === 'boolean'
    ? prefs.reduced
    : matchMedia('(prefers-reduced-motion: reduce)').matches;
const modal = $<HTMLDialogElement>('modal'),
  keys = new Set<string>(),
  touch = { left: false, right: false, jump: false },
  pointer = { x: 500, y: 400 };
let portalTouch = false;
let mouseButtons = 0,
  touchAim = new Set<number>(),
  dialogKind = '',
  lastTime = performance.now(),
  accumulator = 0,
  hudAt = 0,
  shownRoom = '',
  pageActive = !document.hidden;
const input: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: false,
  fire: false,
  aim: { x: 600, y: 550 },
};
const entryUrl = new URL(location.href);
let linkedTest = testEncounterFromUrl(entryUrl);
let linkedDaily = dailyFromUrl(entryUrl);
let invalidDailyLink = entryUrl.searchParams.has('daily') && !linkedDaily;
let seedParam = entryUrl.searchParams.has('daily')
  ? undefined
  : entryUrl.searchParams.get('seed')?.slice(0, 40);
let activeDaily = dailyFromSeed(game.seed);
let dailyResult: { best?: number; newBest: boolean; saved: boolean } | null = null;

function updateTitle() {
  $('play').innerHTML =
    `${linkedTest ? 'Test ' + PRACTICE_BOSSES[linkedTest.kind].name.replace(/^The /, 'the ') : linkedDaily ? 'Play daily' : 'Play'} <span aria-hidden="true">↗</span>`;
  $('daily').textContent = linkedDaily ? 'Random run' : 'Daily run';
  $('daily').title = linkedDaily
    ? 'Start a fresh random run'
    : "Today's shared challenge · resets at midnight UTC";
  $('continue').hidden = !checkpoint;
  $('practice').hidden = encounters.length === 0;
  $('continue').textContent =
    checkpoint && dailyFromSeed(checkpoint.seed) ? 'Continue daily' : 'Continue';
  $('title-hint').textContent = linkedTest
    ? `Full health. ${PRACTICE_BOSSES[linkedTest.kind].stage} upgrades. R to retry.`
    : linkedDaily
      ? `Daily · ${linkedDaily.date}`
      : invalidDailyLink
        ? 'Challenge link unavailable. Start a fresh run.'
        : unavailableDailySave
          ? 'Saved daily unavailable. Start a new daily.'
          : 'Shoot down. Go up.';
}
function clearInput() {
  keys.clear();
  mouseButtons = 0;
  touchAim.clear();
  touch.left = touch.right = touch.jump = false;
  input.left = input.right = input.jump = input.jumpHeld = input.fire = false;
  input.firePressed = false;
  input.portal = undefined;
  portalTouch = false;
  $('portal-touch').setAttribute('aria-pressed', 'false');
}
function closeDialog() {
  if (modal.open) modal.close();
  dialogKind = '';
  clearInput();
}
function persistSettings() {
  write('rf-settings-v2', {
    sound: sound.enabled,
    music: sound.musicEnabled,
    reduced: renderer.reduced,
  });
}
function updateMusic(active = pageActive && document.hasFocus() && !document.hidden) {
  sound.updateMusic(musicScene(game), active);
}
function newSeed() {
  return crypto.getRandomValues(new Uint32Array(1))[0].toString(36).toUpperCase();
}
function start(save?: Checkpoint, retry = false, seedOverride?: string) {
  if (retry && game.practice) {
    startPractice(game.practice);
    return;
  }
  linkedTest = null;
  sound.unlock();
  sound.resetMusic();
  closeDialog();
  const seed =
    save?.seed ??
    (retry ? game.seed : (seedOverride ?? linkedDaily?.seed ?? seedParam ?? newSeed()));
  activeDaily = dailyFromSeed(seed);
  linkedDaily = activeDaily;
  invalidDailyLink = false;
  unavailableDailySave = false;
  if (activeDaily) {
    seedParam = undefined;
    history.replaceState(null, '', dailyLink(activeDaily, location.href));
  } else {
    const url = new URL(location.href);
    url.searchParams.delete('test');
    url.searchParams.delete('daily');
    url.searchParams.delete('dv');
    if (seedParam !== seed) {
      seedParam = undefined;
      url.searchParams.delete('seed');
    }
    history.replaceState(null, '', url);
  }
  dailyResult = null;
  game.start(seed, save);
  renderer.reset();
  pointer.x = canvas.clientWidth * 0.55;
  pointer.y = canvas.clientHeight * 0.6;
  canvas.focus();
}
function startPractice(encounter: Encounter) {
  if (
    ![...encounters, ...(linkedTest ? [linkedTest] : [])].some(
      (record) => record.kind === encounter.kind && record.seed === encounter.seed,
    )
  )
    return;
  sound.unlock();
  sound.resetMusic();
  closeDialog();
  activeDaily = null;
  dailyResult = null;
  game.startPractice(encounter);
  renderer.reset();
  pointer.x = canvas.clientWidth * 0.55;
  pointer.y = canvas.clientHeight * 0.6;
  canvas.focus();
}
function menu() {
  closeDialog();
  game.setMode('title');
}
function backFromPractice() {
  if (game.mode === 'dead' || game.mode === 'won') showDialog('result');
  else if (game.mode === 'paused') showDialog('pause');
  else resume();
}
game.onCheckpoint = (s) => {
  if (game.practice) return;
  checkpoint = s;
  write('rf-checkpoint-v3', s);
};
game.onSound = (kind) => sound.play(kind);
game.onBossDefeated = (kind) => {
  const victory = loadEncounters([{ kind, seed: game.seed }])[0];
  if (!victory || encounters.some((record) => record.kind === kind)) return;
  encounters.push(victory);
  write(VICTORIES_KEY, encounters);
  updateTitle();
};
game.onChange = () => {
  updateMusic();
  const room = game.seed + ':' + game.stage + ':' + game.level.id;
  if (room !== shownRoom) {
    renderer.reset();
    shownRoom = room;
  }
  document.body.dataset.mode = game.mode;
  $('title-screen').hidden = game.mode !== 'title';
  $('stage').textContent = game.practice
    ? 'PRACTICE'
    : (activeDaily ? 'DAILY · ' : '') +
      (game.escape
        ? 'ESCAPE'
        : game.detour
          ? 'CHALLENGE'
          : String(game.stage + 1).padStart(2, '0') + ' / ' + String(STAGES).padStart(2, '0'));
  $('stage').title = game.practice
    ? PRACTICE_BOSSES[game.practice.kind].name
    : `${activeDaily ? 'Daily · ' + activeDaily.date + ' · ' : ''}${AREAS[game.level.area].name} · ${game.level.name}`;
  updateTitle();
  if (game.mode === 'upgrade') showDialog('upgrade');
  if (game.mode === 'dead' || game.mode === 'won') showDialog('result');
};
function modMark(mod: Mod) {
  const paths: Record<string, string> = {
    heavy: 'M10 24h34M34 17l10 7-10 7',
    spread: 'M9 24h12M27 24h18M27 13l16-5M27 35l16 5',
    rapid: 'M8 24h8M24 24h8M40 24h8',
    bounce: 'M10 38l18-28 18 28M20 10h8v8',
    pierce: 'M8 24h42M22 10v28M36 10v28',
    split: 'M8 24h17M25 24l21-14M25 24h21M25 24l21 14',
    air: 'M12 34l14-22 14 22M19 12h7v8M9 40h34',
    kick: 'M45 24H10M20 14L10 24l10 10',
    heal: 'M26 10v28M12 24h28',
    light: 'M10 33l14-20M24 33l14-20M38 33l10-14',
    burst: 'M8 16h10M22 24h10M36 32h10M46 12v6',
    shellshock: 'M8 30l12-12 12 12-12 12zM28 8l2 7M39 13l-5 6M43 26l-8 1M7 8l5 5',
    'blast-surf': 'M8 36l12-8 12 8M20 28V8m-7 8 7-8 7 8M34 25l8 11 5-3',
    aftershock: 'M26 14a10 10 0 1 0 0 20M26 7a17 17 0 1 0 0 34M33 16l8 8-8 8M41 24H26',
    'chain-reaction': 'M9 24h8m14 0h8M4 19h10v10H4zM19 17h10v14H19zM36 19h10v10H36z',
    fold: 'M17 8C3 8 3 40 17 40M17 8c14 0 14 32 0 32M35 8c14 0 14 32 0 32M35 8c-14 0-14 32 0 32',
    backblast: 'M27 24h21M39 17l9 7-9 7M21 24L8 12M21 24H5M21 24L8 36',
    banker: 'M8 37l15-25 15 25 10-17M17 12h6v8M40 20h8v8',
    landing: 'M12 8v19M6 20l6 7 6-7M6 36h18M30 24h19M41 17l8 7-8 7',
    crossfire: 'M8 24h40M8 24L44 9M8 24l36 15',
    bloom: 'M28 9v30M15 16l26 16M15 32l26-16M24 20h8v8h-8z',
    deadeye: 'M8 24h40M28 7v10M28 31v10M18 14h20v20H18z',
    execute: 'M10 10v28h12M28 10v28M36 24h14M43 17l7 7-7 7',
    rewire: 'M12 16C20 3 38 6 43 18M36 17l7 1 1-8M44 32C36 45 18 42 13 30M20 31l-7-1-1 8',
    slingshot: 'M12 9c-9 0-9 30 0 30M12 9c9 0 9 30 0 30M23 24h24M37 14l10 10-10 10',
    redline: 'M8 34a20 20 0 0 1 40 0M28 34l13-18M10 27l5 2M20 15l2 6M34 15l-2 6',
    breach: 'M30 9v30M30 24h18M22 24H7M16 17l-7 7 7 7M10 10l5 3M10 38l5-3',
    shatter: 'M34 7v34M8 24h26M32 24L14 9M32 24L9 16M32 24L9 32M32 24L14 39',
    convergence: 'M7 24l18-14 23 23M7 24h41M7 24l18 14L48 15',
    deadlock: 'M16 12h24v24H16zM8 24h12M36 24h12M24 20h8v8h-8zM24 7h8M24 41h8',
    shockfront: 'M26 17a7 7 0 1 0 0 14M26 9a15 15 0 1 0 0 30M34 24h14M41 17l7 7-7 7',
    backfire: 'M6 24h44M16 14L6 24l10 10M40 14l10 10-10 10',
  };
  return (
    '<svg class="mod-mark" viewBox="0 0 56 48" aria-hidden="true"><path d="' +
    paths[mod.mark] +
    '"/></svg>'
  );
}
function showDialog(kind: string) {
  if (game.mode === 'playing') game.setMode('paused');
  clearInput();
  dialogKind = kind;
  const singleUpgrade = kind === 'upgrade' && game.offers.length === 1;
  modal.classList.toggle('single-upgrade', singleUpgrade);
  modal.classList.toggle('practice-dialog', kind === 'practice');
  const content = $('dialog-content');
  if (kind === 'practice') {
    content.innerHTML =
      '<h2 id="dialog-title">Practice.</h2><p class="practice-note">Full health. Preset gun.</p><div class="practice-list">' +
      encounters
        .map(
          (record) =>
            '<button class="practice-fight" data-boss="' +
            record.kind +
            '"><span>' +
            PRACTICE_BOSSES[record.kind].name +
            '</span><span aria-hidden="true">↗</span></button>',
        )
        .join('') +
      '</div><div class="actions"><button id="practice-back" class="quiet">Back</button></div>';
    content.querySelectorAll<HTMLButtonElement>('[data-boss]').forEach((button) => {
      button.onclick = () => {
        const encounter = encounters.find((record) => record.kind === button.dataset.boss);
        if (encounter) startPractice(encounter);
      };
    });
    $('practice-back').onclick = backFromPractice;
  } else if (kind === 'upgrade') {
    content.innerHTML =
      '<p class="eyebrow">' +
      (activeDaily ? 'DAILY · ' : '') +
      (game.detour
        ? 'BONUS UPGRADE · NO HEALING'
        : game.enteringDetour
          ? 'ROOM CLEAR · CHALLENGE NEXT'
          : 'ROOM CLEAR') +
      '</p><h2 id="dialog-title">' +
      (singleUpgrade ? 'Next upgrade.' : 'Make it kick.') +
      '</h2><div class="choices">' +
      game.offers
        .map(
          (m, i) =>
            '<button class="mod" data-mod="' +
            m.id +
            '"><span class="mod-top">' +
            modMark(m) +
            '<kbd>' +
            (i + 1) +
            '</kbd></span><strong>' +
            m.name +
            '</strong><span class="mod-copy">' +
            m.description +
            '</span>' +
            (modPathLabel(m.id) ? '<span class="mod-path">' + modPathLabel(m.id) + '</span>' : '') +
            '</button>',
        )
        .join('') +
      '</div>';
    content.querySelectorAll<HTMLButtonElement>('[data-mod]').forEach(
      (b) =>
        (b.onclick = () => {
          const id = b.dataset.mod!;
          sound.unlock();
          closeDialog();
          game.chooseMod(id);
          renderer.reset();
          canvas.focus();
        }),
    );
  } else if (kind === 'result' && game.practice) {
    const win = game.mode === 'won';
    content.innerHTML =
      '<p class="eyebrow">PRACTICE · ' +
      PRACTICE_BOSSES[game.practice.kind].name +
      '</p><h2 id="dialog-title">' +
      (win ? 'Fight cleared.' : 'Try again.') +
      '</h2><p class="result-line">' +
      formatTime(game.elapsed) +
      '</p><div class="actions"><button id="retry" class="primary" title="Retry · R">Retry ↗</button><button id="choose-fight" class="quiet"' +
      (encounters.length ? '' : ' hidden') +
      '>Choose fight</button><button id="menu" class="quiet">Menu</button></div>';
    $('retry').onclick = () => start(undefined, true);
    $('choose-fight').onclick = () => showDialog('practice');
    $('menu').onclick = menu;
  } else if (kind === 'result') {
    const win = game.mode === 'won';
    if (activeDaily && !dailyResult) {
      const stored = read(DAILY_BESTS_KEY);
      const record = win ? recordDailyWin(stored, activeDaily, game.elapsed) : null;
      dailyResult = record
        ? {
            best: record.best,
            newBest: record.newBest,
            saved: !record.newBest || write(DAILY_BESTS_KEY, record.bests),
          }
        : { best: loadDailyBests(stored)[activeDaily.seed], newBest: false, saved: true };
    }
    content.innerHTML =
      '<p class="eyebrow">' +
      (activeDaily
        ? 'DAILY · ' + activeDaily.date
        : win
          ? 'ALL ' +
            STAGES +
            ' ROOMS' +
            (game.detours.length ? ' · ' + game.detours.length + ' CHALLENGES' : '')
          : game.detour
            ? 'CHALLENGE'
            : 'ROOM ' + String(game.stage + 1).padStart(2, '0')) +
      '</p><h2 id="dialog-title">' +
      (win ? 'Clean escape.' : 'One more run?') +
      '</h2><p class="result-line">' +
      (activeDaily ? formatDailyTime(game.elapsed * 100) : formatTime(game.elapsed)) +
      ' <span>·</span> ' +
      game.kills +
      ' kills</p>' +
      (dailyResult?.best !== undefined
        ? '<p class="daily-best">' +
          (!dailyResult.saved
            ? 'Time not saved · '
            : dailyResult.newBest
              ? 'New best · '
              : 'Personal best · ') +
          formatDailyTime(dailyResult.best) +
          (!dailyResult.saved ? '<span>Saving unavailable in this browser.</span>' : '') +
          '</p>'
        : '') +
      '<div class="actions"><button id="retry" class="primary">Again ↗</button><button id="menu" class="quiet">Menu</button>' +
      (activeDaily ? '<button id="share" class="quiet">Copy challenge link</button>' : '') +
      '</div>' +
      (activeDaily
        ? '<div id="share-fallback" class="share-fallback" hidden><label for="challenge-link">Copy this link</label><input id="challenge-link" class="share-link" readonly spellcheck="false" /></div><span id="share-status" class="sr-only" role="status"></span>'
        : '');
    if (activeDaily) {
      const link = dailyLink(activeDaily, location.href);
      $('share').onclick = async () => {
        const button = $<HTMLButtonElement>('share');
        button.disabled = true;
        try {
          await navigator.clipboard.writeText(link);
          if (!button.isConnected) return;
          button.textContent = 'Copied';
          $('share-status').textContent = 'Challenge link copied.';
        } catch {
          if (!button.isConnected) return;
          button.textContent = 'Copy challenge link';
          $('share-fallback').hidden = false;
          const field = $<HTMLInputElement>('challenge-link');
          field.value = link;
          field.focus();
          field.select();
          $('share-status').textContent = 'Select and copy the challenge link below.';
        } finally {
          button.disabled = false;
        }
      };
    }
    $('retry').onclick = () => start(undefined, true);
    $('menu').onclick = menu;
  } else {
    const paused = game.mode === 'paused';
    content.innerHTML =
      (paused && game.practice
        ? '<p class="eyebrow">PRACTICE · ' + PRACTICE_BOSSES[game.practice.kind].name + '</p>'
        : paused && activeDaily
          ? '<p class="eyebrow">DAILY · ' + activeDaily.date + '</p>'
          : '') +
      '<h2 id="dialog-title">' +
      (paused ? 'Paused.' : 'Settings.') +
      '</h2>' +
      '<div class="settings-list"><label>Sound<input id="sound" type="checkbox" ' +
      (sound.enabled ? 'checked' : '') +
      ' /></label><label>Music<input id="music" type="checkbox" ' +
      (sound.musicEnabled ? 'checked' : '') +
      ' /></label><label>Screen shake<input id="shake" type="checkbox" ' +
      (!renderer.reduced ? 'checked' : '') +
      ' /></label></div>' +
      '<div class="controls-copy">' +
      (game.portals.equipped
        ? game.mods.includes('rewire')
          ? '<p>Right-click or <kbd>E</kbd> to place or move either portal.</p>'
          : game.portals.canPlace
            ? '<p>Right-click or <kbd>E</kbd> on two surfaces. One portal pair per room.</p>'
            : '<p>Portals are fixed until the next room.</p>'
        : '') +
      '<p><kbd>A</kbd> <kbd>D</kbd> Move <span>·</span> <kbd>Space</kbd> Jump</p><p>Mouse to aim and fire. Shoot down in the air to climb.</p><p>' +
      (game.practice
        ? 'Defeat the boss. Press R to retry.'
        : game.escape
          ? 'Reach the extraction lift.'
          : game.detour
            ? 'Survive for an extra upgrade, without a health refill.'
            : game.canDetour
              ? 'After clearing, the upper door offers an optional challenge.'
              : 'Clear the room, then leave through the right door.') +
      '</p></div>' +
      (paused && game.mods.length
        ? '<details class="build"><summary>Your gun' +
          (buildPath(game.mods) ? ' · ' + PATH_NAMES[buildPath(game.mods)!] : '') +
          '</summary><ul>' +
          game.mods.map((id) => '<li>' + MODS.find((m) => m.id === id)!.name + '</li>').join('') +
          '</ul></details>'
        : '') +
      '<div class="actions"><button id="back" class="primary">' +
      (paused ? 'Resume' : 'Back') +
      '</button>' +
      (paused && game.practice
        ? '<button id="retry" class="quiet">Retry</button><button id="choose-fight" class="quiet"' +
          (encounters.length ? '' : ' hidden') +
          '>Choose fight</button>'
        : '') +
      (paused ? '<button id="menu" class="quiet">Menu</button>' : '') +
      '</div>';
    $<HTMLInputElement>('sound').onchange = (e) => {
      sound.enabled = (e.target as HTMLInputElement).checked;
      if (sound.enabled) sound.unlock();
      persistSettings();
      updateMusic();
    };
    $<HTMLInputElement>('music').onchange = (e) => {
      sound.musicEnabled = (e.target as HTMLInputElement).checked;
      if (sound.musicEnabled) sound.unlock();
      persistSettings();
      updateMusic();
    };
    $<HTMLInputElement>('shake').onchange = (e) => {
      renderer.reduced = !(e.target as HTMLInputElement).checked;
      persistSettings();
    };
    $('back').onclick = resume;
    if (paused && game.practice) {
      $('retry').onclick = () => start(undefined, true);
      $('choose-fight').onclick = () => showDialog('practice');
    }
    if (paused) $('menu').onclick = menu;
  }
  if (!modal.open) modal.showModal();
  if (kind === 'practice' || (kind === 'result' && game.practice))
    content.querySelector<HTMLButtonElement>('button')?.focus();
}
function resume() {
  sound.unlock();
  closeDialog();
  if (game.mode === 'paused') game.setMode('playing');
  canvas.focus();
}
function pause() {
  if (game.mode === 'playing') showDialog('pause');
  else if (game.mode === 'paused') resume();
}
function formatTime(n: number) {
  return Math.floor(n / 60) + ':' + String(Math.floor(n % 60)).padStart(2, '0');
}
$('play').onclick = () => (linkedTest ? startPractice(linkedTest) : start());
$('daily').onclick = () => {
  if (linkedDaily) {
    linkedDaily = null;
    seedParam = undefined;
    start();
  } else start(undefined, false, todayDaily().seed);
};
$('continue').onclick = () => {
  if (checkpoint) start(checkpoint);
};
$('settings').onclick = () => showDialog('settings');
$('practice').onclick = () => {
  if (encounters.length) showDialog('practice');
};
$('pause').onclick = pause;
modal.addEventListener('cancel', (e) => {
  e.preventDefault();
  if (dialogKind === 'practice') {
    backFromPractice();
    return;
  }
  if (game.mode === 'upgrade' || game.mode === 'dead' || game.mode === 'won') return;
  resume();
});
window.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey || e.target instanceof HTMLInputElement) return;
  if (
    game.mode === 'playing' &&
    ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)
  )
    e.preventDefault();
  if (e.repeat) return;
  if (e.code === 'KeyR' && game.practice && game.mode !== 'title' && dialogKind !== 'practice') {
    e.preventDefault();
    start(undefined, true);
    return;
  }
  if (game.mode === 'upgrade') {
    const i = Number(e.key) - 1;
    if (i >= 0 && i < game.offers.length) {
      const id = game.offers[i].id;
      sound.unlock();
      closeDialog();
      game.chooseMod(id);
      renderer.reset();
      canvas.focus();
    }
    return;
  }
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (!modal.open || e.code === 'KeyP') {
      e.preventDefault();
      pause();
    }
    return;
  }
  if (game.mode !== 'playing') return;
  keys.add(e.code);
  if (e.code === 'KeyE') input.portal = renderer.toWorld(pointer.x, pointer.y);
  if (['Space', 'KeyW', 'ArrowUp'].includes(e.code)) input.jump = true;
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
function updatePointer(e: PointerEvent) {
  const r = canvas.getBoundingClientRect();
  pointer.x = e.clientX - r.left;
  pointer.y = e.clientY - r.top;
}
canvas.onpointerdown = (e) => {
  if (game.mode !== 'playing') return;
  sound.unlock();
  canvas.focus();
  canvas.setPointerCapture(e.pointerId);
  updatePointer(e);
  if (e.button === 2 || (e.pointerType === 'touch' && portalTouch)) {
    input.portal = renderer.toWorld(pointer.x, pointer.y);
    portalTouch = false;
    $('portal-touch').setAttribute('aria-pressed', 'false');
    return;
  }
  if (e.pointerType === 'touch' || e.button === 0) input.firePressed = true;
  if (e.pointerType === 'touch') touchAim.add(e.pointerId);
  else mouseButtons = e.buttons;
};
canvas.onpointermove = (e) => {
  updatePointer(e);
  if (e.pointerType !== 'touch') mouseButtons = e.buttons;
};
window.addEventListener('pointerup', (e) => {
  if (e.pointerType === 'touch') touchAim.delete(e.pointerId);
  else mouseButtons = e.buttons;
});
canvas.onpointercancel = (e) => {
  touchAim.delete(e.pointerId);
  mouseButtons = 0;
};
canvas.oncontextmenu = (e) => e.preventDefault();
$('portal-touch').onpointerdown = (e) => {
  if (game.mode !== 'playing' || !game.portals.canPlace) return;
  e.preventDefault();
  portalTouch = !portalTouch;
  $('portal-touch').setAttribute('aria-pressed', String(portalTouch));
};
document.querySelectorAll<HTMLButtonElement>('[data-touch]').forEach((b) => {
  b.onpointerdown = (e) => {
    if (game.mode !== 'playing') return;
    e.preventDefault();
    b.setPointerCapture(e.pointerId);
    const action = b.dataset.touch as keyof typeof touch;
    touch[action] = true;
    if (action === 'jump') input.jump = true;
  };
  const release = () => (touch[b.dataset.touch as keyof typeof touch] = false);
  b.onpointerup = release;
  b.onpointercancel = release;
});
function loseFocus() {
  pageActive = false;
  updateMusic(false);
  clearInput();
  if (game.mode === 'playing') showDialog('pause');
}
window.addEventListener('blur', loseFocus);
window.addEventListener('pagehide', loseFocus);
function regainFocus() {
  pageActive = document.hasFocus() && !document.hidden;
  updateMusic();
}
window.addEventListener('focus', regainFocus);
window.addEventListener('pageshow', regainFocus);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) loseFocus();
  else regainFocus();
});
new ResizeObserver(() => renderer.resize()).observe($('arena'));
function frame(now: number) {
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  if (game.mode === 'playing') {
    accumulator += dt;
    input.left = keys.has('KeyA') || keys.has('ArrowLeft') || touch.left;
    input.right = keys.has('KeyD') || keys.has('ArrowRight') || touch.right;
    input.jumpHeld = keys.has('Space') || keys.has('KeyW') || keys.has('ArrowUp') || touch.jump;
    input.fire = (mouseButtons & 1) !== 0 || touchAim.size > 0;
    input.aim = renderer.toWorld(pointer.x, pointer.y);
    let n = 0;
    while (accumulator >= 1 / 60 && n < 5) {
      game.tick(1 / 60, input);
      input.jump = false;
      input.firePressed = false;
      input.portal = undefined;
      accumulator -= 1 / 60;
      n++;
    }
    if (n === 5) accumulator = 0;
  } else accumulator = 0;
  updateMusic();
  renderer.draw(now);
  if (now - hudAt > 80) {
    hudAt = now;
    $('portal-touch').hidden = !game.portals.canPlace;
    if (!game.portals.canPlace && portalTouch) {
      portalTouch = false;
      $('portal-touch').setAttribute('aria-pressed', 'false');
    }
    $<HTMLProgressElement>('health').value = game.hp;
    $('health').setAttribute('aria-valuetext', Math.ceil(game.hp) + ' health');
    $('health').classList.toggle('low', game.hp <= 30);
  }
  requestAnimationFrame(frame);
}
game.onChange();
requestAnimationFrame(frame);
