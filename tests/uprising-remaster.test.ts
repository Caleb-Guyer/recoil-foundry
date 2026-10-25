import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Input } from '../src/game.ts';
import { UPRISING_ROUTES, type UprisingRouteId } from '../src/uprising-model.ts';
import { uprisingRemasterTestFromUrl } from '../src/uprising-remaster-test.ts';
import { uprisingTestFromUrl } from '../src/uprising-test.ts';
import { UPRISING_REMASTER } from '../src/uprising-remaster-rules.ts';

const DT = 1 / 60;
const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: true,
  fire: false,
  aim: { x: 1000, y: 600 },
};
function fixture(route: UprisingRouteId) {
  const cp = uprisingRemasterTestFromUrl(
    new URL(`https://test/?test=uprising-remaster&route=${route}&v=1`),
  )!.checkpoint;
  const g = new Game();
  g.startTest(cp);
  assert(g.uprising.remaster.eligible);
  return g;
}
function clearPatrol(g: Game) {
  g.waves.clear();
  for (const e of [...g.enemies]) Matter.Composite.remove(g.engine.world, e.body);
  g.enemies = [];
  g.shots = [];
}
function clean(g: Game) {
  Matter.Composite.clear(g.engine.world, false);
  Matter.Engine.clear(g.engine);
}
function frame(g: Game, input: Partial<Input> = {}) {
  g.tick(DT, { ...idle, ...input });
}
function engine(g: Game, n = 1, input: Partial<Input> = {}) {
  for (let i = 0; i < n; i++) {
    g.time += DT;
    g.uprising.remaster.update({ ...idle, ...input }, DT);
  }
}
function near(g: Game, p: { x: number; y: number }) {
  Matter.Body.setPosition(g.player, { x: p.x - 70, y: p.y });
  Matter.Body.setVelocity(g.player, { x: 0, y: 0 });
}
function arm(g: Game) {
  clearPatrol(g);
  g.uprising.patrolClearedAt = g.time - 1;
  near(g, g.uprising.remaster.activeNode!.body.position);
  engine(g, 1, { jump: true });
  assert.notEqual(g.uprising.armedAt, null);
}
function breakRelays(g: Game) {
  for (const node of g.uprising.nodes)
    g.uprising.hit(node, node.maxHp, { x: 1, y: 0 }, undefined, true, true);
}

test('all eleven C105 jobs own distinct native objectives while older isolated jobs retain their controller', () => {
  for (const route of UPRISING_ROUTES) {
    const g = fixture(route.id);
    assert.equal(g.uprising.mission, route.id);
    assert.equal(
      g.uprising.remaster.phase,
      route.mission === 'defend'
        ? 'defend'
        : g.uprising.switchTarget
          ? 'interlock'
          : route.mission === 'steal'
            ? 'collect'
            : route.mission === 'sabotage'
              ? 'sabotage'
              : 'escape',
    );
    assert(g.uprising.remaster.status.length < 145);
    clean(g);
  }
  const cp = uprisingTestFromUrl(new URL('https://test/?test=uprising&route=rail-heist&v=1'))!;
  const old = new Game();
  old.startTest(cp);
  assert(!old.uprising.remaster.eligible);
  assert.equal(old.uprising.nodes.length, 1);
  clean(old);
});

test('convoy defense moves its actual platform and attached protected generator only after activation', () => {
  const g = fixture('rail-guard'),
    u = g.uprising,
    r = u.remaster,
    n = u.nodes[0],
    a = u.anchors[0];
  const start = { platform: { ...a.body.position }, node: { ...n.body.position } };
  engine(g, 120);
  assert.deepEqual(a.body.position, start.platform);
  assert.deepEqual(n.body.position, start.node);
  arm(g);
  engine(g, 300);
  assert(a.body.position.x > start.platform.x + 100);
  assert.equal(a.body.position.y, start.platform.y);
  assert(
    Math.abs(n.body.position.x - start.node.x - (a.body.position.x - start.platform.x)) < 0.01,
  );
  assert(Math.abs(n.body.position.y - start.node.y) < 0.01);
  assert.equal(n.body.isStatic, true);
  assert.equal(r.station, 0);
  clean(g);
});

