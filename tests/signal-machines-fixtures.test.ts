import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Input } from '../src/game.ts';
import { loadCheckpoint, validBuild, direction } from '../src/rules.ts';
import { STARTING_GUN_IDS } from '../src/starting-guns.ts';
import { CALLER } from '../src/caller.ts';
import { TRANSMISSION } from '../src/annex.ts';
import {
  SIGNAL_UNITS,
  SIGNAL_SCENES,
  signalMachinesTestFromUrl,
  signalMachinesTestRoom,
  prepareSignalMachinesTest,
} from '../src/signal-machines-test.ts';
const parse = (q: string) =>
  signalMachinesTestFromUrl(new URL('https://test/?test=signal-machines&v=1&' + q));
const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: false,
  fire: false,
  aim: { x: 1000, y: 700 },
};
function course(q: string) {
  const f = parse(q)!;
  assert(f);
  const g = new Game();
  g.startTest(f.checkpoint, signalMachinesTestRoom(f));
  assert(prepareSignalMachinesTest(g, f));
  const e = [...g.enemies, ...g.factions.allies].find((e) => e.kind === f.unit)!;
  assert(e);
  return { g, e, f };
}
function dispose(g: Game) {
  Matter.Composite.clear(g.engine.world, false);
  Matter.Engine.clear(g.engine);
}
function until(g: Game, check: () => boolean, max = 600) {
  for (let i = 0; i < max && !check() && g.mode === 'playing'; i++) g.tick(1 / 60, idle);
  assert(check(), 'Expected native signal state');
}

