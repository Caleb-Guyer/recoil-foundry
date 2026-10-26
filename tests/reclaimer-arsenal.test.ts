import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Input } from '../src/game.ts';
import {
  prepareReclaimerArsenalTest,
  reclaimerArsenalTestFromUrl,
} from '../src/reclaimer-arsenal-test.ts';
import {
  reclaimerPressureTestFromUrl,
  prepareReclaimerPressureTest,
} from '../src/reclaimer-pressure-test.ts';
import {
  ARSENAL_DASH_WARNING,
  ARSENAL_CORE_WARNING,
  ARSENAL_COLLAPSE_WARNING,
} from '../src/reclaimer-arsenal.ts';

const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: false,
  fire: false,
  aim: { x: 1000, y: 400 },
};
function fixture(form = 'chassis', overtime = false, mirror = false) {
  const f = reclaimerArsenalTestFromUrl(
    new URL(
      `https://test.invalid/?test=arsenal&form=${form}&fight=${overtime ? 'overtime' : 'campaign'}&mirror=${Number(mirror)}&v=1`,
    ),
  )!;
  const g = new Game();
  g.startTest(f.checkpoint);
  assert(prepareReclaimerArsenalTest(g, f));
  return { g, e: g.finale.enemy!, a: g.finale.cinema!.arsenal, f };
}
function dispose(g: Game) {
  Matter.Composite.clear(g.engine.world, false);
  Matter.Engine.clear(g.engine);
}

test('counter-dash locks the real lane, preserves the entire warning and leaves a vulnerable recovery', () => {
  for (const overtime of [false, true])
    for (const mirror of [false, true]) {
      const { g, e, a } = fixture('chassis', overtime, mirror);
      Matter.Body.setPosition(e.body, { x: mirror ? 1200 : 800, y: 695 });
      Matter.Body.setPosition(g.player, { x: mirror ? 800 : 1200, y: 718 });
      assert(a.beginDash(e));
      const locked = structuredClone(a.dash!.to),
        from = { ...e.body.position };
      assert.equal(a.dash!.left, ARSENAL_DASH_WARNING);
      Matter.Body.setPosition(g.player, { x: mirror ? 400 : 1600, y: 718 });
      for (let n = 0; n < 55; n++) g.tick(1 / 60, idle);
      assert.equal(a.dash!.state, 'warning');
      assert(distance(e.body.position, from) < 2, 'No rush movement during warning');
      assert.deepEqual(a.dash!.to, locked, 'Dash destination never tracks an escaping player');
      let last = { ...e.body.position },
        travel = 0;
      for (let n = 0; n < 120 && a.dash?.state !== 'recover'; n++) {
        g.tick(1 / 60, idle);
        const step = distance(last, e.body.position);
        assert(step < 24, 'Dash moves through Matter without warping');
        travel += step;
        last = { ...e.body.position };
      }
      assert(travel > 180, 'The dash is a real body traversal');
      assert.equal(a.dash?.state, 'recover');
      assert.equal(e.state, 'recover');
      assert(a.dash!.left >= 1, 'Readable punish window after the committed charge');
      const hp = e.hp;
      g.hitEnemy(e, 100, undefined, false);
      assert(hp - e.hp > 100, 'Normal recovery damage multiplier remains useful');
      dispose(g);
    }
});

const distance = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);

test('dash sweep cannot tunnel through a shelf or a crate added after the lane locks', () => {
  const { g, e, a } = fixture();
  Matter.Body.setPosition(e.body, { x: 700, y: 680 });
  Matter.Body.setPosition(g.player, { x: 1200, y: 718 });
  assert(a.beginDash(e));
  const crate = g.props.spawn('cover', 1000, 697);
  crate.hp = crate.maxHp = 99999;
  for (let n = 0; n < 120 && a.dash?.state !== 'recover'; n++) g.tick(1 / 60, idle);
  assert.equal(a.dash?.state, 'recover');
  assert(
    e.body.position.x + 33 < crate.body.bounds.min.x + 2,
    'A newly inserted real crate ends the charge',
  );
  assert(!Matter.Collision.collides(e.body, crate.body), 'No penetration into cover');
  dispose(g);
});

