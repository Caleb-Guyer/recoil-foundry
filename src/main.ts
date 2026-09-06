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
<header class="topbar">
 <a class="brand" href="./" aria-label="Recoil Foundry home"><img src="./icon.svg" alt="" /><span>RECOIL <b>FOUNDRY</b><small>EXPERIMENTAL SYSTEMS DIVISION</small></span></a>
 <div class="topmeta"><span class="status-dot"></span><span>RF–01 <i>/</i> SYSTEM ONLINE</span></div>
 <nav aria-label="Game settings"><button id="help" class="text-button">HOW TO PLAY <span>?</span></button><button id="sound" class="icon-button" aria-label="Mute sound" title="Toggle sound">♪</button><button id="pause" class="icon-button" aria-label="Pause game" title="Pause / Escape">Ⅱ</button></nav>
</header>
<main class="game-shell">
 <section class="telemetry" aria-label="Run status">
  <div class="sector-heading"><span class="eyebrow" id="sector-label">AWAITING INITIALIZATION</span><span id="sector-name">Experiment RF–01</span></div>
  <div class="meter"><div><label for="hp">INTEGRITY</label><span id="hp-value">100 / 100</span></div><progress id="hp" value="100" max="100"></progress></div>
  <div class="meter energy"><div><label for="energy">ENERGY</label><span id="energy-value">100 / 100</span></div><progress id="energy" value="100" max="100"></progress></div>
  <div class="sector-progress" id="sector-progress" aria-label="Six sectors"><span class="active">01</span><span>02</span><span>03</span><span>04</span><span>05</span><span>06</span></div>
 </section>
 <div class="viewport" id="viewport">
  <canvas id="game" tabindex="0" aria-label="Recoil Foundry physics game. Use A and D to move, W or Space to jump, mouse to aim, left click to fire, right click for field, E at the exit."></canvas>
  <div class="canvas-corners" aria-hidden="true"></div>
  <div class="arena-meta"><span id="arena-left">SIMULATION / STANDBY</span><span id="arena-right">PHYSICS ACTIVE · 60 Hz</span></div>
  <div class="notice" id="notice" role="status" aria-live="polite"></div>
  <div class="objective" id="objective"><span class="status-dot"></span><span id="objective-text">CLEAR THE SECTOR</span></div>
  <section id="start-screen" class="start-screen" aria-label="Start a run">
   <div class="start-content"><div class="eyebrow accent">PHYSICS / ACTION / ROGUELIKE</div><h1>RECOIL<br><span>FOUNDRY</span><sup>01</sup></h1><p class="tagline">Weaponize your momentum.</p><p class="intro">An unstable machine. An endless experiment.<br>Chain technologies. Turn the facility against itself.</p>
    <div class="loadout"><span class="eyebrow">01 / SELECT YOUR FIELD</span><div class="field-options"><button class="field-card selected" id="field-repulsor" aria-pressed="true"><span class="field-symbol">◎</span><span><b>Repulsor</b><small>Deflect rounds. Push everything.</small></span><span class="radio-dot"></span></button><button class="field-card" id="field-tractor" aria-pressed="false"><span class="field-symbol">⊹</span><span><b>Tractor</b><small>Capture crates. Release to launch.</small></span><span class="radio-dot"></span></button></div></div>
    <div class="launch-row"><button id="start" class="primary">INITIALIZE RUN <span>↗</span></button><label class="seed-label">RUN SEED<input id="seed" maxlength="40" autocomplete="off" aria-label="Run seed" placeholder="Random" /></label></div>
    <button id="continue" class="continue-button" ${checkpoint ? '' : 'hidden'}>↳ RESUME SECTOR ${checkpoint ? String(checkpoint.stage + 1).padStart(2, '0') : ''}</button>
    <div class="start-notes"><span>6 SECTORS</span><span>4 WEAPONS</span><span>16 TECHNOLOGIES</span></div>
   </div>
   <aside class="experiment-note"><div class="eyebrow">OPERATOR NOTE / 001</div><p>Recoil is a force.<br><em>Use it.</em></p><span>Shoot downward to extend a jump.<br>Launch a crate to break a firing line.</span><div class="note-axis"><span>↖</span><span>F = ma</span></div></aside>
  </section>
  <div class="touch-controls" aria-label="Touch controls"><div><button data-touch="left" aria-label="Move left">←</button><button data-touch="right" aria-label="Move right">→</button></div><div><button data-touch="field" aria-label="Activate field">◎</button><button data-touch="jump" aria-label="Jump">↑</button><button data-touch="interact" aria-label="Use exit">E</button></div></div>
 </div>
 <section class="equipment" aria-label="Equipment">
  <div class="weapon-rack" id="weapons"></div>
  <button class="field-slot" id="field-info"><span class="field-symbol">◎</span><span><small>ACTIVE FIELD / RMB</small><b id="field-name">Repulsor</b></span></button>
  <button class="build-button" id="build"><span id="tech-count">00</span><small>TECHNOLOGIES <b>↗</b></small></button>
 </section>
