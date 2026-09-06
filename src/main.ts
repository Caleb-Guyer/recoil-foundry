import './style.css';
import { Game } from './game.ts';
import type { Input } from './game.ts';
import { Renderer } from './render.ts';
import { Sound } from './audio.ts';
import { AREAS } from './areas.ts';
import { MODS, loadCheckpoint, STAGES } from './rules.ts';
import type { Checkpoint, Mod } from './rules.ts';
import {
  DAILY_BESTS_KEY,
  dailyFromSeed,
  dailyFromUrl,
  dailyLink,
  formatDailyTime,
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
let checkpoint = loadCheckpoint(read('rf-checkpoint-v3'));
document.getElementById('app')!.innerHTML = `
<main id="arena">
 <canvas id="game" tabindex="0" aria-label="Recoil Foundry. A and D to move. Space to jump. Mouse to aim and fire. Shoot down in the air to climb."></canvas>
 <div class="hud"><progress id="health" max="100" value="100" aria-label="Health"></progress><div class="run-info"><span id="stage">01 / ${String(STAGES).padStart(2, '0')}</span><button id="pause" class="icon" aria-label="Pause" title="Pause · Esc"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7 5v10M13 5v10"/></svg></button></div></div>
 <section id="title-screen">
  <div class="title-content"><h1><span>RECOIL</span><small>FOUNDRY</small></h1>
   <button id="play" class="primary">Play <span aria-hidden="true">↗</span></button>
   <div class="title-actions"><button id="daily" class="quiet">Daily run</button><button id="continue" class="quiet" ${checkpoint ? '' : 'hidden'}>Continue</button></div>
   <p class="title-controls"><kbd>A</kbd><kbd>D</kbd> move <i>·</i> <kbd>Space</kbd> jump <i>·</i> Mouse fire</p>
   <p id="title-hint" class="recoil-hint">Shoot down. Go up.</p>
  </div><button id="settings" class="quiet title-settings">Settings</button>
 </section>
 <div class="touch-controls" aria-label="Touch controls"><div><button data-touch="left" aria-label="Move left">←</button><button data-touch="right" aria-label="Move right">→</button></div><button data-touch="jump" aria-label="Jump">↑</button></div>
</main><dialog id="modal" aria-labelledby="dialog-title"><div id="dialog-content"></div></dialog><span id="save-status" class="sr-only" role="status"></span>`;
const game = new Game(),
  canvas = $<HTMLCanvasElement>('game'),
  renderer = new Renderer(canvas, game),
  sound = new Sound();
const rawSettings = read('rf-settings-v2');
const prefs = (rawSettings && typeof rawSettings === 'object' ? rawSettings : {}) as {
  sound?: boolean;
  reduced?: boolean;
};
sound.enabled = prefs.sound !== false;
renderer.reduced =
  typeof prefs.reduced === 'boolean'
    ? prefs.reduced
    : matchMedia('(prefers-reduced-motion: reduce)').matches;
const modal = $<HTMLDialogElement>('modal'),
  keys = new Set<string>(),
  touch = { left: false, right: false, jump: false },
  pointer = { x: 500, y: 400 };
let mouseButtons = 0,
  touchAim = new Set<number>(),
  dialogKind = '',
  lastTime = performance.now(),
  accumulator = 0,
  hudAt = 0;
const input: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: false,
  fire: false,
  aim: { x: 600, y: 550 },
};
const entryUrl = new URL(location.href);
let linkedDaily = dailyFromUrl(entryUrl);
let invalidDailyLink = entryUrl.searchParams.has('daily') && !linkedDaily;
let seedParam = entryUrl.searchParams.has('daily')
  ? undefined
  : entryUrl.searchParams.get('seed')?.slice(0, 40);
let activeDaily = dailyFromSeed(game.seed);
let dailyResult: { best?: number; newBest: boolean; saved: boolean } | null = null;

