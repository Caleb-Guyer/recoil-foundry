import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Input } from '../src/game.ts';
import { ORIGINAL_GUN_IDS, type StartingGun } from '../src/starting-guns.ts';
import { uprisingRemasterTestFromUrl } from '../src/uprising-remaster-test.ts';

const DT = 1 / 60;
const idle: Input = {
  left: false,
  right: false,
  jump: false,
  fire: false,
  aim: { x: 1400, y: 468 },
};
function fixture(gun: StartingGun) {
  const cp = uprisingRemasterTestFromUrl(
    new URL('https://test/?test=uprising-remaster&route=core-recovery&v=1'),
  )!.checkpoint;
  cp.startingGun = gun;
  const g = new Game();
  g.startTest(cp);
  g.waves.clear();
  for (const enemy of g.enemies) Matter.Composite.remove(g.engine.world, enemy.body);
  g.enemies = [];
  g.shots = [];
  return g;
}
function advance(g: Game, frames: number, jump = false) {
  for (let frame = 0; frame < frames; frame++) {
    g.time += DT;
    g.uprising.remaster.update({ ...idle, jump }, DT);
  }
}
function collectCase(g: Game) {
  const u = g.uprising;
  Matter.Body.setPosition(g.player, { ...u.switchTarget! });
  advance(g, 1, true);
  assert.equal(u.switchTarget, undefined);
  const node = u.nodes[0];
  u.hit(node, node.hp, { x: 1, y: 0 }, undefined, true, true);
  Matter.Body.setPosition(g.player, { ...node.body.position });
  advance(g, 1);
  assert(u.collected);
  assert(u.remaster.snapshot.pending.some((p) => p.spawn.kind === 'charger'));
}
function clean(g: Game) {
  Matter.Composite.clear(g.engine.world, false);
  Matter.Engine.clear(g.engine);
}

test('a real queued experimental pursuit guard uses a bounded safe entrance after loose cover blocks its authored point', () => {
  const g = fixture('switchjack'),
    crate = g.props.spawn('crate', 1540, 717);
  const position = { ...crate.body.position };
  collectCase(g);
  advance(g, 54);
  assert(
    !g.enemies.some((e) => e.kind === 'charger'),
    'the original entrance gets a full grace period',
  );
  advance(g, 10);
  const guards = g.enemies.filter((e) => e.kind === 'charger');
  assert.equal(guards.length, 1, 'the same queued guard arrives exactly once');
  const guard = guards[0];
  assert([48, -48, 96, -96, 144, -144].includes(guard.body.position.x - 1540));
  assert.equal(guard.body.position.y, 724);
  assert.equal(guard.spawn, 0.65, 'normal native arrival warning is retained');
  assert.equal(guard.elite, undefined);
  assert(
    !Matter.Query.collides(guard.body, g.solidBodies).length,
    'the full arriving hull is clear',
  );
  assert(
    Math.hypot(
      guard.body.position.x - g.player.position.x,
      guard.body.position.y - g.player.position.y,
    ) >= 105,
  );
  assert.deepEqual(crate.body.position, position, 'the obstruction is never moved or deleted');
  assert(g.props.items.includes(crate));
  assert(!g.uprising.remaster.snapshot.pending.some((p) => p.spawn.kind === 'charger'));
  clean(g);
});

test('all six archived native tools keep the original blocked-arrival behavior', () => {
  for (const gun of ORIGINAL_GUN_IDS) {
    const g = fixture(gun),
      crate = g.props.spawn('crate', 1540, 717);
    const position = { ...crate.body.position };
    collectCase(g);
    advance(g, 150);
    assert(!g.enemies.some((e) => e.kind === 'charger'), gun);
    assert(
      g.uprising.remaster.snapshot.pending.some((p) => p.spawn.kind === 'charger'),
      gun,
    );
    assert.deepEqual(crate.body.position, position);
    clean(g);
  }
});

test('a blocked pursuit guard stays queued when none of the bounded alternatives fits its whole hull', () => {
  const g = fixture('bellows');
  const crates = [0, 48, -48, 96, -96, 144, -144].map((dx) =>
    g.props.spawn('crate', 1540 + dx, 717),
  );
  const positions = crates.map((p) => ({ ...p.body.position }));
  collectCase(g);
  advance(g, 150);
  assert(!g.enemies.some((e) => e.kind === 'charger'));
  assert(g.uprising.remaster.snapshot.pending.some((p) => p.spawn.kind === 'charger'));
  assert.deepEqual(
    crates.map((p) => p.body.position),
    positions,
  );
  clean(g);
});

test('mission cover cannot authorize an alternate pursuit entrance', () => {
  const g = fixture('debt-collector'),
    crate = g.props.spawn('crate', 1540, 717);
  crate.auditCase = true;
  collectCase(g);
  advance(g, 150);
  assert(!g.enemies.some((e) => e.kind === 'charger'));
  assert(g.uprising.remaster.snapshot.pending.some((p) => p.spawn.kind === 'charger'));
  assert(g.props.items.includes(crate));
  clean(g);
});

test('near-edge queued arrivals never choose a clear point beyond the playable world', () => {
  for (const side of ['left', 'right'] as const) {
    const g = fixture('switchjack'),
      original = side === 'left' ? 24 : g.worldWidth - 24,
      inward = side === 'left' ? 1 : -1,
      room = g.uprising.room!;
    // A private authored entrance near either edge. Inward alternatives are
    // obstructed, while the far outward alternative is past the boundary wall
    // and would appear point-clear to a geometry-only overlap query.
    Object.defineProperty(g.uprising, 'room', {
      value: {
        ...room,
        reinforcements: [[{ kind: 'charger', x: original, y: 724 }], [], []],
      },
    });
    for (const offset of [0, 48, 96, 144]) g.props.spawn('crate', original + inward * offset, 717);
    collectCase(g);
    advance(g, 150);
    assert(!g.enemies.some((e) => e.kind === 'charger'), side);
    assert(
      g.uprising.remaster.snapshot.pending.some((p) => p.spawn.kind === 'charger'),
      side,
    );
    clean(g);
  }
});
