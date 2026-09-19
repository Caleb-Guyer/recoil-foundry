import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Enemy, type Input } from '../src/game.ts';
import { loadCheckpoint, type Checkpoint } from '../src/rules.ts';
import { testCheckpoint } from '../src/practice.ts';
import { dailyForDate } from '../src/daily.ts';
import {
  COMMENDATIONS,
  loadCommendations,
  mergeCommendations,
  commendationPreviewLink,
  type CommendationId,
} from '../src/commendations.ts';
import { GUN_FINISHES, OUTFITS, loadCosmetics } from '../src/cosmetics.ts';
import { logbookEntries, loadLogbook } from '../src/logbook.ts';
import { logbookArticle } from '../src/logbook-menu.ts';

function setup(stage = 3, seed = 'commendations') {
  const g = new Game();
  const awards: CommendationId[] = [];
  g.onCommendation = (id) => awards.push(id);
  g.start(seed, { ...testCheckpoint(seed, stage), cleanBoss: true });
  return { g, awards };
}
function empty(g: Game) {
  for (const e of g.enemies) {
    Matter.Composite.remove(g.engine.world, e.body);
    if (e.crane) Matter.Composite.remove(g.engine.world, e.crane.body);
  }
  g.enemies = [];
  g.waves.clear();
  g.hazards.clear();
  g.breaches.clear();
  g.areaEvents.clear();
  g.mutations.clear();
  g.courier.clear();
  g.fabricators.clear();
  for (const p of [...g.props.items]) g.props.remove(p);
  for (const b of g.terrain.slice(4)) Matter.Composite.remove(g.engine.world, b);
  g.terrain = g.terrain.slice(0, 4);
}
function boss(g: Game) {
  empty(g);
  g.spawnEnemy('loader', 1000, 600);
  const e = g.enemies.at(-1)!;
  e.spawn = 0;
  e.hp = 1;
  e.state = 'recover';
  return e;
}
function step(g: Game, frames: number) {
  const input: Input = {
    left: false,
    right: false,
    jump: false,
    jumpHeld: false,
    fire: false,
    aim: { x: 600, y: 500 },
  };
  for (let i = 0; i < frames; i++) g.tick(1 / 60, input);
}

test('commendations validate and merge persistent IDs; rewards only equip with their own unlock', () => {
  assert.deepEqual(loadCommendations({ version: 1 }), []);
  assert.deepEqual(loadCommendations(['clean-work', 'fake', null, 'clean-work']), ['clean-work']);
  assert.deepEqual(mergeCommendations(['heavy-equipment'], ['clean-work', 'after-hours']), [
    'clean-work',
    'heavy-equipment',
    'after-hours',
  ]);
  for (const gun of Object.keys(GUN_FINISHES))
    for (const outfit of Object.keys(OUTFITS)) {
      assert.deepEqual(loadCosmetics({ gun, outfit }, []), { gun: 'standard', outfit: 'standard' });
      assert.deepEqual(
        loadCosmetics(
          { gun, outfit },
          COMMENDATIONS.map((c) => c.id),
        ),
        { gun, outfit },
      );
    }
  assert.deepEqual(loadCosmetics({ gun: 'mirror', outfit: 'rigger' }, ['heavy-equipment']), {
    gun: 'standard',
    outfit: 'rigger',
  });
  assert.deepEqual(loadCosmetics({ gun: '__proto__', outfit: 'constructor' }, []), {
    gun: 'standard',
    outfit: 'standard',
  });
});

test('locked commendations expose objectives and rewards, but only earned reports are rendered', () => {
  const locked = logbookEntries([], loadLogbook(null)).filter((e) => e.section === 'commendations');
  assert.equal(locked.length, 4);
  for (const entry of locked) {
    const html = logbookArticle(entry, () => '');
    assert(html.includes(entry.description));
    assert(html.includes('Report not yet filed'));
    assert(!html.includes(entry.lore[0]));
    assert(!html.includes('Open Appearance'));
  }
  const earned = logbookEntries([], loadLogbook(null), ['clean-work']);
  const clean = earned.find((e) => e.id === 'commendation:clean-work')!;
  assert(logbookArticle(clean, () => '').includes(clean.lore[0]));
  assert.equal(earned.filter((e) => e.earned).length, 1);
});

