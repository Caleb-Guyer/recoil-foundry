import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import {
  buildMotion,
  buildMotionCue,
  buildMotionDefinition,
  buildMotionConnections,
} from '../src/build-motion.ts';
import { drawBuildMotion } from '../src/build-motion-art.ts';
import { SHIFT_MODS } from '../src/shift-catalog.ts';
import { fixture, target, wall, round, Body, Composite, Engine } from './branches-fixture.ts';
import type { Game, Input } from '../src/game.ts';
const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: false,
  fire: false,
  aim: { x: 600, y: 300 },
};
const clean = (g: Game) => {
  Composite.clear(g.engine.world, false);
  Engine.clear(g.engine);
};
const row = (g: Game, id: string) => buildMotion(g).find((entry) => entry.id === id)!;
function mount(g: Game) {
  const body = wall(g, 400, 300, 20, 200);
  return { body, local: { x: -10, y: 0 }, normal: { x: -1, y: 0 }, until: g.time + 3 };
}

test('authored explanations cover every new fitting without revealing unowned mechanics', () => {
  const g = fixture([]);
  assert.deepEqual(buildMotion(g), []);
  assert.deepEqual(buildMotionConnections([]), []);
  for (const mod of SHIFT_MODS) {
    const definition = buildMotionDefinition(mod.id)!;
    assert.equal(definition.name, mod.name);
    assert(definition.trigger.length > 20);
    assert(['standard', 'groups', 'incoming', 'cover', 'recoil'].includes(definition.scenario));
    g.mods = [mod.id];
    assert.deepEqual(
      buildMotion(g).map((r) => r.id),
      [mod.id],
    );
  }
  assert.equal(buildMotionDefinition('not-a-fitting'), undefined);
  const copy = buildMotionDefinition('slip-gauge')!;
  copy.name = 'Changed';
  assert.equal(buildMotionDefinition('slip-gauge')!.name, 'Slip Gauge');
  clean(g);
});

test('connections prioritize actual morphs and fusions and do not invent activation counts', () => {
  const connections = buildMotionConnections(['momentum-battery', 'catch-chamber', 'seeker-rack']);
  assert.deepEqual(
    connections.map((c) => c.title),
    ['Seeker Rack', 'Catch Chamber', 'Momentum Battery'],
  );
  assert(connections[1].detail.includes('release fire'));
  assert(!connections.some((c) => /DPS|activations|damage dealt/.test(c.detail)));
});

test('a leased morph is explained as equipped without changing the earned build', () => {
  const g = fixture([]);
  g.shiftRun.state = {
    version: 1,
    routes: [],
    powers: [],
    leases: [],
    paid: [],
    grants: [],
    freeRerolls: 0,
    repairs: [],
    lease: { morph: 'seeker-rack', stage: 6, cleared: [], status: 'active' },
  };
  assert.equal(buildMotion(g).find((r) => r.id === 'seeker-rack')?.state, 'waiting');
  assert.deepEqual(g.mods, []);
  clean(g);
});

test('real Seeker paint changes waiting to charging to actionable locks, then cover invalidates readiness', () => {
  const g = fixture(['seeker-rack']);
  const enemy = target(g, 600);
  assert.equal(row(g, 'seeker-rack').state, 'waiting');
  g.shiftMorphs.input(0.1, { ...idle, fire: true });
  assert.equal(row(g, 'seeker-rack').state, 'charging');
  for (let n = 0; n < 3; n++) g.shiftMorphs.input(0.1, { ...idle, fire: true });
  assert.equal(row(g, 'seeker-rack').state, 'ready');
  assert.deepEqual(buildMotionCue(g), { id: 'seeker-rack', label: 'Release locks' });
  const progress = g.shiftMorphs.locks[0].progress;
  wall(g, 400, 300, 20, 200);
  assert.equal(row(g, 'seeker-rack').state, 'waiting');
  assert.equal(buildMotionCue(g), null);
  assert.equal(
    g.shiftMorphs.locks[0].progress,
    progress,
    'inspection must not discard the real lock',
  );
  clean(g);
});

test('a native pause clears Seeker paint and suppresses world readiness cues', () => {
  const g = fixture(['seeker-rack']);
  target(g, 600);
  for (let n = 0; n < 4; n++) g.shiftMorphs.input(0.1, { ...idle, fire: true });
  assert.equal(row(g, 'seeker-rack').state, 'ready');
  g.setMode('paused');
  assert.equal(row(g, 'seeker-rack').state, 'waiting');
  assert.match(row(g, 'seeker-rack').detail, /On resume:/);
  assert.equal(buildMotionCue(g), null);
  clean(g);
});

