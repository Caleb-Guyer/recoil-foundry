import { RoomRematch, rematchEntry, roomRematchSnapshot } from '../src/room-rematch.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, EXTRACTION_DURATION, type Input } from '../src/game.ts';
import {
  FINALE_SERVICE_REPAIR,
  FinaleService,
  finaleServiceOffers,
  serviceBuild,
  validFinaleService,
} from '../src/finale-service.ts';
import { finaleServiceTestFromUrl, prepareFinaleServiceTest } from '../src/finale-service-test.ts';
import { finaleServiceMarkup } from '../src/finale-service-menu.ts';
import {
  MODS,
  MOD_REQUIRES,
  FUSION_REQUIRES,
  availableMods,
  buildPath,
  getGun,
  isFusion,
  loadCheckpoint,
  validSavedBuild,
  type Checkpoint,
} from '../src/rules.ts';
import { BRANCH_PARENTS } from '../src/upgrade-branches.ts';
import { withParents } from '../src/branch-builds.ts';
import { LONGEVITY_IDS, draftUnlocked } from '../src/longevity.ts';
import { STARTING_GUN_IDS } from '../src/starting-guns.ts';
import { inspectUpgrade } from '../src/upgrade-inspection.ts';
import { createUpgradeDemo, destroyUpgradeDemo, upgradeDemoInput } from '../src/upgrade-demo.ts';

const url = (extra = '') => new URL('https://test/?test=final-service&v=1' + extra);
const preset = (extra = '') => finaleServiceTestFromUrl(url(extra))!;
function fixture(extra = '') {
  const g = new Game();
  g.startTest(preset(extra));
  assert(prepareFinaleServiceTest(g, url(extra)));
  return g;
}
const idle = (g: Game): Input => ({
  left: false,
  right: false,
  jump: false,
  jumpHeld: false,
  fire: false,
  aim: { ...g.player.position },
});

test('every isolated fixture is a legal complete build that actually starts and prepares', () => {
  for (const build of ['standard', 'beam', 'fusion'])
    for (const choice of ['room', 'repair', 'refit', 'leave'])
      for (const mirror of [0, 1]) {
        const u = url('&build=' + build + '&choice=' + choice + '&mirror=' + mirror);
        const cp = finaleServiceTestFromUrl(u);
        assert(cp, u.href);
        assert(Array.isArray(cp.mods));
        assert.equal(cp.mods.length, 19);
        assert(validSavedBuild(cp.mods));
        const g = new Game();
        g.startTest(cp);
        assert(prepareFinaleServiceTest(g, u));
        assert(g.finaleService.available && g.finaleService.nearby);
        assert.equal(g.level.mirrored, !!mirror);
        assert.equal(g.mode, choice === 'room' ? 'playing' : 'finale-service');
      }
});

test('station offers are deterministic, at most three, and do not consume gameplay RNG', () => {
  const mods = preset().mods;
  const expected = finaleServiceOffers(mods, preset().seed);
  assert.equal(expected.length, 3);
  assert.equal(new Set(expected.map((s) => s.to)).size, 3);
  const original = Math.random;
  try {
    Math.random = () => {
      throw Error('Service used global RNG');
    };
    for (let i = 0; i < 10; i++)
      assert.deepEqual(finaleServiceOffers(mods, preset().seed), expected);
  } finally {
    Math.random = original;
  }
  assert.deepEqual(mods, preset().mods);
});

