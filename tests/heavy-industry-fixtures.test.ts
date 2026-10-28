import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Input } from '../src/game.ts';
import { loadCheckpoint, validBuild } from '../src/rules.ts';
import { STARTING_GUN_IDS } from '../src/starting-guns.ts';
import { ENEMY_STATS } from '../src/enemies.ts';
import { MACHINE_VARIANTS, MACHINE_VARIANT_IDS } from '../src/patrol-machines.ts';
import {
  HEAVY_UNITS,
  HEAVY_SCENES,
  heavyIndustryTestFromUrl,
  heavyIndustryTestRoom,
  prepareHeavyIndustryTest,
} from '../src/heavy-industry-test.ts';
const parse = (query: string) =>
  heavyIndustryTestFromUrl(new URL('https://test/?test=heavy-industry&v=1&' + query));
const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: false,
  fire: false,
  aim: { x: 820, y: 720 },
};
function course(query: string) {
  const f = parse(query)!;
  assert(f);
  const g = new Game();
  g.startTest(f.checkpoint, heavyIndustryTestRoom(f));
  assert(prepareHeavyIndustryTest(g, f));
  return { g, f };
}
test('all twelve Heavy courses, six variants and six tools reconstruct 216 legal isolated checkpoints', () => {
  let count = 0;
  for (const unit of HEAVY_UNITS)
    for (const scene of HEAVY_SCENES)
      for (const variant of ['plain', ...MACHINE_VARIANT_IDS])
        for (const gun of STARTING_GUN_IDS) {
          const f = parse(`unit=${unit}&scene=${scene}&variant=${variant}&gun=${gun}`);
          if (
            variant !== 'plain' &&
            MACHINE_VARIANTS[variant as keyof typeof MACHINE_VARIANTS].kind !== unit
          ) {
            assert.equal(f, null);
            continue;
          }
          assert(f);
          assert(loadCheckpoint(f.checkpoint));
          assert(validBuild(f.checkpoint.mods));
          assert(f.checkpoint.seed.length <= 40);
          const room = heavyIndustryTestRoom(f);
          assert.equal(room.spawns[0].kind, unit);
          assert.equal(room.spawns.length, 2);
          assert.equal(room.spawns[1].kind, 'shooter');
          assert(room.spawns[1].x > 1700);
          assert.equal(room.spawns[0].machineVariant, variant === 'plain' ? undefined : variant);
          assert.deepEqual(heavyIndustryTestRoom(f), room);
          count++;
        }
  assert.equal(count, 216);
});
test('courses retain actual patrol hulls, support, native variants and a distant live guard', () => {
  for (const unit of HEAVY_UNITS)
    for (const scene of HEAVY_SCENES) {
      const { g, f } = course(`unit=${unit}&scene=${scene}`);
      const e = g.enemies.find((e) => e.kind === unit)!;
      assert(e?.patrol);
      assert(Matter.Composite.allBodies(g.engine.world).includes(e.body));
      assert.equal(g.enemies.length, 2);
      assert.equal(g.waves.pending, false);
      assert.equal(g.player.position.x, 450);
      assert.equal(g.hp, 100);
      assert.equal(e.body.bounds.max.x - e.body.bounds.min.x, ENEMY_STATS[unit].w);
      for (let i = 0; i < 50; i++) g.tick(1 / 60, idle);
      assert(g.enemyGrounded(e));
      if (scene === 'wreckage')
        assert(e.body.position.y < 600, 'wreck course begins on its real elevated deck');
      assert.equal(g.testRun?.seed, f.checkpoint.seed);
    }
  for (const variant of MACHINE_VARIANT_IDS) {
    const unit = MACHINE_VARIANTS[variant].kind,
      { g } = course(`unit=${unit}&variant=${variant}`);
    assert.equal(g.enemies.find((e) => e.kind === unit)!.patrol!.variant, variant);
  }
});
test('ordinary idle and jump inputs reach warned attacks, native recovery, burst followup and real mortar shells', () => {
  for (const unit of HEAVY_UNITS)
    for (const variant of [
      'plain',
      ...MACHINE_VARIANT_IDS.filter((v) => MACHINE_VARIANTS[v].kind === unit),
    ]) {
      const { g } = course(`unit=${unit}&variant=${variant}`),
        e = g.enemies.find((e) => e.kind === unit)!;
      const states = new Set<string>();
      let sawShell = false;
      for (let i = 0; i < 480 && g.mode === 'playing'; i++) {
        g.tick(1 / 60, { ...idle, jump: i % 90 === 0, jumpHeld: i % 90 < 12 });
        states.add(e.state);
        sawShell ||= g.patrolMachines.shells.some((s) => s.owner === e.id);
      }
      assert(states.has('windup'), variant + ' uses native warning');
      assert(states.has('recover'), variant + ' reaches actual recovery');
      if (variant === 'shutter-burst') assert(states.has('followup'));
      if (unit === 'mortar') assert(sawShell, variant + ' launches a real interceptable shell');
    }
});
test('private firing, movement, Pause, native defeat and retry preserve all progress callback guards', () => {
  for (const unit of HEAVY_UNITS) {
    const f = parse(`unit=${unit}&scene=shutdowns`)!,
      g = new Game();
    let writes = 0,
      awards = 0;
    g.onCheckpoint = () => writes++;
    g.onEnemyDefeated = () => awards++;
    g.onCampaignClear = () => awards++;
    g.onCommendation = () => awards++;
    g.startTest(f.checkpoint, heavyIndustryTestRoom(f));
    prepareHeavyIndustryTest(g, f);
    for (let i = 0; i < 60; i++) g.tick(1 / 60, { ...idle, right: i < 20, fire: i > 30 });
    assert(g.player.position.x > 460);
    assert(g.shotCount > 0);
    g.setMode('paused');
    const time = g.time;
    for (let i = 0; i < 30; i++) g.tick(1 / 60, idle);
    assert.equal(g.time, time);
    g.setMode('playing');
    const e = g.enemies.find((e) => e.kind === unit)!;
    g.hitEnemy(e, 100000);
    assert.equal(g.kills, 1);
    assert.equal(g.mode, 'playing');
    assert(g.enemies.some((e) => e.kind === 'shooter'));
    assert(g.machineBreakdown.wrecks.some((w) => w.visual.id === e.id));
    g.startTest(f.checkpoint, heavyIndustryTestRoom(f));
    prepareHeavyIndustryTest(g, f);
    assert.equal(g.kills, 0);
    assert.equal(g.machineBreakdown.wrecks.length, 0);
    assert.equal(writes, 0);
    assert.equal(awards, 0);
  }
});
test('unsupported or ambiguous heavy links fail closed and cannot alter another run', () => {
  for (const q of [
    'unit=nope',
    'unit=charger',
    'scene=nope',
    'variant=nope',
    'unit=shutter&variant=mortar-twin',
    'unit=mortar&variant=strider-survey',
    'elite=twin',
    'gun=nope',
    'unit=strider&unit=mortar',
    'scene=animations&scene=reactions',
    'variant=plain&variant=shutter-fan',
    'v=2',
    'seed=SAVE',
    'daily=2026-10-27',
    'test=specialists',
    'unit=mortar#fragment',
  ])
    assert.equal(parse(q), null, q);
  assert.equal(
    heavyIndustryTestFromUrl(new URL('https://test/?test=heavy-industry&unit=shutter')),
    null,
  );
  const g = new Game();
  assert.equal(prepareHeavyIndustryTest(g, parse('unit=shutter')), false);
  const a = course('unit=shutter');
  assert.equal(prepareHeavyIndustryTest(a.g, parse('unit=mortar')), false);
});
