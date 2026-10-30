import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Input } from '../src/game.ts';
import { loadCheckpoint, validBuild } from '../src/rules.ts';
import { STARTING_GUN_IDS } from '../src/starting-guns.ts';
import { huntLevel } from '../src/hunt-rules.ts';
import { round } from './branches-fixture.ts';
import {
  CONTRACT_UNITS,
  CONTRACT_SCENES,
  contractMachinesTestFromUrl,
  contractMachinesTestRoom,
  prepareContractMachinesTest,
} from '../src/contract-machines-test.ts';
const parse = (q: string) =>
  contractMachinesTestFromUrl(new URL('https://test/?test=contract-machines&v=1&' + q));
const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: false,
  fire: false,
  aim: { x: 1460, y: 705 },
};
function course(q: string) {
  const f = parse(q)!;
  assert(f);
  const g = new Game();
  g.startTest(f.checkpoint, contractMachinesTestRoom(f));
  assert(prepareContractMachinesTest(g, f));
  const e = g.enemies.find((e) => e.kind === f.unit)!;
  assert(e);
  return { g, e, f };
}
function dispose(g: Game) {
  Matter.Composite.clear(g.engine.world, false);
  Matter.Engine.clear(g.engine);
}
function until(g: Game, predicate: () => boolean, max = 600) {
  for (let i = 0; i < max && !predicate() && g.mode === 'playing'; i++) g.tick(1 / 60, idle);
  assert(predicate(), 'Expected native hunt state before defeat');
}
function advanceShots(g: Game) {
  for (let n = 0; n < 8; n++) {
    g.time += 1 / 60;
    g.updateShots(1 / 60);
  }
}
test('fifteen contract inspections reconstruct90 legal deterministic private tool checkpoints', () => {
  const seeds = new Set<string>();
  for (const unit of CONTRACT_UNITS)
    for (const scene of CONTRACT_SCENES)
      for (const gun of STARTING_GUN_IDS) {
        const f = parse(`unit=${unit}&scene=${scene}&gun=${gun}`)!;
        assert(f);
        assert(loadCheckpoint(f.checkpoint));
        assert(validBuild(f.checkpoint.mods));
        assert(f.checkpoint.seed.length <= 40);
        assert.deepEqual(contractMachinesTestRoom(f), contractMachinesTestRoom(f));
        assert.equal(f.checkpoint.huntRules, undefined);
        assert.equal(f.checkpoint.huntTest, undefined);
        seeds.add(f.checkpoint.seed);
      }
  assert.equal(seeds.size, 90);
});
test('all fifteen inspections retain authored hunt arenas, live native gear and the real floor', () => {
  for (const unit of CONTRACT_UNITS)
    for (const scene of CONTRACT_SCENES) {
      const { g, e, f } = course(`unit=${unit}&scene=${scene}`),
        native = huntLevel(unit);
      assert.equal(g.level.hunt, unit);
      assert.equal(g.level.boss, true);
      assert.deepEqual(g.level.solids.slice(0, native.solids.length), native.solids);
      assert.equal(g.waves.pending, false);
      assert.equal(g.player.position.x, 1000);
      assert.equal(g.player.position.y, 722);
      assert.equal(g.hp, 100);
      assert.equal(g.kills, 0);
      assert.equal(g.machineBreakdown.wrecks.length, 0);
      assert.equal(g.enemies.length, 1);
      assert(Matter.Composite.allBodies(g.engine.world).includes(e.body));
      assert.equal(g.hunts.plates.length, unit === 'bulwark' ? 2 : 0);
      assert.equal(g.hunts.enabled, false);
      assert.equal(g.hunts.state, null);
      assert.equal(g.seed, f.checkpoint.seed);
      dispose(g);
    }
});
test('every contract course reaches actual volleys and its native deployment or shielding cycle', () => {
  for (const unit of CONTRACT_UNITS)
    for (const scene of CONTRACT_SCENES) {
      const { g, e } = course(`unit=${unit}&scene=${scene}`);
      let gear = unit === 'bulwark' && g.hunts.plates.length === 2,
        shots = false;
      until(
        g,
        () => {
          gear ||= g.hunts.cables.length > 0 || g.hunts.mines.length > 0;
          shots ||= g.shots.some((s) => s.damageCause?.enemy === unit);
          return e.attacks >= 2;
        },
        720,
      );
      assert(gear, unit + '/' + scene + ' actual gear');
      assert(shots, unit + '/' + scene + ' actual physical volley');
      dispose(g);
    }
});
for (const unit of CONTRACT_UNITS)
  test(unit + ' private counterplay uses real player projectile contacts', () => {
    const { g, e } = course(`unit=${unit}&scene=mechanisms`);
    e.spawn = 0;
    if (unit === 'cableweaver') {
      until(g, () => g.hunts.cables.length > 0);
      const c = g.hunts.cables[0],
        x = (c.anchors[0].body.position.x + c.anchors[1].body.position.x) / 2;
      round(g, { pos: { x, y: 670 }, vel: { x: 0, y: 28 }, damage: 100 });
      advanceShots(g);
      assert.equal(g.hunts.cables.length, 0);
      assert(c.anchors.every((p) => !g.props.items.includes(p)));
    } else if (unit === 'bulwark') {
      assert.equal(g.hunts.armor(e), 0.7);
      for (const p of [...g.hunts.plates]) {
        const at = { ...p.body.position };
        round(g, { pos: { x: at.x, y: at.y - 55 }, vel: { x: 0, y: 28 }, damage: 120 });
        advanceShots(g);
      }
      assert.equal(g.hunts.plates.length, 0);
      assert.equal(g.hunts.armor(e), 1);
      assert.equal(e.state, 'recover');
    } else {
      until(g, () => g.hunts.mines.length > 0);
      const p = g.hunts.mines[0].prop,
        at = { ...p.body.position },
        hp = g.hp;
      round(g, { pos: { x: at.x, y: at.y - 55 }, vel: { x: 0, y: 28 }, damage: 30 });
      advanceShots(g);
      assert.equal(g.hunts.mines.length, 0);
      assert(!g.props.items.includes(p));
      assert.equal(g.hp, hp);
    }
    dispose(g);
  });
