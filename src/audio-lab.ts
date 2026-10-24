import './audio-lab.css';
import { Sound } from './audio.ts';
import { AUDIO_LAB_SCENES, audioLabOptions, type AudioLabScene } from './audio-lab-model.ts';
import type { SoundMaterial, SoundOrigin } from './sound-event.ts';
import { GAME_VERSION } from './version.ts';

const options = audioLabOptions(new URL(location.href));
const root = document.getElementById('soundcheck')!;
let scene: AudioLabScene = options.scene;
const sound = new Sound();
sound.musicEnabled = false;
sound.effectsVolume = 0.65;
sound.mono = options.mono;
sound.setListener({ x: 0, y: 0 });
let listening = false;
let power = options.power;
let ambience = AUDIO_LAB_SCENES[scene].ambience;
let pulseTimer = 0;
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
root.innerHTML = `<header><a href="./">← Recoil Foundry</a><p class="eyebrow">${GAME_VERSION} · Hear the Foundry</p><h1>Soundcheck.</h1><p>Listen to the actual game sounds in isolation. Headphones help with direction. These controls stay on this page; your game settings and progress are untouched.</p></header><nav aria-label="Soundcheck scenes">${Object.entries(
  AUDIO_LAB_SCENES,
)
  .map(
    ([id, info]) =>
      `<a href="?scene=${id}" data-scene="${id}" ${id === scene ? 'aria-current="page"' : ''}>${info.name}</a>`,
  )
  .join(
    '',
  )}</nav><section class="panel"><h2 id="scene-name"></h2><p id="scene-description"></p><div class="controls"><button id="listen" class="primary">Start listening</button><label><input type="checkbox" id="mono" ${sound.mono ? 'checked' : ''}>Mono audio</label><label><input type="checkbox" id="mute">Mute</label><label>Effects <input type="range" id="volume" min="0" max="100" step="1" value="65" aria-label="Effects volume"><output id="volume-value">65%</output></label></div><p id="listening-status" class="status" role="status">${options.valid ? 'Ready. Start listening to enable audio.' : 'Unknown soundcheck link. Choose a scene and start listening.'}</p><div class="field" aria-label="Sound position"><span id="field-left">Left</span><strong>You</strong><span id="field-right">Right</span></div><div class="samples" role="group" aria-label="Threat comparisons"><button data-cue="left" disabled>Warning on left</button><button data-cue="right" disabled>Warning on right</button><button data-cue="both" disabled>Both warnings</button><button data-cue="arrival" disabled>Reinforcement arrival</button></div><p class="note">Both warnings uses two separate emitters playing the same warning together. Mono keeps their timing and centers the sound.</p></section><section class="panel"><h2>Factory atmosphere</h2><div class="controls"><label><input type="checkbox" id="ambience" ${ambience ? 'checked' : ''}>Zone ambience</label><label><input type="checkbox" id="power" ${power ? 'checked' : ''}>Machinery powered</label></div><p class="note">Compare running machinery with a cut circuit. Room air and rooftop wind remain; motors and powered activity fall away. In the game this follows actual power and shutdown state.</p><div class="samples" role="group" aria-label="Material impacts">${(['armor', 'casing', 'cover', 'power', 'terrain'] as const).map((id) => `<button data-material="${id}" disabled>${{ armor: 'Hit armor', casing: 'Hit metal body', cover: 'Break cover', power: 'Disable cabinet', terrain: 'Break terrain' }[id]}</button>`).join('')}</div><p id="cue-status" class="status" role="status">Choose a sound after starting.</p></section><details><summary>Play with the full mix</summary><p>The soundcheck isolates effects. These saved-progress-safe encounters include the existing score and real machinery.</p><p><a href="./?test=flow&room=overpass&v=1">Docks</a> · <a href="./?test=flow&room=warm-exchange&v=1">Furnace</a> · <a href="./?test=flow&room=upper-return&v=1">Cooling</a> · <a href="./?test=flow&room=inspection-lane&v=1">Reclamation</a> · <a href="./?test=approach&room=signal-yard&v=1">Rooftops</a></p></details><details><summary>Audio checks</summary><p class="note">Render short silent test graphs through this browser’s audio engine to check stereo, mono, overlapping sources, mute, pause, materials, and powered/unpowered ambience.</p><button id="check-audio">Run audio checks</button><p id="check-status" role="status"></p><pre id="audio-report" aria-label="Audio verification report">No checks run yet.</pre></details>`;