test('the moving prototype remains attached to its real cargo support before collection', () => {
  const g = fixture('rail-heist'),
    n = g.uprising.nodes[0],
    a = g.uprising.anchors[0],
    initial = {
      x: n.body.position.x - a.body.position.x,
      y: n.body.position.y - a.body.position.y,
    };
  engine(g, 200);
  assert(a.body.position.x > 640 + 60);
  assert(Math.abs(n.body.position.x - a.body.position.x - initial.x) < 0.01);
  assert(Math.abs(n.body.position.y - a.body.position.y - initial.y) < 0.01);
  assert(!g.uprising.outcome);
  engine(g, 1600);
  assert.deepEqual(a.body.velocity, { x: 0, y: 0 });
  assert.deepEqual(n.body.velocity, { x: 0, y: 0 });
  clean(g);
});

test('sequential crew stations require their own activation and protect inactive or completed nodes', () => {
  const g = fixture('crew-relief'),
    u = g.uprising,
    r = u.remaster;
  const [first, second] = u.nodes;
  const hp = first.hp;
  u.hit(first, 50, { x: 1, y: 0 }, undefined, false, false);
  assert.equal(first.hp, hp);
  arm(g);
  u.hit(second, 50, { x: 1, y: 0 }, undefined, false, false);
  assert.equal(second.hp, second.maxHp);
  u.hit(first, 20, { x: 1, y: 0 }, undefined, false, false);
  assert.equal(first.hp, hp - 20);
  for (let i = 0; i < 560 && r.station === 0; i++) {
    engine(g);
    clearPatrol(g);
  }
  assert.equal(r.station, 1);
  assert.equal(u.armedAt, null);
  assert(!u.outcome);
  assert.equal(r.activeNode, second);
  assert.equal(r.completedStations, 1);
  u.hit(first, 50, { x: 1, y: 0 }, undefined, false, false);
  assert.equal(first.hp, hp - 20);
  near(g, first.body.position);
  engine(g, 1, { jump: true });
  assert.equal(u.armedAt, null, 'the old station cannot start the next hold');
  near(g, second.body.position);
  engine(g, 1, { jump: true });
  assert.notEqual(u.armedAt, null);
  clean(g);
});

test('core research interlock prevents case damage and collection until the real switch is opened', () => {
  const g = fixture('core-recovery'),
    u = g.uprising,
    n = u.nodes[0],
    s = u.switchTarget!;
  assert(s);
  u.hit(n, 1e5, { x: 1, y: 0 }, undefined, true, true);
  assert.equal(n.hp, n.maxHp);
  near(g, { x: s.x + 70, y: s.y });
  engine(g, 1, { jump: true });
  assert.equal(u.routeStep, 1);
  assert.equal(u.switchTarget, undefined);
  u.hit(n, n.hp, { x: 1, y: 0 }, undefined, true, true);
  assert.equal(n.hp, 0);
  assert(!u.collected);
  assert(!u.outcome);
  clean(g);
});

test('theft needs collection, real pursuit arrivals and a supported extraction hold rather than an instant reward', () => {
  const g = fixture('scrap-raid'),
    u = g.uprising,
    r = u.remaster,
    n = u.nodes[0];
  clearPatrol(g);
  u.hit(n, n.hp, { x: 1, y: 0 }, undefined, true, true);
  Matter.Body.setPosition(g.player, { ...n.body.position });
  engine(g);
  assert(u.collected);
  assert(!u.outcome);
  assert(r.extracting);
  assert(!g.props.items.includes(n));
  assert(g.enemies.length > 0);
  assert(g.enemies.every((e) => e.spawn === 0.65));
  const zone = r.extraction!;
  Matter.Body.setPosition(g.player, { x: zone.x + zone.w / 2, y: zone.y + zone.h - 18 });
  g.grounded = true;
  engine(g, 100);
  assert(!u.outcome);
  for (let i = 0; i < 450 && !u.outcome; i++) {
    clearPatrol(g);
    g.grounded = true;
    engine(g);
  }
  assert.equal(u.outcome?.result, 'success');
  assert(r.evacuated);
  assert(u.outcome?.reward);
  clean(g);
});

