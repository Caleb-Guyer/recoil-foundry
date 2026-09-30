import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Enemy, type Shot } from '../src/game.ts';
import { getGun, loadCheckpoint } from '../src/rules.ts';
import {
  COMMENDATIONS,
  COMMENDATIONS_KEY,
  commendationVisible,
  type CommendationId,
} from '../src/commendations.ts';
import { COSMETICS_KEY, loadCosmetics } from '../src/cosmetics.ts';
import { logbookEntries, loadLogbook } from '../src/logbook.ts';
import { logbookArticle } from '../src/logbook-menu.ts';
import { ProgressStore, parseProgressBackup } from '../src/progress.ts';
import { traceTorch } from '../src/torch.ts';
import { shotTrace } from '../src/weapon-mastery.ts';
import { weaponMasteryTestFromUrl } from '../src/weapon-mastery-test.ts';
const { Body, Composite } = Matter;
const ids = ['bank-job', 'air-traffic', 'special-delivery'] as const;

function fixture(mods: string[] = []) {
  const g = new Game(),
    awards: CommendationId[] = [];
  g.start('weapon-mastery-fixture');
  g.onCommendation = (id) => awards.push(id);
  g.waves.clear();
  g.hazards.clear();
  g.breaches.clear();
  g.destruction.clear();
  g.conveyors.clear();
  g.areaEvents.clear();
  for (const e of g.enemies) Composite.remove(g.engine.world, e.body);
  g.enemies = [];
  for (const p of [...g.props.items]) g.props.remove(p);
  for (const b of g.terrain.slice(4)) Composite.remove(g.engine.world, b);
  g.terrain = g.terrain.slice(0, 4);
  g.mods = mods;
  g.gun = getGun(mods);
  Body.setPosition(g.player, { x: 200, y: 400 });
  Body.setVelocity(g.player, { x: 0, y: 0 });
  g.grounded = false;
  return {
    g,
    awards,
    earned: () => awards.filter((id) => ids.includes(id as (typeof ids)[number])),
  };
}
function target(g: Game, kind: Enemy['kind'] = 'runner', x = 1000, y = 500, hp = 100) {
  const e = g.spawnEnemy(kind, x, y);
  e.spawn = 0;
  e.hp = e.maxHp = hp;
  e.state = 'idle';
  e.timer = 100;
  Body.setStatic(e.body, true);
  return e;
}
function shot(g: Game, overrides: Partial<Shot> = {}) {
  return g.addShot({
    pos: { x: 600, y: 710 },
    vel: { x: 0, y: 45 },
    damage: 500,
    life: 2,
    friendly: true,
    radius: 3,
    bounces: 1,
    pierce: 0,
    fragment: false,
    split: false,
    ...overrides,
  })!;
}
function travel(g: Game) {
  for (let i = 0; i < 35; i++) {
    g.time += 1 / 60;
    g.updateShots(1 / 60);
  }
}
function portalPair(g: Game) {
  assert(g.portals.place({ x: 600, y: 740 }));
  assert(g.portals.place({ x: 1000, y: 740 }));
}
function kill(g: Game, e = target(g)) {
  g.hitEnemy(e, 99999);
}

test('Bank Job counts actual post-armor health loss, with exact-half eligibility and no overkill inflation', () => {
  for (const banked of [49, 50, 51]) {
    const { g, earned } = fixture(),
      e = target(g, 'boss');
    g.hitEnemy(e, 100 - banked);
    g.hitEnemy(e, 99999, undefined, true, true, true, undefined, { banked: true });
    assert.equal(earned().includes('bank-job'), banked >= 50);
  }
  const { g, earned } = fixture(),
    e = target(g, 'loader');
  g.hitEnemy(e, 100, undefined, true, true, true, undefined, { banked: true }); // armored: 40
  e.state = 'recover';
  g.hitEnemy(e, 100); // actual loss: 60, not 125
  assert(!earned().includes('bank-job'));
});

