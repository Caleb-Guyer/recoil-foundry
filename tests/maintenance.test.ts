import { tick, climb } from './helpers/maintenance-pilot.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Input } from '../src/game.ts';
import { getGun, loadCheckpoint, availableMods, type Checkpoint } from '../src/rules.ts';
import {
  planMaintenance,
  maintenanceLevel,
  shaftEntry,
  shaftSections,
  type MaintenanceKind,
} from '../src/maintenance.ts';
import { maintenanceTestFromUrl } from '../src/maintenance-test.ts';
import { dailyForDate } from '../src/daily.ts';
import { CRUSHER_TELL } from '../src/hazards.ts';

const { Body } = Matter;
function fixture(kind: MaintenanceKind = 'piston', build = 'standard', variant?: number) {
  const save = maintenanceTestFromUrl(
    new URL(
      `https://test/?test=maintenance&layout=${kind}&build=${build}${variant ? '&variant=' + variant : ''}`,
    ),
  )!;
  assert(loadCheckpoint(save));
  const g = new Game();
  g.start(save.seed, save);
  return g;
}
function snapshot(g: Game) {
  let save: Checkpoint | undefined;
  g.onCheckpoint = (s) => {
    save = s;
  };
  g.save();
  assert(save);
  return save;
}
function atGoal(g: Game) {
  const { x, floor } = g.maintenance.exit;
  Body.setPosition(g.player, { x, y: floor - 18 });
  Body.setVelocity(g.player, { x: 0, y: 0 });
  for (let i = 0; i < 45 && g.mode === 'playing'; i++) tick(g);
}
test('new campaigns schedule at most one rare shaft on its own deterministic stream', () => {
  let count = 0;
  const kinds = new Set(),
    stages = new Set();
  for (let i = 0; i < 1000; i++) {
    const seed = 'shaft-schedule-' + i,
      s = planMaintenance(seed);
    assert.deepEqual(planMaintenance(seed), s);
    if (s) {
      count++;
      kinds.add(s.kind);
      stages.add(s.stage);
    }
  }
  assert(count > 350 && count < 550);
  assert.equal(kinds.size, 2);
  assert.deepEqual(
    [...stages].sort((a, b) => a - b),
    [2, 6, 18],
  );
  for (const revision of [80, 81, 89]) {
    const daily = dailyForDate('2026-09-27', revision);
    if (daily) assert.equal(planMaintenance(daily.seed), null);
  }
});

test('old saves, Daily, practice and Workshop do not acquire a maintenance room', () => {
  let seed = '';
  for (let i = 0; !seed; i++) if (planMaintenance('shaft-old-' + i)) seed = 'shaft-old-' + i;
  const g = new Game();
  g.start(seed);
  assert(g.maintenance.state);
  const save = snapshot(g);
  delete save.maintenance;
  g.start(seed, save);
  assert.equal(g.maintenance.state, null);
  g.start(seed, undefined, null, null, true);
  assert.equal(g.maintenance.state, null);
  assert(g.startPractice({ kind: 'loader', seed }));
  assert.equal(g.maintenance.state, null);
  g.start('RF-D89-2026-09-27');
  assert.equal(g.maintenance.state, null);
});

test('shaft checkpoints reject malformed schedules without changing existing save arithmetic', () => {
  const g = fixture(),
    save = snapshot(g);
  assert(loadCheckpoint(save));
  for (const maintenance of [
    null,
    false,
    [],
    {},
    { stage: 10, kind: 'lift' },
    { stage: '2', kind: 'lift' },
    { stage: 2, kind: 'unknown' },
    { stage: 2, kind: 'lift', reward: true },
    { stage: 2, kind: 'lift', revision: 1 },
    { stage: 2, kind: 'lift', revision: '2' },
    { stage: 2, kind: 'lift', revision: null },
  ])
    assert.equal(loadCheckpoint({ ...save, maintenance }), null);
  assert.equal(loadCheckpoint({ ...save, version: 5 }), null);
  assert.equal(loadCheckpoint({ ...save, seed: 'RF-D89-2026-09-27' }), null);
  assert.equal(loadCheckpoint({ ...save, mods: ['magnum'] }), null);
});