test('private contract movement, firing, Pause, death and restart do not write saved progress or rewards', () => {
  for (const unit of CONTRACT_UNITS) {
    const f = parse(`unit=${unit}&scene=shutdowns`)!,
      g = new Game();
    let writes = 0,
      awards = 0;
    g.onCheckpoint = () => writes++;
    g.onEnemyDefeated = () => awards++;
    g.onCampaignClear = () => awards++;
    g.onCommendation = () => awards++;
    g.hunts.onClear = () => awards++;
    g.startTest(f.checkpoint, contractMachinesTestRoom(f));
    assert(prepareContractMachinesTest(g, f));
    for (let i = 0; i < 45; i++) g.tick(1 / 60, { ...idle, left: i < 20, fire: i > 30 });
    assert(g.player.position.x < 1000);
    assert(g.shotCount > 0);
    g.setMode('paused');
    const time = g.time;
    for (let i = 0; i < 30; i++) g.tick(1 / 60, idle);
    assert.equal(g.time, time);
    g.setMode('playing');
    const e = g.enemies.find((e) => e.kind === unit)!;
    e.spawn = 0;
    g.hitEnemy(e, 100000);
    g.hitStop = 0;
    assert.equal(g.mode, 'playing');
    assert.equal(g.kills, 1);
    assert(g.machineBreakdown.wrecks.some((w) => w.visual.id === e.id));
    assert.equal(g.hunts.cables.length + g.hunts.mines.length + g.hunts.plates.length, 0);
    g.startTest(f.checkpoint, contractMachinesTestRoom(f));
    assert(prepareContractMachinesTest(g, f));
    assert.equal(g.kills, 0);
    assert.equal(g.machineBreakdown.wrecks.length, 0);
    assert.equal(writes, 0);
    assert.equal(awards, 0);
    dispose(g);
  }
});
test('ambiguous contract links fail closed and cannot prepare another run', () => {
  for (const q of [
    'unit=loader',
    'scene=friendly',
    'gun=nope',
    'unit=bulwark&unit=demolisher',
    'scene=animations&scene=reactions',
    'seed=SAVE',
    'daily=2026-10-29',
    'test=hunt',
    'hunt=bulwark',
    'approach=1',
    'v=2',
    'unit=cableweaver#fragment',
  ])
    assert.equal(parse(q), null, q);
  assert.equal(contractMachinesTestFromUrl(new URL('https://test/?test=contract-machines')), null);
  assert.equal(prepareContractMachinesTest(new Game(), parse('unit=bulwark')), false);
  const { g } = course('unit=cableweaver');
  assert.equal(prepareContractMachinesTest(g, parse('unit=demolisher')), false);
  dispose(g);
});
