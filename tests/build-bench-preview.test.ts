import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Input } from '../src/game.ts';
import { MODS, validBuild, type Checkpoint } from '../src/rules.ts';
import { STARTING_GUN_IDS } from '../src/starting-guns.ts';
import { BUILD_BENCH_SCENES, buildBenchTestFromUrl } from '../src/build-bench-test.ts';
import { benchInspect, benchRows } from '../src/build-bench-model.ts';

const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: false,
  fire: false,
  aim: { x: 950, y: 723 },
};
function dispose(g: Game) {
  Matter.Composite.clear(g.engine.world, false);
  Matter.Engine.clear(g.engine);
}
const wanted: Record<string, string[]> = {
  browse: ['ricochet', 'light'],
  dependencies: ['rail-spike', 'light'],
  comparison: ['scatter', 'cutting-torch', 'light'],
  groups: ['pierce', 'split', 'ricochet', 'rapid'],
  incoming: ['countershot', 'reprisal', 'scrap-armor'],
  cover: ['ricochet', 'banker', 'shellshock'],
  recoil: [
    'kick',
    'double-jump',
    'spring-step',
    'wing-harness',
    'glide-rig',
    'ricochet-harness',
    'spring-rivets',
  ],
};

test('all seven Build Bench links retain every intended fitting for all six native guns', () => {
  for (const scene of BUILD_BENCH_SCENES)
    for (const gun of STARTING_GUN_IDS) {
      const fixture = buildBenchTestFromUrl(
        new URL(`https://test.invalid/?test=build-bench&scene=${scene}&gun=${gun}&v=1`),
      );
      assert(fixture, scene + '/' + gun);
      assert.equal(fixture.gun, gun);
      assert.equal(fixture.known.length, MODS.length);
      assert(validBuild(fixture.mods));
      assert(
        wanted[scene].every((id) => fixture.mods.includes(id)),
        scene,
      );
      assert.equal(fixture.editor, ['browse', 'dependencies', 'comparison'].includes(scene));
      if (fixture.initialInspect) {
        const row = benchInspect(fixture.initialInspect, fixture.known, fixture.mods, gun)!;
        assert(
          row.canAdd || row.canRemove,
          'The featured editor comparison must be a real legal edit: ' + scene + '/' + gun,
        );
      }
      if (fixture.initialBrowse)
        assert(benchRows(fixture.known, fixture.mods, gun, fixture.initialBrowse).length > 0);
      const g = new Game();
      g.startWorkshop(fixture.known, fixture.mods, gun, fixture.range);
      assert.equal(g.workshop.scenario, fixture.range);
      assert.equal(g.startingGun, gun);
      assert.deepEqual(
        g.mods,
        fixture.mods,
        'No promised fitting can silently disappear during native startup',
      );
      assert(g.enemies.every((enemy) => !!enemy.workshopTarget));
      assert(
        Object.values(g.gun).every((value) => typeof value !== 'number' || Number.isFinite(value)),
      );
      assert(g.resetWorkshop());
      assert.equal(g.workshop.scenario, fixture.range);
      assert.equal(g.startingGun, gun);
      assert.deepEqual(g.mods, fixture.mods);
      dispose(g);
    }
});

test('Build Bench parser rejects duplicate, ambiguous, mixed-mode and unsupported test links', () => {
  for (const query of [
    '?test=build-bench',
    '?test=build-bench&v=2',
    '?test=build-bench&v=1&scene=nope',
    '?test=build-bench&v=1&gun=nope',
    '?test=build-bench&v=1&test=build-bench',
    '?test=build-bench&v=1&v=1',
    '?test=build-bench&v=1&scene=browse&scene=groups',
    '?test=build-bench&v=1&gun=pistol&gun=shotgun',
    '?test=build-bench&v=1&seed=RF-C108-X',
    '?test=build-bench&v=1&daily=2026-10-26',
    '?test=build-bench&v=1&workshop=1',
    '?test=build-bench&v=1&mods=scatter',
    '?test=build-bench&v=1&mirror=1',
    '?test=build-bench&v=1&scene=',
    '?test=build-bench&v=1&gun=',
  ])
    assert.equal(buildBenchTestFromUrl(new URL('https://test.invalid/' + query)), null, query);
  const defaultFixture = buildBenchTestFromUrl(
    new URL('https://test.invalid/?test=build-bench&v=1'),
  )!;
  assert.equal(defaultFixture.scene, 'browse');
  assert.equal(defaultFixture.gun, 'pistol');
});

