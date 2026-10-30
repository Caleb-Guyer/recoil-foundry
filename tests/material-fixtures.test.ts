import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Input } from '../src/game.ts';
import { loadCheckpoint, validBuild } from '../src/rules.ts';
import { STARTING_GUN_IDS } from '../src/starting-guns.ts';
import {
  MATERIAL_SCENES,
  materialTestFromUrl,
  materialTestRoom,
  prepareMaterialTest,
} from '../src/material-test.ts';
import { LEDGE_HP, WALL_HP } from '../src/destruction.ts';
const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: false,
  fire: false,
  aim: { x: 900, y: 650 },
};
const parse = (q = '') =>
  materialTestFromUrl(new URL('https://test/?test=material-response&v=1&' + q));
function course(scene: string, mirror = false) {
  const f = parse('scene=' + scene + (mirror ? '&mirror=1' : ''))!;
  assert(f);
  const g = new Game();
  g.startTest(f.checkpoint, materialTestRoom(f));
  assert(prepareMaterialTest(g, f));
  return { g, f };
}
function dispose(g: Game) {
  Matter.Composite.clear(g.engine.world, false);
  Matter.Engine.clear(g.engine);
}
function tick(g: Game, n = 1) {
  for (let i = 0; i < n; i++) g.tick(1 / 60, idle);
}
test('six material ranges and both arrangements reconstruct 72 legal six-tool private checkpoints', () => {
  const seeds = new Set<string>();
  for (const scene of MATERIAL_SCENES)
    for (const gun of STARTING_GUN_IDS)
      for (const mirror of ['', '&mirror=1']) {
        const f = parse('scene=' + scene + '&gun=' + gun + mirror)!;
        assert(f);
        assert(loadCheckpoint(f.checkpoint));
        assert(validBuild(f.checkpoint.mods));
        assert(f.checkpoint.seed.length <= 40);
        seeds.add(f.checkpoint.seed);
        const g = new Game();
        g.startTest(f.checkpoint, materialTestRoom(f));
        assert(prepareMaterialTest(g, f));
        assert.equal(g.mode, 'playing');
        assert.equal(g.startingGun, gun);
        assert.equal(g.player.position.x, f.mirror ? 1860 : 140);
        assert(!g.testRun?.rematchRoom);
        assert.deepEqual(g.level.solids, materialTestRoom(f).solids);
        dispose(g);
      }
  assert.equal(seeds.size, 72);
});
test('ordinary material bays use real crate, cover, canister and suspended cargo bodies without an automatic result', () => {
  for (const scene of ['props', 'reactions', 'breakage'])
    for (const mirror of [false, true]) {
      const { g } = course(scene, mirror);
      assert.deepEqual(g.props.items.map((p) => p.kind).sort(), [
        'canister',
        'cargo',
        'cover',
        'crate',
      ]);
      assert.equal(g.cargo.items.length, 1);
      const cargo = g.cargo.items[0];
      assert(cargo.body.isStatic);
      assert.equal(cargo.cargo?.state, 'hanging');
      assert.equal(cargo.hp, 400);
      assert.equal(g.props.items.find((p) => p.kind === 'crate')!.hp, 120);
      assert.equal(g.enemies.length, 0);
      tick(g, 90);
      assert.equal(g.mode, 'playing');
      assert(g.clear);
      dispose(g);
    }
});
test('terrain course registers only its optional wall and shelf with native health and supported loads', () => {
  for (const mirror of [false, true]) {
    const { g, f } = course('terrain', mirror);
    assert.equal(g.destruction.pieces.length, 2);
    assert.deepEqual(
      g.destruction.pieces.map((p) => p.maxHp).sort((a, b) => a - b),
      [LEDGE_HP, WALL_HP],
    );
    const shelf = g.destruction.pieces.find((p) => p.rect.h <= 28)!;
    const load = g.props.items.find((p) => p.kind === 'cover')!;
    assert(load.body.isStatic);
    assert.equal(g.cargo.items.length, 0);
    const before = g.terrain.length;
    g.destruction.hitBody(shelf.body, 999, { x: 0, y: 1 });
    assert(!g.terrain.includes(shelf.body));
    assert.equal(g.terrain.length, before - 1);
    assert(!load.body.isStatic);
    assert.equal(g.destruction.pieces.length, 1);
    const structural = materialTestRoom(f).solids[2];
    assert(g.level.solids.some((s) => s.x === structural.x && s.y === structural.y));
    dispose(g);
  }
});
test('canister range keeps the native delayed arming and impact rule instead of a timed fuse', () => {
  for (const mirror of [false, true]) {
    const { g } = course('canisters', mirror);
    const can = g.props.items.find((p) => p.kind === 'canister')!;
    assert.equal(g.props.items.filter((p) => p.kind === 'canister').length, 3);
    const at = g.time;
    g.props.hit(can, 22, { x: 0, y: -1 }, undefined, true);
    assert(Math.abs(can.armedAt - at - 0.06) < 1e-9);
    assert.equal(can.detonateAt, Infinity);
    tick(g, 8);
    assert(g.props.items.includes(can), 'arming alone must not explode an airborne canister');
    assert(g.time >= can.armedAt);
    assert.equal(can.detonateAt, Infinity);
    dispose(g);
  }
});
test('mixed inspection contains native live enemies and the full ordinary material family', () => {
  for (const mirror of [false, true]) {
    const { g } = course('combat', mirror);
    assert.equal(g.props.items.length, 4);
    const native = [
      ...g.enemies.map((e) => e.kind),
      ...g.waves.doors.filter((d) => d.state !== 'spent').map((d) => d.spawn.kind),
    ];
    assert.deepEqual(native.sort(), ['flyer', 'runner', 'shooter']);
    assert(!g.testRun?.rematchRoom);
    dispose(g);
  }
});
test('Pause and R-style reconstruction keep material ranges private and restore native starting bodies', () => {
  for (const scene of MATERIAL_SCENES) {
    const { g, f } = course(scene);
    let writes = 0;
    g.onCheckpoint = () => writes++;
    g.onEnemyDefeated = () => writes++;
    g.onCommendation = () => writes++;
    tick(g, 15);
    g.setMode('paused');
    const time = g.time,
      props = g.props.items.map((p) => ({ ...p.body.position }));
    tick(g, 60);
    assert.equal(g.time, time);
    assert.deepEqual(
      g.props.items.map((p) => ({ ...p.body.position })),
      props,
    );
    g.startTest(f.checkpoint, materialTestRoom(f));
    assert(prepareMaterialTest(g, f));
    assert.equal(g.kills, 0);
    assert.equal(g.hp, 100);
    assert.equal(writes, 0);
    dispose(g);
  }
});
test('unknown, duplicate, mixed, fragmented and unsupported material links fail closed', () => {
  for (const q of [
    'scene=nope',
    'scene=props&scene=breakage',
    'test=courier',
    'gun=nope',
    'gun=pistol&gun=pistol',
    'seed=LIVE',
    'daily=2026-10-30',
    'mirror=0',
    'mirror=1&mirror=1',
    'v=2',
    'scene=terrain#x',
    'unit=wall',
  ])
    assert.equal(parse(q), null, q);
  assert.equal(materialTestFromUrl(new URL('https://test/?test=material-response')), null);
  const g = new Game();
  assert(!prepareMaterialTest(g, parse()));
  dispose(g);
});

test('canister chain course demonstrates native cover occlusion before the shielding cover breaks', () => {
  for (const mirror of [false, true]) {
    const { g } = course('canisters', mirror);
    const can = g.props.items.find(
      (p) => p.kind === 'canister' && p.body.position.x === (mirror ? 1070 : 930),
    )!;
    const cover = g.props.items.find((p) => p.kind === 'cover')!;
    const crate = g.props.items.find((p) => p.kind === 'crate')!;
    g.props.explode(can);
    assert.equal(g.props.items.filter((p) => p.kind === 'canister').length, 0);
    assert(!g.props.items.includes(cover), 'nearby blast destroys the shielding cover');
    assert(g.props.items.includes(crate));
    assert.equal(crate.hp, 120, 'blast visibility is resolved before that cover is removed');
    dispose(g);
  }
});