test('Siege armor takes every common damage call, breaks visibly, exposes, and closes without changing upgrades', () => {
  for (const overtime of [false, true]) {
    const { g, e, a } = fixture('siege', overtime);
    const mods = [...g.mods],
      gun = g.startingGun;
    assert.equal(a.armor.plates, 3);
    assert(a.armor.hp > 100);
    const hp = e.hp,
      plate = a.armor.hp;
    g.hitEnemy(e, 100, undefined, false);
    assert(
      a.armor.hp < plate,
      'Shared damage drains armor even without projectile origin (beam/DoT)',
    );
    assert(e.hp < hp, 'Armor does not discard valid weapon damage');
    const before = e.hp;
    while (a.armor.exposedLeft === 0) g.hitEnemy(e, 40, { x: 600, y: 718 }, false);
    assert.equal(a.armor.plates, 2);
    assert.equal(a.armor.hp, 0);
    assert(e.hp > 0 && e.hp < before);
    assert.equal(a.armor.exposedLeft, overtime ? 3.2 : 4);
    const exposed = e.hp;
    g.hitEnemy(e, 100, undefined, false);
    assert(exposed - e.hp > 150, 'Breaking armor creates a real damage opportunity');
    a.update(a.armor.exposedLeft);
    assert.equal(a.armor.exposedLeft, 0);
    assert.equal(a.armor.hp, a.armor.maxHp);
    assert.equal(a.armor.plates, 2);
    assert.deepEqual(g.mods, mods);
    assert.equal(g.startingGun, gun);
    dispose(g);
  }
});

test('bombing flight traverses the arena and every fixed mark matches a falling physical bomb', () => {
  for (const overtime of [false, true])
    for (const mirror of [false, true]) {
      const { g, e, a } = fixture('siege', overtime, mirror);
      Matter.Body.setPosition(g.player, { x: 1000, y: 718 });
      a.beginFlight();
      const marks = a.bombs.map((b) => ({ ...b.target })),
        flight = a.flight!;
      assert.equal(a.bombs.length, overtime ? 6 : 4);
      const firstX = flight.x;
      assert(a.bombs.every((b) => b.state === 'warning' && b.left > 1.5));
      a.update(0.5);
      assert.equal(Math.abs(flight.x - firstX), 240);
      assert.deepEqual(
        a.bombs.map((b) => b.target),
        marks,
        'Bomb marks never follow the player',
      );
      let falling = false,
        blasted = 0;
      const hits = new Set<object>();
      for (let n = 0; n < 420; n++) {
        g.time += 1 / 60;
        a.update(1 / 60);
        for (const b of a.bombs) {
          if (b.state === 'falling') {
            falling = true;
            assert(b.pos.y >= 152 && b.pos.y <= b.target.y);
          }
          if (b.state === 'blast' && !hits.has(b)) {
            hits.add(b);
            blasted++;
          }
        }
      }
      assert(falling, 'Aircraft releases visible traveling ammunition');
      assert.equal(blasted, marks.length);
      assert.equal(a.flight, null);
      assert.equal(a.bombs.length, 0);
      assert(e.hp > 0);
      dispose(g);
    }
});

test('a bomb deals no warning damage, cover catches it, and the actual blast can hurt a stationary target', () => {
  const { g, a } = fixture('siege');
  Matter.Body.setPosition(g.player, { x: 880, y: 722 });
  a.beginFlight();
  const b = a.bombs.find((b) => Math.abs(b.target.x - 765) < 1)!;
  assert(b);
  Matter.Body.setPosition(g.player, { x: b.target.x, y: b.target.y - 18 });
  const hp = g.hp;
  while (b.state !== 'blast') {
    assert.equal(g.hp, hp, 'No damage while a ring is amber or a bomb falls');
    g.time += 1 / 60;
    a.update(1 / 60);
  }
  assert(g.hp < hp, 'Only the displayed blast inflicts damage');
  dispose(g);
});

