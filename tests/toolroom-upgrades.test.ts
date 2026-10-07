import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, target, round, advance, beam, Body } from './branches-fixture.ts';
import { TOOLROOM_IDS, TOOLROOM_MODS, TOOLROOM_PARENTS } from '../src/toolroom-catalog.ts';
import { LONGEVITY_IDS, unlockGoals, draftUnlocked } from '../src/longevity.ts';
import { loadLogbook } from '../src/logbook.ts';
import { MODS, getGun, validBuild, rewardMods, seeded, loadCheckpoint } from '../src/rules.ts';
import { UPGRADE_LORE } from '../src/lore-upgrades.ts';
import { modMark } from '../src/upgrade-icons.ts';
import { inspectUpgrade } from '../src/upgrade-inspection.ts';
import { toolroomTestFromUrl, TOOLROOM_BUILDS } from '../src/toolroom-test.ts';
import { Game } from '../src/game.ts';
import { logbookCatalog, catalogMatches, CATALOG_FAMILIES } from '../src/logbook-catalog.ts';

test('the Logbook groups each four-part toolroom family in locked and discovered profiles', () => {
  for (const known of [[], [...TOOLROOM_IDS]]) {
    const goals = unlockGoals(loadLogbook(null), [], [], null);
    const entries = logbookCatalog(known, loadLogbook(null), [], null, goals);
    for (const family of new Set(TOOLROOM_MODS.map((m) => m.family))) {
      const id = 'toolroom:' + family;
      assert(CATALOG_FAMILIES.some((f) => f.id === id));
      const found = catalogMatches(entries, 'equipment', '', 'all', id);
      assert.equal(found.length, 4);
      assert(
        found.every((e) =>
          TOOLROOM_MODS.some((m) => 'mod:' + m.id === e.id && m.family === family),
        ),
      );
    }
  }
});

const near = (a: number, b: number) => assert(Math.abs(a - b) < 1e-6, `${a} != ${b}`);
const kit = (mods: string[]) => {
  const g = fixture(mods);
  g.seed = 'RF-C89-mechanics';
  return g;
};
const hit = (g: Game, e: ReturnType<typeof target>, s: ReturnType<typeof round>) => {
  const hp = e.hp;
  const blocked = g.hitEnemy(e, g.toolroom.damage(e, s, s.damage), s.pos);
  g.support.gunHit(e, hp, s);
  g.toolroom.gunHit(e, hp, s, blocked);
};