test('twelve signal inspections reconstruct72 legal deterministic isolated tool checkpoints', () => {
  let count = 0;
  for (const unit of SIGNAL_UNITS)
    for (const scene of SIGNAL_SCENES)
      for (const gun of STARTING_GUN_IDS) {
        const f = parse(`unit=${unit}&scene=${scene}&gun=${gun}`)!;
        assert(f);
        assert(loadCheckpoint(f.checkpoint));
        assert(validBuild(f.checkpoint.mods));
        assert(f.checkpoint.seed.length <= 40);
        assert.deepEqual(signalMachinesTestRoom(f), signalMachinesTestRoom(f));
        count++;
      }
  assert.equal(count, 72);
});
test('signal courses use actual Annex stations, native actors, supported decks and a distant guard', () => {
  for (const unit of SIGNAL_UNITS)
    for (const scene of SIGNAL_SCENES) {
      const { g, e } = course(`unit=${unit}&scene=${scene}`);
      assert(g.annex.active);
      assert.equal(g.waves.pending, false);
      assert.equal(g.kills, 0);
      assert.equal(g.hp, 100);
      assert(g.enemies.some((a) => a.kind === 'shooter' && a.body.position.x > 1700));
      assert(Matter.Composite.allBodies(g.engine.world).includes(e.body));
      assert.equal(!!e.allied, scene === 'friendly');
      assert.equal(g.player.position.y, scene === 'wreckage' ? 532 : 722);
      assert.equal(g.annex.port.x, 1250);
      assert.equal(g.annex.junction.x, 700);
      assert.deepEqual(g.level.annexStation!.patrol, [850, 1100]);
      assert.equal(
        g.machineBreakdown.wrecks.length,
        0,
        'friendly initialization is uncredited cleanup, not combat',
      );
      dispose(g);
    }
});
test('all twelve signal courses reach real individual shots and Switchman remote-port volleys', () => {
  for (const unit of SIGNAL_UNITS)
    for (const scene of SIGNAL_SCENES) {
      const { g, e } = course(`unit=${unit}&scene=${scene}`);
      until(g, () => (unit === 'caller' ? e.attacks >= 3 : e.attacks >= 1 && g.annex.volleys >= 1));
      assert(
        g.shots.some((s) => s.damageCause?.enemy === unit),
        unit + '/' + scene + ' actual rounds',
      );
      if (unit === 'caller') assert.equal(e.caller!.phase, 'ready');
      else assert(g.annex.transmission?.phase === 'cooldown');
      dispose(g);
    }
});
test('Caller course uses native displacement cancellation after recording lock', () => {
  const { g, e } = course('unit=caller&scene=mechanisms');
  until(g, () => e.caller?.phase === 'locked');
  const shots = g.shots.filter((s) => s.damageCause?.enemy === 'caller').length,
    old = { ...e.body.position };
  Matter.Body.translate(e.body, { x: 41, y: 0 });
  g.updateEnemy(e, 1 / 60);
  assert.equal(e.caller!.phase, 'ready');
  assert.deepEqual(e.caller!.marks, []);
  assert.equal(e.timer, CALLER.recovery);
  assert.equal(g.shots.filter((s) => s.damageCause?.enemy === 'caller').length, shots);
  assert.equal(e.body.position.x, old.x + 41);
  dispose(g);
});
test('Switchman course junction accepts an ordinary projectile and applies only native feedback', () => {
  const { g, e } = course('unit=switchman&scene=mechanisms');
  until(g, () => g.annex.transmission?.phase === 'charging');
  const hp = e.hp,
    volleys = g.annex.volleys,
    d = direction(g.player.position, g.annex.junction);
  g.addShot({
    pos: { ...g.player.position },
    vel: { x: d.x * 24, y: d.y * 24 },
    damage: 1,
    life: 2,
    friendly: true,
    radius: 3,
    bounces: 0,
    pierce: 0,
    fragment: false,
    split: false,
  });
  for (let i = 0; i < 30 && g.annex.interruptions === 0; i++) g.updateShots(1 / 60);
  assert.equal(g.annex.interruptions, 1);
  assert.equal(g.annex.transmission!.phase, 'cooldown');
  assert(g.annex.transmission!.interrupted);
  assert.equal(g.annex.volleys, volleys);
  assert.equal(hp - e.hp, TRANSMISSION.feedback);
  dispose(g);
});
test('hostile and friendly signal movement, firing, Pause, defeat and restart never write progress or awards', () => {
  for (const unit of SIGNAL_UNITS)
    for (const scene of ['shutdowns', 'friendly']) {
      const f = parse(`unit=${unit}&scene=${scene}`)!,
        g = new Game();
      let writes = 0,
        awards = 0;
      g.onCheckpoint = () => writes++;
      g.onEnemyDefeated = () => awards++;
      g.onCampaignClear = () => awards++;
      g.onCommendation = () => awards++;
      g.startTest(f.checkpoint, signalMachinesTestRoom(f));
      prepareSignalMachinesTest(g, f);
      for (let i = 0; i < 45; i++) g.tick(1 / 60, { ...idle, right: i < 20, fire: i > 30 });
      assert(g.player.position.x > 460);
      assert(g.shotCount > 0);
      g.setMode('paused');
      const time = g.time;
      for (let i = 0; i < 30; i++) g.tick(1 / 60, idle);
      assert.equal(g.time, time);
      g.setMode('playing');
      const e = [...g.enemies, ...g.factions.allies].find((e) => e.kind === unit)!;
      assert(e);
      e.spawn = 0;
      if (e.allied) g.factions.hitAlly(e, 100000);
      else g.hitEnemy(e, 100000);
      assert.equal(g.kills, scene === 'friendly' ? 0 : 1);
      assert.equal(g.mode, 'playing');
      assert(g.machineBreakdown.wrecks.some((w) => w.visual.id === e.id));
      g.startTest(f.checkpoint, signalMachinesTestRoom(f));
      prepareSignalMachinesTest(g, f);
      assert.equal(g.kills, 0);
      assert.equal(g.machineBreakdown.wrecks.length, 0);
      assert.equal(writes, 0);
      assert.equal(awards, 0);
      dispose(g);
    }
});
test('ambiguous signal links fail closed and cannot prepare another run', () => {
  for (const q of [
    'unit=nope',
    'unit=relay',
    'scene=nope',
    'gun=nope',
    'unit=caller&unit=switchman',
    'scene=animations&scene=reactions',
    'elite=twin',
    'faction=blue',
    'face=wall',
    'seed=SAVE',
    'daily=2026-10-29',
    'test=surface-machines',
    'v=2',
    'unit=caller#fragment',
  ])
    assert.equal(parse(q), null, q);
  assert.equal(signalMachinesTestFromUrl(new URL('https://test/?test=signal-machines')), null);
  const g = new Game();
  assert.equal(prepareSignalMachinesTest(g, parse('unit=switchman')), false);
  const a = course('unit=caller');
  assert.equal(prepareSignalMachinesTest(a.g, parse('unit=switchman')), false);
  dispose(a.g);
});