test('remote muzzle readiness uses native surface, distance and launch-volume checks without spending the muzzle', () => {
  const g = fixture(['offset-nozzle']);
  g.time = 1;
  g.shotCount = 1;
  g.shootAt = 0;
  const nozzle = { ...mount(g), installed: 1 };
  g.shiftUpgrades.nozzle = nozzle;
  assert.equal(row(g, 'offset-nozzle').state, 'ready');
  assert.equal(buildMotionCue(g)?.id, 'offset-nozzle');
  assert.equal(nozzle.used, undefined);
  g.shootAt = 2;
  assert.equal(row(g, 'offset-nozzle').state, 'charging');
  g.shootAt = 0;
  const blocker = wall(g, 383, 300, 8, 80);
  assert.equal(row(g, 'offset-nozzle').state, 'blocked');
  assert.equal(buildMotionCue(g), null);
  Composite.remove(g.engine.world, blocker);
  g.terrain = g.terrain.filter((b) => b !== blocker);
  Body.setPosition(g.player, { x: 1200, y: 300 });
  assert.equal(row(g, 'offset-nozzle').state, 'blocked');
  g.time = 5;
  assert.equal(row(g, 'offset-nozzle').state, 'waiting');
  assert.equal(
    g.shiftUpgrades.nozzle,
    nozzle,
    'readiness must not clean up or consume native state',
  );
  clean(g);
});

test('a pad is only actionable when the player can use the native surface launch', () => {
  const g = fixture(['spring-rivets']);
  g.time = 1;
  const pad = mount(g);
  g.shiftUpgrades.rivets = [pad];
  assert.equal(row(g, 'spring-rivets').state, 'active');
  Body.setPosition(g.player, { x: 362, y: 300 });
  assert.equal(row(g, 'spring-rivets').state, 'ready');
  assert.equal(buildMotionCue(g)?.label, 'Jump from pad');
  assert.equal(g.shiftUpgrades.rivets.length, 1);
  g.time = 5;
  assert.equal(row(g, 'spring-rivets').state, 'waiting');
  clean(g);
});

test('battery reserve and dodge charges explain the correct grounded or airborne action', () => {
  const g = fixture(['momentum-battery', 'slip-gauge']);
  g.time = 1;
  g.shiftUpgrades.battery = 3;
  g.grounded = true;
  assert.equal(row(g, 'momentum-battery').state, 'ready');
  assert.equal(buildMotionCue(g)?.label, 'Jump reserve');
  g.shiftUpgrades.slipUntil = 2;
  assert.equal(row(g, 'slip-gauge').state, 'active');
  g.grounded = false;
  assert.equal(row(g, 'momentum-battery').state, 'active');
  assert.equal(row(g, 'slip-gauge').state, 'ready');
  assert.equal(buildMotionCue(g)?.label, 'Air burst ready');
  g.time = 3;
  assert.equal(row(g, 'slip-gauge').state, 'waiting');
  clean(g);
});

test('actual Countershot capture becomes release-ready only while the trigger is held', () => {
  const g = fixture(['suspension', 'countershot', 'catch-chamber']);
  g.time = 1;
  assert.equal(row(g, 'catch-chamber').state, 'waiting');
  const hostile = round(g, { friendly: false, radius: 2, damage: 18, vel: { x: -12, y: 0 } });
  assert(g.ballistics.reflectRound(hostile, { x: 400, y: 300 }));
  assert.equal(g.shiftFusions.captured.length, 1);
  assert.equal(row(g, 'catch-chamber').state, 'active');
  g.stasis.input(true);
  assert.equal(row(g, 'catch-chamber').state, 'ready');
  assert.equal(buildMotionCue(g)?.label, 'Release payload');
  g.stasis.input(false);
  assert.equal(row(g, 'catch-chamber').state, 'waiting');
  clean(g);
});

