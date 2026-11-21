import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Input } from '../src/game.ts';
import { getGun, loadCheckpoint } from '../src/rules.ts';
import { MELEE_IDS, STARTING_GUN_IDS, type StartingGun } from '../src/starting-guns.ts';
import { startingGunMenu } from '../src/starting-gun-menu.ts';
import {
  toolsOfTradeTestFromUrl,
  TOOL_TRIAL_CONVERTED_MODS,
  TOOLS_OF_TRADE_SCENES,
} from '../src/tools-of-trade-test.ts';
import { MELEE_FITTINGS } from '../src/melee-fittings.ts';
import { ToolTrial, TOOL_TRIAL_TARGETS } from '../src/tool-trial.ts';

const DT = 1 / 60;
const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: false,
  fire: false,
  aim: { x: 750, y: 723 },
};
function frames(trial: ToolTrial, count: number, input: Partial<Input> = {}) {
  for (let i = 0; i < count; i++) trial.tick(DT, { ...idle, ...input });
}
function cleanup(g: Game) {
  Matter.Composite.clear(g.engine.world, false);
  Matter.Engine.clear(g.engine);
}

test('all nine tools and every public scene have strict independent legal isolated fixtures', () => {
  for (const gun of STARTING_GUN_IDS)
    for (const scene of TOOLS_OF_TRADE_SCENES) {
      const url = new URL(`https://test/?test=tools-of-trade&gun=${gun}&scene=${scene}&v=1`);
      const fixture = toolsOfTradeTestFromUrl(url)!;
      assert(fixture);
      assert.equal(fixture.gun, gun);
      assert.equal(fixture.scene, scene);
      assert(loadCheckpoint(fixture.checkpoint));
      assert.equal(fixture.checkpoint.startingGun, gun);
      assert.deepEqual(
        fixture.checkpoint.mods,
        scene === 'converted' ? [...TOOL_TRIAL_CONVERTED_MODS] : [],
      );
      assert.equal(fixture.checkpoint.unlocks, undefined);
      assert.equal(fixture.checkpoint.uprising, undefined);
      const other = toolsOfTradeTestFromUrl(url)!;
      fixture.checkpoint.mods.push('magnum');
      assert(!other.checkpoint.mods.includes('magnum'));
    }
  assert.equal(
    toolsOfTradeTestFromUrl(new URL('https://test/?test=tools-of-trade&v=1'))?.gun,
    'carbine',
  );
  for (const query of [
    '?test=tools-of-trade&v=2',
    '?test=tools-of-trade&v=1&v=1',
    '?test=tools-of-trade&v=1&test=tools-of-trade',
    '?test=tools-of-trade&v=1&gun=constructor',
    '?test=tools-of-trade&v=1&gun=__proto__',
    '?test=tools-of-trade&v=1&gun=pistol&gun=carbine',
    '?test=tools-of-trade&v=1&scene=range&scene=picker',
    '?test=tools-of-trade&v=1&scene=campaign',
    '?test=tools-of-trade&v=1&unlocks=carbine',
    '?test=tools-of-trade&v=1&build=magnum',
  ])
    assert.equal(toolsOfTradeTestFromUrl(new URL('https://test/' + query)), null, query);
});

test('the detached range retains every unmodified native gun and never attacks or writes a checkpoint', () => {
  const parent = new Game(),
    before = JSON.stringify(parent.checkpointSnapshot());
  for (const gun of STARTING_GUN_IDS) {
    const trial = new ToolTrial(gun),
      g = trial.game;
    assert.notEqual(g, parent);
    assert.notEqual(g.engine, parent.engine);
    assert.equal(g.startingGun, gun);
    assert.deepEqual(g.mods, []);
    assert.deepEqual(g.gun, getGun([], gun));
    assert(g.workshop.active && g.testRun);
    assert.equal(g.uprising.run, null);
    assert.equal(g.factory, null);
    assert.deepEqual(
      g.enemies.map((e) => e.body.position.x),
      [...TOOL_TRIAL_TARGETS],
    );
    assert(g.enemies.every((e) => e.body.isStatic && e.workshopTarget && !e.workshopTarget.moving));
    let saves = 0,
      awards = 0;
    g.onCheckpoint = () => saves++;
    g.onCommendation = () => awards++;
    g.save();
    frames(trial, 90);
    assert.equal(g.hp, 100);
    assert.equal(g.mode, 'playing');
    assert.equal(g.shots.length, 0);
    assert.equal(g.enemies.length, 3);
    assert(g.enemies.every((e) => e.hp === e.maxHp));
    assert.equal(saves, 0);
    assert.equal(awards, 0);
    trial.dispose();
    assert.equal(g.engine.world.bodies.length, 0);
    const stoppedAt = g.time;
    frames(trial, 60, { fire: true });
    assert.equal(g.time, stoppedAt);
    assert.equal(saves, 0);
  }
  assert.equal(JSON.stringify(parent.checkpointSnapshot()), before);
  cleanup(parent);
});