function updateTitle() {
  $('play').innerHTML = `${linkedDaily ? 'Play daily' : 'Play'} <span aria-hidden="true">↗</span>`;
  $('daily').textContent = linkedDaily ? 'Random run' : 'Daily run';
  $('daily').title = linkedDaily
    ? 'Start a fresh random run'
    : "Today's shared challenge · resets at midnight UTC";
  $('continue').hidden = !checkpoint;
  $('continue').textContent =
    checkpoint && dailyFromSeed(checkpoint.seed) ? 'Continue daily' : 'Continue';
  $('title-hint').textContent = linkedDaily
    ? `Daily · ${linkedDaily.date}`
    : invalidDailyLink
      ? 'Challenge link unavailable. Start a fresh run.'
      : 'Shoot down. Go up.';
}
function clearInput() {
  keys.clear();
  mouseButtons = 0;
  touchAim.clear();
  touch.left = touch.right = touch.jump = false;
  input.left = input.right = input.jump = input.jumpHeld = input.fire = false;
  input.firePressed = false;
}
function closeDialog() {
  if (modal.open) modal.close();
  dialogKind = '';
  clearInput();
}
function persistSettings() {
  write('rf-settings-v2', { sound: sound.enabled, reduced: renderer.reduced });
}
function newSeed() {
  return crypto.getRandomValues(new Uint32Array(1))[0].toString(36).toUpperCase();
}
function start(save?: Checkpoint, retry = false, seedOverride?: string) {
  sound.unlock();
  closeDialog();
  const seed =
    save?.seed ??
    (retry ? game.seed : (seedOverride ?? linkedDaily?.seed ?? seedParam ?? newSeed()));
  activeDaily = dailyFromSeed(seed);
  dailyResult = null;
  game.start(seed, save);
  renderer.reset();
  pointer.x = canvas.clientWidth * 0.55;
  pointer.y = canvas.clientHeight * 0.6;
  canvas.focus();
}
game.onCheckpoint = (s) => {
  checkpoint = s;
  write('rf-checkpoint-v3', s);
};
game.onSound = (kind) => sound.play(kind);
game.onChange = () => {
  document.body.dataset.mode = game.mode;
  $('title-screen').hidden = game.mode !== 'title';
  $('stage').textContent =
    String(game.stage + 1).padStart(2, '0') + ' / ' + String(STAGES).padStart(2, '0');
  $('stage').title = `${AREAS[game.level.area].name} · ${game.level.name}`;
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
    backblast: 'M27 24h21M39 17l9 7-9 7M21 24L8 12M21 24H5M21 24L8 36',
    banker: 'M8 37l15-25 15 25 10-17M17 12h6v8M40 20h8v8',
    landing: 'M12 8v19M6 20l6 7 6-7M6 36h18M30 24h19M41 17l8 7-8 7',
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
  const content = $('dialog-content');
  if (kind === 'upgrade') {
    content.innerHTML =
      '<p class="eyebrow">ROOM CLEAR</p><h2 id="dialog-title">Make it kick.</h2><div class="choices">' +
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
            '</span></button>',
        )
        .join('') +
      '</div>';
    content.querySelectorAll<HTMLButtonElement>('[data-mod]').forEach(
      (b) =>
        (b.onclick = () => {
          const id = b.dataset.mod!;
          closeDialog();
          game.chooseMod(id);
          renderer.reset();
          canvas.focus();
        }),
    );
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
          ? 'ALL ' + STAGES + ' ROOMS'
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
    $('menu').onclick = () => {
      closeDialog();
      game.setMode('title');
    };
  } else {
    const paused = game.mode === 'paused';
    content.innerHTML =
      '<h2 id="dialog-title">' +
      (paused ? 'Paused.' : 'Settings.') +
      '</h2>' +
      '<div class="settings-list"><label>Sound<input id="sound" type="checkbox" ' +
      (sound.enabled ? 'checked' : '') +
      ' /></label><label>Screen shake<input id="shake" type="checkbox" ' +
      (!renderer.reduced ? 'checked' : '') +
      ' /></label></div>' +
      '<div class="controls-copy"><p><kbd>A</kbd> <kbd>D</kbd> Move <span>·</span> <kbd>Space</kbd> Jump</p><p>Mouse to aim and fire. Shoot down in the air to climb.</p><p>Clear the room, then leave through the right door.</p></div>' +
      (paused && game.mods.length
        ? '<details class="build"><summary>Your gun</summary><ul>' +
          game.mods.map((id) => '<li>' + MODS.find((m) => m.id === id)!.name + '</li>').join('') +
          '</ul></details>'
        : '') +
      '<div class="actions"><button id="back" class="primary">' +
      (paused ? 'Resume' : 'Back') +
      '</button>' +
      (paused ? '<button id="menu" class="quiet">Menu</button>' : '') +
      '</div>';
    $<HTMLInputElement>('sound').onchange = (e) => {
      sound.unlock();
      sound.enabled = (e.target as HTMLInputElement).checked;
      persistSettings();
    };
    $<HTMLInputElement>('shake').onchange = (e) => {
      renderer.reduced = !(e.target as HTMLInputElement).checked;
      persistSettings();
    };
    $('back').onclick = resume;
    if (paused)
      $('menu').onclick = () => {
        closeDialog();
        game.setMode('title');
      };
  }
  if (!modal.open) modal.showModal();
}
function resume() {
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
$('play').onclick = () => start();
$('daily').onclick = () => {
  if (linkedDaily) {
    linkedDaily = null;
    invalidDailyLink = false;
    seedParam = undefined;
    const url = new URL(location.href);
    url.searchParams.delete('daily');
    url.searchParams.delete('dv');
    url.searchParams.delete('seed');
    history.replaceState(null, '', url);
    start();
  } else start(undefined, false, todayDaily().seed);
};
$('continue').onclick = () => {
  if (checkpoint) start(checkpoint);
};
$('settings').onclick = () => showDialog('settings');
$('pause').onclick = pause;
modal.addEventListener('cancel', (e) => {
  e.preventDefault();
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
  if (game.mode === 'upgrade') {
    const i = Number(e.key) - 1;
    if (i >= 0 && i < game.offers.length) {
      const id = game.offers[i].id;
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
  clearInput();
  if (game.mode === 'playing') showDialog('pause');
}
window.addEventListener('blur', loseFocus);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) loseFocus();
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
      accumulator -= 1 / 60;
      n++;
    }
    if (n === 5) accumulator = 0;
  } else accumulator = 0;
  renderer.draw(now);
  if (now - hudAt > 80) {
    hudAt = now;
    $<HTMLProgressElement>('health').value = game.hp;
    $('health').setAttribute('aria-valuetext', Math.ceil(game.hp) + ' health');
    $('health').classList.toggle('low', game.hp <= 30);
  }
  requestAnimationFrame(frame);
}
game.onChange();
requestAnimationFrame(frame);
