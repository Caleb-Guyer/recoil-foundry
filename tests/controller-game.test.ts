import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Input } from '../src/game.ts';
import { getGun } from '../src/rules.ts';
import { controllerPortalTarget } from '../src/controller-target.ts';
const { Body, Bodies, Composite } = Matter;
const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: true,
  fire: false,
  aim: { x: 800, y: 400 },
};
function fixture() {
  const g = new Game();
  g.start('controller-qa');
  g.hazards.clear();
  g.breaches.clear();
  g.waves.clear();
  for (const prop of [...g.props.items]) g.props.remove(prop);
  for (const e of g.enemies) Composite.remove(g.engine.world, e.body);
  g.enemies = [];
  for (const b of g.terrain.slice(4)) Composite.remove(g.engine.world, b);
  g.terrain = g.terrain.slice(0, 4);
  g.mods = ['fold'];
  g.gun = getGun(g.mods);
  Body.setPosition(g.player, { x: 400, y: 400 });
  g.engine.gravity.y = 0;
  return g;
}
const view = { x: 0, y: 0, width: 1600, height: 800 };
test('controller portal aiming reaches floors and walls and retains the two-placement limit', () => {
  const g = fixture();
  const wall = Bodies.rectangle(800, 400, 40, 400, { isStatic: true });
  g.terrain.push(wall);
  Composite.add(g.engine.world, wall);
  const floor = controllerPortalTarget(g, { x: 0, y: 1 }, view);
  assert(floor && Math.abs(floor.y - 740) < 0.01);
  assert(g.portals.place(floor));
  const side = controllerPortalTarget(g, { x: 1, y: 0 }, view);
  assert(side && Math.abs(side.x - 780) < 0.01);
  assert(g.portals.place(side));
  assert.equal(controllerPortalTarget(g, { x: -1, y: 0 }, view), null);
  g.mods.push('rewire');
  assert(controllerPortalTarget(g, { x: -1, y: 0 }, view));
});
test('controller portal rays cannot pass through crates or target unseen, short or blocked faces', () => {
  const g = fixture();
  assert.equal(controllerPortalTarget(g, { x: 0, y: 1 }, { ...view, height: 600 }), null);
  g.props.spawn('crate', 400, 500);
  assert.equal(controllerPortalTarget(g, { x: 0, y: 1 }, view), null);
  for (const p of [...g.props.items]) g.props.remove(p);
  const short = Bodies.rectangle(650, 400, 40, 50, { isStatic: true });
  g.terrain.push(short);
  Composite.add(g.engine.world, short);
  assert.equal(controllerPortalTarget(g, { x: 1, y: 0 }, view), null);
  assert.equal(controllerPortalTarget(g, { x: NaN, y: 1 }, view), null);
  assert.equal(controllerPortalTarget(g, { x: 0, y: 0 }, view), null);
  assert.equal(g.portals.next, 0);
});
test('full analog movement matches digital movement exactly, including opposing steering', () => {
  for (const sign of [-1, 1]) {
    const analog = fixture(),
      digital = fixture();
    Body.setVelocity(analog.player, { x: -sign * 12, y: 0 });
    Body.setVelocity(digital.player, { x: -sign * 12, y: 0 });
    for (let i = 0; i < 30; i++) {
      analog.tick(1 / 60, { ...idle, move: sign });
      digital.tick(1 / 60, { ...idle, left: sign < 0, right: sign > 0 });
      assert.deepEqual(analog.player.position, digital.player.position);
      assert.deepEqual(analog.player.velocity, digital.player.velocity);
    }
  }
});
test('partial stick movement walks slowly but does not clamp recoil flight', () => {
  const slow = fixture(),
    full = fixture();
  for (let i = 0; i < 40; i++) {
    slow.tick(1 / 60, { ...idle, move: 0.35 });
    full.tick(1 / 60, { ...idle, move: 1 });
  }
  assert(slow.player.velocity.x > 1 && slow.player.velocity.x < full.player.velocity.x * 0.5);
  const boost = fixture(),
    coast = fixture();
  Body.setVelocity(boost.player, { x: 18, y: -8 });
  Body.setVelocity(coast.player, { x: 18, y: -8 });
  boost.tick(1 / 60, { ...idle, move: 0.25 });
  coast.tick(1 / 60, idle);
  assert.deepEqual(boost.player.velocity, coast.player.velocity);
  assert(boost.player.velocity.x > 17);
});
test('invalid analog values fall back to digital controls without corrupting physics', () => {
  for (const move of [NaN, Infinity]) {
    const g = fixture();
    g.tick(1 / 60, { ...idle, right: true, move });
    assert(g.player.velocity.x > 0 && Number.isFinite(g.player.position.x));
  }
});
test('haptic callbacks track actual player shots and damage rather than enemy sound effects', () => {
  const g = fixture(),
    pulses: string[] = [];
  g.onHaptic = (kind, strength) => {
    assert(strength >= 0 && strength <= 1);
    pulses.push(kind);
  };
  g.onSound('land');
  assert.equal(pulses.length, 0);
  g.tick(1 / 60, { ...idle, fire: true, firePressed: true });
  assert.deepEqual(pulses, ['shot']);
  g.damagePlayer(12);
  assert.deepEqual(pulses, ['shot', 'hurt']);
  g.damagePlayer(12);
  assert.equal(pulses.length, 2);
});
test('hard player landings pulse once and airborne recoil feels stronger than grounded fire', () => {
  const g = fixture(),
    pulses: { kind: string; strength: number }[] = [];
  g.onHaptic = (kind, strength) => pulses.push({ kind, strength });
  Body.setPosition(g.player, { x: 400, y: 723 });
  Body.setVelocity(g.player, { x: 0, y: 18 });
  g.grounded = false;
  g.tick(1 / 60, idle);
  assert.equal(pulses.filter((p) => p.kind === 'land').length, 1);
  Body.setVelocity(g.player, { x: 0, y: 0 });
  g.tick(1 / 60, idle);
  assert.equal(pulses.filter((p) => p.kind === 'land').length, 1);
  g.grounded = true;
  g.fireRound();
  const grounded = pulses.at(-1)!.strength;
  g.grounded = false;
  g.fireRound();
  assert(pulses.at(-1)!.strength > grounded);
});
