import Matter from 'matter-js';
import { Game } from '../src/game.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { validBuild, getGun, availableMods } from '../src/rules.ts';
import { SHIFT_MODS, SHIFT_FUSIONS } from '../src/shift-catalog.ts';
import { SHIFT_ROUTE_IDS } from '../src/shift-routes.ts';
import { STARTING_GUN_IDS } from '../src/starting-guns.ts';
import {
  FACTORY_UNBOUND_CONCEPTS,
  FACTORY_UNBOUND_SCENES,
  FACTORY_UNBOUND_FORMS,
  FACTORY_UNBOUND_EVOLUTIONS,
  factoryUnboundIdentity,
  factoryUnboundTestFromUrl,
} from '../src/factory-unbound-test.ts';
const url = (scene: string, gun = 'pistol', form?: string) =>
  new URL(
    'https://test/?test=factory-unbound&scene=' +
      scene +
      '&gun=' +
      gun +
      (form ? '&form=' + form : '') +
      '&v=1',
  );
test('every one of the twenty-eight concepts and nine detailed system scenes has a legal named isolated fixture', () => {
  assert.equal(FACTORY_UNBOUND_CONCEPTS.length, 28);
  assert.equal(new Set(FACTORY_UNBOUND_CONCEPTS).size, 28);
  assert.equal(FACTORY_UNBOUND_SCENES.length, 37);
  assert.equal(new Set(FACTORY_UNBOUND_SCENES).size, 37);
  assert.deepEqual(
    FACTORY_UNBOUND_CONCEPTS.slice(0, 20),
    SHIFT_MODS.map((m) => m.id),
  );
  assert(SHIFT_ROUTE_IDS.every((id) => FACTORY_UNBOUND_CONCEPTS.includes(id)));
  for (const scene of FACTORY_UNBOUND_SCENES) {
    const fixture = factoryUnboundTestFromUrl(url(scene));
    assert(fixture, scene);
    const cp = fixture.checkpoint;
    assert(fixture.title.length > 0 && fixture.hint.includes('isolated test'));
    assert(validBuild(cp.mods), scene + ': prerequisite order and path compatibility');
    assert(
      cp.mods.includes('scatter'),
      scene + ': the actual selected-tool spread remains equipped',
    );
    assert.equal(cp.hp, 100);
    assert.equal(cp.kills, 0);
    assert.equal(cp.elapsed, 0);
    assert.equal(cp.unlocks, undefined);
    assert.equal(cp.reward, undefined);
    assert.equal(cp.uprising, undefined);
    assert.equal(cp.factoryUnbound?.scene, scene);
    assert(cp.seed.length < 40);
    assert(cp.seed.startsWith('SHIFT-107-'));
    if (SHIFT_ROUTE_IDS.includes(scene as never)) {
      assert.equal(cp.stage, 6);
      if (scene === 'rework-loop')
        assert.equal(
          cp.shiftRoute,
          undefined,
          'only actual native source capture may construct Rework',
        );
      else assert.equal(cp.shiftRoute?.kind, scene);
    }
    if (Object.hasOwn(FACTORY_UNBOUND_EVOLUTIONS, scene)) {
      assert(
        cp.mods.includes(
          FACTORY_UNBOUND_EVOLUTIONS[scene as keyof typeof FACTORY_UNBOUND_EVOLUTIONS],
        ),
      );
      assert.equal(
        cp.shiftRun?.experiment,
        undefined,
        'fixtures never invent three earned movement triggers',
      );
    }
    if (SHIFT_MODS.some((m) => m.id === scene)) assert(cp.mods.includes(scene));
    if (Object.hasOwn(SHIFT_FUSIONS, scene))
      for (const parent of SHIFT_FUSIONS[scene]) assert(cp.mods.includes(parent));
  }
});
test('all six native tools retain their genuine pattern in every compatible form and scene', () => {
  const seeds = new Set<string>();
  let supported = 0,
    rejected = 0;
  for (const scene of FACTORY_UNBOUND_SCENES)
    for (const gun of STARTING_GUN_IDS)
      for (const form of FACTORY_UNBOUND_FORMS) {
        const fixture = factoryUnboundTestFromUrl(url(scene, gun, form));
        if (!fixture) {
          rejected++;
          continue;
        }
        supported++;
        const cp = fixture.checkpoint;
        assert(validBuild(cp.mods));
        assert.equal(cp.startingGun, gun);
        assert.equal(cp.factoryUnbound?.form, form);
        assert.equal(cp.mods.includes('cutting-torch'), form === 'beam');
        assert.equal(cp.mods.includes('mass-driver'), form === 'ball');
        assert.equal(cp.mods.includes('shellshock'), form === 'shell');
        assert(cp.mods.filter((id) => Object.hasOwn(SHIFT_FUSIONS, id)).length <= 1);
        const actual = getGun(cp.mods, gun),
          plain = getGun(cp.mods, 'pistol');
        if (gun === 'shotgun') assert(actual.pellets > plain.pellets);
        if (gun === 'twinbore') assert(actual.pellets > plain.pellets);
        if (gun === 'nailgun') assert.equal(actual.burstCount, 3);
        if (gun === 'carbine') assert(actual.pierce > plain.pierce);
        if (gun === 'repeater') assert(actual.interval < plain.interval);
        assert.deepEqual(factoryUnboundIdentity(cp.seed), { scene, gun, form });
        assert(!seeds.has(cp.seed), 'each scene/tool/form has its own bounded identity');
        seeds.add(cp.seed);
      }
  assert(supported > 600);
  assert(rejected > 0, 'incompatible existing paths are rejected instead of cheated');
});
test('required native conversions and fusion paths remain honest', () => {
  assert.equal(factoryUnboundTestFromUrl(url('hot-wire'))?.checkpoint.factoryUnbound?.form, 'beam');
  assert.equal(
    factoryUnboundTestFromUrl(url('scrap-comet'))?.checkpoint.factoryUnbound?.form,
    'ball',
  );
  for (const form of ['rounds', 'shell', 'ball'])
    assert.equal(factoryUnboundTestFromUrl(url('hot-wire', 'pistol', form)), null);
  for (const form of ['rounds', 'beam', 'shell'])
    assert.equal(factoryUnboundTestFromUrl(url('scrap-comet', 'pistol', form)), null);
  assert.equal(
    factoryUnboundTestFromUrl(url('windmill', 'pistol', 'beam')),
    null,
    'Grindshot and Cutting Torch retain their native incompatibility',
  );
  assert.equal(
    factoryUnboundTestFromUrl(url('ghost-shift', 'pistol', 'beam')),
    null,
    'Afterimage and Cutting Torch retain distinct paths',
  );
  const basic = factoryUnboundTestFromUrl(url('polarity-rounds'))!;
  assert(basic.checkpoint.mods.includes('crossfire'));
  const beam = factoryUnboundTestFromUrl(url('polarity-rounds', 'pistol', 'beam'))!;
  assert(!beam.checkpoint.mods.includes('crossfire'));
  assert(!availableMods(beam.checkpoint.mods, true).some((m) => m.id === 'crossfire'));
});
test('strict query and canonical seed parsing reject every unknown, duplicate or forged field', () => {
  const base = 'https://test/?test=factory-unbound&scene=polarity-rounds&v=1';
  for (const suffix of [
    '&v=1',
    '&test=factory-unbound',
    '&scene=polarity-rounds',
    '&gun=pistol&gun=shotgun',
    '&form=rounds&form=beam',
    '&mirror=1',
    '&ng=1',
    '&build=magnum',
    '&hp=999',
    '&unlocks=all',
    '&seed=other',
  ])
    assert.equal(factoryUnboundTestFromUrl(new URL(base + suffix)), null, suffix);
  for (const query of [
    '?test=factory-unbound&v=2',
    '?test=factory-unbound&v=',
    '?test=factory-unbound',
    '?test=factory-unbound&scene=constructor&v=1',
    '?test=factory-unbound&scene=__proto__&v=1',
    '?test=factory-unbound&scene=&v=1',
    '?test=factory-unbound&gun=constructor&v=1',
    '?test=factory-unbound&gun=laser&v=1',
    '?test=factory-unbound&form=constructor&v=1',
    '?test=factory-unbound&form=rail&v=1',
    '?test=tools-of-trade&v=1',
  ])
    assert.equal(factoryUnboundTestFromUrl(new URL('https://test/' + query)), null, query);
  for (const seed of [
    'SHIFT-107-0-0-0',
    'SHIFT-107-ZZ-0-0',
    'SHIFT-107-00-6-0',
    'SHIFT-107-00-0-4',
    'SHIFT-107-00-0-0-extra',
    'RF-C107-00-0-0',
    'SHIFT-106-00-0-0',
  ])
    assert.equal(factoryUnboundIdentity(seed), null, seed);
  assert(factoryUnboundTestFromUrl(new URL('https://test/?test=factory-unbound&v=1')));
});
test('fixture records are deterministic independent copies and never include profile writes or scripted victories', () => {
  for (const scene of FACTORY_UNBOUND_SCENES) {
    const a = factoryUnboundTestFromUrl(url(scene))!,
      b = factoryUnboundTestFromUrl(url(scene))!;
    assert.deepEqual(a, b);
    assert.notEqual(a.checkpoint, b.checkpoint);
    assert.notEqual(a.checkpoint.mods, b.checkpoint.mods);
    a.checkpoint.mods.push('repair');
    a.checkpoint.hp = 1;
    assert.equal(b.checkpoint.hp, 100);
    assert(!b.checkpoint.mods.includes('repair'));
    assert.equal(b.checkpoint.overtime, undefined);
    assert.equal(b.checkpoint.reward, undefined);
    if (a.checkpoint.shiftRoute?.turns) {
      a.checkpoint.shiftRoute.turns[0] = 2;
      assert.equal(b.checkpoint.shiftRoute!.turns![0], 0);
    }
  }
});

