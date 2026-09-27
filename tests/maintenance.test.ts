import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Input } from '../src/game.ts';
import { getGun, loadCheckpoint, availableMods, type Checkpoint } from '../src/rules.ts';
import {
  planMaintenance,
  maintenanceLevel,
  shaftEntry,
  type MaintenanceKind,
} from '../src/maintenance.ts';
import { maintenanceTestFromUrl } from '../src/maintenance-test.ts';
import { dailyForDate } from '../src/daily.ts';
import { CRUSHER_TELL } from '../src/hazards.ts';

const { Body } = Matter;
function tick(g: Game, input: Partial<Input> = {}) {
  const p = g.player.position;
  g.tick(1 / 60, {
    left: false,
    right: false,
    jump: false,
    jumpHeld: true,
    fire: false,
    aim: { x: p.x, y: p.y + 500 },
    ...input,
  });
}
function fixture(kind: MaintenanceKind = 'piston', build = 'standard') {
  const save = maintenanceTestFromUrl(
    new URL(`https://test/?test=maintenance&layout=${kind}&build=${build}`),
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
// Real tick/input simulation: no teleport, healing, disabled hazards, altered
// gravity or forced completion. Shoot downward, coast to a landing, repeat.
function climb(g: Game) {
  let waypoint = 0,
    boost = true;
  for (let frame = 0; frame < 7200 && g.mode === 'playing'; frame++) {
    const p = g.player.position,
      t = g.level.route[waypoint];
    if (!t) {
      tick(g);
      continue;
    }
    if (Math.abs(p.x - t.x) < 50 && Math.abs(p.y - t.y) < 12 && g.grounded) {
      waypoint++;
      boost = true;
      continue;
    }
    let x = t.x;
    if (
      g.level.maintenance === 'piston' &&
      p.y > t.y + 25 &&
      ((t.x < 1000 && p.x < 985) || (t.x > 1000 && p.x > 1015))
    )
      x = 1000;
    if (p.y < t.y - 45) boost = false;
    if (p.y > t.y + 180) boost = true;
    const dx = x - p.x,
      vx = g.player.velocity.x;
    const dir = Math.abs(dx) < 5 ? -Math.sign(vx) : Math.sign(dx - vx * 5);
    tick(g, {
      left: dir < 0,
      right: dir > 0,
      jump: g.grounded,
      fire: boost && !g.grounded && p.y > t.y - 55 && g.player.velocity.y > -9,
    });
    assert(Number.isFinite(g.player.position.y));
  }
  return { waypoint, mode: g.mode, hp: g.hp, seconds: g.time, shots: g.shotCount };
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
  ])
    assert.equal(maintenanceTestFromUrl(new URL('https://test/?' + query)), null);
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
