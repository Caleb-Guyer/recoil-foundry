import './style.css';
import { Game } from './game.ts';
import { Renderer } from './render.ts';
import { Sound } from './audio.ts';
import { STAGES, TECHS, WEAPONS, validateCheckpoint, pointerButtons } from './rules.ts';
import type { Checkpoint, FieldId, WeaponId } from './rules.ts';
import type { Input } from './game.ts';
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
function read(key: string): unknown {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null');
  } catch {
    return null;
  }
}
function write(key: string, data: unknown) {
  try {
    if (data === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(data));
  } catch {
    $('save-status').textContent = 'LOCAL SAVING UNAVAILABLE';
  }
}
const rawSave = read('rf-checkpoint-v1');
let checkpoint: Checkpoint | null = validateCheckpoint(rawSave) ? rawSave : null;
let selectedField: FieldId = 'repulsor';
document.getElementById('app')!.innerHTML = `
<main class="game-shell">
 <div class="viewport" id="viewport">
  <canvas id="game" tabindex="0" aria-label="Recoil Foundry physics game. Use A and D to move, W or Space to jump, mouse to aim, left click to fire, right click for field, E at the exit."></canvas>
  <section class="hud" aria-label="Run status">
   <div class="meters">
    <div class="meter" title="Health"><span aria-hidden="true">+</span><progress id="hp" aria-label="Health" value="100" max="100"></progress><span id="hp-value">100</span></div>
    <div class="meter energy" title="Energy"><span aria-hidden="true">ϟ</span><progress id="energy" aria-label="Energy" value="100" max="100"></progress><span id="energy-value">100</span></div>
   </div>
   <div class="run-controls"><span id="sector-progress" title="Sector">1 / 6</span><button id="pause" class="icon-button" aria-label="Pause game" title="Pause · Esc">Ⅱ</button></div>
  </section>
  <div class="notice" id="notice" role="status" aria-live="polite"></div>
  <section id="start-screen" class="start-screen" aria-label="Start a run">
   <div class="start-content">
    <img class="title-mark" src="./icon.svg" alt="" />
    <h1>Recoil Foundry</h1>
    <button id="start" class="primary">Play</button>
    <button id="continue" class="text-button" ${checkpoint ? '' : 'hidden'}>Continue</button>
    <details class="run-options"><summary>Options</summary>
     <div class="field-options" aria-label="Starting field"><button class="field-card selected" id="field-repulsor" aria-pressed="true" title="Push objects and reflect bullets">◎ Repulsor</button><button class="field-card" id="field-tractor" aria-pressed="false" title="Catch crates and release to throw">⊹ Tractor</button></div>
     <p class="field-description" id="field-description">Push objects and reflect bullets.</p>
     <label class="seed-label">Seed<input id="seed" maxlength="40" autocomplete="off" aria-label="Run seed" placeholder="Random" /></label>
    </details>
   </div>
  </section>
  <section class="equipment" aria-label="Equipment">
   <div class="equipped-line"><span id="weapon-name">Coil driver</span><button id="build" class="text-button" title="View technologies"><span aria-hidden="true">◇</span> <span id="tech-count">0</span><span class="sr-only"> technologies</span></button></div>
   <div class="equipment-buttons"><div class="weapon-rack" id="weapons"></div><button class="icon-button field-slot" id="field-info" aria-label="Repulsor field controls" title="Repulsor · RMB or Shift">◎</button></div>
  </section>
  <nav class="settings" aria-label="Game settings"><button id="help" class="icon-button" aria-label="How to play" title="Controls">?</button><button id="sound" class="icon-button" aria-label="Mute sound" title="Toggle sound">♪</button></nav>
  <div class="touch-controls" aria-label="Touch controls"><div><button data-touch="left" aria-label="Move left">←</button><button data-touch="right" aria-label="Move right">→</button></div><div><button data-touch="field" aria-label="Activate field">◎</button><button data-touch="jump" aria-label="Jump">↑</button><button data-touch="interact" aria-label="Use exit">E</button></div></div>
 </div>
</main>
<span class="sr-only" id="save-status" role="status"></span>
<dialog id="modal" aria-labelledby="modal-title"><div id="modal-content"></div></dialog>`;
const game = new Game(),
  canvas = $<HTMLCanvasElement>('game'),
  renderer = new Renderer(canvas, game),
  sound = new Sound();