test('all public scenes load real native controllers in independent worlds without awarding progress', () => {
  const parent = new Game(),
    before = JSON.stringify(parent.checkpointSnapshot());
  for (const scene of FACTORY_UNBOUND_SCENES) {
    const fixture = factoryUnboundTestFromUrl(url(scene))!,
      g = new Game();
    let writes = 0;
    g.onCheckpoint = () => writes++;
    g.onCommendation = () => writes++;
    g.onEnemyDefeated = () => writes++;
    g.onBossDefeated = () => writes++;
    g.startTest(fixture.checkpoint);
    g.save();
    assert(g.testRun);
    assert.equal(g.startingGun, fixture.checkpoint.startingGun);
    assert.deepEqual(g.mods, fixture.checkpoint.mods);
    assert.deepEqual(g.gun, getGun(g.mods, g.startingGun));
    if (SHIFT_ROUTE_IDS.includes(scene as never)) {
      assert.equal(g.shiftRoutes.kind, scene);
      assert(g.enemies.length >= 4);
      if (scene === 'rework-loop') {
        assert.equal(g.shiftRoutes.state!.rework!.source, 'factory-unbound-range');
        assert(g.shiftRoutes.state!.rework!.props.some((p) => p.kind === 'cover' && p.hp! < 72));
      }
    } else assert.equal(g.level.id, 'factory-unbound-range');
    if (['lease', 'power', 'experiment'].includes(scene)) assert.equal(g.mode, 'shift-office');
    if (['transport', 'security', 'reclamation'].includes(scene))
      assert.equal(g.shiftRun.state?.circuit?.kind, scene);
    if (Object.hasOwn(FACTORY_UNBOUND_EVOLUTIONS, scene)) {
      assert.equal(g.shiftRun.state?.experiment?.progress, 0);
      assert.equal(g.shiftRun.state?.experiment?.status, 'active');
      assert.equal(g.shiftRun.state?.experiment?.evolution, undefined);
    }
    assert.equal(writes, 0, scene);
    Matter.Composite.clear(g.engine.world, false);
    Matter.Engine.clear(g.engine);
  }
  assert.equal(JSON.stringify(parent.checkpointSnapshot()), before);
  Matter.Composite.clear(parent.engine.world, false);
  Matter.Engine.clear(parent.engine);
});
