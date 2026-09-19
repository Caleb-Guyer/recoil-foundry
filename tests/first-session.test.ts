import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Input } from '../src/game.ts';
import { FirstSessionGuide, audioState, controlsIntro } from '../src/first-session.ts';
import { interactionCues } from '../src/interaction-cues.ts';
import { shutdownTestFromUrl, DISCONNECT } from '../src/shutdown-layout.ts';
import { auditorTestFromUrl } from '../src/auditor-layout.ts';
import { eventTestFromUrl } from '../src/area-events.ts';
import { distance } from '../src/rules.ts';
import { loadLogbook, recordLogbook } from '../src/logbook.ts';
import { snapshotRun } from '../src/run-history.ts';

const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: true,
  fire: false,
  aim: { x: 500, y: 723 },
};
function step(g: Game, guide: FirstSessionGuide, count: number, extra: Partial<Input> = {}) {
  for (let i = 0; i < count; i++) {
    const input = { ...idle, ...extra };
    g.tick(1 / 60, input);
    guide.observe(g, input);
  }
}

test('the harmless starting-gun warm-up teaches actual movement, jumping, shooting and recoil without granting progress', () => {
  const g = new Game(),
    guide = new FirstSessionGuide();
  let saves = 0;
  g.onCheckpoint = () => saves++;
  g.startWorkshop([], []);
  step(g, guide, 30);
  guide.start(g, true);
  step(g, guide, 30, { right: true });
  assert(guide.moved);
  step(g, guide, 1, { jump: true });
  assert(guide.jumped);
  assert(!guide.recoiled, 'an ordinary jump cannot complete recoil practice');
  for (let i = 0; i < 50; i++)
    step(g, guide, 1, {
      fire: true,
      aim: { x: g.player.position.x, y: g.player.position.y + 300 },
    });
  assert(guide.fired && guide.recoiled);
  step(g, guide, 480);
  for (let i = 0; i < 900 && !guide.hit; i++) {
    const target = [...g.enemies].sort(
      (a, b) =>
        distance(a.body.position, g.player.position) - distance(b.body.position, g.player.position),
    )[0];
    step(g, guide, 1, { fire: true, aim: target?.body.position ?? idle.aim });
  }
  assert(guide.complete);
  assert.match(guide.message(g, 'keyboard'), /Ready/);
  g.damagePlayer(9999);
  g.save();
  assert.equal(g.hp, 100);
  assert.equal(saves, 0);
  assert.deepEqual(g.mods, []);
  assert.deepEqual(recordLogbook(loadLogbook(null), g), loadLogbook(null));
  assert.equal(snapshotRun(g, 'warmup', 1), null);
  guide.start(g, true);
  assert(!guide.complete && !guide.moved && !guide.recoiled, 'restart resets the lessons');
});

test('opening tips expire, pause with the run, hide in later rooms, and do not leak into isolated modes', () => {
  const g = new Game(),
    guide = new FirstSessionGuide();
  g.start('first-session');
  guide.start(g);
  assert.match(guide.message(g, 'keyboard'), /A \/ D/);
  assert.match(guide.message(g, 'controller'), /Left stick/);
  assert.match(guide.message(g, 'touch'), /left arrows/);
  g.time += 8;
  assert.equal(guide.message(g, 'keyboard'), '');
  g.clear = true;
  assert.match(guide.message(g, 'keyboard'), /door.*right/);
  g.setMode('paused');
  assert.equal(guide.message(g, 'keyboard'), '');
  g.setMode('playing');
  g.stage = 1;
  assert.equal(guide.message(g, 'keyboard'), '');
  g.startWorkshop([], []);
  assert.equal(guide.message(g, 'keyboard'), '');
  guide.start(g, true);
  guide.stop();
  assert.equal(guide.message(g, 'keyboard'), '');
});

test('audio state explains the master mute even when Music remains checked', () => {
  assert.equal(audioState(false, true).music, 'Muted');
  assert.match(audioState(false, true).note, /Enable Sound/);
  assert.equal(audioState(true, false).sound, 'On');
  assert.equal(audioState(true, false).music, 'Off');
  assert.equal(audioState(true, true).note, '');
  for (const device of ['keyboard', 'controller', 'touch'] as const) {
    const copy = controlsIntro(device);
    assert(copy.includes('Move') && copy.includes('Jump') && copy.includes('Pause'));
    assert(
      !/boss|portal|Auditor|shutdown|Overtime/i.test(copy),
      'base controls must not spoil unearned mechanics',
    );
  }
});

test('shoot cues require a nearby exposed control and disappear behind physical cover', () => {
  const g = new Game();
  g.startTest(shutdownTestFromUrl(new URL('https://test/?test=shutdown&scene=relay'))!);
  g.clear = false;
  assert.deepEqual(interactionCues(g), []);
  g.enemies.forEach((e) => Matter.Composite.remove(g.engine.world, e.body));
  g.enemies = [];
  g.waves.clear();
  g.clear = true;
  Matter.Body.setPosition(g.player, { x: DISCONNECT.x + 100, y: DISCONNECT.y });
  assert.deepEqual(interactionCues(g), [{ kind: 'shoot', pos: DISCONNECT }]);
  const cover = Matter.Bodies.rectangle(DISCONNECT.x + 50, DISCONNECT.y, 15, 100, {
    isStatic: true,
  });
  g.terrain.push(cover);
  Matter.Composite.add(g.engine.world, cover);
  assert.deepEqual(interactionCues(g), []);
  Matter.Composite.remove(g.engine.world, cover);
  g.terrain = g.terrain.filter((b) => b !== cover);
  Matter.Body.setPosition(g.player, { x: 800, y: 720 });
  assert.deepEqual(interactionCues(g), []);
});

test('sealed cases use the same shoot shape only after the room is clear and within reach', () => {
  const g = new Game();
  g.startTest(auditorTestFromUrl(new URL('https://test/?test=auditor&phase=case'))!);
  g.clear = false;
  assert.deepEqual(interactionCues(g), []);
  g.enemies.forEach((e) => Matter.Composite.remove(g.engine.world, e.body));
  g.enemies = [];
  g.waves.clear();
  g.clear = true;
  Matter.Body.setPosition(g.player, { x: 170, y: 718 });
  assert(interactionCues(g).some((cue) => cue.kind === 'shoot'));
  Matter.Body.setPosition(g.player, { x: 800, y: 718 });
  assert.deepEqual(interactionCues(g), []);
});

test('ready lockdown switches show a jump shape at the actual interaction distance', () => {
  const p = eventTestFromUrl(new URL('https://test/?test=events&event=lockdown'));
  assert(p);
  const g = new Game();
  g.startTest(p);
  g.enemies.forEach((e) => Matter.Composite.remove(g.engine.world, e.body));
  g.enemies = [];
  g.waves.clear();
  assert(g.areaEvents.terminalReady);
  Matter.Body.setPosition(g.player, { ...g.areaEvents.site });
  assert(interactionCues(g).some((cue) => cue.kind === 'jump'));
  Matter.Body.setPosition(g.player, { x: g.areaEvents.site.x + 66, y: g.areaEvents.site.y });
  assert(!interactionCues(g).some((cue) => cue.kind === 'jump'));
});
