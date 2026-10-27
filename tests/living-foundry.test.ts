import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Input } from '../src/game.ts';
import { LivingFoundryScenery } from '../src/living-foundry.ts';
import type { AreaId } from '../src/areas.ts';
import { quickShiftFromSeed } from '../src/quick-shift-rules.ts';
import { eventTestFromUrl } from '../src/area-events.ts';
import { loadCheckpoint, type Checkpoint } from '../src/rules.ts';
import {
  livingFoundryTestFromUrl,
  livingFoundryTestRoom,
  prepareLivingFoundryTest,
} from '../src/living-foundry-test.ts';

const zones: AreaId[] = ['docks', 'furnace', 'cooling', 'reclamation', 'rooftops'];
const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: false,
  fire: false,
  aim: { x: 1000, y: 500 },
};
function native(area: AreaId = 'docks', offset = 0, elapsed = 0) {
  const g = new Game();
  const cp: Checkpoint = {
    version: 6,
    seed: 'RF-C108-LIVING-NATIVE',
    stage: zones.indexOf(area) * 4 + offset,
    mods: [],
    hp: 100,
    kills: 0,
    elapsed,
  };
  assert(loadCheckpoint(cp));
  g.start(cp.seed, cp);
  assert.equal(g.level.area, area);
  return g;
}
function fixture(
  area: AreaId = 'docks',
  scene = 'reveal',
  variant = 0,
  mirror = false,
  state = 'powered',
) {
  const spec = livingFoundryTestFromUrl(
    new URL(
      'https://example.test/?test=living-foundry&zone=' +
        area +
        '&scene=' +
        scene +
        '&variant=' +
        variant +
        '&mirror=' +
        Number(mirror) +
        '&state=' +
        state +
        '&v=1',
    ),
  )!;
  assert(spec);
  const g = new Game();
  g.startTest(spec.checkpoint, livingFoundryTestRoom(spec));
  assert(prepareLivingFoundryTest(g, spec));
  return g;
}
function advance(g: Game, scenery: LivingFoundryScenery, frames = 12, reduced = false) {
  let value = scenery.update(g, reduced);
  for (let i = 0; i < frames; i++) {
    g.tick(1 / 60, idle);
    value = scenery.update(g, reduced);
  }
  return value!;
}

test('five native districts project distinct read-only scenes with bounded service fields', () => {
  for (const area of zones) {
    const g = native(area),
      scenery = new LivingFoundryScenery();
    const f = scenery.update(g)!;
    assert(f, area);
    assert.equal(f.area, area);
    assert([0, 1, 2].includes(f.variant));
    assert.equal(f.power, 1);
    for (const key of ['coolant', 'salvage', 'wind', 'reveal'] as const)
      assert(f[key] >= 0 && f[key] <= 1);
    if (area === 'cooling') assert(f.coolant > 0);
    if (area === 'reclamation') assert(f.salvage > 0);
    if (area === 'rooftops') assert(f.wind > 0);
  }
});

test('first room architecture follows exploration, never idle time, and cannot close on backtracking', () => {
  const g = native(),
    scenery = new LivingFoundryScenery();
  assert.equal(scenery.update(g)!.reveal, 0);
  assert.equal(
    advance(g, scenery, 90).reveal,
    0,
    'waiting at spawn never starts an automatic cinematic',
  );
  Matter.Body.setPosition(g.player, { x: 395, y: 722 });
  const half = scenery.update(g)!;
  assert(half.reveal > 0 && half.reveal < 1);
  assert(half.revealing);
  Matter.Body.setPosition(g.player, { x: 180, y: 722 });
  assert.equal(scenery.update(g)!.reveal, half.reveal);
  Matter.Body.setPosition(g.player, { x: 650, y: 722 });
  const open = scenery.update(g)!;
  assert.equal(open.reveal, 1);
  assert.equal(open.revealing, false);
  Matter.Body.setPosition(g.player, { x: 140, y: 722 });
  assert.equal(scenery.update(g)!.reveal, 1);
});

test('ordinary mid-zone rooms and Continue begin open without replaying an entry', () => {
  for (const area of zones) {
    const g = native(area, 1, 600),
      scenery = new LivingFoundryScenery();
    const f = scenery.update(g)!;
    assert.equal(f.reveal, 1, area);
    assert.equal(f.revealing, false);
    assert.equal(f.motion, 0, 'a saved elapsed value never becomes a giant first-frame phase jump');
  }
});

