import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Input } from '../src/game.ts';
import { operatorPose, type OperatorPose } from '../src/operator-pose.ts';
import { drawOperator } from '../src/operator-art.ts';
import { drawWeapon } from '../src/weapon-art.ts';
import { OUTFITS, drawOutfit, type Cosmetics } from '../src/cosmetics.ts';
import { STARTING_GUN_IDS, type StartingGun } from '../src/starting-guns.ts';
import {
  operatorTestFromUrl,
  operatorTestRoom,
  prepareOperatorTest,
} from '../src/operator-test.ts';

const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: false,
  fire: false,
  aim: { x: 900, y: 680 },
};
function actor(gun: StartingGun = 'pistol', morph = 'native') {
  const spec = operatorTestFromUrl(
    new URL(
      'https://example.test/?test=operator&scene=grips&gun=' + gun + '&morph=' + morph + '&v=1',
    ),
  )!;
  const g = new Game();
  g.startTest(spec.checkpoint, operatorTestRoom(spec));
  assert(prepareOperatorTest(g, spec));
  g.time = 2;
  g.grounded = true;
  g.aim = { x: g.player.position.x + 500, y: g.player.position.y };
  return g;
}
function tick(g: Game, frames: number, input = idle) {
  for (let i = 0; i < frames; i++) g.tick(1 / 60, input);
}
type Operation = { name: string; args: unknown[] };
function canvas() {
  let depth = 0;
  const values: Record<string, unknown> = { globalAlpha: 1, lineWidth: 1 };
  const saved: Record<string, unknown>[] = [];
  const operations: Operation[] = [];
  const context = new Proxy({} as CanvasRenderingContext2D, {
    get(_target, key) {
      if (Object.hasOwn(values, key)) return values[String(key)];
      return (...args: unknown[]) => {
        if (key === 'save') {
          depth++;
          saved.push({ ...values });
        }
        if (key === 'restore') {
          depth--;
          assert(depth >= 0, 'balanced canvas stack');
          for (const name of Object.keys(values)) delete values[name];
          Object.assign(values, saved.pop());
        }
        for (const v of args) if (typeof v === 'number') assert(Number.isFinite(v), String(key));
        if (key === 'arc' || key === 'ellipse')
          assert((args[2] as number) >= 0, 'nonnegative radius');
        if (key === 'fillRect' || key === 'roundRect' || key === 'rect') {
          assert(
            (args[2] as number) >= 0 && (args[3] as number) >= 0,
            String(key) + ' nonnegative size',
          );
        }
        assert(
          !['fillText', 'strokeText', 'drawImage', 'getImageData', 'clearRect'].includes(
            String(key),
          ),
        );
        operations.push({ name: String(key), args });
      };
    },
    set(_target, key, value) {
      if (key === 'globalAlpha') assert(Number.isFinite(value) && value >= 0 && value <= 1);
      if (key === 'lineWidth') assert(Number.isFinite(value) && value > 0);
      values[String(key)] = value;
      operations.push({ name: 'style:' + String(key), args: [value] });
      return true;
    },
  });
  return {
    context,
    operations,
    get depth() {
      return depth;
    },
  };
}
function numeric(value: unknown) {
  if (typeof value === 'number') assert(Number.isFinite(value));
  else if (Array.isArray(value)) value.forEach(numeric);
  else if (value && typeof value === 'object') Object.values(value).forEach(numeric);
}

test('actual movement, jump, recoil flight and landing choose distinct joint poses', () => {
  const g = actor();
  assert.equal(operatorPose(g).state, 'idle');
  Matter.Body.setVelocity(g.player, { x: 5, y: 0 });
  assert.equal(operatorPose(g).state, 'run');
  g.grounded = false;
  g.jumpAt = g.time;
  Matter.Body.setVelocity(g.player, { x: 2, y: -9 });
  const jump = operatorPose(g);
  assert.equal(jump.state, 'jump');
  assert(jump.legs.every((leg) => !leg.planted));
  g.lastShot = g.time;
  const launch = operatorPose(g);
  assert.equal(launch.state, 'launch');
  assert.notDeepEqual(jump.body, launch.body);
  g.lastShot = -100;
  Matter.Body.setVelocity(g.player, { x: 2, y: 9 });
  const fall = operatorPose(g);
  assert.equal(fall.state, 'fall');
  assert.notDeepEqual(fall.legs, jump.legs);
  g.grounded = true;
  g.combatFeel.landedAt = g.time;
  g.combatFeel.landingStrength = 1;
  const land = operatorPose(g);
  assert.equal(land.state, 'landing');
  assert(land.body.y > operatorPose(actor()).body.y);
});