</main>
<footer><span class="control-guide"><kbd>A</kbd><kbd>D</kbd> MOVE <i>·</i> <kbd>W</kbd> JUMP <i>·</i> LMB FIRE <i>·</i> RMB FIELD <i>·</i> <kbd>Q</kbd> WEAPON <i>·</i> <kbd>E</kbd> EXIT</span><span id="save-status">LOCAL RECORDS · v1.0</span></footer>
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
  $('field-name').textContent = field === 'repulsor' ? 'Repulsor' : 'Tractor';
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
  $('weapons').innerHTML = (Object.keys(WEAPONS) as WeaponId[])
    .map(
      (id, index) =>
        `<button class="weapon ${game.weapon === id ? 'equipped' : ''} ${game.weapons.includes(id) ? '' : 'locked'}" data-weapon="${id}" ${game.weapons.includes(id) ? '' : 'disabled'} aria-label="${WEAPONS[id].name}${game.weapons.includes(id) ? '' : ' — unlock after sector ' + index}" aria-pressed="${game.weapon === id}"><span class="keycap">${index + 1}</span><span class="weapon-shape shape-${id}" aria-hidden="true">${id === 'coil' ? '━━┥' : id === 'scatter' ? '╞══' : id === 'lance' ? '──⊳' : '━◉'}</span><span><b>${WEAPONS[id].name}</b><small>${game.weapons.includes(id) ? WEAPONS[id].label : 'UNLOCK / SECTOR ' + String(index).padStart(2, '0')}</small></span></button>`,
    )
    .join('');
  document.querySelectorAll<HTMLButtonElement>('[data-weapon]').forEach(
    (b) =>
      (b.onclick = () => {
        game.equip(b.dataset.weapon as WeaponId);
        canvas.focus();
      }),
  );
  $('field-name').textContent =
    (game.mode === 'title' ? selectedField : game.field) === 'repulsor' ? 'Repulsor' : 'Tractor';
  $('tech-count').textContent = String(game.techs.length).padStart(2, '0');
}
game.onChange = () => {
  $('start-screen').hidden = game.mode !== 'title';
  $('objective').hidden = game.mode === 'title';
  document.body.dataset.mode = game.mode;
  $('sector-label').textContent =
    game.mode === 'title' ? 'AWAITING INITIALIZATION' : STAGES[game.stage].label;
  $('sector-name').textContent =
    game.mode === 'title' ? 'Experiment RF–01' : STAGES[game.stage].name;
  $('arena-left').textContent =
    game.mode === 'title' ? 'SIMULATION / STANDBY' : 'SEED / ' + game.seed;
  $('arena-right').textContent =
    game.mode === 'title'
      ? 'PHYSICS ACTIVE · 60 Hz'
      : `${game.enemies.length} HOSTILES / ${game.kills} ELIMINATED`;
  $('objective-text').textContent = game.clear
    ? 'REACH THE EXIT · PRESS E'
    : 'ELIMINATE ALL HOSTILES';
  $('objective').classList.toggle('complete', game.clear);
  $('sector-progress').innerHTML = STAGES.map(
    (_, i) =>
      `<span class="${i === game.stage ? 'active' : i < game.stage ? 'done' : ''}">${i < game.stage ? '✓' : String(i + 1).padStart(2, '0')}</span>`,
  ).join('');
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
    content.innerHTML = `<div class="eyebrow accent">SECTOR ${String(game.stage + 1).padStart(2, '0')} / COMPLETE</div><h2 id="modal-title">Evolve the experiment.</h2><p class="modal-intro">Choose one technology. Your integrity is repaired by 12 and energy is restored.</p>${game.weaponReward ? `<div class="reward-banner"><span>WEAPON ACQUIRED</span><b>${WEAPONS[game.weaponReward].name}</b><small>${WEAPONS[game.weaponReward].description}</small></div>` : ''}<div class="tech-grid">${game.offers.map((t, i) => `<button class="tech-card" data-tech="${t.id}"><span class="tech-top"><span>${t.category}</span><kbd>${i + 1}</kbd></span><span class="tech-glyph">${t.glyph}</span><b>${t.name}</b><p>${t.description}</p><span class="tech-select">INSTALL TECHNOLOGY ↗</span></button>`).join('')}</div><p class="fine-print">The next sector is saved automatically. Return later to restart from its entrance.</p>`;
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
    content.innerHTML = `<div class="eyebrow ${win ? 'accent' : 'danger'}">${win ? 'EXPERIMENT SUCCESSFUL' : 'EXPERIMENT TERMINATED'}</div><h2 id="modal-title">${win ? 'The foundry is silent.' : 'Every failure is data.'}</h2><p class="modal-intro">${win ? 'You dismantled the prime mover. Try another field or seed for a different build.' : 'Reconfigure. Apply what you learned. Run the experiment again.'}</p><div class="result-stats"><div><b>${game.stage + 1}<small>/ 6</small></b><span>SECTOR REACHED</span></div><div><b>${game.kills}</b><span>ELIMINATIONS</span></div><div><b>${formatTime(game.elapsed)}</b><span>RUN TIME</span></div></div><div class="build-tags">${game.techs.map((id) => `<span>${TECHS.find((t) => t.id === id)?.name}</span>`).join('') || '<span>Baseline configuration</span>'}</div><div class="result-seed">SEED / ${escape(game.seed)}</div><div class="modal-actions"><button class="primary" id="retry">RUN IT AGAIN ↗</button><button class="secondary" id="new-run">NEW CONFIGURATION</button><button class="secondary" id="copy-seed">COPY SEED LINK</button></div>`;
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
        $('copy-seed').textContent = 'LINK COPIED';
      } catch {
        $('copy-seed').textContent = 'SEED: ' + game.seed;
      }
    };
  } else if (kind === 'help') {
    content.innerHTML = `<div class="eyebrow accent">OPERATOR MANUAL / RF–01</div><h2 id="modal-title">Make physics work for you.</h2><div class="manual-grid"><div><h3>Move & fight</h3><p><kbd>A</kbd> <kbd>D</kbd> or arrow keys to move.<br><kbd>W</kbd> / <kbd>Space</kbd> / <kbd>↑</kbd> to jump.<br><kbd>S</kbd> or <kbd>↓</kbd> to crouch.<br>Mouse to aim. Left click to fire.<br><kbd>1</kbd>–<kbd>4</kbd>, <kbd>Q</kbd>, or wheel to switch weapons.<br><kbd>E</kbd> at the exit after clearing enemies.<br><kbd>Esc</kbd> or <kbd>P</kbd> to pause.</p></div><div><h3>Use your field</h3><p>Hold right click or <kbd>Shift</kbd>.<br><b>Repulsor:</b> push objects and reflect hostile rounds.<br><b>Tractor:</b> catch a nearby crate, aim, then release to launch it.<br>Fields consume energy. Stop using them to recharge.</p></div></div><div class="manual-tip">Shoot downward with the scatter array to extend a jump. The coil driver costs no energy. Explosions launch you without dealing self-damage. Clear five sectors, defeat the prime mover, and reach the final exit.</div><p class="fine-print">On touch screens, use the movement buttons and hold the arena to aim and fire. Progress saves at each sector entrance. A defeat ends that run.</p><button class="primary" id="back">${game.mode === 'paused' ? 'RESUME EXPERIMENT' : 'READY'} ↗</button>`;
    $('back').onclick = () => {
      closeModal();
      if (game.mode === 'paused') game.setMode('playing');
      canvas.focus();
    };
  } else if (kind === 'build') {
    content.innerHTML = `<div class="eyebrow accent">CURRENT CONFIGURATION</div><h2 id="modal-title">Your machine, redefined.</h2><div class="stat-strip"><span>DAMAGE <b>${Math.round(game.stats.damage * 100)}%</b></span><span>RECOIL <b>${Math.round(game.stats.recoil * 100)}%</b></span><span>ENERGY REGEN <b>${game.stats.regen}/s</b></span></div><div class="tech-list">${
      game.techs
        .map((id) => {
          const t = TECHS.find((t) => t.id === id)!;
          return `<article><span class="tech-glyph">${t.glyph}</span><div><b>${t.name}</b><p>${t.description}</p></div></article>`;
        })
        .join('') ||
      '<p>No technologies installed yet. Clear a sector and reach the exit to choose your first upgrade.</p>'
    }</div><button class="primary" id="back">${game.mode === 'paused' ? 'RESUME EXPERIMENT' : 'BACK'} ↗</button>`;
    $('back').onclick = () => {
      closeModal();
      if (game.mode === 'paused') game.setMode('playing');
      canvas.focus();
    };
  } else {
    content.innerHTML = `<div class="eyebrow accent">SIMULATION SUSPENDED</div><h2 id="modal-title">Take a breath.</h2><p class="modal-intro">Sector ${game.stage + 1} · ${escape(STAGES[game.stage].name)} · ${formatTime(game.elapsed)}</p><div class="pause-actions"><button class="primary" id="resume">RESUME EXPERIMENT ↗</button><button class="secondary" id="inspect">INSPECT BUILD</button><button class="secondary" id="manual">OPERATOR MANUAL</button></div><label class="motion-setting"><input type="checkbox" id="reduced" ${renderer.reduced ? 'checked' : ''} /> Reduce screen shake</label><p class="fine-print">Your checkpoint is the entrance to this sector.</p><button class="text-button" id="menu">RETURN TO MAIN MENU</button>`;
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
      $('continue').textContent =
        '↳ RESUME SECTOR ' + String((checkpoint?.stage ?? 0) + 1).padStart(2, '0');
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
    $('hp-value').textContent = `${Math.ceil(game.hp)} / ${game.stats.maxHp}`;
    $<HTMLProgressElement>('energy').max = game.stats.maxEnergy;
    $<HTMLProgressElement>('energy').value = game.energy;
    $('energy-value').textContent = `${Math.floor(game.energy)} / ${game.stats.maxEnergy}`;
    $('notice').textContent = game.noticeTime > 0 ? game.notice : '';
    $('notice').classList.toggle('visible', game.noticeTime > 0);
    if (game.mode !== 'title')
      $('arena-right').textContent =
        `${game.enemies.length} HOSTILES / ${formatTime(game.elapsed)}`;
  }
  requestAnimationFrame(frame);
}
game.onChange();
requestAnimationFrame(frame);
