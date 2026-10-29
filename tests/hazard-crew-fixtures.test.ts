import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Input } from '../src/game.ts';
import { loadCheckpoint, validBuild } from '../src/rules.ts';
import { STARTING_GUN_IDS } from '../src/starting-guns.ts';
import {
  HAZARD_UNITS,
  HAZARD_SCENES,
  hazardCrewTestFromUrl,
  hazardCrewTestRoom,
  prepareHazardCrewTest,
} from '../src/hazard-crew-test.ts';
const parse = (q: string) =>
  hazardCrewTestFromUrl(new URL('https://test/?test=hazard-crew&v=1&' + q));
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
  g.startTest(f.checkpoint, hazardCrewTestRoom(f));
  assert(prepareHazardCrewTest(g, f));
  return { g, f };
}
test('fifteen hazard inspections and six tools reconstruct ninety legal isolated checkpoints', () => {
  let count = 0;
  for (const unit of HAZARD_UNITS)
    for (const scene of HAZARD_SCENES)
      for (const gun of STARTING_GUN_IDS) {
        const f = parse(`unit=${unit}&scene=${scene}&gun=${gun}`)!;
        assert(f);
        assert(loadCheckpoint(f.checkpoint));
        assert(validBuild(f.checkpoint.mods));
        assert(f.checkpoint.seed.length <= 40);
        assert.deepEqual(hazardCrewTestRoom(f), hazardCrewTestRoom(f));
        count++;
      }
  assert.equal(count, 90);
});
test('inspection courses contain actual sources, loose crates, raised support and a distant guard', () => {
  for (const unit of HAZARD_UNITS)
    for (const scene of HAZARD_SCENES) {
      const { g } = course(`unit=${unit}&scene=${scene}`);
      const e = g.enemies.find((e) => e.kind === unit)!;
      assert(e);
      assert(Matter.Composite.allBodies(g.engine.world).includes(e.body));
      assert.equal(g.waves.pending, false);
      assert(g.enemies.some((e) => e.kind === 'shooter' && e.body.position.x > 1700));
      assert.equal(g.hp, 100);
      assert.equal(g.kills, 0);
      assert.equal(g.player.position.x, 450);
      assert.equal(g.player.position.y, scene === 'wreckage' ? 532 : 722);
      assert.equal(
        g.props.items.filter((p) => p.kind === 'crate').length,
        unit === 'scrapper' ? 1 : 0,
      );
      if (unit === 'scrapper')
        assert(!g.props.items.find((p) => p.kind === 'crate')!.body.isStatic);
      if (scene === 'wreckage') assert(e.body.position.y < 550);
    }
});
test('ordinary course ticks reach actual crate throws, harpoon launches and charge creation', () => {
  for (const unit of HAZARD_UNITS) {
    const { g } = course(`unit=${unit}`),
      e = g.enemies.find((e) => e.kind === unit)!;
    let held = false,
      flight = false,
      charge = false;
    for (let i = 0; i < 720 && g.mode === 'playing' && e.attacks === 0; i++) {
      g.tick(1 / 60, idle);
      held ||= !!e.scrapper?.held;
      flight ||= e.harpoon?.phase === 'flight';
      charge ||= g.sappers.items.length > 0;
    }
    assert(e.attacks > 0, unit + ' native controller must attack');
    if (unit === 'scrapper') {
      assert(held);
      assert(g.props.items.some((p) => (p.throwUntil ?? 0) > g.time));
    }
    if (unit === 'harpooner') assert(flight);
    if (unit === 'sapper') assert(charge);
  }
});
test('movement, firing, Pause, accepted defeat and restart keep private progress isolated', () => {
  for (const unit of HAZARD_UNITS) {
    const f = parse(`unit=${unit}&scene=shutdowns`)!,
      g = new Game();
    let writes = 0,
      awards = 0;
    g.onCheckpoint = () => writes++;
    g.onEnemyDefeated = () => awards++;
    g.onCampaignClear = () => awards++;
    g.onCommendation = () => awards++;
    g.startTest(f.checkpoint, hazardCrewTestRoom(f));
    prepareHazardCrewTest(g, f);
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
    g.startTest(f.checkpoint, hazardCrewTestRoom(f));
    prepareHazardCrewTest(g, f);
    assert.equal(g.kills, 0);
    assert.equal(g.machineBreakdown.wrecks.length, 0);
    assert.equal(writes, 0);
    assert.equal(awards, 0);
  }
});
test('ambiguous hazard links fail closed and cannot stage another run', () => {
  for (const q of [
    'unit=nope',
    'unit=relay',
    'scene=nope',
    'gun=nope',
    'unit=sapper&unit=scrapper',
    'scene=animations&scene=reactions',
    'elite=twin',
    'seed=SAVE',
    'daily=2026-10-28',
    'test=support-systems',
    'v=2',
    'unit=sapper#fragment',
  ])
    assert.equal(parse(q), null, q);
  assert.equal(hazardCrewTestFromUrl(new URL('https://test/?test=hazard-crew')), null);
  const g = new Game();
  assert.equal(prepareHazardCrewTest(g, parse('unit=sapper')), false);
  const a = course('unit=scrapper');
  assert.equal(prepareHazardCrewTest(a.g, parse('unit=sapper')), false);
});
