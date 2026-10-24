import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Input } from '../src/game.ts';
import {
  COMBAT_FOCUS_IDS,
  COMBAT_FOCUS_SCENES,
  combatFocusTestFromUrl,
  combatFocusRoom,
  combatFocusLevel,
  combatFocusEntry,
  prepareCombatFocus,
} from '../src/combat-focus-test.ts';
import { loadCheckpoint, getGun } from '../src/rules.ts';
import { ENEMY_STATS } from '../src/enemies.ts';
const { Query } = Matter;
const url = (query = '') => new URL('https://test/?test=focus&v=1' + query);
function start(scene: string, mirror = false) {
  const spec = combatFocusTestFromUrl(url(`&scene=${scene}&mirror=${mirror ? 1 : 0}`))!;
  const g = new Game();
  g.startTest(spec.checkpoint);
  return { g, spec };
}
const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: false,
  fire: false,
  aim: { x: 1000, y: 700 },
};
const overlap = (a: Matter.Bounds, b: Matter.Bounds) =>
  Math.min(a.max.x, b.max.x) - Math.max(a.min.x, b.min.x) > 0.5 &&
  Math.min(a.max.y, b.max.y) - Math.max(a.min.y, b.min.y) > 0.5;

test('all 24 links are valid private checkpoints and camera modes share the exact same world', () => {
  for (const scene of COMBAT_FOCUS_IDS)
    for (const mirror of [false, true]) {
      const values = ['follow', 'steady', 'wide'].map(
        (camera) =>
          combatFocusTestFromUrl(url(`&scene=${scene}&mirror=${mirror ? 1 : 0}&camera=${camera}`))!,
      );
      assert(values.every((v) => loadCheckpoint(v.checkpoint)));
      for (const v of values) {
        assert.equal(v.checkpoint.hp, 100);
        assert.equal(v.checkpoint.startingGun, 'pistol');
        assert.deepEqual(v.checkpoint.mods, []);
        assert(v.checkpoint.seed.length <= 40);
        assert.deepEqual(v.checkpoint, values[0].checkpoint);
      }
    }
  assert.equal(combatFocusTestFromUrl(url())?.scene, 'climb');
  assert.equal(combatFocusTestFromUrl(url())?.camera, 'follow');
});
test('focus links reject duplicate keys, unknown options and invalid modes or fixtures', () => {
  for (const query of [
    '&test=focus',
    '&v=1',
    '&scene=climb&scene=climb',
    '&camera=wide&camera=wide',
    '&mirror=0&mirror=0',
    '&gun=shotgun',
    '&build=beam',
    '&room=climb',
    '&scene=',
    '&scene=other',
    '&camera=',
    '&camera=automatic',
    '&mirror=true',
    '&mirror=2',
    '&test=flow',
  ])
    assert.equal(combatFocusTestFromUrl(url(query)), null, query);
  assert.equal(combatFocusTestFromUrl(new URL('https://test/?test=focus')), null);
  assert.equal(combatFocusTestFromUrl(new URL('https://test/?test=focus&v=2')), null);
});
test('production startTest hooks select the authored room and supported initial position on both mirrors', () => {
  for (const scene of COMBAT_FOCUS_IDS)
    for (const mirror of [false, true]) {
      const { g } = start(scene, mirror);
      assert.equal(g.level.id, 'combat-focus-' + scene);
      assert.deepEqual(g.player.position, combatFocusEntry(scene, mirror));
      assert.equal(g.level.mirrored, mirror);
      assert.equal(g.worldTop, scene === 'climb' || scene === 'descent' ? -620 : 0);
      assert(!g.recoil.active);
      assert.equal(g.recoil.state, null);
      assert.equal(g.recoil.practice, null);
      assert.equal(g.hp, 100);
      assert.deepEqual(g.gun, getGun([], 'pistol'));
    }
});
test('fixture selection cannot alter normal Campaigns, a different stage or unrelated private runs', () => {
  const { g } = start('climb'),
    base = combatFocusRoom('cover');
  g.testRun = null;
  assert.equal(combatFocusLevel(g, base), base);
  const spec = combatFocusTestFromUrl(url('&scene=climb'))!;
  g.testRun = spec.checkpoint;
  g.stage++;
  assert.equal(combatFocusLevel(g, base), base);
  g.stage--;
  g.testRun = { ...spec.checkpoint, seed: 'other' };
  assert.equal(combatFocusLevel(g, base), base);
  const before = { ...g.player.position };
  prepareCombatFocus(g);
  assert.deepEqual(g.player.position, before);
});
test('native actor and prop hulls fit every authored fixture and every route node has real support', () => {
  for (const scene of COMBAT_FOCUS_IDS)
    for (const mirror of [false, true]) {
      const { g } = start(scene, mirror);
      for (const b of [
        g.player,
        ...g.enemies.map((e) => e.body),
        ...g.props.items.map((p) => p.body),
      ])
        assert(
          !g.terrain.some((terrain) => overlap(b.bounds, terrain.bounds)),
          `${scene}/${mirror}: initial terrain overlap`,
        );
      for (const e of g.enemies) {
        assert(
          e.body.position.x > ENEMY_STATS[e.kind].w / 2 &&
            e.body.position.x < 2000 - ENEMY_STATS[e.kind].w / 2,
        );
        assert(e.hp > 0 && Number.isFinite(e.hp));
      }
      for (const node of g.level.route) {
        const below = Query.ray(
          g.terrain,
          { x: node.x, y: node.y + 16 },
          { x: node.x, y: node.y + 25 },
          4,
        );
        assert(below.length > 0, `${scene}/${mirror}: unsupported route ${JSON.stringify(node)}`);
      }
    }
});
test('fixtures own fresh geometry and Retry resets the real room without checkpoint or reward writes', () => {
  for (const scene of COMBAT_FOCUS_IDS) {
    const { g, spec } = start(scene);
    let writes = 0;
    g.onCheckpoint = () => writes++;
    g.onCommendation = () => writes++;
    g.onCampaignClear = () => writes++;
    const first = structuredClone(g.level),
      entry = { ...g.player.position };
    for (let n = 0; n < 60; n++)
      g.tick(1 / 60, { ...idle, right: true, jump: n === 0, jumpHeld: true });
    assert.notDeepEqual(g.player.position, entry);
    g.save();
    assert.equal(writes, 0);
    g.startTest(spec.checkpoint);
    assert.deepEqual(g.level, first);
    assert.deepEqual(g.player.position, entry);
    assert.equal(g.hp, 100);
    assert.equal(writes, 0);
    const a = combatFocusRoom(scene),
      b = combatFocusRoom(scene);
    a.solids.push({ x: 0, y: 0, w: 1, h: 1 });
    assert.notDeepEqual(a, b);
  }
});
test('moving cover uses actual supported lift and crate physics without a scripted obstruction', () => {
  for (const mirror of [false, true]) {
    const { g } = start('cover', mirror),
      lift = g.hazards.items[0],
      crate = g.props.items[0];
    assert(lift && crate);
    assert.equal(crate.kind, 'crate');
    assert(!crate.body.isStatic);
    const before = { lift: lift.body.position.y, crate: crate.body.position.y };
    for (let n = 0; n < 90 && g.mode === 'playing'; n++) g.tick(1 / 60, idle);
    assert(lift.body.position.y < before.lift - 25);
    assert(crate.body.position.y < before.crate - 20);
    assert.equal(g.hp, 100);
  }
});