test('shaft preview URLs are strict, reproducible and isolated by the existing test boundary', () => {
  for (const kind of ['piston', 'lift'])
    for (const build of ['standard', 'recoil', 'portal']) {
      const url = new URL(`https://test/?test=maintenance&layout=${kind}&build=${build}`);
      const save = maintenanceTestFromUrl(url)!;
      assert(loadCheckpoint(save));
      assert.deepEqual(maintenanceTestFromUrl(url), save);
      const g = new Game();
      let writes = 0;
      g.onCheckpoint = () => writes++;
      g.start(save.seed, save, null, save);
      g.save();
      assert.equal(writes, 0);
    }
  for (const query of [
    'test=other',
    'test=maintenance&layout=bad',
    'test=maintenance&build=bad',
    'test=maintenance&layout=lift&layout=piston',
    'test=maintenance&stage=19',
    'test=maintenance&test=maintenance',
    'test=maintenance&variant=0',
    'test=maintenance&variant=-1',
    'test=maintenance&variant=1.2',
    'test=maintenance&variant=1000',
    'test=maintenance&variant=01',
    'test=maintenance&variant=1&variant=2',
  ])
    assert.equal(maintenanceTestFromUrl(new URL('https://test/?' + query)), null);
});

for (const kind of ['piston', 'lift'] as const) {
  const arrangements = new Map<string, number>();
  for (let variant = 1; variant <= 999 && arrangements.size < 36; variant++) {
    const seed = `MAINTENANCE-${kind}-${variant}`;
    arrangements.set(shaftSections(seed).join(''), variant);
  }
  for (const build of ['standard', 'recoil', 'portal'])
    test(`${kind}: all 36 authored section orders are reachable with the ${build} gun`, () => {
      assert.equal(arrangements.size, 36);
      for (const [order, variant] of arrangements) {
        const g = fixture(kind, build, variant),
          result = climb(g);
        assert.equal(
          result.mode,
          'upgrade',
          JSON.stringify({ kind, order, variant, ...result, position: g.player.position }),
        );
        assert(result.hp > 0);
        assert.equal(g.offers.length, 3);
      }
    });
}

test('new layouts rebuild from their saved revision without altering legacy shafts or reward draws', () => {
  for (const kind of ['piston', 'lift'] as const) {
    for (const variant of [1, 2, 83]) {
      const g = fixture(kind, 'standard', variant),
        save = snapshot(g);
      assert.equal(save.maintenance!.revision, 2);
      const resumed = new Game();
      resumed.start(save.seed, loadCheckpoint(save)!);
      assert.deepEqual(resumed.level, g.level);
      assert.deepEqual(resumed.maintenance.presses, g.maintenance.presses);
      assert.deepEqual(resumed.player.position, shaftEntry(kind));
      const original = structuredClone(save);
      delete original.maintenance!.revision;
      const old = new Game();
      old.start(original.seed, loadCheckpoint(original)!);
      assert.deepEqual(old.level, maintenanceLevel(kind));
      atGoal(g);
      atGoal(old);
      assert.deepEqual(g.offers, old.offers);
      const pending = snapshot(g);
      resumed.start(pending.seed, loadCheckpoint(pending)!);
      assert.equal(resumed.mode, 'upgrade');
      assert.deepEqual(resumed.offers, g.offers);
      resumed.chooseMod(resumed.offers[0].id);
      assert.equal(resumed.stage, 3);
      assert.deepEqual(resumed.detours, [0]);
      assert(loadCheckpoint(snapshot(resumed)));
    }
  }
});

test('varied previews preserve progress and each seeded shaft contains all three section families', () => {
  for (const kind of ['piston', 'lift'] as const)
    for (const variant of [1, 2, 999]) {
      const url = new URL(`https://test/?test=maintenance&layout=${kind}&variant=${variant}`);
      const save = maintenanceTestFromUrl(url)!;
      assert(loadCheckpoint(save));
      assert.deepEqual(maintenanceTestFromUrl(url), save);
      assert.equal(new Set(shaftSections(save.seed)).size, 3);
      const g = new Game();
      let writes = 0;
      g.onCheckpoint = () => writes++;
      g.start(save.seed, save, null, save);
      atGoal(g);
      g.save();
      g.chooseMod(g.offers[0].id);
      assert.equal(writes, 0);
    }
});

test('every varied press warns for its full tell, cycles independently and leaves a safe landing', () => {
  const g = fixture('piston', 'standard', 1);
  const warnings = new Map<number, number>(),
    cycles = new Map<number, number>();
  for (let i = 0; i < 1500; i++) {
    const before = g.hazards.items.map((h) => h.state);
    tick(g);
    g.hazards.items.forEach((h, index) => {
      if (h.state === 'warning' && before[index] === 'idle') {
        assert(h.timer >= CRUSHER_TELL - 0.02);
        warnings.set(index, g.time);
        cycles.set(index, (cycles.get(index) ?? 0) + 1);
      }
      if (h.state === 'falling' && before[index] === 'warning')
        assert(g.time - warnings.get(index)! >= CRUSHER_TELL - 0.02);
    });
  }
  assert.equal(cycles.size, g.hazards.items.length);
  assert([...cycles.values()].every((n) => n >= 2));
  for (const point of g.level.route) {
    const heads = g.hazards.items.filter((h) => h.placement.y + 178 === point.y + 18);
    assert(heads.length > 0);
    assert(heads.every((h) => Math.abs(point.x - h.placement.x) > h.placement.w / 2 + 14));
  }
  const before = structuredClone(g.maintenance.presses);
  g.setMode('paused');
  for (let i = 0; i < 600; i++) tick(g);
  assert.deepEqual(g.maintenance.presses, before);
  g.setMode('playing');
  g.hitStop = 1;
  tick(g);
  assert.deepEqual(g.maintenance.presses, before);
  assert.equal(g.hp, 100);
});