test('preview links are strict and cannot be combined with campaign or Daily parameters', () => {
  const link = (q: string) => commendationPreviewLink(new URL('https://example.test/?' + q));
  assert(link('test=commendations&v=2.90.0'));
  for (const q of [
    'test=commendations&seed=x',
    'test=commendations&daily=2026-09-18',
    'test=commendations&test=commendations',
    'test=commendations&room=boss',
    'test=logbook',
  ])
    assert(!link(q), q);
});

test('a clean boss defeat awards once, including legitimate Daily runs', () => {
  for (const seed of ['commendations', dailyForDate('2026-09-18')!.seed]) {
    const { g, awards } = setup(3, seed);
    const e = boss(g);
    g.hitEnemy(e, 9999);
    g.hitEnemy(e, 9999);
    assert.deepEqual(awards, ['clean-work']);
    g.loadRoom();
    const again = boss(g);
    g.hitEnemy(again, 9999);
    assert.deepEqual(awards, ['clean-work']);
  }
});

test('accepted damage disqualifies Clean Work even after healing and checkpoint reload', () => {
  const { g, awards } = setup();
  let saved: Checkpoint | null = null;
  g.onCheckpoint = (s) => {
    if (s) saved = s;
  };
  g.damagePlayer(10);
  assert(saved);
  assert.equal((saved as Checkpoint).cleanBoss, false);
  g.hp = 100;
  g.hitEnemy(boss(g), 9999);
  assert.deepEqual(awards, []);
  const resumed = new Game();
  resumed.onCommendation = (id) => awards.push(id);
  resumed.start(g.seed, loadCheckpoint(saved)!);
  assert.equal(resumed.commendations.cleanBoss, false);
  resumed.hitEnemy(boss(resumed), 9999);
  assert.deepEqual(awards, []);
  resumed.stage = 7;
  resumed.loadRoom();
  resumed.hitEnemy(boss(resumed), 9999);
  assert.deepEqual(awards, ['clean-work']);
});

test('old checkpoints do not invent clean-room evidence; clean new checkpoints preserve it', () => {
  const { g, awards } = setup();
  const save = testCheckpoint('old-commendation-save', 3);
  g.start(save.seed, save);
  g.hitEnemy(boss(g), 9999);
  assert.deepEqual(awards, []);
  g.stage = 7;
  g.loadRoom();
  let snapshot: Checkpoint | null = null;
  g.onCheckpoint = (s) => {
    snapshot = s;
  };
  g.save();
  assert.equal((snapshot as Checkpoint | null)?.cleanBoss, true);
  g.start(g.seed, snapshot!);
  g.hitEnemy(boss(g), 9999);
  assert.deepEqual(awards, ['clean-work']);
  assert.equal(loadCheckpoint({ ...save, cleanBoss: 'true' }), null);
});

test('invulnerability and zero damage do not disqualify an otherwise clean boss fight', () => {
  const { g, awards } = setup();
  g.hurtAt = g.time;
  g.damagePlayer(20);
  assert.equal(g.hp, 100);
  g.time += 1;
  g.damagePlayer(0);
  g.hitEnemy(boss(g), 9999);
  assert.deepEqual(awards, ['clean-work']);
});

test('Return to Sender requires an actual reflected killing projectile, not having Countershot', () => {
  const { g, awards } = setup();
  const e = boss(g);
  g.damagePlayer(1);
  g.addShot({
    pos: { x: 910, y: 600 },
    vel: { x: -20, y: 0 },
    source: { ...e.body.position },
    damage: 20,
    life: 1,
    friendly: false,
    radius: 3,
    bounces: 0,
    pierce: 0,
    fragment: false,
    split: false,
  });
  const s = g.shots.at(-1)!;
  assert(g.ballistics.reflectRound(s, s.pos));
  g.time += 1 / 60;
  g.updateShots(0.1);
  assert(e.hp <= 0);
  assert.deepEqual(awards, ['return-to-sender']);
  const other = setup();
  other.g.mods.push('countershot');
  other.g.damagePlayer(1);
  other.g.hitEnemy(boss(other.g), 9999);
  assert.deepEqual(other.awards, []);
});