test('falling bombs hit newly moved cover and do not explode in midair when old cover is removed', () => {
  const { g, a } = fixture('siege');
  Matter.Body.setPosition(g.player, { x: 280, y: 722 });
  const old = g.props.spawn('cover', 165, 400);
  a.beginFlight();
  const bomb = a.bombs.find((b) => Math.abs(b.target.x - 165) < 1)!;
  assert(bomb.target.y < 500);
  g.props.remove(old);
  // Moving another crate into the falling lane changes the real impact,
  // while the warning's horizontal lane remains the original snapshot.
  const moved = g.props.spawn('cover', 165, 590);
  Matter.Body.setPosition(g.player, { x: 165, y: 722 });
  for (let n = 0; n < 400 && bomb.state !== 'blast'; n++) {
    g.time += 1 / 60;
    a.update(1 / 60);
  }
  assert.equal(bomb.state, 'blast');
  assert(Math.abs(bomb.pos.y - (moved.body.bounds.min.y - 8)) < 1);
  assert.equal(g.hp, 100, 'A crate blocks the impact from the player below it');
  dispose(g);
});

test('Rupture core warning holds completely and its live rotating beams use actual cover', () => {
  for (const overtime of [false, true])
    for (const mirror of [false, true]) {
      const { g, e, a } = fixture('rupture', overtime, mirror);
      Matter.Body.setPosition(e.body, { x: 1000, y: 340 });
      Matter.Body.setPosition(g.player, { x: 1500, y: 340 });
      a.beginCore();
      const core = a.core!,
        locked = core.angle;
      assert.equal(core.left, ARSENAL_CORE_WARNING);
      assert.equal(core.segments.length, overtime ? 2 : 1);
      g.time += 1.49;
      a.update(1.49);
      assert.equal(core.state, 'warning');
      assert.equal(g.hp, 100);
      assert.equal(core.angle, locked);
      const cover = g.props.spawn('cover', 1250, 340);
      cover.hp = cover.maxHp = 99999;
      a.update(0.02);
      assert.equal(core.state, 'active');
      for (let n = 0; n < 180; n++) {
        g.time += 1 / 60;
        a.update(1 / 60);
        if (a.core)
          for (const s of a.core.segments)
            if (Math.abs(s.to.x - cover.body.bounds.min.x) < 7)
              assert(s.to.x < g.player.position.x, 'Ray stops at real cover');
      }
      assert(Math.abs(core.angle - locked) > 1.3, 'Core sweeps a meaningful fixed arc');
      assert(g.hp === 100, 'The player behind the real cover is protected');
      dispose(g);
    }
});

test('Rupture collapses exactly the warned physical platforms and retains floor plus two shelves', () => {
  for (const mirror of [false, true]) {
    const { g, a } = fixture('rupture', false, mirror);
    const floor = g.terrain[0],
      baseCount = g.terrain.length;
    for (let n = 0; n < 3; n++) {
      assert(a.planCollapse());
      const mark = a.collapses.at(-1)!;
      assert.equal(mark.duration, ARSENAL_COLLAPSE_WARNING);
      const body = g.terrain
        .slice(4)
        .find((b) => Math.abs(b.position.x - mark.rect.x - mark.rect.w / 2) < 0.01)!;
      assert(body);
      a.update(3.19);
      assert(g.terrain.includes(body));
      assert(!mark.fallen);
      a.update(0.02);
      assert(mark.fallen);
      assert(!g.terrain.includes(body));
      assert(!Matter.Composite.allBodies(g.engine.world).includes(body));
      assert(!g.level.solids.includes(mark.rect));
    }
    assert.equal(a.planCollapse(), false);
    assert.equal(g.level.solids.length, 2);
    assert.equal(g.terrain.length, baseCount - 3);
    assert(g.terrain.includes(floor));
    g.finale.cinema!.enterForm(2);
    assert.equal(g.level.solids.length, 5, 'A new form/retry reconstructs all support');
    assert.equal(a.collapses.length, 0);
    dispose(g);
  }
});