test('24 distinct fittings have legal parents, real icons, lore and meaningful inspection changes', () => {
  assert.equal(TOOLROOM_IDS.length, 24);
  assert.equal(new Set(TOOLROOM_IDS).size, 24);
  assert.equal(MODS.length, 141);
  for (const fitting of TOOLROOM_MODS) {
    const mods: string[] = [];
    let id = TOOLROOM_PARENTS[fitting.id];
    while (id) {
      mods.unshift(id);
      id =
        (TOOLROOM_PARENTS as Record<string, string>)[id] ??
        (
          {
            'heat-relay': 'thermal-runaway',
            'thermal-runaway': 'cutting-torch',
            'wing-harness': 'airshot',
          } as Record<string, string>
        )[id];
    }
    assert(validBuild([...mods, fitting.id]), fitting.id);
    assert(UPGRADE_LORE[fitting.id]?.[2].length > 100, fitting.id);
    const mod = MODS.find((m) => m.id === fitting.id)!;
    assert(!/undefined/.test(modMark(mod)), fitting.id);
    assert(
      inspectUpgrade(mods, mod, 'pistol', undefined, 100, 'RF-C89-fit').changes.length > 0,
      fitting.id,
    );
  }
});
test('family milestones require actual victories and new fitting drafts begin in zone two on new seeds', () => {
  const empty = loadLogbook(null);
  assert(
    unlockGoals(empty, [], [], null)
      .filter((g) => TOOLROOM_IDS.includes(g.id as never))
      .every((g) => !g.unlocked),
  );
  const earned = unlockGoals(
    { ...empty, escaped: true },
    [],
    ['loader', 'press', 'condenser', 'sorter'],
    null,
  );
  assert(earned.filter((g) => TOOLROOM_IDS.includes(g.id as never)).every((g) => g.unlocked));
  const duplicate = unlockGoals(empty, [], ['loader', 'loader', 'loader'], null);
  assert(
    duplicate
      .filter((g) =>
        ['bank-capacitor', 'bank-memory', 'kinetic-liner', 'guide-vane'].includes(g.id),
      )
      .every((g) => g.current === 1 && !g.unlocked),
  );
  for (const seed of ['RF-C88-old', 'old-campaign', 'RF-D89-2026-10-07'])
    for (const id of TOOLROOM_IDS) assert(!draftUnlocked(id, LONGEVITY_IDS, seed), seed + id);
  for (const stage of [0, 1, 2, 3]) {
    const offers = rewardMods([], 200, seeded('pool'), {
      stage,
      seed: 'RF-C89-fit',
      unlocks: [...LONGEVITY_IDS],
    });
    assert(offers.every((m) => !TOOLROOM_IDS.includes(m.id as never)));
  }
  const offers = rewardMods([], 200, seeded('pool'), {
    stage: 4,
    seed: 'RF-C89-fit',
    unlocks: [...LONGEVITY_IDS],
  });
  assert(offers.some((m) => m.id === 'opening-shot'));
});
test('Surveyor shares a mark across a real Scattershot volley and only a later discharge gets the bonus', () => {
  const g = kit(['deadeye', 'scatter', 'surveyor']);
  const e = target(g, 320);
  g.fire();
  advance(g, 12);
  near(100000 - e.hp, g.gun.damage * 5);
  const hp = e.hp;
  g.shots = [];
  g.time += 0.4;
  g.fire();
  advance(g, 12);
  near(hp - e.hp, g.gun.damage * 5 * 1.2);
  const fragment = round(g, {
    fragment: true,
    toolroom: { discharge: 999, origin: { x: 0, y: 300 } },
  });
  near(g.toolroom.damage(e, fragment, 10), 10);
});
test('marks, distance and kill reserves work on actual hits without secondary self-priming or cancelled tells', () => {
  const g = kit([
    'deadeye',
    'surveyor',
    'far-sight',
    'follow-mark',
    'capacitor',
    'stagger-coil',
    'clean-cycle',
    'opening-shot',
    'airshot',
    'recoil-runner',
  ]);
  const e = target(g, 700);
  e.hp = 100;
  const s = round(g, { damage: 10, charged: true });
  g.shotCount = 1;
  g.toolroom.tag(s);
  near(g.toolroom.damage(e, s, 10), 11.5);
  e.timer = 1;
  hit(g, e, s);
  near(e.timer, 1.25);
  hit(g, e, s);
  near(e.timer, 1.25);
  g.time += 0.2;
  g.shotCount++;
  g.toolroom.tag(s);
  near(g.toolroom.damage(e, s, 10), 13.5);
  e.state = 'windup';
  e.timer = 0.6;
  hit(g, e, s);
  near(e.timer, 0.6);
  e.hp = 1;
  hit(g, e, s);
  assert(g.toolroom.followUntil > g.time);
  const other = target(g, 800);
  other.hp = 1;
  g.shotCount++;
  g.toolroom.tag(s);
  hit(g, other, s);
  assert(g.toolroom.cleanReady);
  Body.setVelocity(g.player, { x: 9, y: 0 });
  near(g.toolroom.discharge(), 1.4);
  near(g.toolroom.discharge(), 1.15);
  g.time += 3;
  near(g.toolroom.discharge(), 1.35);
});
test('a beam mark does not multiply across Prism rays and enhanced heat remains bounded', () => {
  const g = kit([
    'cutting-torch',
    'thermal-runaway',
    'heat-relay',
    'heat-exchanger',
    'insulated-line',
    'thermal-budget',
    'hot-start',
    'deadeye',
    'surveyor',
  ]);
  const e = target(g, 600);
  beam(g, 0.15);
  assert(g.torch.heat >= 0.25, 'Hot Start applies to the first exposed target');
  beam(g, 2);
  assert(g.torch.heat <= 1);
  const s = g.torch.pulse!;
  assert(s.toolroom);
  e.hp = -1;
  g.support.gunHit(e, 1, s, true);
  near(g.support.relay, g.torch.heat * 0.75);
  near(g.support.relayUntil - g.time, 1.8);
  g.time += 1.5;
  near(g.support.takeHeat(), 0.75);
  near(g.support.takeHeat(), 0);
  near(g.toolroom.startHeat(0), 0);
});
test('enhanced bank pays one capped reserve per whole volley and its memory decays without refilling', () => {
  const g = kit(['scatter', 'overkill-bank', 'bank-capacitor', 'bank-memory']);
  g.support.reserve = 1000;
  g.fire();
  assert.equal(g.shots.length, 5);
  for (const s of g.shots) {
    near(s.damage, g.gun.damage * 1.75);
    assert(s.overkillSpent);
  }
  near(g.support.reserve, 250);
  const e = target(g, 700);
  e.hp = -50;
  g.support.gunHit(e, 5, g.shots[0]);
  near(g.support.reserve, 250);
  near(g.support.discharge(100), 1.75);
  near(g.support.reserve, 62.5);
  near(g.support.discharge(100), 1.625);
  near(g.support.reserve, 15.625);
});
test('native cover destruction grants bounded healing and reinforced plates still reject explosive shells', () => {
  const g = kit(['reclamation', 'scrap-armor', 'reinforced-plate', 'plate-retainer']);
  g.hp = 50;
  const destroy = () => {
    const crate = g.props.spawn('crate', 600, 300);
    const s = round(g, { damage: 150 });
    g.props.hit(crate, s.damage, s.vel, s);
  };
  destroy();
  near(g.hp, 52);
  near(g.support.plateUntil - g.time, 6);
  destroy();
  near(g.hp, 52);
  const enemy = round(g, { friendly: false, damage: 28, radius: 6 });
  assert(g.support.absorb(enemy));
  assert(!g.support.absorb(enemy));
  g.time += 6;
  destroy();
  assert(g.support.plate);
  assert(!g.support.absorb({ ...enemy, blade: true }));
  assert(!g.support.absorb({ ...enemy, shell: { armed: false } as never }));
  for (let i = 0; i < 8; i++) {
    g.time += 6;
    destroy();
  }
  near(g.hp, 60);
  near(g.toolroom.scrapSpent, 10);
});
test('Field Patch stops outside live combat and shares a finite room allowance across injuries', () => {
  const g = kit(['field-patch']);
  target(g);
  g.hp = 50;
  g.hurtAt = 0;
  g.time = 5.9;
  g.toolroom.update(1);
  near(g.hp, 50);
  g.time = 7;
  g.toolroom.update(4);
  near(g.hp, 54);
  g.mode = 'paused';
  g.toolroom.update(4);
  near(g.hp, 54);
  g.mode = 'playing';
  g.clear = true;
  g.toolroom.update(4);
  near(g.hp, 54);
  g.clear = false;
  g.toolroom.update(20);
  near(g.hp, 60);
  near(g.toolroom.patchSpent, 10);
  g.hp = 20;
  g.hurtAt = g.time;
  g.time += 8;
  g.toolroom.update(20);
  near(g.hp, 20);
  g.toolroom.reset();
  g.toolroom.update(2);
  near(g.hp, 22);
});
test('Impulse Reserve and ground anchoring apply once per firing pattern and recharge on landing', () => {
  const basic = kit(['kick', 'scatter']);
  const enhanced = kit(['kick', 'scatter', 'impulse-reserve', 'ground-anchor']);
  basic.fire();
  enhanced.fire();
  near(enhanced.player.velocity.x / basic.player.velocity.x, 1.25);
  assert(!enhanced.toolroom.impulseReady);
  enhanced.toolroom.land();
  assert(enhanced.toolroom.impulseReady);
  Body.setVelocity(basic.player, { x: 0, y: 0 });
  Body.setVelocity(enhanced.player, { x: 0, y: 0 });
  basic.grounded = enhanced.grounded = true;
  basic.fire();
  enhanced.fire();
  near(enhanced.player.velocity.x / basic.player.velocity.x, 0.6);
  assert(enhanced.toolroom.impulseReady);
});
test('every public fitting preset loads, retries and leaves production checkpoint callbacks untouched', () => {
  for (const build of Object.keys(TOOLROOM_BUILDS)) {
    const save = toolroomTestFromUrl(
      new URL('https://example.test/?test=toolroom&build=' + build),
    )!;
    assert(save, build);
    assert(loadCheckpoint(save), build);
    const g = new Game();
    let writes = 0;
    g.onCheckpoint = () => writes++;
    g.startTest(save);
    assert.equal(g.mode, 'playing');
    assert(g.level.toolroom);
    g.save();
    assert.equal(writes, 0);
    assert(!g.commendations.eligible);
    g.startTest(g.testRun!);
    assert.deepEqual(g.mods, save.mods);
  }
  for (const query of [
    'test=toolroom&gun=unknown',
    'test=toolroom&build=nope',
    'test=toolroom&room=nope',
    'test=toolroom&machine=mortar&room=cover-line',
    'test=toolroom&seed=abc',
    'test=toolroom&build=native&build=thermal',
    'test=toolroom&test=loader',
  ])
    assert.equal(toolroomTestFromUrl(new URL('https://example.test/?' + query)), null, query);
});