const storedSettings = read('rf-settings-v1') as { sound?: boolean; reduced?: boolean } | null;
sound.enabled = storedSettings?.sound !== false;
renderer.reduced =
  storedSettings?.reduced ?? window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const input: Input = {
  left: false,
  right: false,
  crouch: false,
  jump: false,
  fire: false,
  field: false,
  interact: false,
  aim: { x: 500, y: 650 },
};
const mouse = { x: 500, y: 350 };
const keys = new Set<string>();
let modalKind = '';
let lastMode = game.mode;
const arenaTouches = new Set<number>();
let heldMouseButtons = 0;
const modal = $<HTMLDialogElement>('modal');
const params = new URLSearchParams(location.search);
$<HTMLInputElement>('seed').value = (params.get('seed') ?? '').slice(0, 40);
function clearInput() {
  keys.clear();
  arenaTouches.clear();
  heldMouseButtons = 0;
  for (const key of ['left', 'right', 'crouch', 'jump', 'fire', 'field', 'interact'] as const)
    input[key] = false;
}
function newSeed() {
  const n = new Uint32Array(1);
  crypto.getRandomValues(n);
  return n[0].toString(36).toUpperCase();
}
function start(save?: Checkpoint) {
  sound.unlock();
  closeModal();
  clearInput();
  const seed = save?.seed ?? ($<HTMLInputElement>('seed').value.trim() || newSeed());
  game.start(seed, selectedField, save);
  canvas.focus();
}
function settings() {
  write('rf-settings-v1', { sound: sound.enabled, reduced: renderer.reduced });
  $('sound').textContent = sound.enabled ? '♪' : '♪̸';
  $('sound').setAttribute('aria-label', sound.enabled ? 'Mute sound' : 'Enable sound');
}
function selectField(field: FieldId) {
  selectedField = field;
  for (const f of ['repulsor', 'tractor']) {
    $('field-' + f).classList.toggle('selected', f === field);
    $('field-' + f).setAttribute('aria-pressed', String(f === field));
  }
  $('field-description').textContent =
    field === 'repulsor' ? 'Push objects and reflect bullets.' : 'Catch crates. Release to throw.';
}
$('field-repulsor').onclick = () => selectField('repulsor');
$('field-tractor').onclick = () => selectField('tractor');
$('start').onclick = () => start();
$('continue').onclick = () => {
  if (checkpoint) start(checkpoint);
};
$('sound').onclick = () => {
  sound.unlock();
  sound.enabled = !sound.enabled;
  settings();
};
settings();
$('help').onclick = () => showModal('help');
$('pause').onclick = () => togglePause();
$('build').onclick = () => showModal('build');
$('field-info').onclick = () => showModal('help');
game.onSound = (kind) => sound.play(kind);
game.onCheckpoint = (save) => {
  checkpoint = save;
  write('rf-checkpoint-v1', save);
};
function renderEquipment() {
  const icons: Record<WeaponId, string> = {
    coil: 'M4 8h18v5H12l-2 5H6l1-5H4z M22 9h6v3h-6',
    scatter: 'M3 8h24v3H13l-2 7H7l1-7H3z M15 5h12 M17 14h8',
    lance: 'M4 8h12v6H4z M16 9h7v4h-7 M23 11h7 M8 14l-1 4',
    mortar: 'M4 8h9v6H4z M13 6h12v10H13z M25 8h4v6h-4 M7 14v4',
  };
  $('weapons').innerHTML = game.weapons
    .map(
      (id) =>
        `<button class="weapon ${game.weapon === id ? 'equipped' : ''}" data-weapon="${id}" title="${WEAPONS[id].name} · ${(Object.keys(WEAPONS) as WeaponId[]).indexOf(id) + 1}" aria-label="${WEAPONS[id].name}" aria-pressed="${game.weapon === id}"><svg viewBox="0 0 32 22" aria-hidden="true"><path d="${icons[id]}" /></svg></button>`,
    )
    .join('');
  document.querySelectorAll<HTMLButtonElement>('[data-weapon]').forEach(
    (b) =>
      (b.onclick = () => {
        game.equip(b.dataset.weapon as WeaponId);
        canvas.focus();
      }),
  );
  const fieldName = game.field === 'repulsor' ? 'Repulsor' : 'Tractor';
  $('field-info').textContent = game.field === 'repulsor' ? '◎' : '⊹';
  $('field-info').title = `${fieldName} · RMB or Shift`;
  $('field-info').setAttribute('aria-label', `${fieldName} field controls`);
  $('weapon-name').textContent = WEAPONS[game.weapon].name;
  $('tech-count').textContent = String(game.techs.length);
}
game.onChange = () => {
  $('start-screen').hidden = game.mode !== 'title';
  document.body.dataset.mode = game.mode;
  $('sector-progress').textContent = `${game.stage + 1} / 6`;
  $('sector-progress').title = STAGES[game.stage].name;
  renderEquipment();
  if (game.mode === 'upgrade') showModal('upgrade');
  if (game.mode === 'dead' || game.mode === 'won') {
    const records = read('rf-records-v1') as { runs?: number; wins?: number; best?: number } | null;
    if (lastMode !== game.mode)
      write('rf-records-v1', {
        runs: (records?.runs ?? 0) + 1,
        wins: (records?.wins ?? 0) + (game.mode === 'won' ? 1 : 0),
        best: Math.max(records?.best ?? 0, game.kills),
      });
    showModal('result');
  }
  lastMode = game.mode;
};
function closeModal() {
  if (modal.open) modal.close();
  modalKind = '';
}
function togglePause() {
  if (game.mode === 'playing') {
    game.setMode('paused');
    showModal('pause');
  } else if (game.mode === 'paused') {
    closeModal();
    game.setMode('playing');
    canvas.focus();
  }
}
function showModal(kind: string) {
  if (
    (game.mode === 'upgrade' || game.mode === 'dead' || game.mode === 'won') &&
    !['upgrade', 'result'].includes(kind)
  )
    return;
  if (game.mode === 'playing') {
    game.setMode('paused');
    clearInput();
  }
  modalKind = kind;
  const content = $('modal-content');
  if (kind === 'upgrade') {
    content.innerHTML = `<h2 id="modal-title">Choose an upgrade</h2>${game.weaponReward ? `<p class="reward-banner">Unlocked: <b>${WEAPONS[game.weaponReward].name}</b></p>` : ''}<div class="tech-grid">${game.offers.map((t, i) => `<button class="tech-card" data-tech="${t.id}"><kbd>${i + 1}</kbd><b>${t.name}</b><p>${t.description}</p></button>`).join('')}</div><p class="fine-print">+12 health · Energy restored · Checkpoint saved on entry</p>`;
    content.querySelectorAll<HTMLButtonElement>('[data-tech]').forEach(
      (b) =>
        (b.onclick = () => {
          closeModal();
          clearInput();
          game.chooseTech(b.dataset.tech!);
          canvas.focus();
        }),
    );
  } else if (kind === 'result') {
    const win = game.mode === 'won';
    content.innerHTML = `<h2 id="modal-title">${win ? 'Run complete' : 'Destroyed'}</h2><div class="result-stats"><span>Sector <b>${game.stage + 1}/6</b></span><span><b>${game.kills}</b> kills</span><span>${formatTime(game.elapsed)}</span></div><div class="modal-actions"><button class="primary" id="retry">Retry</button><button class="secondary" id="new-run">Main menu</button></div><details class="result-details"><summary>Run details</summary><div class="build-tags">${game.techs.map((id) => `<span>${TECHS.find((t) => t.id === id)?.name}</span>`).join('') || '<span>No upgrades</span>'}</div><p class="result-seed">Seed: ${escape(game.seed)}</p><button class="text-button" id="copy-seed">Copy seed link</button></details>`;
    $('retry').onclick = () => {
      $<HTMLInputElement>('seed').value = game.seed;
      selectedField = game.field;
      start();
    };
    $('new-run').onclick = () => {
      closeModal();
      game.setMode('title');
      $<HTMLInputElement>('seed').value = '';
      $('continue').hidden = true;
      selectField(selectedField);
    };
    $('copy-seed').onclick = async () => {
      try {
        const url = new URL(location.href);
        url.searchParams.set('seed', game.seed);
        await navigator.clipboard.writeText(url.href);
        $('copy-seed').textContent = 'Copied';
      } catch {
        $('copy-seed').textContent = 'Seed: ' + game.seed;
      }
    };
  } else if (kind === 'help') {
    content.innerHTML = `<h2 id="modal-title">Controls</h2><div class="manual-grid"><div><h3>Move & fight</h3><p><kbd>A</kbd> <kbd>D</kbd> or arrows to move<br><kbd>W</kbd> / <kbd>Space</kbd> to jump<br><kbd>S</kbd> to crouch<br>Mouse to aim · Left click to fire<br><kbd>1</kbd>–<kbd>4</kbd>, <kbd>Q</kbd>, or wheel to switch<br><kbd>E</kbd> at a cleared exit<br><kbd>Esc</kbd> to pause</p></div><div><h3>Field · Hold right click or Shift</h3><p><b>Repulsor</b> pushes objects and reflects bullets.<br><b>Tractor</b> catches a crate. Aim and release to throw.<br>Stop using energy to recharge. The coil driver is free.</p></div></div><p class="manual-tip">Shoot downward to extend jumps. Clear each sector, choose an upgrade, and defeat the reactor boss.</p><p class="fine-print">Touch: movement buttons + hold the arena to aim/fire. Progress saves at sector entrances. Death ends a run.</p><button class="primary" id="back">${game.mode === 'paused' ? 'Resume' : 'Back'}</button>`;
    $('back').onclick = () => {
      closeModal();
      if (game.mode === 'paused') game.setMode('playing');
      canvas.focus();
    };
  } else if (kind === 'build') {
    content.innerHTML = `<h2 id="modal-title">Build</h2><div class="stat-strip"><span>Damage <b>${Math.round(game.stats.damage * 100)}%</b></span><span>Recoil <b>${Math.round(game.stats.recoil * 100)}%</b></span><span>Energy <b>${game.stats.regen}/s</b></span></div><div class="tech-list">${
      game.techs
        .map((id) => {
          const t = TECHS.find((t) => t.id === id)!;
          return `<article><b>${t.name}</b><p>${t.description}</p></article>`;
        })
        .join('') || '<p>Clear a sector to earn your first upgrade.</p>'
    }</div><button class="primary" id="back">${game.mode === 'paused' ? 'Resume' : 'Back'}</button>`;
    $('back').onclick = () => {
      closeModal();
      if (game.mode === 'paused') game.setMode('playing');
      canvas.focus();
    };
  } else {
    content.innerHTML = `<h2 id="modal-title">Paused</h2><div class="pause-actions"><button class="primary" id="resume">Resume</button><button class="secondary" id="inspect">Build</button><button class="secondary" id="manual">Controls</button></div><details class="pause-options"><summary>Options</summary><label class="motion-setting"><input type="checkbox" id="reduced" ${renderer.reduced ? 'checked' : ''} /> Reduce screen shake</label><p class="fine-print">Seed: ${escape(game.seed)}</p></details><button class="text-button" id="menu">Main menu</button><p class="fine-print">Continue restarts this sector from its checkpoint.</p>`;
    $('resume').onclick = () => togglePause();
    $('inspect').onclick = () => showModal('build');
    $('manual').onclick = () => showModal('help');
    $('reduced').onchange = () => {
      renderer.reduced = $<HTMLInputElement>('reduced').checked;
      settings();
    };
    $('menu').onclick = () => {
      closeModal();
      game.setMode('title');
      $('continue').hidden = !checkpoint;
      $('continue').textContent = 'Continue';
    };
  }
  if (!modal.open) modal.showModal();
}
modal.addEventListener('cancel', (event) => {
  event.preventDefault();
  if (modalKind === 'upgrade' || modalKind === 'result') return;
  closeModal();
  if (game.mode === 'paused') game.setMode('playing');
  canvas.focus();
});
function formatTime(t: number) {
  return `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
}
window.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement || e.ctrlKey || e.metaKey || e.altKey) return;
  if (
    ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code) &&
    e.code !== 'Tab'
  )
    e.preventDefault();
  if (e.repeat) return;
  if (game.mode === 'upgrade') {
    const n = Number(e.key) - 1;
    if (n >= 0 && n < game.offers.length) {
      closeModal();
      clearInput();
      game.chooseTech(game.offers[n].id);
      canvas.focus();
    }
    return;
  }
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (!modal.open) togglePause();
    else if (e.code === 'KeyP' && game.mode === 'paused') togglePause();
    return;
  }
  if (game.mode !== 'playing') return;
  keys.add(e.code);
  if (['KeyW', 'Space', 'ArrowUp'].includes(e.code)) input.jump = true;
  if (e.code === 'KeyE') input.interact = true;
  if (e.code === 'KeyQ') game.cycleWeapon();
  if (/^Digit[1-4]$/.test(e.code))
    game.equip((Object.keys(WEAPONS) as WeaponId[])[Number(e.code.slice(-1)) - 1]);
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
function syncPointer() {
  const buttons = pointerButtons(heldMouseButtons);
  input.fire = buttons.fire || arenaTouches.size > 0;
  input.field = buttons.field;
}
canvas.addEventListener('pointermove', (e) => {
  const r = canvas.getBoundingClientRect();
  mouse.x = e.clientX - r.left;
  mouse.y = e.clientY - r.top;
  if (e.pointerType !== 'touch' && game.mode === 'playing') {
    heldMouseButtons = e.buttons;
    syncPointer();
  }
});
canvas.addEventListener('pointerdown', (e) => {
  if (game.mode !== 'playing') return;
  sound.unlock();
  canvas.focus();
  canvas.setPointerCapture(e.pointerId);
  const r = canvas.getBoundingClientRect();
  mouse.x = e.clientX - r.left;
  mouse.y = e.clientY - r.top;
  if (e.pointerType === 'touch') arenaTouches.add(e.pointerId);
  else heldMouseButtons = e.buttons;
  syncPointer();
});
window.addEventListener('pointerup', (e) => {
  if (e.pointerType === 'touch') arenaTouches.delete(e.pointerId);
  else heldMouseButtons = e.buttons;
  syncPointer();
});
canvas.addEventListener('pointercancel', (e) => {
  arenaTouches.delete(e.pointerId);
  if (e.pointerType !== 'touch') heldMouseButtons = 0;
  syncPointer();
});
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener(
  'wheel',
  (e) => {
    if (game.mode === 'playing') {
      e.preventDefault();
      game.cycleWeapon();
    }
  },
  { passive: false },
);
const touch = { left: false, right: false, field: false };
document.querySelectorAll<HTMLButtonElement>('[data-touch]').forEach((b) => {
  b.onpointerdown = (e) => {
    e.preventDefault();
    b.setPointerCapture(e.pointerId);
    const action = b.dataset.touch!;
    if (action === 'jump') input.jump = true;
    else if (action === 'interact') input.interact = true;
    else touch[action as keyof typeof touch] = true;
  };
  const release = () => {
    const action = b.dataset.touch!;
    if (action in touch) touch[action as keyof typeof touch] = false;
  };
  b.onpointerup = release;
  b.onpointercancel = release;
});
window.addEventListener('blur', () => {
  clearInput();
  touch.left = touch.right = touch.field = false;
  if (game.mode === 'playing') {
    game.setMode('paused');
    showModal('pause');
  }
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && game.mode === 'playing') {
    clearInput();
    game.setMode('paused');
    showModal('pause');
  }
});
new ResizeObserver(() => renderer.resize()).observe($('viewport'));
let previous = performance.now(),
  accumulator = 0,
  hudAt = 0;
function frame(now: number) {
  const delta = Math.min((now - previous) / 1000, 0.1);
  previous = now;
  if (game.mode === 'playing') {
    accumulator += delta;
    input.left = keys.has('KeyA') || keys.has('ArrowLeft') || touch.left;
    input.right = keys.has('KeyD') || keys.has('ArrowRight') || touch.right;
    input.crouch = keys.has('KeyS') || keys.has('ArrowDown');
    input.aim = renderer.toWorld(mouse.x, mouse.y);
    let steps = 0;
    while (accumulator >= 1 / 60 && steps < 5) {
      const field = input.field || keys.has('ShiftLeft') || keys.has('ShiftRight') || touch.field;
      game.tick(1 / 60, { ...input, field });
      input.jump = false;
      input.interact = false;
      accumulator -= 1 / 60;
      steps++;
    }
    if (steps === 5) accumulator = 0;
  } else accumulator = 0;
  renderer.draw();
  if (now - hudAt > 80) {
    hudAt = now;
    $<HTMLProgressElement>('hp').max = game.stats.maxHp;
    $<HTMLProgressElement>('hp').value = game.hp;
    $('hp-value').textContent = String(Math.ceil(game.hp));
    $<HTMLProgressElement>('energy').max = game.stats.maxEnergy;
    $<HTMLProgressElement>('energy').value = game.energy;
    $('energy-value').textContent = String(Math.floor(game.energy));
    const showNotice = game.mode === 'playing' && game.noticeTime > 0;
    $('notice').textContent = showNotice ? game.notice : '';
    $('notice').classList.toggle('visible', showNotice);
  }
  requestAnimationFrame(frame);
}
game.onChange();
requestAnimationFrame(frame);
