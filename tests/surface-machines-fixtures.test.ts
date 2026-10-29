import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Input } from '../src/game.ts';
import { loadCheckpoint, validBuild } from '../src/rules.ts';
import { STARTING_GUN_IDS } from '../src/starting-guns.ts';
import { ANGLER, beginAnglerAttack, updateAngler } from '../src/angler.ts';
import { CRAWLER, beginCrawlerAttack } from '../src/wallcrawler.ts';
import {
  SURFACE_UNITS,
  SURFACE_SCENES,
  SURFACE_FACES,
  surfaceMachinesTestFromUrl,
  surfaceMachinesTestRoom,
  prepareSurfaceMachinesTest,
} from '../src/surface-machines-test.ts';
const parse = (q: string) =>
  surfaceMachinesTestFromUrl(new URL('https://test/?test=surface-machines&v=1&' + q));
const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: false,
  fire: false,
  aim: { x: 1000, y: 700 },
};
function course(q: string) {
  const f = parse(q)!;
  assert(f);
  const g = new Game();
  g.startTest(f.checkpoint, surfaceMachinesTestRoom(f));
  assert(prepareSurfaceMachinesTest(g, f));
  return { g, f, e: g.enemies.find((e) => e.kind === f.unit)! };
}
function dispose(g: Game) {
  Matter.Composite.clear(g.engine.world, false);
  Matter.Engine.clear(g.engine);
}

test('surface inspection links reconstruct 120 legal deterministic tool, face and scene checkpoints', () => {
  let count = 0;
  for (const unit of SURFACE_UNITS)
    for (const scene of SURFACE_SCENES)
      for (const face of unit === 'wallcrawler' ? SURFACE_FACES : [undefined])
        for (const gun of STARTING_GUN_IDS) {
          const f = parse(
            `unit=${unit}&scene=${scene}&gun=${gun}` + (face ? `&face=${face}` : ''),
          )!;
          assert(f);
          assert(loadCheckpoint(f.checkpoint));
          assert(validBuild(f.checkpoint.mods));
          assert(f.checkpoint.seed.length <= 40);
          assert.deepEqual(surfaceMachinesTestRoom(f), surfaceMachinesTestRoom(f));
          count++;
        }
  assert.equal(count, 120);
});
test('surface courses use actual breakable terrain, mounted sources and a distant guard', () => {
  for (const unit of SURFACE_UNITS)
    for (const scene of SURFACE_SCENES) {
      const { g, e } = course(`unit=${unit}&scene=${scene}`);
      assert(e);
      assert.equal(g.waves.pending, false);
      assert.equal(g.destruction.pieces.length, 1);
      assert(g.enemies.some((a) => a.kind === 'shooter' && a.body.position.x > 1700));
      assert.equal(g.kills, 0);
      assert.equal(g.hp, 100);
      if (unit === 'wallcrawler') assert.equal(e.crawler!.support, g.destruction.pieces[0].body);
      dispose(g);
    }
  for (const [face, normal] of [
    ['floor', { x: 0, y: -1 }],
    ['wall', { x: -1, y: 0 }],
    ['ceiling', { x: 0, y: 1 }],
  ] as const) {
    const { g, e } = course(`unit=wallcrawler&face=${face}`);
    assert(
      Math.abs(e.crawler!.normal.x - normal.x) < 1e-9 &&
        Math.abs(e.crawler!.normal.y - normal.y) < 1e-9,
    );
    assert(e.crawler!.support);
    dispose(g);
  }
});
test('ordinary surface inspection ticks reach native bank rounds and three-shot volleys on every face', () => {
  for (const unit of SURFACE_UNITS)
    for (const scene of SURFACE_SCENES)
      for (const face of unit === 'wallcrawler' ? SURFACE_FACES : [undefined]) {
        const label = `${unit}/${scene}/${face ?? 'native'}`,
          { g, e } = course(`unit=${unit}&scene=${scene}` + (face ? `&face=${face}` : ''));
        for (let i = 0; i < 900 && g.mode === 'playing' && e.attacks === 0; i++)
          g.tick(1 / 60, idle);
        assert(e.attacks > 0, label + ' native attack missing');
        assert(
          g.shots.some((s) => s.damageCause?.enemy === unit),
          label + ' actual shot missing',
        );
        if (unit === 'angler') assert(g.shots.some((s) => s.angler?.owner === e.id));
        else assert.equal(e.crawler!.fired, 3);
        dispose(g);
      }
});
test('authored bank/support can be shot away through native interruption and exposure', () => {
  for (const unit of SURFACE_UNITS) {
    const { g, e } = course(`unit=${unit}&scene=mechanisms`);
    for (let i = 0; i < 50; i++) g.tick(1 / 60, idle);
    e.spawn = 0;
    if (unit === 'angler') assert(beginAnglerAttack(g, e));
    else beginCrawlerAttack(g, e);
    const piece = g.destruction.pieces[0];
    g.destruction.hitBody(piece.body, piece.hp, { x: 0, y: -10 });
    if (unit === 'angler') {
      updateAngler(g, e, 1 / 60);
      assert.equal(e.angler!.exposed, ANGLER.exposed);
      assert.equal(e.angler!.plan, undefined);
    } else {
      assert.equal(e.crawler!.support, undefined);
      assert.equal(e.crawler!.vulnerable, CRAWLER.stun);
      assert.equal(e.crawler!.angles.length, 0);
    }
    assert.equal(e.state, 'recover');
    assert.equal(g.shots.length, 0);
    const hp = e.hp;
    g.hitEnemy(e, 10);
    assert(Math.abs(hp - e.hp - 15) < 1e-6);
    dispose(g);
  }
});
test('surface movement, firing, Pause, defeat and restart preserve private progress isolation', () => {
  for (const unit of SURFACE_UNITS) {
    const f = parse(`unit=${unit}&scene=shutdowns`)!,
      g = new Game();
    let writes = 0,
      awards = 0;
    g.onCheckpoint = () => writes++;
    g.onEnemyDefeated = () => awards++;
    g.onCampaignClear = () => awards++;
    g.onCommendation = () => awards++;
    g.startTest(f.checkpoint, surfaceMachinesTestRoom(f));
    prepareSurfaceMachinesTest(g, f);
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
    g.startTest(f.checkpoint, surfaceMachinesTestRoom(f));
    prepareSurfaceMachinesTest(g, f);
    assert.equal(g.kills, 0);
    assert.equal(g.machineBreakdown.wrecks.length, 0);
    assert.equal(writes, 0);
    assert.equal(awards, 0);
    dispose(g);
  }
});
test('ambiguous surface links fail closed and cannot prepare another run', () => {
  for (const q of [
    'unit=nope',
    'unit=relay',
    'scene=nope',
    'gun=nope',
    'face=roof',
    'unit=angler&face=floor',
    'unit=wallcrawler&face=wall&face=ceiling',
    'unit=wallcrawler&unit=angler',
    'scene=animations&scene=reactions',
    'elite=twin',
    'seed=SAVE',
    'daily=2026-10-29',
    'test=district-machines',
    'v=2',
    'unit=angler#fragment',
  ])
    assert.equal(parse(q), null, q);
  assert.equal(surfaceMachinesTestFromUrl(new URL('https://test/?test=surface-machines')), null);
  const g = new Game();
  assert.equal(prepareSurfaceMachinesTest(g, parse('unit=wallcrawler')), false);
  const a = course('unit=angler');
  assert.equal(prepareSurfaceMachinesTest(a.g, parse('unit=wallcrawler')), false);
  dispose(a.g);
});
