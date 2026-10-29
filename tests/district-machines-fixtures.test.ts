import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Input } from '../src/game.ts';
import { loadCheckpoint, validBuild } from '../src/rules.ts';
import { STARTING_GUN_IDS } from '../src/starting-guns.ts';
import {
  DISTRICT_UNITS,
  DISTRICT_SCENES,
  districtMachinesTestFromUrl,
  districtMachinesTestRoom,
  prepareDistrictMachinesTest,
} from '../src/district-machines-test.ts';
const parse = (q: string) =>
  districtMachinesTestFromUrl(new URL('https://test/?test=district-machines&v=1&' + q));
const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: false,
  fire: false,
  aim: { x: 820, y: 710 },
};
function course(q: string) {
  const f = parse(q)!;
  assert(f);
  const g = new Game();
  g.startTest(f.checkpoint, districtMachinesTestRoom(f));
  assert(prepareDistrictMachinesTest(g, f));
  return { g, f };
}
test('fifteen district inspections and six tools reconstruct ninety legal isolated checkpoints', () => {
  let count = 0;
  for (const unit of DISTRICT_UNITS)
    for (const scene of DISTRICT_SCENES)
      for (const gun of STARTING_GUN_IDS) {
        const f = parse(`unit=${unit}&scene=${scene}&gun=${gun}`)!;
        assert(f);
        assert(loadCheckpoint(f.checkpoint));
        assert(validBuild(f.checkpoint.mods));
        assert(f.checkpoint.seed.length <= 40);
        assert.deepEqual(districtMachinesTestRoom(f), districtMachinesTestRoom(f));
        count++;
      }
  assert.equal(count, 90);
});
test('district courses contain actual sources, authored cover, raised support and a distant guard', () => {
  for (const unit of DISTRICT_UNITS)
    for (const scene of DISTRICT_SCENES) {
      const { g } = course(`unit=${unit}&scene=${scene}`),
        e = g.enemies.find((e) => e.kind === unit)!;
      assert(e);
      assert(Matter.Composite.allBodies(g.engine.world).includes(e.body));
      assert.equal(g.waves.pending, false);
      assert(g.enemies.some((e) => e.kind === 'shooter' && e.body.position.x > 1700));
      assert.equal(g.hp, 100);
      assert.equal(g.kills, 0);
      assert.equal(g.player.position.x, 450);
      assert.equal(g.player.position.y, scene === 'wreckage' ? 532 : 722);
      assert.equal(g.level.area, unit === 'skimmer' ? 'cooling' : 'reclamation');
      const crate = scene === 'mechanisms' || (unit === 'borer' && scene === 'animations');
      assert.equal(g.props.items.filter((p) => p.kind === 'crate').length, crate ? 1 : 0);
      if (crate) assert(!g.props.items.find((p) => p.kind === 'crate')!.body.isStatic);
      if (scene === 'wreckage') assert(e.body.position.y < 550);
      if (unit !== 'borer') assert.equal(e.body.position.y, scene === 'wreckage' ? 420 : 610);
    }
});
test('ordinary course ticks reach real district volleys with and without authored cover', () => {
  for (const unit of DISTRICT_UNITS)
    for (const scene of ['animations', 'mechanisms']) {
      const { g } = course(`unit=${unit}&scene=${scene}`),
        e = g.enemies.find((e) => e.kind === unit)!;
      for (let i = 0; i < 720 && g.mode === 'playing' && e.attacks === 0; i++) g.tick(1 / 60, idle);
      assert(e.attacks > 0, unit + '/' + scene + ' native controller must fire');
      assert(
        g.shots.some((s) => s.damageCause?.enemy === unit),
        unit + ' creates actual hostile ammunition',
      );
    }
});
test('movement, firing, Pause, accepted defeat and restart keep private progress isolated', () => {
  for (const unit of DISTRICT_UNITS) {
    const f = parse(`unit=${unit}&scene=shutdowns`)!,
      g = new Game();
    let writes = 0,
      awards = 0;
    g.onCheckpoint = () => writes++;
    g.onEnemyDefeated = () => awards++;
    g.onCampaignClear = () => awards++;
    g.onCommendation = () => awards++;
    g.startTest(f.checkpoint, districtMachinesTestRoom(f));
    prepareDistrictMachinesTest(g, f);
    for (let i = 0; i < 45; i++) g.tick(1 / 60, { ...idle, right: i < 20, fire: i > 30 });
    assert(g.player.position.x > 460);
    assert(g.shotCount > 0);
    g.setMode('paused');
    const time = g.time;
    for (let i = 0; i < 30; i++) g.tick(1 / 60, idle);
    assert.equal(g.time, time);
    g.setMode('playing');
    const e = g.enemies.find((e) => e.kind === unit)!;
    assert(e);
    e.spawn = 0;
    g.hitEnemy(e, 100000);
    assert.equal(g.kills, 1);
    assert.equal(g.mode, 'playing');
    assert(g.machineBreakdown.wrecks.some((w) => w.visual.id === e.id));
    g.startTest(f.checkpoint, districtMachinesTestRoom(f));
    prepareDistrictMachinesTest(g, f);
    assert.equal(g.kills, 0);
    assert.equal(g.machineBreakdown.wrecks.length, 0);
    assert.equal(writes, 0);
    assert.equal(awards, 0);
  }
});
test('ambiguous district links fail closed and cannot stage another run', () => {
  for (const q of [
    'unit=nope',
    'unit=relay',
    'scene=nope',
    'gun=nope',
    'unit=skimmer&unit=borer',
    'scene=animations&scene=reactions',
    'elite=twin',
    'seed=SAVE',
    'daily=2026-10-28',
    'test=support-systems',
    'v=2',
    'unit=skimmer#fragment',
  ])
    assert.equal(parse(q), null, q);
  assert.equal(districtMachinesTestFromUrl(new URL('https://test/?test=district-machines')), null);
  const g = new Game();
  assert.equal(prepareDistrictMachinesTest(g, parse('unit=skimmer')), false);
  const a = course('unit=borer');
  assert.equal(prepareDistrictMachinesTest(a.g, parse('unit=skimmer')), false);
});