test('all 141-upgrade prerequisite families keep parents, fusions, fire mechanisms and path', () => {
  assert(MODS.length >= 141);
  const core = ['magnum', 'rapid', 'light', 'airshot', 'kick', 'scatter', 'pierce', 'leech'];
  let checked = 0,
    swaps = 0;
  for (const mod of MODS) {
    const build = withParents(core, [mod.id]);
    assert(build, 'Missing legal parent closure for ' + mod.id);
    const required = new Set(
      build.flatMap((id) => [
        ...(MOD_REQUIRES[id] ? [MOD_REQUIRES[id]] : []),
        ...(BRANCH_PARENTS[id] ?? []),
        ...(FUSION_REQUIRES[id] ?? []),
      ]),
    );
    const beforeGun = getGun(build);
    for (const offer of finaleServiceOffers(
      build,
      'RF-C98-CATALOG',
      false,
      undefined,
      LONGEVITY_IDS,
    )) {
      const next = serviceBuild(build, offer),
        afterGun = getGun(next);
      assert(validSavedBuild(next), mod.id + '/' + offer.from + '/' + offer.to);
      assert.equal(next.length, build.length);
      assert.equal(buildPath(next), buildPath(build));
      assert(!required.has(offer.from));
      assert(!isFusion(offer.from) && !isFusion(offer.to));
      for (const fusion of build.filter(isFusion)) assert(next.includes(fusion));
      for (const id of [
        'cutting-torch',
        'shellshock',
        'mass-driver',
        'fold',
        'recall',
        'vector',
        'grindshot',
        'suspension',
        'tripwire',
        'crossfire',
      ])
        assert.equal(next.includes(id), build.includes(id), mod.id + ' changed ' + id);
      assert.equal(afterGun.shellshock, beforeGun.shellshock);
      swaps++;
    }
    checked++;
  }
  assert.equal(checked, MODS.length);
  assert(swaps > 300, 'The safety constraints still need useful choices');
});

test('locked profile upgrades stay out of service offers and legacy-prefix ownership stays intact', () => {
  const build = withParents(['magnum', 'rapid', 'light', 'kick', 'airshot'], ['pulse-chamber'])!;
  for (const offer of finaleServiceOffers(build, 'RF-C98-LOCKS'))
    assert(draftUnlocked(offer.to, [], 'RF-C98-LOCKS'));
  const legacy = ['magnum', 'rapid', 'kick'];
  const full = [...legacy, 'light', 'airshot'];
  for (const offer of finaleServiceOffers(full, 'RF-C98-LEGACY', false, legacy)) {
    assert(!legacy.includes(offer.from));
    assert.deepEqual(serviceBuild(full, offer).slice(0, legacy.length), legacy);
    assert(validSavedBuild(serviceBuild(full, offer), legacy));
  }
});

test('interaction requires the unspent grounded station during the rain approach and adds no collision', () => {
  for (const mirror of [0, 1]) {
    const g = fixture('&mirror=' + mirror),
      service = g.finaleService;
    assert(service.available && service.nearby && g.grounded);
    assert.equal(service.site!.x, mirror ? 1440 : 560);
    assert.equal(Matter.Query.collides(g.player, g.solidBodies).length, 0);
    const solids = [...g.solidBodies];
    g.grounded = false;
    assert(!service.interact());
    g.grounded = true;
    g.hitStop = 0.01;
    assert(!service.interact());
    g.hitStop = 0;
    Matter.Body.setPosition(g.player, { x: mirror ? 1800 : 100, y: 722 });
    assert(!service.interact());
    assert(prepareFinaleServiceTest(g, url('&mirror=' + mirror)));
    assert(service.interact());
    assert.equal(g.mode, 'finale-service');
    assert.deepEqual(g.solidBodies, solids);
    const time = g.time;
    g.tick(1 / 60, { ...idle(g), right: true, fire: true });
    assert.equal(g.time, time);
  }
});

test('repair recovers25 with a100HP cap and neither repair nor Leave can be farmed', () => {
  assert.equal(FINALE_SERVICE_REPAIR, 25);
  for (const hp of [1, 57, 90, 99]) {
    const g = fixture();
    g.hp = hp;
    assert(g.finaleService.interact());
    assert(g.finaleService.repair());
    assert.equal(g.hp, Math.min(100, hp + 25));
    assert.equal(g.mode, 'playing');
    assert.equal(g.finaleService.current!.status, 'repair');
    assert(!g.finaleService.interact());
    assert(!g.finaleService.repair());
    assert(!g.finaleService.choose(0));
    g.finaleService.reset();
    assert(!g.finaleService.available);
  }
  const g = fixture();
  g.hp = 100;
  assert(g.finaleService.interact());
  assert(!g.finaleService.repair());
  assert(g.finaleService.leave());
  assert.equal(g.finaleService.current!.status, 'left');
  assert(!g.finaleService.interact());
});