test('Pause and intermission freeze every frame value and discard any paused time gap', () => {
  const g = native(),
    scenery = new LivingFoundryScenery();
  Matter.Body.setPosition(g.player, { x: 330, y: 722 });
  const before = advance(g, scenery);
  assert(before.motion > 0);
  g.setMode('paused');
  g.elapsed += 10;
  Matter.Body.setPosition(g.player, { x: 620, y: 722 });
  assert.deepEqual(scenery.update(g), before);
  g.setMode('upgrade');
  assert.deepEqual(scenery.update(g), before);
  Matter.Body.setPosition(g.player, { x: 330, y: 722 });
  g.setMode('playing');
  const resumed = scenery.update(g)!;
  assert.equal(resumed.motion, before.motion);
  assert.equal(resumed.time, before.time);
  assert.equal(resumed.reveal, before.reveal);
  assert(advance(g, scenery, 2).motion > before.motion);
});

test('reduced effects retain architecture and exploration while all decorative clocks stay still', () => {
  const g = fixture('cooling'),
    scenery = new LivingFoundryScenery();
  const before = scenery.update(g, true)!;
  const later = advance(g, scenery, 45, true);
  assert.equal(later.time, before.time);
  assert.equal(later.motion, before.motion);
  assert(later.coolant > 0);
  Matter.Body.setPosition(g.player, { x: 650, y: 722 });
  assert.equal(scenery.update(g, true)!.reveal, 1);
  const normal = scenery.update(g, false)!;
  assert.equal(normal.motion, before.motion, 'enabling motion cannot replay the reduced interval');
  assert(advance(g, scenery, 2).motion > normal.motion);
});

test('live blackout freezes motors until the native persistent fuse is successfully shot', () => {
  const g = new Game();
  g.startTest(eventTestFromUrl(new URL('https://example.test/?test=events&event=blackout'))!);
  const scenery = new LivingFoundryScenery(),
    box = g.areaEvents.fuseBox!;
  assert(box);
  assert.equal(scenery.update(g)!.power, 0);
  assert.equal(advance(g, scenery, 30).motion, 0);
  const time = scenery.update(g)!.time;
  assert(time > 0);
  g.areaEvents.hitFuse(box, 1, false);
  assert.equal(scenery.update(g)!.power, 0);
  g.areaEvents.hitFuse(box, 1, true);
  const restored = scenery.update(g)!;
  assert.equal(restored.power, 1);
  assert.equal(restored.motion, 0, 'restoration does not replay powerless seconds');
  assert(g.props.items.includes(box));
  assert(advance(g, scenery, 4).motion > 0);
});

test('a real local disconnect cuts only its room; unrelated disabled circuits do not stop the district', () => {
  const g = native('furnace'),
    scenery = new LivingFoundryScenery();
  g.shutdown.state = { disabled: [8] };
  assert.equal(scenery.update(g)!.power, 1, 'a later circuit is unrelated');
  const before = advance(g, scenery);
  g.shutdown.state = { disabled: [4] };
  const cut = scenery.update(g)!;
  assert.equal(cut.power, 0);
  assert.equal(cut.motion, before.motion);
  assert.equal(advance(g, scenery).motion, before.motion);
  g.stage = 5;
  g.loadRoom();
  assert.equal(scenery.update(g)!.power, 1);
  assert.equal(scenery.update(g)!.motion, before.motion);
});

test('successful Core sabotage stops environmental services without inventing a total electricity loss', () => {
  for (const area of ['cooling', 'reclamation', 'rooftops'] as const) {
    const g = fixture(area, 'machinery', 0, false, 'sabotaged');
    assert(g.uprising.active);
    const scenery = new LivingFoundryScenery();
    const f = scenery.update(g)!;
    assert.equal(f.power, 1, area + ' still has independent supply');
    assert.equal(f.coolant, 0);
    assert.equal(f.wind, 0);
    if (area === 'reclamation')
      assert(f.salvage > 0, 'belts and magnets are not the cut hazard circuit');
    assert(advance(g, scenery, 3).motion > f.motion);
  }
});

test('real belt, magnet, vent and fan states change only their bounded visual service projection', () => {
  const g = fixture('reclamation', 'machinery'),
    scenery = new LivingFoundryScenery();
  const base = scenery.update(g)!;
  g.conveyors.items = [{ x: 500, y: 740, w: 300, speed: 2 }];
  assert(scenery.update(g)!.salvage > base.salvage);
  g.conveyors.items = [];
  g.pressure.spawn({
    x: 900,
    y: 738,
    dir: { x: 0, y: -1 },
    valve: { x: 850, y: 714 },
    width: 90,
    length: 500,
    offset: 0,
  });
  g.pressure.items[0].phase = 'burst';
  assert(scenery.update(g)!.coolant > base.coolant);
  g.pressure.items[0].phase = 'ready';
  g.magnets.items = [{ x: 1000, y: 300, floor: 740, offset: 0, phase: 'lift', held: null }];
  assert(scenery.update(g)!.salvage > base.salvage);
  g.magnets.items[0].phase = 'rest';
  assert.equal(scenery.update(g)!.salvage, base.salvage);
  g.crosswind.items = [
    {
      x: 1000,
      y: 730,
      dir: { x: 0, y: -1 },
      width: 150,
      length: 600,
      offset: 0,
      phase: 'gust',
      timer: 1,
      rotation: 0,
    },
  ];
  assert(scenery.update(g)!.wind > base.wind);
  assert.equal(scenery.update(g)!.power, 1);
  g.clear = true;
  assert.equal(scenery.update(g)!.power, 1, 'clearing a patrol is not a factory power switch');
});