test('each private melee drill judges its real combat result with stock and fitted weapons', () => {
  for (const gun of MELEE_IDS) {
    const own = MELEE_FITTINGS.filter((f) => f.weapon === gun).map((f) => f.id);
    for (const mods of [[], own]) {
      const trial = new ToolTrial(gun, 'range', [...mods, 'scatter', 'invalid']);
      const g = trial.game,
        goal = trial.drillMessage;
      assert.deepEqual(g.mods, mods);
      if (gun === 'katana' && mods.length) g.hitEnemy(g.enemies[1], 200);
      let grants = 0;
      g.onWeaponChallengeProgress = () => {
        grants++;
      };
      frames(trial, 220);
      assert.equal(g.hp, 100);
      assert.equal(
        trial.drillMessage,
        goal,
        'waiting or taking a harmless round cannot complete a drill',
      );
      for (let i = 0; i < 500 && trial.drillMessage === goal; i++) {
        const closeRound = g.shots.some(
          (s) =>
            !s.friendly &&
            Math.hypot(s.pos.x - g.player.position.x, s.pos.y - g.player.position.y) < 77,
        );
        const fire = gun === 'katana' ? closeRound : gun === 'hammer' ? i === 1 : i < 48;
        trial.tick(DT, { ...idle, fire });
      }
      assert.match(trial.drillMessage, /complete/i, gun);
      if (gun === 'katana') assert.equal(g.melee.activeStrike?.parries, mods.length ? 2 : 1);
      if (gun === 'hammer')
        assert(g.enemies.some((e) => !e.body.isStatic && e.body.velocity.x > 4));
      if (gun === 'spear') assert.equal(g.melee.activeStrike?.enemiesHit, 2);
      assert.equal(grants, 0);
      assert.equal(g.hp, 100);
      trial.dispose();
    }
  }
});

test('a quick spear tap can land a hit without completing the full-charge piercing drill', () => {
  const trial = new ToolTrial('spear');
  const goal = trial.drillMessage;
  frames(trial, 24);
  frames(trial, 2, { fire: true });
  frames(trial, 16);
  assert(trial.game.enemies.some((e) => e.hp < e.maxHp));
  assert.equal(trial.drillMessage, goal);
  trial.dispose();
});

test('a carbine round penetrates two aligned native targets while an unmodified pistol stops at one', () => {
  for (const gun of ['carbine', 'pistol'] as const) {
    const trial = new ToolTrial(gun),
      g = trial.game;
    frames(trial, 25);
    trial.tick(DT, { ...idle, fire: true, firePressed: true });
    frames(trial, 28);
    assert.equal(g.shotCount, 1);
    const [first, second, third] = g.enemies;
    assert(first.hp < first.maxHp);
    assert.equal(second.hp < second.maxHp, gun === 'carbine');
    assert.equal(third.hp, third.maxHp);
    assert.equal(g.hp, 100);
    trial.dispose();
  }
});

test('the native shotgun and Twinbore emit real multi-round volleys and the nailgun completes its burst', () => {
  for (const gun of ['shotgun', 'twinbore', 'nailgun'] as const) {
    const trial = new ToolTrial(gun),
      g = trial.game;
    frames(trial, 25);
    trial.tick(DT, { ...idle, fire: true, firePressed: true });
    assert.equal(g.shots.length, gun === 'shotgun' ? 5 : gun === 'twinbore' ? 2 : 1);
    frames(trial, 20);
    assert.equal(g.shotCount, gun === 'nailgun' ? 3 : 1);
    assert(g.enemies[0].hp < g.enemies[0].maxHp);
    trial.dispose();
  }
});

test('converted ranges retain the actual selected gun, owned fittings and native beam multiplicity', () => {
  for (const gun of STARTING_GUN_IDS) {
    const trial = new ToolTrial(gun, 'converted'),
      g = trial.game;
    const expected = getGun(TOOL_TRIAL_CONVERTED_MODS, gun);
    assert.equal(g.startingGun, gun);
    assert.deepEqual(g.mods, [...TOOL_TRIAL_CONVERTED_MODS]);
    assert.deepEqual(g.gun, expected);
    assert(g.torch.equipped);
    frames(trial, 25);
    let rays = 0;
    for (let i = 0; i < 35; i++) {
      trial.tick(DT, { ...idle, fire: true, firePressed: i === 0 });
      rays = Math.max(rays, new Set(g.torch.segments.map((s) => s.ray ?? 0)).size);
    }
    assert.equal(rays, expected.pellets);
    assert(g.enemies[0].hp < g.enemies[0].maxHp);
    assert.equal(g.hp, 100);
    trial.dispose();
  }
});