test('one swap preserves all starting guns and rebuilds the full gun while clearing old projectiles', () => {
  for (const startingGun of STARTING_GUN_IDS) {
    const cp = preset('&build=beam');
    cp.startingGun = startingGun;
    const g = new Game();
    g.startTest(cp);
    assert(prepareFinaleServiceTest(g));
    assert(g.finaleService.interact());
    const before = [...g.mods],
      swap = { ...g.finaleService.offers[0] },
      hp = g.hp;
    const body = g.player,
      solids = [...g.solidBodies];
    g.burstRemaining = 3;
    g.fireBuffer = 1;
    g.landingReady = true;
    g.addShot({
      pos: { x: 700, y: 600 },
      vel: { x: 1, y: 0 },
      damage: 24,
      life: 1,
      friendly: true,
      radius: 3,
      bounces: 0,
      pierce: 0,
      fragment: false,
      split: false,
    });
    assert(g.finaleService.choose(0));
    assert.deepEqual(g.mods, serviceBuild(before, swap));
    assert.deepEqual(g.gun, getGun(g.mods, startingGun));
    assert.equal(g.startingGun, startingGun);
    assert.equal(g.hp, hp);
    assert.equal(g.player, body);
    assert.deepEqual(g.solidBodies, solids);
    assert.equal(g.shots.length, 0);
    assert.equal(g.burstRemaining, 0);
    assert.equal(g.fireBuffer, 0);
    assert(!g.landingReady);
    assert(!g.finaleService.choose(0));
    assert(!g.finaleService.repair());
    assert(validFinaleService(g.checkpointSnapshot()));
  }
});

test('open, repaired, swapped and skipped service receipts survive strict Continue without rerolls', () => {
  for (const action of ['open', 'repair', 'swap', 'leave']) {
    const g = fixture();
    assert(g.finaleService.interact());
    const offers = structuredClone(g.finaleService.offers);
    if (action === 'repair') assert(g.finaleService.repair());
    if (action === 'swap') assert(g.finaleService.choose(0));
    if (action === 'leave') assert(g.finaleService.leave());
    const saved = loadCheckpoint(JSON.parse(JSON.stringify(g.checkpointSnapshot())));
    assert(saved, action + ' checkpoint rejected');
    const h = new Game();
    h.start(saved.seed, saved);
    assert.deepEqual(h.finaleService.offers, offers);
    assert.deepEqual(h.finaleService.checkpoint, g.finaleService.checkpoint);
    assert.equal(h.mode, action === 'open' ? 'finale-service' : 'playing');
    if (action === 'open') {
      assert(h.finaleService.repair());
      assert.equal(h.hp, 82);
    } else assert(!h.finaleService.interact());
  }
});

test('Campaign receipt survives actual Overtime entry and grants only a separate second-lap service', () => {
  const g = fixture();
  assert(g.finaleService.interact());
  assert(g.finaleService.repair());
  const campaign = structuredClone(g.finaleService.current);
  const seed = g.seed;
  g.finaleFirstClear = false;
  g.clear = true;
  for (const e of g.enemies) Matter.Composite.remove(g.engine.world, e.body);
  g.enemies = [];
  g.waves.clear();
  g.startEscape();
  assert(g.escape && g.canOvertime);
  g.escape.phase = 'extracting';
  g.escape.destination = 'overtime';
  g.escape.depart = EXTRACTION_DURATION;
  assert(g.startOvertime());
  assert.equal(g.seed, seed);
  assert.notEqual(g.layoutSeed, seed);
  assert.equal(g.stage, 0);
  assert.deepEqual(g.finaleService.state.campaign, campaign);
  const saved = loadCheckpoint(g.checkpointSnapshot());
  assert(saved, 'Overtime checkpoint lost service receipt');
  const h = new Game();
  h.start(saved.seed, saved);
  assert.deepEqual(h.finaleService.state.campaign, campaign);
  for (let i = 0; i < 19; i++) {
    const mod = availableMods(h.mods).find((m) => draftUnlocked(m.id, h.unlocks, h.seed));
    assert(mod);
    h.mods.push(mod.id);
  }
  h.gun = getGun(h.mods, h.startingGun);
  h.stage = 19;
  h.loadRoom();
  assert(h.finaleService.available);
  assert(h.finaleService.current);
  const site = h.finaleService.site!;
  Matter.Body.setPosition(h.player, { x: site.x - 45, y: 722 });
  Matter.Body.setVelocity(h.player, { x: 0, y: 0 });
  for (let i = 0; i < 3; i++) h.tick(1 / 60, idle(h));
  assert(h.finaleService.interact());
  assert(h.finaleService.leave());
  assert.deepEqual(h.finaleService.state.campaign, campaign);
  assert.equal(h.finaleService.state.overtime!.status, 'left');
  assert(loadCheckpoint(h.checkpointSnapshot()));
});