test('requested fixture variants and already-open machinery scenes survive deterministic hashing', () => {
  for (const area of zones)
    for (let variant = 0; variant < 3; variant++) {
      const g = fixture(area, 'machinery', variant),
        scenery = new LivingFoundryScenery();
      const f = scenery.update(g)!;
      assert.equal(f.variant, variant);
      assert.equal(f.reveal, 1);
      assert.equal(f.revealing, false);
    }
});

test('mirrored inspection entries explore inward while native mirrored Campaign still explores rightward', () => {
  const g = fixture('docks', 'reveal', 2, true),
    scenery = new LivingFoundryScenery();
  assert.equal(g.player.position.x, 1860);
  assert.equal(scenery.update(g)!.reveal, 0);
  Matter.Body.setPosition(g.player, { x: 1605, y: 722 });
  assert(scenery.update(g)!.reveal > 0);
  Matter.Body.setPosition(g.player, { x: 1350, y: 722 });
  assert.equal(scenery.update(g)!.reveal, 1);
  const campaign = native();
  campaign.level.mirrored = true;
  const normal = new LivingFoundryScenery();
  assert.equal(normal.update(campaign)!.reveal, 0);
  Matter.Body.setPosition(campaign.player, { x: 650, y: 722 });
  assert.equal(normal.update(campaign)!.reveal, 1);
});

test('variant identity is repeatable, independent of frame rate and consumes no game randomness', () => {
  const seen = new Set<number>();
  for (let i = 0; i < 24; i++) {
    const g = native();
    g.seed = 'RF-C108-LIVING-' + i;
    const a = new LivingFoundryScenery(),
      b = new LivingFoundryScenery();
    let draws = 0;
    g.rng = () => {
      draws++;
      throw new Error('Scenery cannot draw combat randomness');
    };
    const first = a.update(g)!;
    for (let j = 0; j < 10; j++) assert.equal(a.update(g)!.variant, first.variant);
    assert.equal(b.update(g)!.variant, first.variant);
    seen.add(first.variant);
    assert.equal(draws, 0);
  }
  assert.equal(seen.size, 3);
});

test('projection does not mutate checkpoints, physics, entities, level data or award/audio callbacks', () => {
  const g = fixture('cooling', 'combat'),
    scenery = new LivingFoundryScenery();
  let effects = 0;
  g.onCheckpoint = () => effects++;
  g.onSound = () => effects++;
  g.onBossDefeated = () => effects++;
  g.onEnemyDefeated = () => effects++;
  g.onCommendation = () => effects++;
  const data = () =>
    JSON.stringify({
      level: g.level,
      stage: g.stage,
      seed: g.seed,
      elapsed: g.elapsed,
      time: g.time,
      mode: g.mode,
      hp: g.hp,
      mods: g.mods,
      kills: g.kills,
      testRun: g.testRun,
      event: g.areaEvents.state,
      uprising: g.uprising.run,
      report: g.combatReport.snapshot(),
      bodies: Matter.Composite.allBodies(g.engine.world).map((body) => ({
        id: body.id,
        position: body.position,
        velocity: body.velocity,
        angle: body.angle,
        force: body.force,
        static: body.isStatic,
      })),
    });
  const before = data();
  const rng = g.rng;
  g.rng = () => {
    throw new Error('No RNG draws');
  };
  for (let i = 0; i < 50; i++) scenery.update(g, i % 2 === 0);
  assert.equal(data(), before);
  assert.equal(effects, 0);
  assert.notEqual(g.rng, rng, 'controller did not replace the supplied RNG sentinel');
});

test('specialized staging is excluded rather than covered by a generic district projection', () => {
  const g = native('cooling');
  const source = structuredClone(g.level);
  for (const [key, value] of [
    ['maintenance', 'pressure'],
    ['recoilTrial', 'launch'],
    ['annex', true],
    ['freight', true],
    ['crossing', true],
    ['shutdown', true],
    ['story', 'inspection'],
    ['sortingPit', 'audit'],
    ['uprising', 'railworks'],
    ['uprising', 'core'],
  ] as const) {
    g.level = { ...structuredClone(source), [key]: value } as never;
    assert.equal(new LivingFoundryScenery().update(g), null, key);
  }
  g.level = source;
  g.stage = 19;
  assert.equal(new LivingFoundryScenery().update(g), null);
  g.stage = 8;
  g.workshop.active = true;
  assert.equal(new LivingFoundryScenery().update(g), null);
});