test('Capacitor and Countershot report actual shared native reserve states', () => {
  const g = fixture(['capacitor', 'countershot']);
  g.time = 1;
  assert.equal(row(g, 'capacitor').state, 'charging');
  g.ballistics.charge(0.85, false);
  assert.equal(row(g, 'capacitor').state, 'ready');
  const shot = round(g, { friendly: false, damage: 18, radius: 2 });
  assert(g.ballistics.reflectRound(shot, { x: 400, y: 300 }));
  assert.equal(row(g, 'countershot').state, 'charging');
  assert.equal(row(g, 'countershot').progress, 0);
  g.ballistics.charge(0.8, false);
  assert.equal(row(g, 'countershot').state, 'ready');
  const cells = g.ballistics.charges;
  g.setMode('paused');
  assert.equal(row(g, 'capacitor').state, 'ready');
  assert.match(row(g, 'capacitor').detail, /On resume:/);
  assert.equal(g.ballistics.charges, cells);
  clean(g);
});

test('dead, title, hitstop and visual transitions cannot promise actionable readiness', () => {
  const g = fixture(['momentum-battery']);
  g.shiftUpgrades.battery = 5;
  g.grounded = true;
  for (const mode of ['title', 'dead', 'won', 'upgrade'] as const) {
    g.mode = mode;
    assert.equal(row(g, 'momentum-battery').state, 'blocked');
    assert.equal(buildMotionCue(g), null);
  }
  g.mode = 'playing';
  g.hitStop = 0.1;
  assert.equal(row(g, 'momentum-battery').state, 'blocked');
  assert.equal(buildMotionCue(g), null);
  g.hitStop = 0;
  g.finale.state = 'transform';
  assert.equal(row(g, 'momentum-battery').state, 'blocked');
  assert.equal(buildMotionCue(g), null);
  clean(g);
});

test('repeated inspection is read-only for physics, reserves, stored payloads and report counters', () => {
  const g = fixture([
    'capacitor',
    'countershot',
    'momentum-battery',
    'offset-nozzle',
    'slip-gauge',
  ]);
  g.time = 1;
  g.shiftUpgrades.battery = 4;
  g.shiftUpgrades.slipUntil = 3;
  g.ballistics.charges = 1;
  g.shiftUpgrades.nozzle = { ...mount(g), installed: 0 };
  g.shotCount = 1;
  const snapshot = () =>
    JSON.stringify({
      mods: g.mods,
      time: g.time,
      shotCount: g.shotCount,
      position: g.player.position,
      velocity: g.player.velocity,
      cells: g.ballistics.charges,
      battery: g.shiftUpgrades.battery,
      slip: g.shiftUpgrades.slipUntil,
      nozzleUsed: g.shiftUpgrades.nozzle?.used,
      shotIds: g.shots.map((s) => s.id),
      report: g.combatReport.snapshot(),
    });
  const before = snapshot();
  for (let n = 0; n < 50; n++) {
    buildMotion(g);
    buildMotionCue(g);
  }
  assert.equal(snapshot(), before);
  clean(g);
});

test('the cue layer draws one calm label in either effects mode and no label while paused', () => {
  const g = fixture(['momentum-battery', 'slip-gauge']);
  g.time = 1;
  g.grounded = false;
  g.shiftUpgrades.slipUntil = 3;
  g.shiftUpgrades.battery = 5;
  const labels: string[] = [];
  const context = {
    save() {},
    restore() {},
    measureText(text: string) {
      return { width: text.length * 6 };
    },
    fillRect() {},
    fillText(text: string) {
      labels.push(text);
    },
  } as unknown as CanvasRenderingContext2D;
  drawBuildMotion(context, g, false, 0.6);
  assert.deepEqual(labels, ['Air burst ready']);
  labels.length = 0;
  drawBuildMotion(context, g, true, 0.6);
  assert.deepEqual(labels, ['Air burst ready']);
  labels.length = 0;
  g.mode = 'paused';
  drawBuildMotion(context, g, true);
  assert.deepEqual(labels, []);
  clean(g);
});

test('Wake Wire readiness follows native held fire and actual recoil travel rather than a morph trigger', () => {
  const g = fixture(['wake-wire']);
  g.time = 1;
  for (let n = 0; n < 9; n++) {
    g.time += 1 / 60;
    Body.setVelocity(g.player, { x: 8, y: 0 });
    g.shiftUpgrades.beforeStep(1 / 60, { ...idle, fire: true });
    g.shiftUpgrades.recoilDelta({ x: -1, y: 0 }, 2);
    Body.translate(g.player, { x: 16, y: 0 });
    g.shiftUpgrades.afterStep(1 / 60, { ...idle, fire: true });
  }
  assert.equal(
    g.shiftMorphs.triggerHeld,
    false,
    'native filtered fire can differ from the morph trigger',
  );
  assert.equal(row(g, 'wake-wire').state, 'ready');
  assert.equal(buildMotionCue(g)?.label, 'Release to arm');
  g.shiftUpgrades.beforeStep(1 / 60, idle);
  assert.equal(row(g, 'wake-wire').state, 'active');
  assert.equal(buildMotionCue(g), null);
  clean(g);
});

