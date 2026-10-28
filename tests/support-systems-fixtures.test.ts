import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Input } from '../src/game.ts';
import { loadCheckpoint, validBuild } from '../src/rules.ts';
import { STARTING_GUN_IDS } from '../src/starting-guns.ts';
import {
  SUPPORT_UNITS,
  SUPPORT_SCENES,
  supportSystemsTestFromUrl,
  supportSystemsTestRoom,
  prepareSupportSystemsTest,
} from '../src/support-systems-test.ts';
const parse = (q: string) =>
  supportSystemsTestFromUrl(new URL('https://test/?test=support-systems&v=1&' + q));
const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: false,
  fire: false,
  aim: { x: 820, y: 610 },
};
function course(q: string) {
  const f = parse(q)!;
  assert(f);
  const g = new Game();
  g.startTest(f.checkpoint, supportSystemsTestRoom(f));
  assert(prepareSupportSystemsTest(g, f));
  return { g, f };
}
test('twenty support courses and six tools reconstruct 120 legal isolated checkpoints', () => {
  let count = 0;
  for (const unit of SUPPORT_UNITS)
    for (const scene of SUPPORT_SCENES)
      for (const gun of STARTING_GUN_IDS) {
        const f = parse(`unit=${unit}&scene=${scene}&gun=${gun}`);
        if (
          ['interruptions', 'power-loss'].includes(scene) &&
          ['repairer', 'relay'].includes(unit)
        ) {
          assert.equal(f, null);
          continue;
        }
        assert(f);
        assert(loadCheckpoint(f.checkpoint));
        assert(validBuild(f.checkpoint.mods));
        assert(f.checkpoint.seed.length <= 40);
        assert.deepEqual(supportSystemsTestRoom(f), supportSystemsTestRoom(f));
        count++;
      }
  assert.equal(count, 120);
});
test('all support inspection floors retain native sources, actual owned Sentries, support and distant guard', () => {
  for (const unit of SUPPORT_UNITS)
    for (const scene of SUPPORT_SCENES) {
      const f = parse(`unit=${unit}&scene=${scene}`);
      if (!f) continue;
      const { g } = course(`unit=${unit}&scene=${scene}`);
      assert(g.teamwork.enabled);
      assert(g.fabricators.enabled);
      assert.equal(g.waves.pending, false);
      const source = g.enemies.find((e) => e.kind === (unit === 'sentry' ? 'fabricator' : unit))!;
      assert(source);
      assert(Matter.Composite.allBodies(g.engine.world).includes(source.body));
      assert(g.enemies.some((e) => e.kind === 'shooter' && e.body.position.x > 1700));
      assert.equal(g.hp, 100);
      assert.equal(g.kills, 0);
      if (unit === 'sentry' || ['interruptions', 'power-loss'].includes(scene)) {
        const child = g.enemies.find((e) => e.sentry?.owner === source.id)!;
        assert(child, unit + ' ' + scene + ' has its actual frame');
        assert.equal(child.sentry!.ready, scene !== 'interruptions');
        assert(g.fabricators.supported(child));
        assert.equal(source.fabricator!.built, scene === 'interruptions' ? 0 : 1);
        if (scene === 'wreckage') assert(child.body.position.y < 550);
      }
      assert.equal(g.player.position.x, scene === 'power-loss' ? 1350 : 450);
    }
});
test('ordinary support course inputs reach real repair pulses, partner charges, assembly and Sentry discharge', () => {
  for (const unit of SUPPORT_UNITS) {
    const { g } = course(`unit=${unit}`),
      source = g.enemies.find((e) => e.kind === (unit === 'sentry' ? 'fabricator' : unit))!;
    let heal = false,
      charge = false,
      built = false,
      fired = false;
    for (let i = 0; i < 720 && g.mode === 'playing'; i++) {
      g.tick(1 / 60, idle);
      heal ||= !!source.support && source.kind === 'repairer' && source.support.remaining < 48;
      charge ||= !!source.support && source.kind === 'relay' && source.support.remaining < 3;
      built ||= !!source.fabricator && source.fabricator.built > 0;
      fired ||= g.enemies.some((e) => !!e.sentry && (e.attacks ?? 0) > 0);
    }
    if (unit === 'repairer') assert(heal, 'wounded real partner receives actual heal');
    if (unit === 'relay') assert(charge, 'a real partner consumes a charge');
    if (unit === 'fabricator') assert(built, 'native builder completes its real frame');
    if (unit === 'sentry') assert(fired, 'native completed Sentry fires');
  }
});
test('private movement, firing, Pause, accepted defeat and retry leave progress callbacks isolated', () => {
  for (const unit of SUPPORT_UNITS) {
    const f = parse(`unit=${unit}&scene=shutdowns`)!,
      g = new Game();
    let writes = 0,
      awards = 0;
    g.onCheckpoint = () => writes++;
    g.onEnemyDefeated = () => awards++;
    g.onCampaignClear = () => awards++;
    g.onCommendation = () => awards++;
    g.startTest(f.checkpoint, supportSystemsTestRoom(f));
    prepareSupportSystemsTest(g, f);
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
    assert.equal(g.kills, unit === 'sentry' ? 0 : 1);
    assert.equal(g.mode, 'playing');
    assert(g.machineBreakdown.wrecks.some((w) => w.visual.id === e.id));
    g.startTest(f.checkpoint, supportSystemsTestRoom(f));
    prepareSupportSystemsTest(g, f);
    assert.equal(g.kills, 0);
    assert.equal(g.machineBreakdown.wrecks.length, 0);
    assert.equal(writes, 0);
    assert.equal(awards, 0);
  }
});
test('construction interruption and owner destruction use native removal without extra kill rewards', () => {
  for (const unit of ['fabricator', 'sentry'])
    for (const scene of ['interruptions', 'power-loss']) {
      const { g } = course(`unit=${unit}&scene=${scene}`),
        owner = g.enemies.find((e) => e.fabricator)!,
        child = g.enemies.find((e) => e.sentry?.owner === owner.id)!;
      assert(child);
      owner.spawn = 0;
      const before = g.kills;
      g.hitEnemy(owner, scene === 'interruptions' ? 1 : 100000);
      assert(!g.enemies.includes(child));
      assert(!Matter.Composite.allBodies(g.engine.world).includes(child.body));
      assert.equal(g.kills, before + (scene === 'power-loss' ? 1 : 0));
      assert(g.machineBreakdown.wrecks.some((w) => w.visual.id === child.id));
    }
});
test('ambiguous support links fail closed and cannot stage another run', () => {
  for (const q of [
    'unit=nope',
    'unit=shutter',
    'scene=nope',
    'unit=relay&scene=power-loss',
    'unit=repairer&scene=interruptions',
    'gun=nope',
    'unit=sentry&unit=fabricator',
    'scene=animations&scene=reactions',
    'variant=plain',
    'elite=twin',
    'seed=SAVE',
    'daily=2026-10-28',
    'test=heavy-industry',
    'v=2',
    'unit=sentry#fragment',
  ])
    assert.equal(parse(q), null, q);
  assert.equal(supportSystemsTestFromUrl(new URL('https://test/?test=support-systems')), null);
  const g = new Game();
  assert.equal(prepareSupportSystemsTest(g, parse('unit=sentry')), false);
  const a = course('unit=repairer');
  assert.equal(prepareSupportSystemsTest(a.g, parse('unit=sentry')), false);
});
