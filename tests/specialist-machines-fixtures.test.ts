import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Input } from '../src/game.ts';
import { loadCheckpoint, validBuild } from '../src/rules.ts';
import { STARTING_GUN_IDS } from '../src/starting-guns.ts';
import {
  SPECIALIST_UNITS,
  SPECIALIST_SCENES,
  specialistMachineTestFromUrl,
  specialistMachineTestRoom,
  prepareSpecialistMachineTest,
} from '../src/specialist-machines-test.ts';
const parse = (query: string) =>
  specialistMachineTestFromUrl(new URL('https://test/?test=specialists&v=1&' + query));
const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: false,
  fire: false,
  aim: { x: 900, y: 720 },
};
function course(query: string) {
  const f = parse(query)!;
  assert(f);
  const g = new Game();
  g.startTest(f.checkpoint, specialistMachineTestRoom(f));
  assert(prepareSpecialistMachineTest(g, f));
  return { g, f };
}

test('all twelve specialist courses and native Twin comparison reconstruct legal private checkpoints', () => {
  let count = 0;
  for (const unit of SPECIALIST_UNITS)
    for (const scene of SPECIALIST_SCENES)
      for (const elite of ['plain', 'twin'])
        for (const gun of STARTING_GUN_IDS) {
          const f = parse(`unit=${unit}&scene=${scene}&elite=${elite}&gun=${gun}`);
          if (elite === 'twin' && unit !== 'sniper') {
            assert.equal(f, null);
            continue;
          }
          assert(f);
          assert(loadCheckpoint(f.checkpoint));
          assert(validBuild(f.checkpoint.mods));
          assert(f.checkpoint.seed.length <= 40);
          const room = specialistMachineTestRoom(f);
          assert.equal(room.boss, false);
          assert.equal(room.spawns[0].kind, unit);
          assert.equal(room.spawns.length, 2);
          assert.equal(room.spawns[1].kind, 'shooter');
          assert(room.spawns[1].x > 1700);
          assert.deepEqual(specialistMachineTestRoom(f), room);
          count++;
        }
  assert.equal(count, 96);
});

test('authored courses spawn real specialist hulls and native Twin identity on actual supports', () => {
  for (const unit of SPECIALIST_UNITS)
    for (const scene of SPECIALIST_SCENES) {
      const { g, f } = course(`unit=${unit}&scene=${scene}`);
      const e = g.enemies.find((e) => e.kind === unit)!;
      assert(e);
      assert(Matter.Composite.allBodies(g.engine.world).includes(e.body));
      assert.equal(g.enemies.length, 2);
      assert.equal(g.waves.pending, false);
      assert.equal(g.hp, 100);
      assert.equal(g.player.position.x, 450);
      for (let i = 0; i < 50; i++) g.tick(1 / 60, idle);
      if (unit === 'sniper') {
        assert(e.body.isStatic);
        assert(g.enemyGrounded(e));
      }
      if (scene === 'wreckage' && unit !== 'charger') {
        assert(e.body.position.y < 600, 'elevated targets start above a real authored deck');
      }
      assert.equal(g.testRun?.seed, f.checkpoint.seed);
    }
  const { g } = course('unit=sniper&elite=twin');
  assert.equal(g.enemies.find((e) => e.kind === 'sniper')!.elite, 'twin');
});

test('ordinary inputs exercise native specialist warning, flight, rush and recovery states', () => {
  for (const unit of SPECIALIST_UNITS) {
    const { g } = course(`unit=${unit}`);
    const e = g.enemies.find((e) => e.kind === unit)!;
    const states = new Set<string>();
    for (let i = 0; i < 480 && g.mode === 'playing'; i++) {
      g.tick(1 / 60, { ...idle, jump: i % 90 === 0, jumpHeld: i % 90 < 12 });
      states.add(e.state);
    }
    assert(states.has('windup'), unit + ' winds up with native AI');
    assert(states.has('recover'), unit + ' reaches native recovery');
    if (unit === 'charger') assert(states.has('rush'));
    if (unit === 'hopper') assert(states.has('airborne'));
  }
  const { g } = course('unit=sniper&elite=twin');
  const e = g.enemies.find((e) => e.kind === 'sniper')!;
  const states = new Set<string>();
  for (let i = 0; i < 280 && g.mode === 'playing'; i++) {
    g.tick(1 / 60, idle);
    states.add(e.state);
  }
  assert(states.has('followup'), 'Twin uses its real second lock cycle');
  assert(states.has('recover'));
});

test('private input, pause, a native kill and restart preserve all progress callback guards', () => {
  for (const unit of SPECIALIST_UNITS) {
    const f = parse(`unit=${unit}&scene=shutdowns`)!;
    const g = new Game();
    let writes = 0,
      awards = 0;
    g.onCheckpoint = () => writes++;
    g.onEnemyDefeated = () => awards++;
    g.onCampaignClear = () => awards++;
    g.onCommendation = () => awards++;
    g.startTest(f.checkpoint, specialistMachineTestRoom(f));
    prepareSpecialistMachineTest(g, f);
    const x = g.player.position.x;
    for (let i = 0; i < 60; i++) g.tick(1 / 60, { ...idle, right: i < 20, fire: i > 30 });
    assert(g.player.position.x > x + 10);
    assert(g.shotCount > 0);
    g.setMode('paused');
    const time = g.time;
    for (let i = 0; i < 30; i++) g.tick(1 / 60, idle);
    assert.equal(g.time, time);
    g.setMode('playing');
    const e = g.enemies.find((e) => e.kind === unit)!;
    g.hitEnemy(e, 100000);
    assert.equal(g.kills, 1);
    assert.equal(g.mode, 'playing', 'native distant guard keeps shutdown observable');
    assert(g.enemies.some((e) => e.kind === 'shooter'));
    assert(g.machineBreakdown.wrecks.some((w) => w.visual.id === e.id));
    g.startTest(f.checkpoint, specialistMachineTestRoom(f));
    prepareSpecialistMachineTest(g, f);
    assert.equal(g.kills, 0);
    assert.equal(g.machineBreakdown.wrecks.length, 0);
    assert.equal(writes, 0);
    assert.equal(awards, 0);
  }
});

test('invalid or mixed specialist links fail closed and cannot prepare an unrelated game', () => {
  for (const q of [
    'unit=nope',
    'unit=runner',
    'scene=nope',
    'unit=hopper&elite=twin',
    'unit=charger&elite=shielded',
    'unit=sniper&elite=volatile',
    'gun=nope',
    'unit=sniper&unit=charger',
    'scene=animations&scene=reactions',
    'v=2',
    'seed=SAVE',
    'daily=2026-10-27',
    'test=operator',
    'unit=sniper#fragment',
  ])
    assert.equal(parse(q), null, q);
  assert.equal(
    specialistMachineTestFromUrl(new URL('https://test/?test=specialists&unit=charger')),
    null,
  );
  const g = new Game();
  assert.equal(prepareSpecialistMachineTest(g, parse('unit=charger')), false);
  const a = course('unit=charger');
  assert.equal(prepareSpecialistMachineTest(a.g, parse('unit=hopper')), false);
});
