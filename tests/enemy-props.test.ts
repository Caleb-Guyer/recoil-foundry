import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game } from '../src/game.ts';
import { ENEMY_STATS } from '../src/enemies.ts';
import type { EnemyKind } from '../src/levels.ts';
import type { PropKind } from '../src/props.ts';
import { sweepBox } from '../src/collisions.ts';

const { Body, Bodies, Composite, Engine, Query } = Matter;
const kinds = Object.keys(ENEMY_STATS) as EnemyKind[];
function fixture(kind: EnemyKind) {
  const g = new Game();
  g.start('enemy-props');
  for (const e of g.enemies) Composite.remove(g.engine.world, e.body);
  g.enemies = [];
  g.waves.clear();
  for (const prop of [...g.props.items]) g.props.remove(prop);
  for (const body of g.terrain.slice(4)) Composite.remove(g.engine.world, body);
  g.terrain = g.terrain.slice(0, 4);
  Body.setPosition(g.player, { x: 1400, y: 400 });
  g.spawnEnemy(kind, 700, kind === 'crane' ? 150 : 400);
  const e = g.enemies[0];
  e.spawn = 0;
  e.timer = 10;
  g.engine.gravity.y = 0;
  return { g, e };
}
// Exercise real Matter contacts, independently of steering and attack selection.
function physics(g: Game, frames = 1) {
  for (let i = 0; i < frames; i++) {
    g.time += 1 / 60;
    g.props.beforeStep();
    Engine.update(g.engine, 1000 / 60);
    g.props.afterStep(1 / 60);
  }
}

for (const kind of kinds) {
  test(`${kind}: moving crates collide with the hull and inflict impact damage`, () => {
    const { g, e } = fixture(kind);
    const crate = g.props.spawn(
      'crate',
      e.body.position.x - ENEMY_STATS[kind].w / 2 - 30,
      e.body.position.y,
    );
    Body.setVelocity(crate.body, { x: 14, y: 0 });
    physics(g, 3);
    assert(e.hp < e.maxHp);
    assert(crate.hits.has(e.id));
  });
  test(`${kind}: gentle contact with crates and fuel is solid and harmless`, () => {
    for (const propKind of ['crate', 'canister'] as PropKind[]) {
      const { g, e } = fixture(kind);
      const prop = g.props.spawn(
        propKind,
        e.body.position.x - ENEMY_STATS[kind].w / 2 - 22,
        e.body.position.y,
      );
      const start = prop.body.position.x;
      Body.setVelocity(prop.body, { x: 3, y: 0 });
      physics(g, 20);
      assert(g.props.items.includes(prop));
      assert.equal(prop.hp, prop.maxHp);
      assert.equal(e.hp, e.maxHp);
      assert(prop.body.position.x < e.body.position.x, 'prop passed through the enemy');
      assert(
        prop.body.position.x - start < 35 || e.body.position.x > 701,
        'contact did not stop or push the enemy',
      );
      assert(Query.collides(prop.body, [e.body]).every((hit) => hit.depth < 0.5));
    }
  });
  if (!['shooter', 'sniper', 'crane'].includes(kind)) {
    test(`${kind}: a hard body impact damages stationary crates and ignites untouched fuel`, () => {
      for (const propKind of ['crate', 'canister', 'cover'] as PropKind[]) {
        const { g, e } = fixture(kind);
        const prop = g.props.spawn(
          propKind,
          700 + ENEMY_STATS[kind].w / 2 + (propKind === 'crate' ? 22 : 12) + 6,
          400,
        );
        Body.setVelocity(e.body, { x: 14, y: 0 });
        physics(g, 2);
        assert(!g.props.items.includes(prop), `${kind} did not break ${propKind}`);
        assert(!Composite.allBodies(g.engine.world).includes(prop.body));
      }
    });
  }
}