test('destroyed relays lower a real service bridge and never resolve before the player takes its supported route', () => {
  const g = fixture('core-sabotage'),
    u = g.uprising,
    r = u.remaster,
    a = u.anchors[0],
    before = a.body.position.y;
  clearPatrol(g);
  breakRelays(g);
  engine(g);
  assert(!u.outcome);
  assert(r.extracting);
  assert(a.body.position.y > before);
  for (let i = 0; i < 320; i++) {
    engine(g);
    clearPatrol(g);
  }
  assert(Math.abs(a.body.position.y - before - 250) < 0.01);
  assert(!u.outcome);
  const zone = r.extraction!;
  Matter.Body.setPosition(g.player, { x: zone.x + zone.w / 2, y: zone.y + zone.h - 18 });
  g.grounded = true;
  for (let i = 0; i < 130 && !u.outcome; i++) {
    engine(g);
    clearPatrol(g);
    g.grounded = true;
  }
  assert.equal(u.outcome?.result, 'success');
  assert(!r.evacuated, 'sabotage still uses the native room exit');
  clean(g);
});

test('escape dispatch starts at the first deliberate switch, retains every stage and fails at its deadline', () => {
  const g = fixture('rail-escape'),
    u = g.uprising;
  engine(g, 3000);
  assert.equal(u.deadline, 0);
  assert(!u.outcome);
  const first = u.switchTarget!;
  Matter.Body.setPosition(g.player, { ...first });
  engine(g, 1, { jump: true });
  assert.equal(u.routeStep, 1);
  assert(u.deadline > g.time);
  assert(u.switchTarget);
  assert(!u.outcome);
  g.time = u.deadline;
  u.remaster.update(idle, DT);
  assert.equal(u.outcome?.result, 'failed');
  assert(!u.outcome?.reward);
  clean(g);
});

test('arrival groups remain bounded, preserve native warnings and wait for a genuinely clear spawn hull', () => {
  const g = fixture('rail-guard'),
    u = g.uprising,
    r = u.remaster;
  arm(g);
  for (let i = 0; i < 1600 && !u.outcome; i++) {
    engine(g);
    assert(g.combatEnemyCount <= UPRISING_REMASTER.reinforcementCap);
    assert(r.snapshot.pending.length <= 6);
  }
  assert(r.snapshot.groups.length === 3);
  assert(g.enemies.length > 0);
  assert(g.enemies.every((e) => e.spawn === 0.65));
  assert(new Set(g.enemies.map((e) => e.kind)).size >= 3);
  clearPatrol(g);
  engine(g, 3);
  assert.equal(u.outcome?.result, 'success');
  clean(g);
  const h = fixture('scrap-raid'),
    v = h.uprising;
  clearPatrol(h);
  const n = v.nodes[0];
  v.hit(n, n.hp, { x: 1, y: 0 }, undefined, true, true);
  Matter.Body.setPosition(h.player, { ...n.body.position });
  engine(h);
  const pending = v.remaster.snapshot.pending;
  assert(pending.length);
  const blocked = pending[0].spawn;
  Matter.Body.setPosition(h.player, { x: blocked.x, y: blocked.y });
  const before = h.enemies.length;
  engine(h, 25);
  assert(
    !h.enemies.some((e) => e.body.position.x === blocked.x && e.body.position.y === blocked.y),
  );
  assert(h.enemies.length >= before);
  clean(h);
});