test('native jump and real landing are read without synthesizing a movement event', () => {
  const g = actor();
  tick(g, 35);
  assert(g.grounded);
  g.tick(1 / 60, { ...idle, jump: true, jumpHeld: true });
  assert(['jump', 'launch'].includes(operatorPose(g).state));
  for (let i = 0; i < 180 && (!g.grounded || g.combatFeel.landedAt < 0); i++) g.tick(1 / 60, idle);
  assert(g.grounded);
  assert(g.combatFeel.landedAt >= 0);
  assert(['landing', 'idle'].includes(operatorPose(g).state));
});

test('a running stance foot remains planted in world coordinates over the distance phase', () => {
  const g = actor();
  Matter.Body.setVelocity(g.player, { x: 5.5, y: 0 });
  const a = operatorPose(g);
  assert(a.legs[0].planted);
  const beforeX = a.legs[0].end.x + g.player.position.x;
  Matter.Body.translate(g.player, { x: 1, y: 0 });
  const b = operatorPose(g);
  assert(b.legs[0].planted);
  assert(Math.abs(b.legs[0].end.x + g.player.position.x - beforeX) < 1e-9);
  assert.equal(a.legs[0].end.y, b.legs[0].end.y);
  Matter.Body.translate(g.player, { x: 8, y: 0 });
  const swing = operatorPose(g);
  assert(swing.legs.some((leg) => !leg.planted && leg.end.y < a.legs[0].end.y));
});

test('aim-opposite movement stays backpedaling; only measured braking plants a wide brake stance', () => {
  const g = actor();
  Matter.Body.setVelocity(g.player, { x: -5, y: 0 });
  assert.equal(operatorPose(g).state, 'run', 'aim is not movement input');
  g.operatorSurface.braking = 0.85;
  const stopped = operatorPose(g);
  assert.equal(stopped.state, 'brake');
  assert(stopped.legs.every((leg) => leg.planted));
  assert.notDeepEqual(stopped.legs, operatorPose(actor()).legs);
});

test('actual support height anchors boot soles without changing the native hull', () => {
  const g = actor();
  g.operatorSurface.contact = {
    surface: 'metal',
    body: g.terrainBodies[0],
    point: { x: g.player.position.x, y: g.player.position.y + 17 },
    supportVelocity: { x: 0, y: 0 },
  };
  const before = JSON.stringify(g.player.bounds);
  const pose = operatorPose(g);
  assert(pose.legs.every((leg) => leg.end.y === 15));
  assert.equal(JSON.stringify(g.player.bounds), before);
});

test('all aim quadrants keep trigger and support wrists attached to the original weapon pivot', () => {
  for (const gun of STARTING_GUN_IDS) {
    const g = actor(gun);
    for (let i = 0; i < 16; i++) {
      const angle = (i * Math.PI) / 8;
      g.aim = {
        x: g.player.position.x + Math.cos(angle) * 500,
        y: g.player.position.y + Math.sin(angle) * 500,
      };
      const pose = operatorPose(g);
      assert.deepEqual(pose.weapon.pivot, { x: 0, y: -3 });
      assert(Math.abs(pose.weapon.angle - Math.atan2(Math.sin(angle), Math.cos(angle))) < 1e-12);
      for (const [armIndex, gripIndex] of [
        [0, 1],
        [1, 0],
      ]) {
        const grip = pose.weapon.grips[gripIndex];
        const end = pose.arms[armIndex].end;
        assert(Math.abs(end.x - (Math.cos(angle) * grip.x - Math.sin(angle) * grip.y)) < 1e-9);
        assert(Math.abs(end.y - (-3 + Math.sin(angle) * grip.x + Math.cos(angle) * grip.y)) < 1e-9);
      }
      numeric(pose);
    }
  }
});