test('split lifts support either branch and the crumbling transfers can be bypassed with recoil', () => {
  for (const variant of [1, 6, 83]) {
    const g = fixture('lift', 'standard', variant);
    const sections = shaftSections(g.seed);
    const route = [];
    for (let section = 0; section < 4; section++) {
      const y = 420 - section * 320,
        left = section % 2 === 1;
      const lifts = g.hazards.items.filter((h) => h.kind === 'lift' && h.placement.y === y + 200);
      const lift = lifts.at(-1)!;
      route.push({ x: lift.placement.x, y: lift.placement.y - 18 });
      if (sections[section] === 2) route.push({ x: left ? 1200 : 800, y: y + 62 });
      route.push({ x: left ? 800 : 1200, y: y - 18 });
    }
    g.level.route = route;
    const result = climb(g);
    assert.equal(
      result.mode,
      'upgrade',
      JSON.stringify({ variant, ...result, p: g.player.position }),
    );
    assert(result.hp > 0);
  }
});

test('crumbling transfer plates regenerate after use and never trap an actor inside the replacement', () => {
  const g = fixture('lift', 'standard', 1);
  const plate = g.hazards.items.find((h) => h.kind === 'crumble')!;
  Body.setPosition(g.player, { x: plate.placement.x, y: plate.placement.y - 18 });
  Body.setVelocity(g.player, { x: 0, y: 0 });
  for (let i = 0; i < 50; i++) tick(g);
  assert.equal(plate.state, 'gone');
  Body.setPosition(g.player, { x: plate.placement.x, y: plate.body.position.y });
  Body.setStatic(g.player, true);
  for (let i = 0; i < 240; i++) tick(g);
  assert(!plate.visible);
  Body.setPosition(g.player, shaftEntry('lift'));
  tick(g);
  assert(plate.visible);
});

test('an empty shaft cannot clear early, pay at the bottom or generate combat and random obstructions', () => {
  for (const kind of ['piston', 'lift'] as const) {
    const g = fixture(kind);
    for (let i = 0; i < 600; i++) tick(g);
    g.openReward();
    assert(!g.clear);
    assert.equal(g.mode, 'playing');
    assert.equal(g.offers.length, 0);
    assert.equal(g.enemies.length, 0);
    assert(!g.waves.pending);
    assert.equal(g.props.items.length, 0);
    assert.equal(g.destruction.pieces.length, 0);
    assert(!g.canDetour && !g.canChooseRoute);
    assert.equal(g.breaches.panels.length, 0);
    assert.equal(g.hp, 100);
  }
});

test('press banks alternate with the full warning and leave the outer ledges safe', () => {
  const g = fixture();
  for (let i = 0; i < 97; i++) tick(g);
  const left = g.hazards.items.filter((_, i) => i % 2 === 0);
  const right = g.hazards.items.filter((_, i) => i % 2 === 1);
  assert(left.every((h) => h.state === 'warning' && h.timer >= CRUSHER_TELL - 0.05));
  assert(right.every((h) => h.state === 'idle'));
  for (let i = 0; i < 240; i++) tick(g);
  assert(right.every((h) => h.state === 'warning'));
  assert(left.every((h) => h.state === 'idle'));
  for (let i = 0; i < 8; i++) {
    const h = g.hazards.items[i],
      rest = g.level.route[i];
    assert(Math.abs(rest.x - h.placement.x) > h.placement.w / 2 + 14);
  }
});

test('pause and hitstop freeze both the lift and the press schedule', () => {
  for (const kind of ['piston', 'lift'] as const) {
    const g = fixture(kind);
    tick(g);
    const state = () => [
      g.time,
      g.maintenance.pulseAt,
      g.maintenance.bank,
      ...g.hazards.items.map((h) => [h.state, h.phase, h.timer, h.body.position.y]),
    ];
    const before = state();
    g.setMode('paused');
    for (let i = 0; i < 100; i++) tick(g);
    assert.deepEqual(state(), before);
    g.setMode('playing');
    g.hitStop = 1;
    tick(g);
    assert.deepEqual(state(), before);
  }
});

