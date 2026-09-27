import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Shot } from '../src/game.ts';
import { welderTestFromUrl } from '../src/welder-test.ts';
import { WELD_TELL } from '../src/welder.ts';
import { getGun } from '../src/rules.ts';
import { COMMENDATIONS_KEY, type CommendationId } from '../src/commendations.ts';
import { COSMETICS_KEY, loadCosmetics } from '../src/cosmetics.ts';
import { ProgressStore, parseProgressBackup } from '../src/progress.ts';
import { logbookEntries, loadLogbook } from '../src/logbook.ts';

function arena() {
  const g = new Game();
  const save = welderTestFromUrl(new URL('https://test/?test=welder'))!;
  g.start(save.seed, save);
  for (const e of g.enemies) Matter.Composite.remove(g.engine.world, e.body);
  g.enemies = [];
  g.waves.clear();
  g.hazards.clear();
  g.mutations.clear();
  for (const b of [...g.terrain])
    if (b.bounds.min.y < 739 && b.bounds.min.x >= 0 && b.bounds.max.x <= 2000) {
      Matter.Composite.remove(g.engine.world, b);
      g.terrain = g.terrain.filter((t) => t !== b);
    }
  for (const p of [...g.props.items]) g.props.remove(p);
  const e = g.spawnEnemy('welder', 1100, 710);
  e.spawn = 0;
  e.state = 'recover';
  Matter.Body.setPosition(g.player, { x: 700, y: 721 });
  const awards: CommendationId[] = [];
  g.onCommendation = (id) => awards.push(id);
  const deploy = () => {
    g.welder.planBarriers(e);
    g.welder.update(WELD_TELL);
    return g.props.items.filter((p) => p.welded);
  };
  return { g, e, deploy, awards };
}
const friendly = { friendly: true } as Shot;
const destroy = (g: Game, p: ReturnType<Game['props']['spawn']>) =>
  g.props.hit(p, 120, { x: 1, y: 0 }, friendly);

test('Hot Work requires both actual walls in one deployment and the subsequent credited victory', () => {
  const { g, e, deploy, awards } = arena();
  const walls = deploy();
  assert.equal(walls.length, 2);
  destroy(g, walls[0]);
  destroy(g, walls[0]);
  assert.deepEqual(awards, []);
  destroy(g, walls[1]);
  assert.deepEqual(awards, []);
  // A later attack does not erase a completed pair in the same fight.
  deploy();
  g.hitEnemy(e, 10000);
  g.hitEnemy(e, 10000);
  assert.deepEqual(awards, ['hot-work']);
});

test('separate deployments and a cancelled second warning never combine', () => {
  for (const cancelled of [false, true]) {
    const { g, e, deploy, awards } = arena();
    const first = deploy();
    destroy(g, first[0]);
    if (cancelled) Matter.Body.setPosition(g.player, { ...first[1].body.position });
    const second = deploy();
    assert.equal(second.length, cancelled ? 1 : 2);
    destroy(g, second.at(-1)!);
    g.hitEnemy(e, 10000);
    assert.deepEqual(awards, []);
  }
});

test('expiry, cleanup, hostile fire, allied fire and machinery cannot satisfy the pair', () => {
  for (const reason of ['expired', 'removed', 'hostile', 'allied', 'contact', 'train'] as const) {
    const { g, e, deploy, awards } = arena();
    const [a, b] = deploy();
    destroy(g, a);
    if (reason === 'expired') {
      g.time = b.expires!;
      destroy(g, b); // Even an expiry-frame hit cannot revive an expired wall.
    } else if (reason === 'removed') g.props.remove(b);
    else if (reason === 'hostile') g.props.hit(b, 120, { x: 1, y: 0 }, { friendly: false } as Shot);
    else if (reason === 'allied')
      g.props.hit(b, 120, { x: 1, y: 0 }, { friendly: true, allied: true } as Shot);
    else if (reason === 'contact') g.props.strike(b, 120, { x: 1, y: 0 });
    else g.props.break(b);
    g.hitEnemy(e, 10000);
    assert.deepEqual(awards, [], reason);
  }
});

test('death, room reload, cleanup kill and uncredited victory cannot complete Hot Work', () => {
  for (const reason of ['death', 'reload', 'cleanup', 'uncredited'] as const) {
    const { g, e, deploy, awards } = arena();
    for (const wall of deploy()) destroy(g, wall);
    if (reason === 'death') {
      g.hp = 0;
      g.setMode('dead');
    }
    if (reason === 'reload') g.loadRoom();
    g.hitEnemy(
      e,
      10000,
      undefined,
      false,
      false,
      reason !== 'uncredited',
      reason === 'cleanup' ? 'cleanup' : undefined,
    );
    assert.deepEqual(awards, [], reason);
  }
});