test('real banked projectiles earn Bank Job; equipping Ricochet or having an unused bounce cannot', () => {
  for (const banked of [false, true]) {
    const { g, earned } = fixture(['ricochet']);
    target(g, 'boss', 600, 500);
    shot(g, banked ? {} : { pos: { x: 600, y: 400 }, vel: { x: 0, y: 45 } });
    travel(g);
    assert.equal(earned().includes('bank-job'), banked);
  }
});

test('bank evidence belongs to each boss and uncredited damage never supplies bank credit', () => {
  const { g, earned } = fixture(),
    a = target(g, 'boss', 1000),
    b = target(g, 'loader', 1500);
  g.hitEnemy(a, 60, undefined, true, true, true, undefined, { banked: true });
  g.hitEnemy(b, 10, undefined, true, true, false, undefined, { banked: true });
  kill(g, b);
  assert(!earned().includes('bank-job'));
});

test('Air Traffic requires six distinct kills in one continuous airborne streak', () => {
  const { g, earned } = fixture();
  for (let i = 0; i < 5; i++) kill(g);
  assert.deepEqual(earned(), []);
  const last = target(g);
  kill(g, last);
  kill(g, last);
  assert.deepEqual(earned(), ['air-traffic']);
});

test('a landing between kills resets the streak even with a stale grounded flag and no kill at landing', () => {
  const { g, earned } = fixture();
  for (let i = 0; i < 5; i++) kill(g);
  Body.setPosition(g.player, { x: 200, y: 722 });
  g.grounded = false;
  g.commendations.weapons.sampleGround();
  Body.setPosition(g.player, { x: 200, y: 400 });
  kill(g);
  assert.deepEqual(earned(), []);
  for (let i = 0; i < 5; i++) kill(g);
  assert.deepEqual(earned(), ['air-traffic']);
});

test('ground kills, relay targets, sentries, uncredited deaths and boss cleanup cannot pad Air Traffic', () => {
  for (const reason of ['ground', 'relay', 'sentry', 'uncredited', 'cleanup', 'spawn'] as const) {
    const { g, earned } = fixture();
    if (reason === 'ground') Body.setPosition(g.player, { x: 200, y: 722 });
    for (let i = 0; i < 7; i++) {
      const e = target(g, reason === 'sentry' ? 'sentry' : 'runner');
      if (reason === 'relay') e.eventRole = 'relay';
      if (reason === 'spawn') e.spawn = 1;
      g.hitEnemy(
        e,
        99999,
        undefined,
        true,
        true,
        reason !== 'uncredited',
        reason === 'cleanup' ? 'cleanup' : undefined,
      );
    }
    assert.deepEqual(earned(), [], reason);
  }
});

test('Special Delivery requires four real portal killing shots; direct kills do not count', () => {
  const { g, earned } = fixture(['fold']);
  portalPair(g);
  kill(g);
  for (let i = 0; i < 4; i++) {
    target(g, 'runner', 1000, 570);
    const s = shot(g);
    travel(g);
    assert.equal(shotTrace(s)?.portaled, true);
    assert.equal(earned().includes('special-delivery'), i === 3);
  }
});

test('a portal wound followed by a direct killing shot does not qualify', () => {
  const { g, earned } = fixture(['fold']);
  portalPair(g);
  for (let i = 0; i < 4; i++) {
    const e = target(g, 'runner', 1000, 570);
    shot(g, { damage: 1 });
    travel(g);
    assert(e.hp < 100 && e.hp > 0);
    kill(g, e);
  }
  assert(!earned().includes('special-delivery'));
});