test('malformed, forged or cross-mode receipts are rejected without granting a fresh service', () => {
  const g = fixture();
  assert(g.finaleService.interact());
  const cp = g.checkpointSnapshot();
  assert(validFinaleService(cp));
  const invalid: unknown[] = [
    null,
    {},
    [],
    { version: 2 },
    { ...cp.finaleService, extra: true },
    { ...cp.finaleService, overtime: cp.finaleService!.campaign },
  ];
  for (const value of invalid)
    assert.equal(
      validFinaleService({ ...cp, finaleService: value as never }),
      false,
      JSON.stringify(value),
    );
  for (const change of [
    { status: 'cheat' },
    { status: 'repair', open: true },
    { status: 'swap', swap: 99 },
    { startingGun: 'shotgun' },
    { offers: [{ from: 'magnum', to: 'wallrunner' }] },
    { offers: [...g.finaleService.offers].reverse() },
    { baseMods: ['resonator'] },
    { unlocks: ['not-an-upgrade'] },
  ]) {
    const receipt = { ...cp.finaleService!.campaign!, ...change };
    const forged = { ...cp, finaleService: { version: 1 as const, campaign: receipt as never } };
    assert(!validFinaleService(forged), JSON.stringify(change));
    assert.equal(loadCheckpoint(forged), null);
    const model = new FinaleService(g);
    model.start(forged);
    assert(!model.available);
  }
  for (const seed of ['RF-C97-LEGACY', 'old', 'RF-D98-2026-10-24'])
    assert(!validFinaleService({ ...cp, seed }));
  const snapshot = g.finaleService.checkpoint!;
  snapshot.campaign!.offers[0].to = 'fake';
  assert.notEqual(g.finaleService.offers[0].to, 'fake');
});

test('stale or tampered offers cannot commit a swap even in an open menu', () => {
  const g = fixture();
  assert(g.finaleService.interact());
  g.finaleService.offers[0].from = 'magnum';
  assert(!g.finaleService.choose(0));
  assert(!g.finaleService.repair());
  assert.equal(g.finaleService.current!.status, 'available');
});

test('service is absent in legacy, Daily, Practice, Workshop, combat and ordinary test links', () => {
  const cp = preset();
  for (const change of [
    { seed: 'RF-C97-NO-SERVICE' },
    { seed: 'legacy' },
    { seed: 'RF-D98-2026-10-24' },
  ]) {
    const g = new Game();
    g.start(change.seed, { ...cp, ...change });
    assert(!g.finaleService.eligible);
    assert(!g.finaleService.site);
  }
  const g = fixture();
  g.practice = { kind: 'interceptor', seed: 'PRACTICE' };
  assert(!g.finaleService.eligible);
  g.practice = null;
  g.workshop.active = true;
  assert(!g.finaleService.eligible);
  g.workshop.active = false;
  g.testRun = { ...cp, seed: 'RF-C98-ORDINARY-TEST' };
  assert(!g.finaleService.eligible);
  g.testRun = cp;
  g.finale.cinema!.state = 'boarding';
  assert(!g.finaleService.eligible);
  assert(!g.finaleService.interact());
});

test('isolated links stay profile-safe, use strict URL parameters and never auto-consume a service', () => {
  for (const extra of [
    '&build=beam',
    '&build=fusion',
    '&choice=repair',
    '&choice=refit',
    '&choice=leave',
    '&mirror=1',
  ]) {
    const g = new Game();
    let writes = 0;
    g.onCheckpoint = () => writes++;
    g.startTest(preset(extra));
    assert(prepareFinaleServiceTest(g, url(extra)));
    assert.equal(writes, 0);
    assert.equal(g.finaleService.current!.status, 'available');
    if (g.mode === 'playing') assert(g.finaleService.interact());
    assert(g.finaleService.leave());
    assert.equal(writes, 0);
  }
  for (const extra of [
    '&daily=1',
    '&build=unknown',
    '&build=beam&build=fusion',
    '&choice=swap-now',
    '&v=1',
    '&mirror=2',
  ])
    assert.equal(finaleServiceTestFromUrl(url(extra)), null, extra);
  assert.equal(finaleServiceTestFromUrl(new URL('https://test/?test=final-service&v=2')), null);
});