test('tool-specific support grips and real receiver cycles remain distinct across native and converted tools', () => {
  const signatures = new Set<string>();
  for (const gun of STARTING_GUN_IDS) {
    const g = actor(gun);
    signatures.add(JSON.stringify(operatorPose(g).weapon));
    g.lastShot = g.time;
    g.muzzle = 0.065;
    const fired = operatorPose(g);
    assert(fired.weapon.grips[0].x < 10);
    g.time += 1;
    g.muzzle = 0;
    assert.equal(operatorPose(g).weapon.grips[0].x, 10);
  }
  assert(signatures.size >= 4);
  for (const morph of ['beam', 'piston', 'saw', 'seeker', 'foam']) {
    const g = actor('twinbore', morph);
    const pose = operatorPose(g);
    assert.notEqual(pose.weapon.kind, 'twinbore');
    g.lastShot = g.time;
    g.muzzle = 0.065;
    assert.equal(
      operatorPose(g).weapon.grips[0].x,
      10,
      'fixed conversion receiver retains its hand anchor',
    );
  }
});

test('Pause preserves the complete pose including active braking and idle breath', () => {
  const g = actor('shotgun');
  Matter.Body.setVelocity(g.player, { x: 3, y: 0 });
  g.operatorSurface.braking = 0.8;
  g.lastShot = g.time - 0.03;
  const before = operatorPose(g);
  g.setMode('paused');
  tick(g, 50);
  assert.deepEqual(operatorPose(g), before);
  const idleG = actor();
  const first = operatorPose(idleG);
  idleG.time += 0.8;
  assert.notEqual(
    operatorPose(idleG).body.y,
    first.body.y,
    'subpixel native idle breath is visible',
  );
  const quiet = operatorPose(idleG, true);
  idleG.time += 0.8;
  assert.deepEqual(operatorPose(idleG, true), quiet);
});

test('Reduced Effects uses bounded quiet poses and removes cloth and landing exaggeration', () => {
  const g = actor('shotgun');
  g.lastShot = g.time;
  g.combatFeel.landedAt = g.time;
  g.combatFeel.landingStrength = 1;
  const full = operatorPose(g),
    quiet = operatorPose(g, true);
  assert(Math.abs(quiet.body.angle) <= Math.abs(full.body.angle));
  assert.equal(quiet.body.x, 0);
  assert.equal(quiet.body.y, 0);
  assert.equal(quiet.cloth, 0);
  assert.deepEqual(quiet.weapon.pivot, full.weapon.pivot);
});

test('every outfit and tool renders finite, balanced native joint and weapon geometry in both facing directions', () => {
  const tools: [StartingGun, string][] = [
    ...STARTING_GUN_IDS.map((gun): [StartingGun, string] => [gun, 'native']),
    ['pistol', 'beam'],
    ['shotgun', 'piston'],
    ['nailgun', 'saw'],
    ['carbine', 'seeker'],
    ['repeater', 'foam'],
  ];
  let rendered = 0;
  for (const [gun, morph] of tools) {
    const g = actor(gun, morph);
    g.lastShot = g.time - 0.035;
    g.muzzle = 0.03;
    Matter.Body.setVelocity(g.player, { x: 5, y: -4 });
    for (const outfit of Object.keys(OUTFITS) as Cosmetics['outfit'][])
      for (const angle of [0, Math.PI / 2, Math.PI, -Math.PI / 2])
        for (const reduced of [false, true]) {
          g.cosmetics.outfit = outfit;
          g.aim = {
            x: g.player.position.x + Math.cos(angle) * 600,
            y: g.player.position.y + Math.sin(angle) * 600,
          };
          const surface = canvas();
          drawOperator(surface.context, g, reduced, 0.8);
          assert.equal(surface.depth, 0);
          assert(
            surface.operations.some((op) => op.name === 'arc'),
            'visible knee/elbow joints',
          );
          assert(
            surface.operations.some((op) => op.name === 'lineTo'),
            'linked articulated limbs',
          );
          assert(surface.operations.length < 800, 'bounded geometry budget');
          numeric(operatorPose(g, reduced));
          rendered++;
        }
  }
  assert.equal(rendered, tools.length * Object.keys(OUTFITS).length * 8);
});