test('banked and portaled shell payloads retain their provenance through Fuse, clusters and Aftershock', () => {
  const { g, earned } = fixture(['shellshock', 'fuse', 'cluster-shell', 'aftershock']);
  const s = shot(g, { pos: { x: 600, y: 500 }, weaponTrace: { banked: true, portaled: true } });
  g.demolition.impact(s);
  assert.equal(g.ballistics.shells.length, 1);
  assert.deepEqual(g.ballistics.shells[0].weaponTrace, { banked: true, portaled: true });
  g.time += 1;
  g.ballistics.update();
  assert(g.demolition.bomblets.length > 0);
  assert(g.demolition.pending.length > 0);
  for (const payload of [...g.demolition.bomblets, ...g.demolition.pending])
    assert.deepEqual(payload.weaponTrace, { banked: true, portaled: true });
  const e = target(g, 'boss', 600, 500);
  g.demolition.detonate({
    pos: { x: 600, y: 500 },
    damage: 9999,
    radius: 70,
    launch: 0,
    kind: 'shell',
    weaponTrace: { banked: true },
  });
  assert(e.hp <= 0);
  assert(earned().includes('bank-job'));
});

test('splinters inherit their parent path but a new Death Bloom volley does not invent travel', () => {
  const { g } = fixture(['split']);
  const s = shot(g, { weaponTrace: { banked: true, portaled: true } });
  g.splitShot(s);
  const fragments = g.shots.filter((x) => x !== s);
  assert(fragments.length > 0);
  assert(fragments.every((x) => shotTrace(x)?.banked && shotTrace(x)?.portaled));
  g.shots = [];
  g.deathBloom(s, { x: 600, y: 400 });
  assert(g.shots.every((x) => !shotTrace(x)));
});

test('beams credit only segments after a physical bank or portal, including portal-origin repeats', () => {
  const { g } = fixture(['cutting-torch', 'ricochet']);
  Body.setPosition(g.player, { x: 600, y: 400 });
  g.aim = { x: 600, y: 740 };
  target(g, 'boss', 600, 220);
  const banked = traceTorch(g);
  assert(!banked[0].weaponTrace?.banked);
  assert(banked.find((s) => s.enemy)?.weaponTrace?.banked);
  g.mods = ['cutting-torch', 'fold'];
  g.gun = getGun(g.mods);
  portalPair(g);
  target(g, 'runner', 1000, 570);
  const portaled = traceTorch(g);
  assert(!portaled[0].weaponTrace?.portaled);
  assert(portaled.find((s) => s.enemy)?.weaponTrace?.portaled);
  const origin = portaled.find((s) => s.portalExit)!.portalExit!;
  assert(
    traceTorch(g, false, 0, 12, { used: true }, origin).find((s) => s.enemy)?.weaponTrace?.portaled,
  );
});

test('a real banked beam can complete Bank Job through the damage pipeline', () => {
  const { g, earned } = fixture(['cutting-torch', 'ricochet']);
  Body.setPosition(g.player, { x: 600, y: 400 });
  g.aim = { x: 600, y: 740 };
  const e = target(g, 'boss', 600, 220);
  for (let i = 0; i < 180 && e.hp > 0; i++) {
    g.time += 1 / 60;
    g.torch.beforeStep(1 / 60, true);
    g.torch.afterStep(1 / 60);
  }
  assert(e.hp <= 0);
  assert(earned().includes('bank-job'));
});

test('reflected and allied rounds cannot borrow player-weapon travel attribution', () => {
  for (const flag of ['reflected', 'allied'] as const) {
    const { g, earned } = fixture(['fold']);
    portalPair(g);
    const s = shot(g, { [flag]: true, weaponTrace: { banked: true, portaled: true } });
    assert.equal(shotTrace(s), undefined);
    travel(g);
    assert.equal(shotTrace(s), undefined);
    assert.deepEqual(earned(), []);
  }
});

test('a single piercing portal round can make four distinct deliveries, but room reload loses partial progress', () => {
  const { g, earned } = fixture(['fold']);
  portalPair(g);
  for (const y of [650, 570, 490, 410]) target(g, 'runner', 1000, y);
  shot(g, { pierce: 4 });
  travel(g);
  assert(earned().includes('special-delivery'));
  const next = fixture(['fold']);
  portalPair(next.g);
  for (let i = 0; i < 3; i++) {
    target(next.g, 'runner', 1000, 570);
    shot(next.g);
    travel(next.g);
  }
  next.g.commendations.resetRoom();
  target(next.g, 'runner', 1000, 570);
  shot(next.g);
  travel(next.g);
  assert(!next.earned().includes('special-delivery'));
});