test('home stays concise and refit confirmation uses the complete real gun without altering the run', () => {
  const g = fixture('&build=beam');
  assert(g.finaleService.interact());
  const home = finaleServiceMarkup(g.finaleService);
  assert.equal((home.match(/data-service=/g) ?? []).length, 3);
  assert(!home.includes('<canvas'));
  const confirmation = finaleServiceMarkup(g.finaleService, 'confirm', 0);
  assert.equal((confirmation.match(/<canvas/g) ?? []).length, 2);
  assert.match(confirmation, /data-service-confirm class="primary" disabled/);
  const swap = g.finaleService.offers[0],
    mod = MODS.find((m) => m.id === swap.to)!;
  const inspection = inspectUpgrade(g.mods, mod, g.startingGun, g.hp, swap.from, g.seed);
  assert.deepEqual(inspection.beforeMods, g.mods);
  assert.deepEqual(inspection.afterMods, serviceBuild(g.mods, swap));
  const before = JSON.stringify({
    mods: g.mods,
    hp: g.hp,
    seed: g.seed,
    service: g.finaleService.checkpoint,
  });
  for (const mods of [inspection.beforeMods, inspection.afterMods]) {
    const demo = createUpgradeDemo(mods, g.startingGun, g.seed, mod.id);
    assert.deepEqual(demo.mods, mods);
    assert.deepEqual(demo.gun, getGun(mods, g.startingGun));
    for (let frame = 0; frame < 90; frame++) demo.tick(1 / 60, upgradeDemoInput(demo, frame));
    assert(demo.shotCount > 0);
    destroyUpgradeDemo(demo);
  }
  assert.equal(
    JSON.stringify({ mods: g.mods, hp: g.hp, seed: g.seed, service: g.finaleService.checkpoint }),
    before,
  );
});

test('post-service death snapshots keep repaired and refitted receipts with the exact finished gun', () => {
  for (const action of ['repair', 'swap'] as const) {
    const g = fixture('&build=beam');
    const entry = rematchEntry(g);
    assert(entry);
    assert.equal(entry.checkpoint.finaleService!.campaign!.status, 'available');
    assert(g.finaleService.interact());
    assert(action === 'repair' ? g.finaleService.repair() : g.finaleService.choose(0));
    const finished = {
      mods: [...g.mods],
      gun: { ...g.gun },
      startingGun: g.startingGun,
      service: g.finaleService.checkpoint,
    };
    assert.equal(
      entry.checkpoint.finaleService!.campaign!.status,
      'available',
      'Room entry remains an immutable layout snapshot',
    );
    g.finale.cinema!.enterForm(0);
    g.damagePlayer(100, undefined, { type: 'shot', enemy: 'interceptor' });
    assert.equal(g.mode, 'dead');
    const snapshot = roomRematchSnapshot(g, entry);
    assert(snapshot?.finalePractice);
    assert.equal(snapshot.checkpoint.finaleService!.campaign!.status, action);
    assert(validFinaleService(snapshot.checkpoint));
    assert(
      loadCheckpoint(snapshot.checkpoint),
      'The finished build and spent service must form a legal checkpoint',
    );
    const practice = new RoomRematch(snapshot);
    assert.deepEqual(practice.game.mods, finished.mods);
    assert.deepEqual(practice.game.gun, finished.gun);
    assert.equal(practice.game.startingGun, finished.startingGun);
    assert.deepEqual(practice.game.finaleService.checkpoint, finished.service);
    assert.equal(practice.game.finaleService.current!.status, action);
    assert(!practice.game.finaleService.available);
    assert(practice.game.testRun?.rematchRoom);
    let records = 0;
    practice.game.onCheckpoint = () => records++;
    practice.game.onCampaignClear = () => records++;
    practice.game.onBossDefeated = () => records++;
    practice.reset();
    practice.game.setMode('playing');
    practice.game.hitEnemy(practice.game.finale.enemy!, 1e9);
    assert.equal(practice.game.mode, 'won');
    assert.equal(records, 0, 'The private form clear cannot save, unlock or award a Campaign kill');
    assert.deepEqual(
      { mods: g.mods, gun: g.gun, startingGun: g.startingGun, service: g.finaleService.checkpoint },
      finished,
    );
    practice.dispose();
  }
});