test('targets return after native destruction, wait for the player hull, and stay bounded', () => {
  const trial = new ToolTrial('pistol'),
    g = trial.game;
  const first = g.enemies[0];
  g.hitEnemy(first, first.hp + 1);
  trial.tick(DT, idle);
  Matter.Body.setPosition(g.player, { x: TOOL_TRIAL_TARGETS[0], y: 721 });
  Matter.Body.setVelocity(g.player, { x: 0, y: 0 });
  frames(trial, 110);
  assert(!g.enemies.some((e) => e.body.position.x === TOOL_TRIAL_TARGETS[0]));
  Matter.Body.setPosition(g.player, { x: 140, y: 721 });
  frames(trial, 3);
  assert.equal(g.enemies.length, 3);
  assert.notEqual(g.enemies[0], first);
  frames(trial, 180);
  assert.equal(g.enemies.length, 3);
  assert.equal(g.hp, 100);
  trial.dispose();
});

test('paused ranges and invalid ticks cannot advance physics or queue extra weapon activity', () => {
  const trial = new ToolTrial('nailgun'),
    g = trial.game;
  frames(trial, 25);
  trial.tick(DT, { ...idle, fire: true, firePressed: true });
  g.setMode('paused');
  const time = g.time,
    count = g.shotCount,
    bodies = g.engine.world.bodies.map((b) => ({ ...b.position }));
  frames(trial, 120, { fire: true });
  assert.equal(g.time, time);
  assert.equal(g.shotCount, count);
  assert.deepEqual(
    g.engine.world.bodies.map((b) => ({ ...b.position })),
    bodies,
  );
  g.setMode('playing');
  for (const dt of [0, -1, Infinity, NaN]) trial.tick(dt, { ...idle, fire: true });
  assert.equal(g.time, time);
  frames(trial, 25);
  assert.equal(g.shotCount, count, 'the cancelled burst cannot fire on resume');
  trial.dispose();
});

class FakeButton {
  dataset: Record<string, string> = {};
  textContent = '';
  attributes = new Map<string, string>();
  onclick: (() => void) | null = null;
  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
  }
}
class MenuRoot {
  html = '';
  lockedTrials: FakeButton[] = [];
  buttons = STARTING_GUN_IDS.map((id) => {
    const button = new FakeButton();
    button.dataset.startingGun = id;
    return button;
  });
  nodes = new Map(
    ['starting-gun-detail', 'start-with-gun', 'starting-gun-back', 'try-tool'].map((id) => [
      id,
      new FakeButton(),
    ]),
  );
  set innerHTML(html: string) {
    this.html = html;
    this.lockedTrials = [...html.matchAll(/data-try-locked-gun="([^"]+)"/g)].map((match) => {
      const button = new FakeButton();
      button.dataset.tryLockedGun = match[1];
      return button;
    });
  }
  querySelectorAll(selector: string) {
    return selector === '[data-try-locked-gun]' ? this.lockedTrials : this.buttons;
  }
  querySelector(selector: string) {
    if (selector === '#try-tool' && !this.html.includes('id="try-tool"')) return null;
    return this.nodes.get(selector.slice(1));
  }
}
test('one Try tool action follows the selected unlocked weapon and reports selection without granting a lock', () => {
  const root = new MenuRoot(),
    tried: StartingGun[] = [],
    selected: StartingGun[] = [],
    played: StartingGun[] = [];
  let backs = 0;
  startingGunMenu(
    root as unknown as HTMLElement,
    'carbine',
    (gun) => played.push(gun),
    () => backs++,
    ['pistol', 'twinbore'],
    {
      tryTool: (gun) => tried.push(gun),
      onSelect: (gun) => selected.push(gun),
    },
  );
  root.nodes.get('try-tool')!.onclick!();
  assert.deepEqual(tried, ['pistol']);
  root.buttons.find((b) => b.dataset.startingGun === 'nailgun')!.onclick!();
  assert.deepEqual(selected, []);
  root.nodes.get('try-tool')!.onclick!();
  assert.deepEqual(tried, ['pistol', 'pistol']);
  root.buttons.find((b) => b.dataset.startingGun === 'twinbore')!.onclick!();
  root.nodes.get('try-tool')!.onclick!();
  root.nodes.get('start-with-gun')!.onclick!();
  assert.deepEqual(selected, ['twinbore']);
  assert.deepEqual(tried, ['pistol', 'pistol', 'twinbore']);
  assert.deepEqual(played, ['twinbore']);
  assert.equal(
    root.buttons.find((b) => b.dataset.startingGun === 'twinbore')!.attributes.get('aria-pressed'),
    'true',
  );
  root.nodes.get('starting-gun-back')!.onclick!();
  assert.equal(backs, 1);
  assert.equal((root.html.match(/id="try-tool"/g) ?? []).length, 1);
  for (const gun of ['katana', 'hammer', 'spear']) {
    root.lockedTrials.find((button) => button.dataset.tryLockedGun === gun)!.onclick!();
    assert.equal(tried.at(-1), gun);
  }
  root.nodes.get('start-with-gun')!.onclick!();
  assert.deepEqual(
    played,
    ['twinbore', 'twinbore'],
    'Trying a locked gun never selects or unlocks it',
  );
  const ordinary = new MenuRoot();
  startingGunMenu(
    ordinary as unknown as HTMLElement,
    'pistol',
    () => {},
    () => {},
  );
  assert.equal(ordinary.querySelector('#try-tool'), null);
});