for (const kind of ['loader', 'charger'] as const)
  for (const propKind of ['crate', 'cover', 'canister'] as PropKind[])
    test(`${kind}: a committed ram reaches ${propKind} from both sides before striking it`, () => {
      for (const sign of [-1, 1]) {
        const { g, e } = fixture(kind);
        const prop = g.props.spawn(
          propKind,
          700 + sign * (ENEMY_STATS[kind].w / 2 + (propKind === 'crate' ? 22 : 12) + 17),
          400,
        );
        e.state = 'rush';
        e.aim = { x: sign, y: 0 };
        g.updateEnemy(e, 1 / 60);
        assert.equal(e.state, 'rush');
        assert.equal(prop.hp, prop.maxHp);
        physics(g);
        g.updateEnemy(e, 1 / 60);
        assert.equal(e.state, 'recover');
        assert(!g.props.items.includes(prop));
        assert(Math.abs(e.body.position.x - 700) >= 16, 'ram struck across an empty gap');
      }
    });

test('Loader catches a low tipped crate below its centerline', () => {
  const { g, e } = fixture('loader');
  const crate = g.props.spawn('crate', 785, 449);
  Body.setAngle(crate.body, Math.PI / 4);
  e.state = 'rush';
  e.aim = { x: 1, y: 0 };
  g.updateEnemy(e, 1 / 60);
  physics(g);
  g.updateEnemy(e, 1 / 60);
  assert(!g.props.items.includes(crate));
  assert.equal(e.state, 'recover');
});

for (const propKind of ['crate', 'canister', 'cover'] as PropKind[])
  test(`Press and Crane slams stop at and destroy ${propKind}`, () => {
    for (const kind of ['press', 'crane'] as const) {
      const { g, e } = fixture(kind);
      e.state = 'rush';
      e.attack = 'slam';
      const from = kind === 'press' ? e.body.position : e.crane!.head;
      if (e.crane) e.crane.to = { x: from.x, y: from.y + 200 };
      const half = kind === 'press' ? 31 : 23;
      const prop = g.props.spawn(
        propKind,
        from.x,
        from.y + half + (propKind === 'crate' ? 22 : propKind === 'cover' ? 42 : 19) + 8,
      );
      const start = { ...from };
      g.updateEnemy(e, 1 / 60);
      assert(!g.props.items.includes(prop));
      assert.equal(e.state, 'recover');
      const end = kind === 'press' ? e.body.position : e.crane!.head;
      assert(Math.abs(end.y - start.y - 8) < 0.2, 'slam failed to stop on the first contact');
    }
  });

test('solid cover protects props behind it from a Press slam', () => {
  const { g, e } = fixture('press');
  const wall = Bodies.rectangle(700, 450, 180, 10, { isStatic: true });
  Composite.add(g.engine.world, wall);
  g.terrain.push(wall);
  const fuel = g.props.spawn('canister', 700, 475);
  e.state = 'rush';
  g.updateEnemy(e, 1 / 60);
  assert.equal(e.state, 'recover');
  assert(g.props.items.includes(fuel));
  assert.equal(fuel.armedAt, Infinity);
});

test('the resting Crane hammer supports a falling crate and the moving motor hits rail props', () => {
  const { g, e } = fixture('crane');
  const head = e.crane!.head;
  const crate = g.props.spawn('crate', head.x, head.y - 60);
  Body.setVelocity(crate.body, { x: 0, y: 3 });
  physics(g, 20);
  assert(crate.body.position.y + 22 <= head.y - 23 + 0.2);
  const railCrate = g.props.spawn('crate', e.body.position.x + 45 + 22 + 4, 150);
  e.state = 'return';
  g.updateEnemy(e, 1 / 60);
  assert(!g.props.items.includes(railCrate));
});

test('swept hulls catch thin rotated solids without colliding with their empty bounding corners', () => {
  const body = Bodies.rectangle(100, 100, 44, 44);
  Body.setAngle(body, Math.PI / 4);
  assert.equal(sweepBox({ x: 122, y: 127 }, { x: 130, y: 127 }, { x: 1, y: 1 }, body), null);
  assert(sweepBox({ x: 0, y: 100 }, { x: 200, y: 100 }, { x: 15, y: 16 }, body));
  const floor = Bodies.rectangle(100, 150, 300, 10);
  assert.equal(sweepBox({ x: 0, y: 129 }, { x: 20, y: 129 }, { x: 15, y: 16 }, floor), null);
});