test('room changes preserve powered phase, ordinary rooms stay open and a new run resets reveal history', () => {
  const g = native(),
    scenery = new LivingFoundryScenery();
  Matter.Body.setPosition(g.player, { x: 650, y: 722 });
  const prior = advance(g, scenery);
  g.stage = 1;
  g.loadRoom();
  const next = scenery.update(g)!;
  assert.equal(next.motion, prior.motion);
  assert.equal(next.reveal, 1);
  g.setMode('title');
  assert.equal(scenery.update(g), null);
  g.start('RF-C108-LIVING-NATIVE');
  const fresh = scenery.update(g)!;
  assert.equal(fresh.reveal, 0);
  assert.equal(fresh.motion, 0);
  scenery.reset();
  assert.equal(scenery.update(g)!.motion, 0);
});

test('corrupt or delayed simulation samples cannot make clocks or intensities unbounded or nonfinite', () => {
  const g = fixture('rooftops'),
    scenery = new LivingFoundryScenery();
  scenery.update(g);
  for (const value of [1e50, Infinity, NaN, -1, 1e50, 1e50 + 10, 0, 0.1]) {
    g.elapsed = value;
    const frame = scenery.update(g)!;
    for (const v of Object.values(frame)) if (typeof v === 'number') assert(Number.isFinite(v));
    assert(frame.time <= 1e6 && frame.time >= 0);
    assert(frame.motion <= 1e6 && frame.motion >= 0);
    assert(frame.wind <= 1 && frame.wind >= 0);
  }
});

test('returned frames cannot mutate the controller, including frozen Pause copies', () => {
  const g = native(),
    scenery = new LivingFoundryScenery();
  const a = scenery.update(g)!;
  a.reveal = 1;
  a.motion = 900;
  assert.equal(scenery.update(g)!.reveal, 0);
  g.setMode('paused');
  const b = scenery.update(g)!;
  b.motion = 1000;
  assert.equal(scenery.update(g)!.motion, 0);
});

test('Quick Shift reveals the actual first occurrence of a district, not its compressed stage number', () => {
  const g = new Game(),
    scenery = new LivingFoundryScenery();
  assert(g.quickShift.begin(quickShiftFromSeed('RF-Q1-QUICK531')!, 'pistol'));
  const choose = () => {
    while (g.quickShift.state!.phase === 'draft')
      assert(g.quickShift.chooseMod(g.quickShift.state!.offers[0]));
    if (g.quickShift.state!.phase === 'route') assert(g.quickShift.chooseRoute('high'));
  };
  const clear = () => {
    for (let i = 0; i < 7000 && g.quickShift.state!.phase === 'fight'; i++) {
      g.hp = 100;
      if (g.clear) Matter.Body.setPosition(g.player, { x: 1920, y: 722 });
      for (const e of [...g.enemies]) if (e.spawn <= 0) g.hitEnemy(e, 100000);
      g.tick(1 / 60, idle);
    }
    assert.equal(g.quickShift.state!.phase, 'draft');
  };
  choose();
  assert.equal(scenery.update(g)!.reveal, 0);
  clear();
  choose();
  assert.equal(g.stage, 4);
  assert.equal(g.level.area, 'reclamation');
  assert.equal(scenery.update(g)!.reveal, 0);
  clear();
  choose();
  assert.equal(g.level.area, 'reclamation');
  assert.equal(
    scenery.update(g)!.reveal,
    1,
    'a second room in the same district never replays the reveal',
  );
});

test('legacy Campaign and Daily scenes remain a visual projection without gameplay revisions', () => {
  for (const seed of ['LEGACY-FOUND', 'RF-D78-2026-09-01', 'RF-D91-2026-10-27']) {
    const g = new Game();
    g.start(seed, { version: 5, seed, stage: 1, hp: 100, mods: [], kills: 0, elapsed: 20 });
    const before = JSON.stringify(g.level),
      gun = JSON.stringify(g.gun);
    const f = new LivingFoundryScenery().update(g);
    if (g.level.crossing || g.level.freight)
      assert.equal(f, null, 'special transit staging stays native');
    else {
      assert(f);
      assert.equal(f.reveal, 1);
    }
    assert.equal(JSON.stringify(g.level), before);
    assert.equal(JSON.stringify(g.gun), gun);
    assert.equal(g.seed, seed);
  }
});