test('Practice, tests and Workshop cannot bank barricade progress for a later real award', () => {
  for (const mode of ['practice', 'test', 'workshop'] as const) {
    const { g, e, deploy, awards } = arena();
    if (mode === 'test') g.testRun = welderTestFromUrl(new URL('https://test/?test=welder'))!;
    if (mode === 'practice') g.practice = { kind: 'welder', seed: g.seed };
    if (mode === 'workshop') g.workshop.active = true;
    for (const p of deploy()) destroy(g, p);
    g.testRun = null;
    g.practice = null;
    g.workshop.active = false;
    g.hitEnemy(e, 10000);
    assert.deepEqual(awards, [], mode);
  }
});

test('a partial pair cannot survive Continue into a different deployment', () => {
  const { g, deploy } = arena();
  destroy(g, deploy()[0]);
  let snapshot: any;
  g.onCheckpoint = (s) => {
    snapshot = s;
  };
  g.save();
  g.start(g.seed, snapshot);
  assert(g.level.spawns.some((e) => e.kind === 'welder'));
  const e = g.spawnEnemy('welder', 1100, 710);
  e.spawn = 0;
  const awards: CommendationId[] = [];
  g.onCommendation = (id) => awards.push(id);
  g.hitEnemy(e, 10000);
  assert.deepEqual(awards, []);
});

test('primary rounds, beams, steel balls and player explosions all count real wall destruction', () => {
  for (const weapon of ['round', 'beam', 'ball', 'blast'] as const) {
    const { g, e, deploy, awards } = arena();
    const walls = deploy();
    for (const wall of walls) {
      if (weapon === 'round') {
        g.addShot({
          pos: { x: wall.body.position.x - 60, y: 700 },
          vel: { x: 20, y: 0 },
          damage: 120,
          friendly: true,
          life: 1,
          radius: 3,
          bounces: 0,
          pierce: 0,
          fragment: false,
          split: false,
        });
        g.updateShots(0.05);
      } else if (weapon === 'beam') {
        g.mods = ['cutting-torch'];
        g.gun = getGun(g.mods);
        Matter.Body.setPosition(g.player, { x: wall.body.position.x - 80, y: 700 });
        g.aim = { ...wall.body.position };
        for (let i = 0; i < 120 && g.props.items.includes(wall); i++) {
          g.time += 1 / 60;
          g.torch.beforeStep(1 / 60, true);
          g.torch.afterStep(1 / 60);
        }
      } else if (weapon === 'ball') {
        g.massDriver.hitProp(
          {
            ...friendly,
            massDriver: true,
            damage: 150,
            vel: { x: 20, y: 0 },
            pos: wall.body.position,
          } as Shot,
          wall,
          { x: -1, y: 0 },
        );
      } else {
        g.demolition.detonate({
          pos: { x: wall.body.position.x - 20, y: 700 },
          damage: 180,
          radius: 50,
          launch: 0,
          kind: 'shell',
        });
      }
      assert(!g.props.items.includes(wall), weapon);
    }
    g.hitEnemy(e, 10000);
    assert.deepEqual(awards, ['hot-work'], weapon);
  }
});

test('only player-triggered canister chains count, not enemy-triggered explosions', () => {
  for (const player of [true, false]) {
    const { g, e, deploy, awards } = arena();
    for (const wall of deploy()) {
      wall.hp = 70;
      const fuel = g.props.spawn('canister', wall.body.position.x - 30, 710);
      g.props.hit(fuel, 1, { x: 0, y: 0 }, { friendly: player } as Shot);
      g.props.explode(fuel);
      assert(!g.props.items.includes(wall));
    }
    g.hitEnemy(e, 10000);
    assert.deepEqual(awards, player ? ['hot-work'] : []);
  }
});

test('Hot Work unlocks both cosmetics and its report, and survives backup/restore and reload', async () => {
  const memory = new Map<string, string>();
  const disk = {
    getItem: (k: string) => memory.get(k) ?? null,
    setItem: (k: string, v: string) => {
      memory.set(k, v);
    },
    removeItem: (k: string) => {
      memory.delete(k);
    },
  };
  const store = new ProgressStore(() => disk);
  const pair = { gun: 'kiln', outfit: 'forgehand' } as const;
  assert.deepEqual(loadCosmetics(pair, []), { gun: 'standard', outfit: 'standard' });
  assert.deepEqual(loadCosmetics(pair, ['hot-work']), pair);
  await store.write(COMMENDATIONS_KEY, ['hot-work']);
  await store.write(COSMETICS_KEY, pair);
  const backup = parseProgressBackup(store.backup('3.9.1'));
  assert(await store.restore(backup));
  const loaded = new ProgressStore(() => disk);
  assert.deepEqual(loaded.read(COMMENDATIONS_KEY), ['hot-work']);
  assert.deepEqual(loaded.read(COSMETICS_KEY), pair);
  const entry = logbookEntries([], loadLogbook(null), ['hot-work']).find(
    (e) => e.id === 'commendation:hot-work',
  )!;
  assert(entry.earned);
  assert(entry.lore[2].includes('permanently'));
});