test('Gate Snare reports native arming, armed and blocked paths without rebuilding or removing the wire', () => {
  const g = fixture(['fold', 'tripwire', 'gate-snare']);
  const left = wall(g, 600, 400, 20, 500),
    right = wall(g, 1200, 400, 20, 500),
    floor = wall(g, 1000, 730, 1600, 20);
  g.portals.pair = [
    { body: left, pos: { x: 589, y: 400 }, normal: { x: -1, y: 0 } },
    { body: right, pos: { x: 1211, y: 400 }, normal: { x: 1, y: 0 } },
  ];
  g.portals.next = 2;
  const anchor = (x: number) => ({
    body: floor,
    pos: { x, y: 717 },
    normal: { x: 0, y: -1 },
    origin: { ...floor.position },
    angle: floor.angle,
    damage: 24,
  });
  assert(g.shiftFusions.linkGate(anchor(400), anchor(1450)));
  assert.equal(row(g, 'gate-snare').state, 'charging');
  g.time = 0.3;
  assert.equal(row(g, 'gate-snare').state, 'active');
  const gate = g.shiftFusions.gate!,
    segment = gate.segments[0];
  wall(g, (segment.a.x + segment.b.x) / 2, (segment.a.y + segment.b.y) / 2, 20, 50);
  assert.equal(row(g, 'gate-snare').state, 'blocked');
  assert.equal(g.shiftFusions.gate, gate);
  clean(g);
});

test('Hot Wire explains only a living clear native cable and actual supplied beam energy', () => {
  const g = fixture(['cutting-torch', 'tether', 'hot-wire']);
  g.time = 1;
  const a = target(g, 600),
    b = target(g, 800);
  g.tethers.link = { a, b, length: 200, until: 10, tension: 0 };
  assert.equal(row(g, 'hot-wire').state, 'waiting');
  assert.equal(
    g.shiftFusions.beamSample(
      [
        {
          a: { x: 200, y: 300 },
          b: { x: 800, y: 300 },
          dir: { x: 1, y: 0 },
          gain: 1,
          muzzle: true,
        },
      ],
      40,
      1,
    ),
    0.75,
  );
  assert.equal(row(g, 'hot-wire').state, 'active');
  const hot = g.shiftFusions.hot;
  wall(g, 700, 300, 20, 60);
  assert.equal(row(g, 'hot-wire').state, 'blocked');
  assert.equal(g.shiftFusions.hot, hot, 'inspection cannot spend or discard the real cable energy');
  clean(g);
});

test('readiness labels stay within both world edges at ordinary and wide framing scales', () => {
  const g = fixture(['momentum-battery']);
  g.grounded = true;
  g.shiftUpgrades.battery = 5;
  const rectangles: { x: number; width: number }[] = [];
  const centers: number[] = [];
  const context = {
    save() {},
    restore() {},
    measureText(text: string) {
      return { width: text.length * 6 };
    },
    fillRect(x: number, _y: number, width: number) {
      rectangles.push({ x, width });
    },
    fillText(_text: string, x: number) {
      centers.push(x);
    },
  } as unknown as CanvasRenderingContext2D;
  for (const scale of [0.4, 0.6, 1, 1.5]) {
    for (const edge of [10, g.worldWidth - 10]) {
      Body.setPosition(g.player, { x: edge, y: 300 });
      drawBuildMotion(context, g, false, scale);
      const rectangle = rectangles.at(-1)!;
      assert(rectangle.x >= 8 / scale - 1e-8);
      assert(rectangle.x + rectangle.width <= g.worldWidth - 8 / scale + 1e-8);
      assert.equal(centers.at(-1), rectangle.x + rectangle.width / 2);
      assert.equal(g.player.position.x, edge, 'clamping the label cannot move the player');
    }
  }
  assert.equal(centers.length, 8);
  clean(g);
});