test('native weapon drawing remains an exact untouched subsequence after the operator body transforms', () => {
  for (const [gun, morph] of [
    ['pistol', 'native'],
    ['shotgun', 'native'],
    ['carbine', 'native'],
    ['twinbore', 'beam'],
    ['nailgun', 'piston'],
  ] as [StartingGun, string][]) {
    const g = actor(gun, morph);
    g.lastShot = g.time - 0.03;
    g.aim = { x: g.player.position.x - 300, y: g.player.position.y - 250 };
    const all = canvas(),
      native = canvas();
    drawOperator(all.context, g, false);
    const pose = operatorPose(g);
    native.context.save();
    native.context.translate(0, -3);
    native.context.rotate(pose.weapon.angle);
    drawWeapon(native.context, g, false);
    const needle = JSON.stringify(native.operations).slice(1, -1);
    assert(
      JSON.stringify(all.operations).includes(needle),
      gun + '/' + morph + ' preserves actual native weapon commands and transform',
    );
  }
});

test('outfit details remain distinct and retain the common bright visor', () => {
  const signatures = new Set<string>();
  for (const id of Object.keys(OUTFITS) as Cosmetics['outfit'][]) {
    const surface = canvas();
    drawOutfit(surface.context, id, 1, 0, { articulated: true, cloth: 0.5, brace: 0.2 });
    assert.equal(surface.depth, 0);
    assert(
      surface.operations.some(
        (op) => op.name === 'fillRect' && JSON.stringify(op.args) === '[-8,-10,16,7]',
      ),
    );
    assert(
      surface.operations.some(
        (op) => op.name === 'fillRect' && JSON.stringify(op.args) === '[3,-9,3,5]',
      ),
    );
    signatures.add(JSON.stringify(surface.operations));
  }
  assert.equal(signatures.size, Object.keys(OUTFITS).length);
});

test('drawing and pose projection never change physics, weapon discharge, RNG, progress or sounds', () => {
  const g = actor('shotgun', 'saw');
  g.fire();
  let callbacks = 0;
  g.onCheckpoint = () => callbacks++;
  g.onSound = () => callbacks++;
  g.onCommendation = () => callbacks++;
  g.onBossDefeated = () => callbacks++;
  const snapshot = () =>
    JSON.stringify({
      body: {
        position: g.player.position,
        velocity: g.player.velocity,
        bounds: g.player.bounds,
        force: g.player.force,
        angle: g.player.angle,
        mass: g.player.mass,
      },
      mods: g.mods,
      gun: g.gun,
      time: g.time,
      elapsed: g.elapsed,
      shots: g.shots.map((shot) => ({
        id: shot.id,
        pos: shot.pos,
        vel: shot.vel,
        life: shot.life,
        damage: shot.damage,
        hits: [...shot.hits],
      })),
      report: g.combatReport.snapshot(),
      source: g.testRun,
      surface: g.operatorSurface.diagnostics,
    });
  const before = snapshot();
  let draws = 0;
  g.rng = () => {
    draws++;
    throw new Error('No cosmetic RNG');
  };
  for (let i = 0; i < 10; i++) {
    operatorPose(g);
    drawOperator(canvas().context, g, false);
  }
  const after = snapshot();
  assert.equal(after, before);
  assert.equal(callbacks, 0);
  assert.equal(draws, 0);
});

test('invalid cosmetic input samples stay finite without changing the physical state', () => {
  const g = actor();
  g.aim = { x: NaN, y: Infinity };
  Matter.Body.setVelocity(g.player, { x: NaN, y: Infinity });
  g.time = NaN;
  g.lastShot = Infinity;
  numeric(operatorPose(g));
});