test('phase movies, retry, paused mode and historical C107 never retain live signature payloads', () => {
  const { g, e, a, f } = fixture('siege');
  a.beginFlight();
  const before = JSON.stringify({ flight: a.flight, bombs: a.bombs, clock: a.clock });
  g.mode = 'paused';
  a.update(3);
  assert.equal(JSON.stringify({ flight: a.flight, bombs: a.bombs, clock: a.clock }), before);
  g.mode = 'playing';
  g.finale.cinema!.breakForm(e);
  assert.equal(a.flight, null);
  assert.equal(a.bombs.length, 0);
  assert.equal(a.core, null);
  g.startTest(f.checkpoint);
  assert(prepareReclaimerArsenalTest(g, f));
  assert.equal(g.finale.cinema!.arsenal.bombs.length, 0);
  assert.equal(g.finale.cinema!.arsenal.armor.plates, 3);
  dispose(g);
  const old = reclaimerPressureTestFromUrl(
    new URL('https://test.invalid/?test=reclaimer&phase=2&v=1'),
  )!;
  const archived = new Game();
  archived.startTest(old.checkpoint);
  prepareReclaimerPressureTest(archived, old);
  assert(!archived.finale.cinema!.arsenal.enabled);
  archived.finale.cinema!.arsenal.beginFlight();
  assert.equal(archived.finale.cinema!.arsenal.flight, null);
  assert.equal(archived.finale.cinema!.arsenal.armor.plates, 0);
  dispose(archived);
});

test('earned network isolation improves every signature without disabling the encounter', () => {
  for (const form of ['chassis', 'siege', 'rupture']) {
    const normal = fixture(form),
      weak = fixture(form);
    // This is the actual successful route from issue #10; Uprising computes
    // the consequence from the player's completed jobs, not a test flag.
    const route = reclaimerPressureTestFromUrl(
      new URL('https://test.invalid/?test=reclaimer&phase=2&route=isolated&v=1'),
    )!.checkpoint.uprising!;
    weak.g.testRun!.uprising = structuredClone(route);
    weak.g.uprising.run = structuredClone(route);
    assert.equal(weak.g.uprising.finale, 'isolated');
    weak.a.startForm(weak.g.finale.phase);
    if (form === 'chassis') {
      for (const f of [normal, weak]) {
        Matter.Body.setPosition(f.e.body, { x: 800, y: 695 });
        Matter.Body.setPosition(f.g.player, { x: 1200, y: 718 });
        assert(f.a.beginDash(f.e));
      }
      assert(weak.a.dash!.duration > normal.a.dash!.duration);
    } else if (form === 'siege') {
      for (const f of [normal, weak]) {
        Matter.Body.setPosition(f.g.player, { x: 1000, y: 718 });
        f.a.beginFlight();
      }
      assert.equal(weak.a.bombs.length, 3);
      assert.equal(normal.a.bombs.length, 4);
      assert(weak.a.bombs[0].radius < normal.a.bombs[0].radius);
      assert(weak.a.armor.maxHp < normal.a.armor.maxHp);
      assert(weak.a.armor.exposedDuration > normal.a.armor.exposedDuration);
    } else {
      normal.a.beginCore();
      weak.a.beginCore();
      assert(weak.a.core!.duration > normal.a.core!.duration);
      assert(weak.a.core!.sweep < normal.a.core!.sweep);
      assert(normal.a.planCollapse() && weak.a.planCollapse());
      assert(weak.a.collapses[0].duration > normal.a.collapses[0].duration);
    }
    dispose(normal.g);
    dispose(weak.g);
  }
});

test('the last Siege armor layer stays destroyed after its timed opening ends', () => {
  const { g, e, a } = fixture('siege');
  const sounds: string[] = [];
  g.onSound = (name) => sounds.push(name);
  for (let plate = 2; plate >= 0; plate--) {
    while (a.armor.exposedLeft === 0 && a.armor.plates > plate) g.hitEnemy(e, 40, undefined, false);
    assert.equal(a.armor.plates, plate);
    a.update(a.armor.exposedLeft);
  }
  assert.equal(a.armor.hp, 0);
  assert.equal(a.armor.exposedLeft, 0);
  assert.equal(sounds.filter((name) => name === 'arsenal-armor-break').length, 3);
  assert.equal(sounds.filter((name) => name === 'arsenal-armor-close').length, 2);
  assert.equal(a.damage(100), 150, 'The destroyed armor cannot silently protect the hull again');
  dispose(g);
});