test('spawn invulnerability, uncredited kills and boss cleanup cannot earn commendations', () => {
  for (const reason of ['spawn', 'uncredited', 'cleanup', 'dead'] as const) {
    const { g, awards } = setup();
    const e = boss(g);
    if (reason === 'spawn') e.spawn = 1;
    if (reason === 'dead') g.hp = 0;
    g.hitEnemy(
      e,
      9999,
      undefined,
      true,
      true,
      reason !== 'uncredited',
      reason === 'cleanup' ? 'cleanup' : 'reflection',
    );
    assert.deepEqual(awards, [], reason);
  }
});

test('one real falling cargo load can crush three enemies and earn Heavy Equipment', () => {
  const { g, awards } = setup(2);
  empty(g);
  const load = g.cargo.spawn({ x: 800, y: 390, anchorY: 110 });
  const victims: Enemy[] = [];
  for (const x of [764, 800, 836]) {
    g.spawnEnemy('runner', x, 723);
    const e = g.enemies.at(-1)!;
    e.spawn = 0;
    e.timer = 100;
    victims.push(e);
  }
  // Stop enemy AI only: retain gravity, hull contacts, impact callbacks and damage.
  g.updateEnemy = () => {};
  g.cargo.cut(load, 48);
  step(g, 150);
  assert(
    victims.every((e) => e.hp <= 0),
    JSON.stringify({
      victims: victims.map((e) => ({ hp: e.hp, pos: e.body.position })),
      load: load.body.position,
      mode: g.mode,
      awards,
    }),
  );
  assert.deepEqual(awards, ['heavy-equipment']);
});

test('separate loads, later pushes and secondary explosions cannot combine into a three-kill drop', () => {
  for (const reason of ['separate', 'landed', 'secondary'] as const) {
    const { g, awards } = setup(2);
    empty(g);
    const a = g.cargo.spawn({ x: 800, y: 400, anchorY: 110 });
    const b = g.cargo.spawn({ x: 1200, y: 400, anchorY: 110 });
    a.cargo!.state = b.cargo!.state = 'loose';
    a.velocity = b.velocity = { x: 0, y: 12 };
    for (let i = 0; i < 3; i++) {
      g.spawnEnemy('runner', 800, 600);
      const e = g.enemies.at(-1)!;
      e.spawn = 0;
      if (reason === 'landed' && i === 2) a.cargo!.dropEndedAt = g.time - 1;
      if (reason === 'secondary' && i === 2) g.hitEnemy(e, 9999);
      else g.cargo.impact(reason === 'separate' && i === 2 ? b : a, e.body, 12);
    }
    assert.deepEqual(awards, [], reason);
  }
});

test('After Hours awards only when the Overtime extraction actually completes', () => {
  for (const overtime of [false, true]) {
    const { g, awards } = setup(19);
    if (overtime) g.overtime = { baseMods: g.mods.length, repairs: 0 };
    g.loadRoom(true);
    assert(g.escape);
    g.escape.phase = 'extracting';
    step(g, 1);
    assert.deepEqual(awards, []);
    step(g, 600);
    assert.equal(g.mode, 'won');
    assert.deepEqual(awards, overtime ? ['after-hours'] : []);
  }
});

test('Practice, Workshop and test presets cannot award any commendation', () => {
  for (const mode of ['practice', 'workshop', 'test'] as const) {
    const { g, awards } = setup();
    if (mode === 'practice') g.startPractice({ kind: 'loader', seed: 'LOADER-SHIFT-5' });
    if (mode === 'test') g.startTest(testCheckpoint('test-commendations', 3));
    if (mode === 'workshop') g.startWorkshop([]);
    g.commendations.cleanBoss = true;
    g.hitEnemy(boss(g), 9999, undefined, true, true, true, 'reflection');
    for (const c of COMMENDATIONS) g.commendations.award(c.id);
    assert.deepEqual(awards, [], mode);
  }
});