test('pause, hitstop, invalid time and resolved failures never advance pending mission movement or arrivals', () => {
  const g = fixture('rail-guard');
  arm(g);
  engine(g, 80);
  const before = structuredClone(g.uprising.remaster.snapshot),
    positions = g.uprising.anchors.map((a) => ({ ...a.body.position }));
  g.setMode('paused');
  const pausedTime = g.time;
  for (let i = 0; i < 300; i++) frame(g);
  assert.equal(g.time, pausedTime, 'native pause freezes the objective clock');
  assert.deepEqual(g.uprising.remaster.snapshot, before);
  assert.deepEqual(
    g.uprising.anchors.map((a) => ({ ...a.body.position })),
    positions,
  );
  g.setMode('playing');
  g.hitStop = 0.1;
  engine(g, 200);
  assert.deepEqual(g.uprising.remaster.snapshot, before);
  g.hitStop = 0;
  for (const dt of [0, -1, NaN, Infinity]) g.uprising.remaster.update(idle, dt);
  assert.deepEqual(g.uprising.remaster.snapshot, before);
  g.uprising.abandon();
  const p = g.uprising.anchors[0].body.position.x;
  engine(g, 800);
  assert.equal(g.uprising.anchors[0].body.position.x, p);
  assert.deepEqual(g.uprising.anchors[0].body.velocity, { x: 0, y: 0 });
  assert.equal(g.uprising.outcome?.result, 'failed');
  assert(!g.uprising.outcome?.reward);
  clean(g);
});

test('boarding requires two continuous grounded seconds and discards time spent jumping inside the deck marker', () => {
  const g = fixture('scrap-raid'),
    u = g.uprising,
    r = u.remaster;
  clearPatrol(g);
  const node = u.nodes[0];
  u.hit(node, node.hp, { x: 1, y: 0 }, undefined, true, true);
  Matter.Body.setPosition(g.player, { ...node.body.position });
  engine(g);
  for (let i = 0; i < 420; i++) {
    clearPatrol(g);
    engine(g);
  }
  clearPatrol(g);
  const zone = r.extraction!;
  Matter.Body.setPosition(g.player, { x: zone.x + zone.w / 2, y: zone.y + zone.h - 18 });
  g.grounded = true;
  engine(g, 90);
  assert.notEqual(u.boardingAt, null);
  assert(!u.outcome);
  g.grounded = false;
  engine(g, 45);
  assert.equal(u.boardingAt, null);
  assert(!u.outcome);
  g.grounded = true;
  engine(g, 90);
  assert(!u.outcome, 'the previous landing and airborne time cannot finish this hold');
  engine(g, 40);
  assert.equal(u.outcome?.result, 'success');
  clean(g);
});

test('successful sabotage Continue restores the lowered bridge before any playing frame', () => {
  for (const route of ['core-sabotage', 'signal-cut'] as const) {
    const g = fixture(route),
      u = g.uprising;
    clearPatrol(g);
    breakRelays(g);
    for (let i = 0; i < 360; i++) {
      engine(g);
      clearPatrol(g);
    }
    const zone = u.remaster.extraction!;
    Matter.Body.setPosition(g.player, { x: zone.x + zone.w / 2, y: zone.y + zone.h - 18 });
    g.grounded = true;
    engine(g, 130);
    assert.equal(u.outcome?.result, 'success');
    const save = g.checkpointSnapshot();
    const continued = new Game();
    continued.startTest(save);
    continued.setMode('paused');
    assert.equal(continued.uprising.outcome?.result, 'success');
    assert.equal(continued.uprising.anchors[0].body.bounds.min.y, zone.y + zone.h);
    assert.deepEqual(continued.uprising.anchors[0].body.velocity, { x: 0, y: 0 });
    assert.equal(continued.uprising.nodes.length, 0, 'completed objectives do not respawn');
    clean(continued);
    clean(g);
  }
});

test('walking at the optional exit cannot cancel a mission while a native arrival is still deferred', () => {
  const g = fixture('scrap-raid'),
    u = g.uprising;
  clearPatrol(g);
  const node = u.nodes[0];
  u.hit(node, node.hp, { x: 1, y: 0 }, undefined, true, true);
  Matter.Body.setPosition(g.player, { ...node.body.position });
  engine(g);
  const deferred = u.remaster.snapshot.pending[0];
  assert(deferred);
  g.props.spawn('cover', deferred.spawn.x, deferred.spawn.y);
  clearPatrol(g);
  Matter.Body.setPosition(g.player, { x: 1900, y: 720 });
  g.grounded = true;
  engine(g, 75, { right: true });
  assert(u.remaster.snapshot.pending.length > 0);
  assert(!u.outcome, 'deferred reinforcements keep the route active');
  clean(g);
});