function update() {
  const focused = !document.hidden && document.hasFocus();
  const active = listening && focused;
  const area = AUDIO_LAB_SCENES[scene].area;
  sound.updateMusic(
    {
      area,
      room: 'soundcheck-' + scene,
      mode: active ? 'playing' : 'paused',
      intensity: 0,
      boss: false,
      clear: false,
      musicSilent: true,
    },
    active,
  );
  sound.updateWorld(
    ambience
      ? { area, room: 'soundcheck-' + scene, power: power ? 1 : 0, activity: power ? 1 : 0 }
      : null,
    active,
  );
  $('scene-name').textContent = AUDIO_LAB_SCENES[scene].name;
  $('scene-description').textContent = AUDIO_LAB_SCENES[scene].description;
  $('listen').textContent = listening ? 'Pause listening' : 'Start listening';
  root
    .querySelectorAll<HTMLButtonElement>('[data-cue],[data-material]')
    .forEach(
      (button) => (button.disabled = !active || !sound.enabled || sound.effectsVolume === 0),
    );
  $('listening-status').textContent = !listening
    ? 'Paused. Start listening when ready.'
    : !focused
      ? 'Paused while this tab is hidden or unfocused.'
      : !sound.enabled || !sound.effectsVolume
        ? 'Muted.'
        : sound.context?.state === 'running'
          ? `${AUDIO_LAB_SCENES[scene].name} · ${sound.mono ? 'Mono' : 'Stereo'} · ${ambience ? (power ? 'Machinery powered' : 'Machinery off') : 'Effects only'}`
          : 'Audio is not running. Start listening again to retry.';
}
$('listen').onclick = async () => {
  if (listening) {
    listening = false;
    update();
    return;
  }
  sound.unlock();
  try {
    if (sound.context?.state === 'suspended') await sound.context.resume();
  } catch {
    $('listening-status').textContent =
      'Audio could not start. Check your browser audio permission and try again.';
    return;
  }
  if (!sound.context) {
    $('listening-status').textContent = 'Web Audio is unavailable in this browser.';
    return;
  }
  listening = true;
  update();
};
$<HTMLInputElement>('mono').onchange = (e) => {
  sound.mono = (e.target as HTMLInputElement).checked;
  update();
};
$<HTMLInputElement>('mute').onchange = (e) => {
  sound.enabled = !(e.target as HTMLInputElement).checked;
  update();
};
$<HTMLInputElement>('volume').oninput = (e) => {
  sound.effectsVolume = (e.target as HTMLInputElement).valueAsNumber / 100;
  $('volume-value').textContent = Math.round(sound.effectsVolume * 100) + '%';
  update();
};
$<HTMLInputElement>('ambience').onchange = (e) => {
  ambience = (e.target as HTMLInputElement).checked;
  update();
};
$<HTMLInputElement>('power').onchange = (e) => {
  power = (e.target as HTMLInputElement).checked;
  update();
};
root.querySelectorAll<HTMLAnchorElement>('[data-scene]').forEach(
  (link) =>
    (link.onclick = (e) => {
      e.preventDefault();
      scene = link.dataset.scene as AudioLabScene;
      ambience = AUDIO_LAB_SCENES[scene].ambience;
      $<HTMLInputElement>('ambience').checked = ambience;
      history.replaceState(null, '', '?scene=' + scene);
      root
        .querySelectorAll('[data-scene]')
        .forEach((el) =>
          el === link
            ? el.setAttribute('aria-current', 'page')
            : el.removeAttribute('aria-current'),
        );
      update();
    }),
);
function pulse(left: boolean, right: boolean) {
  clearTimeout(pulseTimer);
  $('field-left').dataset.lit = String(left);
  $('field-right').dataset.lit = String(right);
  pulseTimer = window.setTimeout(() => {
    delete $('field-left').dataset.lit;
    delete $('field-right').dataset.lit;
  }, 500);
}
function cue(kind: string, origin: SoundOrigin) {
  sound.play(kind, origin);
}
root.querySelectorAll<HTMLButtonElement>('[data-cue]').forEach(
  (button) =>
    (button.onclick = () => {
      const id = button.dataset.cue!;
      if (id === 'left' || id === 'both') cue('lock', { x: -420, y: 0, source: 'soundcheck-left' });
      if (id === 'right' || id === 'both')
        cue('lock', { x: 420, y: 0, source: 'soundcheck-right' });
      if (id === 'arrival') cue('reinforce', { x: 420, y: 0, source: 'soundcheck-door' });
      pulse(id === 'left' || id === 'both', id !== 'left');
      $('cue-status').textContent =
        button.textContent! + (sound.mono ? ' · centered in mono.' : '.');
    }),
);
root.querySelectorAll<HTMLButtonElement>('[data-material]').forEach(
  (button) =>
    (button.onclick = () => {
      const material = button.dataset.material as SoundMaterial;
      cue(
        material === 'armor'
          ? 'armor'
          : material === 'casing'
            ? 'hit'
            : material === 'power'
              ? 'shutdown-break'
              : 'break',
        {
          x: 0,
          y: 0,
          source: 'soundcheck-' + material,
          material,
        },
      );
      $('cue-status').textContent =
        button.textContent + ' · actual game effect and material layer.';
    }),
);
$('check-audio').onclick = async () => {
  const button = $<HTMLButtonElement>('check-audio');
  button.disabled = true;
  $('check-status').textContent = 'Rendering short audio checks…';
  try {
    const { runAudioAudit } = await import('./audio-audit.ts');
    const report = await runAudioAudit();
    $('audio-report').textContent = JSON.stringify({ version: GAME_VERSION, ...report }, null, 2);
    $('check-status').textContent = report.pass
      ? 'All audio checks passed.'
      : 'Some audio checks failed. See the report below.';
  } catch (error) {
    $('check-status').textContent =
      error instanceof Error ? error.message : 'Audio checks could not finish.';
  } finally {
    button.disabled = false;
  }
};
const refresh = () => update();
window.addEventListener('blur', refresh);
window.addEventListener('focus', refresh);
document.addEventListener('visibilitychange', refresh);
window.addEventListener('pagehide', () => {
  listening = false;
  update();
  sound.enabled = false;
});
window.setInterval(() => {
  if (listening) update();
}, 150);
$('scene-name').textContent = AUDIO_LAB_SCENES[scene].name;
$('scene-description').textContent = AUDIO_LAB_SCENES[scene].description;
