import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game } from '../src/game.ts';
import { SupportDrill } from '../src/support-drill.ts';
import {
  SUPPORT_DRILLS,
  supportDrillFromUrl,
  supportDrillForEntry,
  type SupportDrillId,
} from '../src/support-drill-info.ts';
import { loadLogbook } from '../src/logbook.ts';
import { logbookCatalog } from '../src/logbook-catalog.ts';
import { logbookArticle } from '../src/logbook-menu.ts';

const input = (aim = { x: 490, y: 693 }, fire = false) => ({
  left: false,
  right: false,
  jump: false,
  jumpHeld: false,
  fire,
  aim,
});
function play(id: SupportDrillId) {
  const drill = new SupportDrill(id),
    g = drill.game;
  let tracked = g.enemies[0];
  for (let frame = 0; frame < 6000 && !drill.complete && !drill.failed; frame++) {
    let aim = { x: 490, y: 693 },
      fire = true;
    if (id === 'heat') {
      if (!tracked || tracked.hp <= 0) tracked = g.enemies.find((e) => e.hp > 0)!;
      if (tracked) aim = { ...tracked.body.position };
      else fire = false;
    } else if (id === 'overkill') {
      const target = g.enemies.find((e) =>
        g.support.reserve > 0 ? e.body.position.x > 600 : e.body.position.x < 600,
      );
      if (target) aim = { ...target.body.position };
      else fire = false;
    } else {
      const cover = g.props.items.find((p) => p.kind === 'cover');
      if (cover) aim = { ...cover.body.position };
      fire = !!cover && !g.support.plate;
    }
    drill.tick(1 / 60, input(aim, fire));
  }
  return drill;
}
for (const id of Object.keys(SUPPORT_DRILLS) as SupportDrillId[]) {
  test(id + ' drill can complete using ordinary aim/fire and actual combat counters', () => {
    const drill = play(id);
    try {
      assert.equal(
        drill.complete,
        true,
        JSON.stringify({
          results: drill.game.combatReport.snapshot(),
          hp: drill.game.hp,
          time: drill.game.time,
          targets: drill.game.enemies.map((e) => ({ hp: e.hp, pos: e.body.position })),
          player: drill.game.player.position,
        }),
      );
      assert.equal(drill.failed, false);
      const before = drill.game.time;
      drill.tick(1, input(undefined, true));
      assert.equal(drill.game.time, before, 'a completed drill freezes');
      assert.equal(drill.game.commendations.eligible, false);
    } finally {
      drill.dispose();
    }
  });
}
test('training leaves a paused Campaign and its checkpoint exactly intact and grants no callbacks', () => {
  const campaign = new Game();
  campaign.start('RF-C413-preserve-training');
  campaign.setMode('paused');
  const checkpoint = () => {
    let value: unknown;
    campaign.onCheckpoint = (save) => {
      value = save;
    };
    campaign.save();
    return value;
  };
  const bodies = Matter.Composite.allBodies(campaign.engine.world);
  const before = {
    checkpoint: checkpoint(),
    position: { ...campaign.player.position },
    results: campaign.combatReport.snapshot(),
    mode: campaign.mode,
  };
  const drill = new SupportDrill('overkill');
  let awards = 0,
    saves = 0;
  drill.game.onCommendation = () => awards++;
  drill.game.onCheckpoint = () => saves++;
  for (let frame = 0; frame < 900; frame++) drill.tick(1 / 60, input(undefined, true));
  assert.equal(awards, 0);
  assert.equal(saves, 0);
  assert.deepEqual(
    {
      checkpoint: checkpoint(),
      position: { ...campaign.player.position },
      results: campaign.combatReport.snapshot(),
      mode: campaign.mode,
    },
    before,
  );
  assert.deepEqual(Matter.Composite.allBodies(campaign.engine.world), bodies);
  assert.notEqual(drill.game.engine, campaign.engine);
  drill.dispose();
  assert.equal(Matter.Composite.allBodies(drill.game.engine.world).length, 0);
  drill.dispose();
  Matter.Composite.clear(campaign.engine.world, false);
  Matter.Engine.clear(campaign.engine);
});
test('a retry starts counters and support reserves at zero', () => {
  const completed = play('overkill');
  assert.equal(completed.current, 8);
  completed.dispose();
  const retry = new SupportDrill('overkill');
  assert.equal(retry.current, 0);
  assert.equal(retry.complete, false);
  assert.equal(retry.game.support.reserve, 0);
  assert.equal(retry.game.hp, 100);
  retry.dispose();
});
test('a failed drill freezes and can be replaced without retaining damage or counters', () => {
  const drill = new SupportDrill('armor');
  drill.game.damagePlayer(100, undefined, { type: 'shot' });
  assert.equal(drill.failed, true);
  const time = drill.game.time;
  drill.tick(1, input(undefined, true));
  assert.equal(drill.game.time, time);
  drill.dispose();
  const retry = new SupportDrill('armor');
  assert.equal(retry.failed, false);
  assert.equal(retry.current, 0);
  assert.equal(retry.game.hp, 100);
  retry.dispose();
});
test('range geometry keeps recoil jumps inside the visible arena and repeated retries clean up physics', () => {
  for (let attempt = 0; attempt < 10; attempt++) {
    const drill = new SupportDrill('heat');
    for (let i = 0; i < 240; i++)
      drill.tick(1 / 60, {
        ...input({ x: drill.game.player.position.x, y: 840 }, true),
        jump: i === 0,
        jumpHeld: true,
      });
    assert(drill.game.player.position.y >= 535);
    assert.equal(drill.failed, false);
    drill.dispose();
    assert.equal(Matter.Composite.allBodies(drill.game.engine.world).length, 0);
  }
});
test('misses do not manufacture heat transfers or armor blocks', () => {
  const heat = new SupportDrill('heat'),
    armor = new SupportDrill('armor');
  for (let i = 0; i < 600; i++) {
    heat.tick(1 / 60, input({ x: 200, y: 450 }, true));
    armor.tick(1 / 60, input());
  }
  assert.equal(heat.current, 0);
  assert.equal(armor.current, 0);
  heat.dispose();
  armor.dispose();
});
test('drill action appears only on revealed support masteries', () => {
  const hidden = logbookCatalog([], loadLogbook(null), [], null);
  for (const id of Object.keys(SUPPORT_DRILLS) as SupportDrillId[]) {
    const entryId = 'commendation:' + SUPPORT_DRILLS[id].mastery;
    assert.equal(supportDrillForEntry(entryId), id);
    assert.doesNotMatch(
      logbookArticle(hidden.find((e) => e.id === entryId)!, () => ''),
      /data-support-drill|Try this challenge/,
    );
    const known = logbookCatalog([...SUPPORT_DRILLS[id].mods], loadLogbook(null), [], null);
    assert.match(
      logbookArticle(known.find((e) => e.id === entryId)!, () => ''),
      new RegExp('data-support-drill="' + id + '"'),
    );
  }
  assert.equal(supportDrillForEntry('commendation:gauntlet-cleared'), undefined);
});
test('direct links accept exactly one known drill and reject mixed or duplicate intents', () => {
  const url = (query: string) => new URL('https://caleb-guyer.github.io/recoil-foundry/?' + query);
  for (const id of Object.keys(SUPPORT_DRILLS) as SupportDrillId[])
    assert.equal(supportDrillFromUrl(url('test=drill&build=' + id + '&v=4.16.0')), id);
  for (const query of [
    'test=drill',
    'test=drill&build=combined',
    'test=support&build=heat',
    'test=drill&build=heat&build=armor',
    'test=drill&test=support&build=heat',
    'test=drill&build=heat&daily=1',
    'test=drill&build=heat&seed=hello',
    'test=drill&build=heat&gun=shotgun',
  ])
    assert.equal(supportDrillFromUrl(url(query)), null, query);
});