test('fixture discovery and build arrays are private copies and cannot unlock the ordinary Workshop', () => {
  const url = new URL('https://test.invalid/?test=build-bench&scene=dependencies&v=1');
  const first = buildBenchTestFromUrl(url)!;
  first.known.length = 0;
  first.mods.length = 0;
  const second = buildBenchTestFromUrl(url)!;
  assert.equal(second.known.length, MODS.length);
  assert(second.mods.includes('rail-spike'));
  const g = new Game();
  g.startWorkshop([], second.mods, 'pistol');
  assert.deepEqual(g.mods, []);
  assert.deepEqual(g.workshop.discovered, []);
  assert.equal(g.workshop.scenario, 'standard');
  assert.equal(g.enemies.length, 4, 'The ordinary first-session warm-up keeps its original range');
  assert.deepEqual(benchRows([], []), []);
  dispose(g);
});

test('private range play, accepted hits, target kills, reset and defeat cannot replace Continue or award progress', () => {
  for (const scene of ['groups', 'incoming', 'cover', 'recoil'] as const) {
    const fixture = buildBenchTestFromUrl(
      new URL(`https://test.invalid/?test=build-bench&scene=${scene}&v=1`),
    )!;
    const g = new Game();
    let saved: Checkpoint | null = null,
      writes = 0,
      awards = 0,
      observed = 0;
    g.onCheckpoint = (save) => {
      saved = save;
      writes++;
    };
    g.start('RF-C108-BENCH-CONTINUE');
    assert(saved);
    const original = structuredClone(saved);
    const priorWrites = writes;
    g.onEnemyDefeated = () => awards++;
    g.onBossDefeated = () => awards++;
    g.onCommendation = () => awards++;
    g.onCampaignClear = () => awards++;
    g.onMilestone = () => awards++;
    // Encounter observation is emitted by the simulation; the actual main-page
    // writer accepts only normal Campaign play, so private observations stay local.
    g.onEnemyEncountered = () => {
      observed++;
      if (!g.practice && !g.testRun && !g.workshop.active && g.mode === 'playing') awards++;
    };
    g.startWorkshop(fixture.known, fixture.mods, fixture.gun, fixture.range);
    for (let frame = 0; frame < 360; frame++) g.tick(1 / 60, idle);
    assert(observed > 0);
    assert(!g.commendations.eligible);
    for (const enemy of [...g.enemies]) g.hitEnemy(enemy, 100000);
    g.save();
    g.openReward();
    g.chooseMod('mass-driver');
    g.startEscape();
    g.startOvertime();
    assert(!g.escape && !g.overtime && !g.clear);
    assert(!g.canChooseRoute && !g.canDetour && !g.canReroll);
    g.resetWorkshop();
    g.die();
    assert.equal(g.mode, 'playing');
    assert.equal(g.hp, 100);
    assert.equal(g.workshop.scenario, fixture.range);
    assert.deepEqual(g.mods, fixture.mods);
    assert.equal(writes, priorWrites);
    assert.equal(awards, 0);
    assert.deepEqual(saved, original);
    g.setMode('title');
    g.start(original!.seed, original!);
    assert.equal(g.workshop.active, false);
    assert.equal(g.seed, original!.seed);
    assert.deepEqual(g.mods, original!.mods);
    dispose(g);
  }
});