for (const kind of ['piston', 'lift'] as const)
  for (const build of ['standard', 'recoil', 'portal'])
    test(`${kind}: ordinary inputs with ${build} gun reach the summit with live machinery`, () => {
      const g = fixture(kind, build),
        result = climb(g);
      assert.equal(
        result.mode,
        'upgrade',
        JSON.stringify(result) + ' ' + JSON.stringify(g.player.position),
      );
      assert(result.hp > 0);
      assert(result.shots > 0);
      assert.equal(g.offers.length, 3);
      assert(g.offers.every((m) => availableMods(g.mods).some((a) => a.id === m.id)));
    });

test('Continue restarts an unfinished shaft at its safe entrance without duplicating the regular reward', () => {
  for (const kind of ['piston', 'lift'] as const) {
    const g = fixture(kind, 'portal'),
      save = snapshot(g);
    for (let i = 0; i < 100; i++) tick(g);
    g.hp = 24;
    Body.setPosition(g.player, { x: 1000, y: -100 });
    const resumed = new Game();
    resumed.start(save.seed, loadCheckpoint(save)!);
    assert.deepEqual(resumed.player.position, shaftEntry(kind));
    assert.equal(resumed.hp, 100);
    assert.deepEqual(resumed.mods, ['fold']);
    assert(!resumed.clear);
    assert.equal(resumed.offers.length, 0);
    assert(resumed.portals.pair.every((p) => p === null));
    assert.deepEqual(resumed.level, maintenanceLevel(kind));
  }
});

test('the summit reward persists exactly, pays once without healing and rejoins the same boss stage', () => {
  for (const kind of ['piston', 'lift'] as const) {
    const g = fixture(kind);
    g.hp = 51;
    atGoal(g);
    assert.equal(g.mode, 'upgrade');
    const save = snapshot(g);
    assert(loadCheckpoint(save));
    const resumed = new Game();
    resumed.start(save.seed, loadCheckpoint(save)!);
    assert.equal(resumed.mode, 'upgrade');
    assert.deepEqual(resumed.offers, g.offers);
    assert.equal(resumed.player.position.y, -558);
    resumed.chooseMod(resumed.offers[0].id);
    assert.equal(resumed.stage, 3);
    assert.equal(resumed.mods.length, 1);
    assert.equal(resumed.hp, 51);
    assert(resumed.level.boss);
    assert(!resumed.detour && !resumed.maintenance.active);
    assert.deepEqual(resumed.detours, [0]);
    const after = snapshot(resumed);
    assert(loadCheckpoint(after));
    resumed.chooseMod(g.offers[0].id);
    assert.deepEqual(snapshot(resumed), after);
  }
});

test('Fold works on shaft walls and negative-height landings, but never attaches to a moving lift', () => {
  for (const kind of ['piston', 'lift'] as const) {
    const g = fixture(kind, 'portal'),
      exit = g.maintenance.exit;
    assert(g.portals.place({ x: 1000, y: 740 }));
    assert(g.portals.place({ x: exit.x, y: exit.floor }));
    Body.setPosition(g.player, { x: 1000, y: 710 });
    Body.setVelocity(g.player, { x: 0, y: 4 });
    for (let i = 0; i < 30 && g.player.position.y > 0; i++) tick(g);
    assert(g.player.position.y < -540);
    assert(!g.portals.canPlace);
    g.portals.reset();
    assert(g.portals.place({ x: 650, y: -380 }));
    if (kind === 'lift')
      assert(!g.portals.candidate({ x: 1000, y: g.hazards.items[0].body.position.y - 10 }));
  }
});

test('taking the service hatch pays the ordinary room upgrade before the shaft, while the lower exit skips it', () => {
  for (const enter of [false, true]) {
    const g = fixture();
    const s = snapshot(g);
    delete s.detour;
    s.mods = ['magnum', 'rapid'];
    delete s.missedUpgrades;
    g.start(s.seed, s);
    // Controlled room-clear fixture; shaft traversal is tested with inputs above.
    for (let i = 0; i < 400; i++) {
      for (const e of [...g.enemies]) {
        e.spawn = 0;
        g.hitEnemy(e, 99999);
      }
      g.hitStop = 0;
      g.time += 0.05;
      g.waves.update(0.05);
      if (!g.enemies.length && !g.waves.pending) break;
    }
    g.clear = true;
    g.openReward(enter);
    assert.equal(g.mode, 'upgrade');
    g.chooseMod(g.offers[0].id);
    assert.equal(g.mods.length, 3);
    assert.equal(g.stage, enter ? 2 : 3);
    assert.equal(g.maintenance.active, enter);
    assert(loadCheckpoint(snapshot(g)));
  }
});