test('Practice, previews, Workshop, death and room resets cannot preserve partial mastery evidence', () => {
  for (const mode of ['practice', 'test', 'workshop', 'dead', 'reset'] as const) {
    const { g, earned } = fixture();
    if (mode === 'practice') g.practice = { kind: 'loader', seed: g.seed };
    if (mode === 'test')
      g.testRun = weaponMasteryTestFromUrl(new URL('https://example.test/?test=weapon-mastery'));
    if (mode === 'workshop') g.workshop.active = true;
    for (let i = 0; i < 5; i++) kill(g);
    if (mode === 'dead') {
      g.setMode('dead');
      g.setMode('playing');
    }
    if (mode === 'reset') g.commendations.resetRoom();
    g.practice = null;
    g.testRun = null;
    g.workshop.active = false;
    kill(g);
    assert.deepEqual(earned(), [], mode);
  }
});

test('pause preserves a legitimate airborne streak and repeated kills award only once', () => {
  const { g, earned } = fixture();
  for (let i = 0; i < 5; i++) kill(g);
  g.setMode('paused');
  g.setMode('playing');
  for (let i = 0; i < 4; i++) kill(g);
  assert.deepEqual(earned(), ['air-traffic']);
});

test('discovery gates both locked objectives and appearance; earned reports remain accessible', () => {
  for (const [id, upgrade] of [
    ['bank-job', 'ricochet'],
    ['air-traffic', 'kick'],
    ['special-delivery', 'fold'],
  ] as const) {
    assert(!commendationVisible(id, [], []));
    assert(commendationVisible(id, [], [], [upgrade]));
    const entries = logbookEntries([upgrade], loadLogbook(null));
    const entry = entries.find((e) => e.id === 'commendation:' + id)!;
    assert(entry && !entry.earned);
    assert(!logbookArticle(entry, () => '').includes(entry.lore[2]));
    const earned = logbookEntries([], loadLogbook(null), [id]).find((e) => e.id === entry.id)!;
    assert(logbookArticle(earned, () => '').includes(earned.lore[0]));
  }
});

test('all three finishes survive backup restore without unlocking unearned rewards', async () => {
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
  for (const [id, gun] of [
    ['bank-job', 'carom'],
    ['air-traffic', 'airmail'],
    ['special-delivery', 'waybill'],
  ] as const) {
    const store = new ProgressStore(() => disk);
    assert.equal(loadCosmetics({ gun }, []).gun, 'standard');
    await store.write(COMMENDATIONS_KEY, [id]);
    await store.write(COSMETICS_KEY, { gun, outfit: 'standard' });
    assert(await store.restore(parseProgressBackup(store.backup('3.17.0'))));
    assert.deepEqual(new ProgressStore(() => disk).read(COSMETICS_KEY), {
      gun,
      outfit: 'standard',
    });
  }
  assert(new Set(COMMENDATIONS.map((c) => c.id)).size === COMMENDATIONS.length);
});

test('mastery preview links use valid saved builds and reject mixed, duplicated or unknown parameters', () => {
  for (const id of ids)
    assert(
      loadCheckpoint(
        weaponMasteryTestFromUrl(
          new URL('https://example.test/?test=weapon-mastery&challenge=' + id),
        ),
      ),
    );
  for (const extra of [
    '&seed=x',
    '&daily=2026-09-29',
    '&challenge=unknown',
    '&test=weapon-mastery',
    '&v=1&v=2',
  ])
    assert.equal(
      weaponMasteryTestFromUrl(new URL('https://example.test/?test=weapon-mastery' + extra)),
      null,
    );
});
