import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import {
  OperatorPreviewStage,
  OperatorPreviewView,
  operatorPreviewMarkup,
  OPERATOR_PREVIEW_POSES,
} from '../src/operator-preview.ts';
import { Game } from '../src/game.ts';
import { appearanceMenu } from '../src/appearance-menu.ts';
import type { AppearanceItemId } from '../src/appearance-notices.ts';

class PreviewNode extends EventTarget {
  dataset: Record<string, string> = {};
  attributes = new Map<string, string>();
  textContent = '';
  value = '';
  disabled = false;
  onclick: (() => void) | null = null;
  focused = false;
  focus() {
    this.focused = true;
  }
  setAttribute(key: string, value: string) {
    this.attributes.set(key, value);
  }
}
function surface() {
  const calls: { name: string; args: unknown[] }[] = [];
  const styles: Record<string, unknown> = { globalAlpha: 1, lineWidth: 1 };
  let depth = 0;
  const context = new Proxy({} as CanvasRenderingContext2D, {
    get(_target, key) {
      if (String(key).startsWith('create')) return () => ({ addColorStop() {} });
      if (key in styles) return styles[String(key)];
      return (...args: unknown[]) => {
        assert(
          args.every((arg) => typeof arg !== 'number' || Number.isFinite(arg)),
          String(key) + ' must use finite pose geometry',
        );
        if (key === 'save') depth++;
        if (key === 'restore') {
          depth--;
          assert(depth >= 0);
        }
        calls.push({ name: String(key), args });
      };
    },
    set(_target, key, value) {
      styles[String(key)] = value;
      return true;
    },
  });
  return {
    calls,
    context,
    get depth() {
      return depth;
    },
  };
}
class PreviewCanvas extends PreviewNode {
  width = 720;
  height = 440;
  readonly surface = surface();
  available = true;
  getContext() {
    return this.available ? this.surface.context : null;
  }
}
class PreviewRoot {
  innerHTML = '';
  isConnected = true;
  ownerDocument = { hidden: false };
  canvas = new PreviewCanvas();
  caption = new PreviewNode();
  motion = new PreviewNode();
  toggle = new PreviewNode();
  tools = new PreviewNode();
  poses = OPERATOR_PREVIEW_POSES.map((pose) => {
    const node = new PreviewNode();
    node.dataset.operatorPose = pose.id;
    return node;
  });
  querySelector(selector: string) {
    return (
      (
        {
          '.operator-preview-canvas': this.canvas,
          figcaption: this.caption,
          '.operator-preview-motion': this.motion,
          '[data-operator-toggle]': this.toggle,
          '[data-operator-tool]': this.innerHTML.includes('data-operator-tool') ? this.tools : null,
        } as Record<string, unknown>
      )[selector] ?? null
    );
  }
  querySelectorAll(selector: string) {
    return selector === '[data-operator-pose]' ? this.poses : [];
  }
  asElement() {
    return this as unknown as HTMLElement;
  }
}
const standard = { gun: 'standard', outfit: 'standard' } as const;
const options = () => ({ selection: standard, earned: [] as const });
const click = (node: PreviewNode) => node.dispatchEvent(new Event('click'));

test('preview actors retain earned cosmetics, hide first-run tools and reject locked or malformed tool selections', () => {
  const first = new OperatorPreviewStage({
    ...options(),
    gun: 'shotgun',
    unlockedGuns: ['pistol', 'shotgun'],
    showTools: false,
  });
  assert.equal(first.game.startingGun, 'pistol');
  assert.doesNotMatch(
    operatorPreviewMarkup({ ...options(), showTools: false }),
    /Preview tool|data-operator-tool/,
  );
  first.setTool('shotgun');
  assert.equal(first.game.startingGun, 'pistol');
  first.dispose();
  const stage = new OperatorPreviewStage({
    selection: { gun: 'kiln', outfit: 'forgehand' },
    earned: ['hot-work'],
    gun: 'shotgun',
    unlockedGuns: ['pistol', 'shotgun'],
    showTools: true,
  });
  assert.equal(stage.game.startingGun, 'shotgun');
  assert.deepEqual(stage.game.cosmetics, { gun: 'kiln', outfit: 'forgehand' });
  stage.setTool('nailgun');
  assert.equal(stage.game.startingGun, 'pistol');
  stage.setTool('__proto__');
  assert.equal(stage.game.startingGun, 'pistol');
  stage.setAppearance({ gun: 'inspector', outfit: 'operator' });
  assert.deepEqual(stage.game.cosmetics, standard);
  const markup = operatorPreviewMarkup({
    ...options(),
    unlockedGuns: ['pistol', 'shotgun'],
    showTools: true,
  });
  assert.match(markup, /value="shotgun"/);
  assert.doesNotMatch(markup, /value="nailgun"/);
  stage.dispose();
});

test('preview poses use a private native actor without ticking, firing, sounding or changing the original run', () => {
  const parent = new Game();
  parent.start('RF-C108-OPERATOR');
  const original = parent.checkpointSnapshot();
  const originalBody = structuredClone(parent.player.position);
  const selection = { ...parent.cosmetics };
  const stage = new OperatorPreviewStage({ selection, earned: [] });
  const events: string[] = [];
  stage.game.tick = () => {
    throw new Error('Visual posing must not advance physics');
  };
  stage.game.fire = () => {
    throw new Error('Visual posing must not fire');
  };
  stage.game.onSound = () => events.push('sound');
  stage.game.onCheckpoint = () => events.push('checkpoint');
  stage.game.onCommendation = () => events.push('commendation');
  stage.game.onBossDefeated = () => events.push('boss');
  for (const pose of OPERATOR_PREVIEW_POSES) {
    assert(stage.setPose(pose.id));
    for (let i = 0; i < 80; i++) stage.frame(1 / 60, true, false);
    assert(Number.isFinite(stage.game.player.position.x));
    assert(Number.isFinite(stage.game.player.velocity.y));
  }
  assert.deepEqual(events, []);
  assert.equal(stage.game.shotCount, 0);
  assert.equal(stage.game.shots.length, 0);
  assert.deepEqual(parent.checkpointSnapshot(), original);
  assert.deepEqual(parent.player.position, originalBody);
  assert.deepEqual(parent.cosmetics, selection);
  stage.dispose();
});

test('pause, inactive views and Reduced Effects freeze the preview clock without a catch-up jump', () => {
  const stage = new OperatorPreviewStage(options());
  stage.setPose('run');
  stage.frame(0.1, true, false);
  const clock = stage.clock,
    posed = structuredClone(stage.game.player.position);
  stage.frame(0.1, false, false);
  assert.equal(stage.clock, clock);
  assert.deepEqual(stage.game.player.position, posed);
  stage.playing = false;
  stage.frame(0.1, true, false);
  assert.equal(stage.clock, clock);
  stage.playing = true;
  stage.frame(0.1, true, true);
  const reduced = structuredClone(stage.game.player.position);
  for (let i = 0; i < 120; i++) stage.frame(0.1, true, true);
  assert.equal(stage.clock, clock);
  assert.deepEqual(stage.game.player.position, reduced);
  stage.frame(0.1, true, false);
  assert.equal(stage.clock, clock + 0.1);
  for (const dt of [NaN, Infinity, -1, 0]) {
    const before = stage.clock;
    stage.frame(dt, true, false);
    assert.equal(stage.clock, before);
  }
  stage.dispose();
});

test('native articulated rendering gives each selected reduced pose a distinct, steady image', () => {
  const root = new PreviewRoot();
  const view = new OperatorPreviewView(root.asElement(), options());
  const signatures = new Set<string>();
  for (const node of root.poses) {
    click(node);
    view.frame(0.1, 1000 + signatures.size * 100, true, true);
    assert.equal(root.toggle.disabled, true);
    assert.match(root.motion.textContent, /Reduced Effects/);
    const count = root.canvas.surface.calls.length;
    for (let i = 0; i < 30; i++) view.frame(0.1, 2000 + i * 100, true, true);
    assert.equal(
      root.canvas.surface.calls.length,
      count,
      'still poses must not repaint repeatedly',
    );
    root.canvas.surface.calls.length = 0;
    view.update(standard);
    signatures.add(JSON.stringify(root.canvas.surface.calls));
    assert.equal(root.canvas.surface.depth, 0);
  }
  assert.equal(signatures.size, 5);
  view.dispose();
});

test('the view pauses on visibility loss, hidden tabs or disconnect and limits live repaint cadence', () => {
  const root = new PreviewRoot();
  const view = new OperatorPreviewView(root.asElement(), options());
  view.frame(0.1, 100, false, true);
  const before = view.stage.clock;
  root.ownerDocument.hidden = true;
  view.frame(0.1, 100000, false, true);
  assert.equal(view.stage.clock, before);
  root.ownerDocument.hidden = false;
  view.frame(0.1, 100100, false, false);
  assert.equal(view.stage.clock, before);
  root.isConnected = false;
  view.frame(0.1, 100200, false, true);
  assert.equal(view.stage.clock, before);
  root.isConnected = true;
  view.frame(0.1, 100300, false, true);
  assert.equal(view.stage.clock, before + 0.1);
  root.canvas.surface.calls.length = 0;
  for (let i = 0; i < 60; i++) view.frame(1 / 60, 101000 + (i * 1000) / 60, false, true);
  const paints = root.canvas.surface.calls.filter((op) => op.name === 'clearRect').length;
  assert(paints > 15 && paints <= 31, 'body preview should draw at most thirty times per second');
  view.dispose();
});

test('pose, pause and earned-tool controls do not equip anything or acknowledge cosmetic notices', () => {
  const root = new PreviewRoot();
  const view = new OperatorPreviewView(root.asElement(), {
    ...options(),
    unlockedGuns: ['pistol', 'shotgun'],
    showTools: true,
  });
  click(root.poses[1]);
  assert.equal(view.stage.pose, 'run');
  click(root.toggle);
  const before = view.stage.clock;
  view.frame(0.1, 100, false, true);
  assert.equal(view.stage.clock, before);
  assert.equal(root.toggle.textContent, 'Play preview');
  root.tools.value = 'shotgun';
  root.tools.dispatchEvent(new Event('change'));
  assert.equal(view.stage.game.startingGun, 'shotgun');
  assert.equal(root.tools.value, 'shotgun');
  root.tools.value = 'nailgun';
  root.tools.dispatchEvent(new Event('change'));
  assert.equal(view.stage.game.startingGun, 'pistol');
  assert.equal(root.tools.value, 'pistol');
  assert.match(root.canvas.attributes.get('aria-label')!, /Service pistol · Run preview/);
  view.dispose();
});

test('disposing the preview releases its physics world and listeners and prevents further work', () => {
  const root = new PreviewRoot();
  const view = new OperatorPreviewView(root.asElement(), options());
  assert(Matter.Composite.allBodies(view.stage.game.engine.world).length > 0);
  view.dispose();
  assert.equal(Matter.Composite.allBodies(view.stage.game.engine.world).length, 0);
  const clock = view.stage.clock,
    count = root.canvas.surface.calls.length;
  click(root.poses[1]);
  click(root.toggle);
  view.frame(0.1, 1000, false, true);
  view.update(standard);
  view.tool('pistol');
  view.dispose();
  assert.equal(view.stage.pose, 'idle');
  assert.equal(view.stage.clock, clock);
  assert.equal(root.canvas.surface.calls.length, count);
});

test('a missing canvas context leaves Appearance usable with a factual unavailable message', () => {
  const root = new PreviewRoot();
  root.canvas.available = false;
  const view = new OperatorPreviewView(root.asElement(), options());
  assert.match(root.motion.textContent, /Preview unavailable/);
  assert.equal(root.toggle.disabled, true);
  view.frame(0.1, 1000, false, true);
  assert.equal(view.stage.clock, 0);
  view.update(standard);
  assert.match(root.caption.textContent, /Standard/);
  view.dispose();
});

class ChoiceList {
  private html = '';
  buttons: PreviewNode[] = [];
  get innerHTML() {
    return this.html;
  }
  set innerHTML(value: string) {
    this.html = value;
    this.buttons = [];
    for (const match of value.matchAll(/<button\b([^>]*)>/g)) {
      const node = new PreviewNode(),
        attrs = match[1];
      node.dataset.slot = /data-slot="([^"]+)"/.exec(attrs)![1];
      node.dataset.style = /data-style="([^"]+)"/.exec(attrs)![1];
      node.disabled = /(?:^|\s)disabled(?:\s|$)/.test(attrs);
      this.buttons.push(node);
    }
  }
  querySelectorAll() {
    return this.buttons;
  }
  querySelector(selector: string) {
    const slot = /data-slot="([^"]+)"/.exec(selector)?.[1];
    const style = /data-style="([^"]+)"/.exec(selector)?.[1];
    return (
      this.buttons.find(
        (button) => button.dataset.slot === slot && button.dataset.style === style,
      ) ?? null
    );
  }
  choice(slot: string, style: string) {
    return this.querySelector('[data-slot="' + slot + '"][data-style="' + style + '"]')!;
  }
}
class AppearanceRoot {
  innerHTML = '';
  choices = new ChoiceList();
  preview = new PreviewRoot();
  logbook = new PreviewNode();
  querySelector(selector: string) {
    return (
      (
        {
          '.appearance-options': this.choices,
          '.appearance-preview': this.preview,
          figcaption: this.preview.caption,
          '#appearance-logbook': this.logbook,
        } as Record<string, unknown>
      )[selector] ?? null
    );
  }
  asElement() {
    return this as unknown as HTMLElement;
  }
}

test('Appearance keeps independent new-item notices and locked choices while animation controls remain private', () => {
  const root = new AppearanceRoot(),
    game = new Game();
  game.cosmetics = { gun: 'kiln', outfit: 'forgehand' };
  const viewed: AppearanceItemId[] = [],
    equipped: unknown[] = [];
  const view = appearanceMenu(root.asElement(), {
    game,
    earned: ['hot-work', 'cable-cut'],
    defeated: ['crane'],
    preview: false,
    previewGun: 'pistol',
    unlockedGuns: ['pistol', 'shotgun'],
    showTools: true,
    unseen: ['gun:kiln', 'outfit:forgehand', 'gun:copperline'],
    viewed(id) {
      viewed.push(id);
    },
    equip(selection) {
      game.cosmetics = selection;
      equipped.push(selection);
    },
    logbook() {},
  });
  assert.deepEqual(viewed, []);
  assert.equal(
    root.preview.canvas.surface.calls.length,
    0,
    'the native actor stays lazy while Build is open',
  );
  view();
  assert.deepEqual(viewed, ['gun:kiln', 'outfit:forgehand']);
  click(root.preview.poses[1]);
  click(root.preview.toggle);
  root.preview.tools.value = 'shotgun';
  root.preview.tools.dispatchEvent(new Event('change'));
  for (let i = 0; i < 40; i++) view.frame(0.016, i * 16, false, true);
  assert.deepEqual(viewed, ['gun:kiln', 'outfit:forgehand']);
  assert.deepEqual(equipped, []);
  assert.deepEqual(game.cosmetics, { gun: 'kiln', outfit: 'forgehand' });
  const locked = root.choices.choice('outfit', 'operator');
  assert(locked.disabled);
  locked.onclick!();
  assert.deepEqual(equipped, []);
  assert.deepEqual(viewed, ['gun:kiln', 'outfit:forgehand']);
  root.choices.choice('gun', 'copperline').onclick!();
  assert.deepEqual(game.cosmetics, { gun: 'copperline', outfit: 'forgehand' });
  assert.deepEqual(viewed, ['gun:kiln', 'outfit:forgehand', 'gun:copperline']);
  assert.equal(equipped.length, 1);
  assert.equal(root.choices.choice('gun', 'copperline').focused, true);
  view();
  assert.equal(viewed.length, 3, 'opening a viewed item again does not acknowledge another reward');
  view.dispose();
  const before = root.preview.canvas.surface.calls.length;
  view();
  view.frame(0.1, 10000, false, true);
  assert.equal(
    root.preview.canvas.surface.calls.length,
    before,
    'disposed Appearance cannot resurrect its actor',
  );
});

test('isolated Appearance tests never acknowledge real cosmetic notices', () => {
  const root = new AppearanceRoot(),
    game = new Game();
  game.cosmetics = { gun: 'kiln', outfit: 'forgehand' };
  const notices: string[] = [];
  const view = appearanceMenu(root.asElement(), {
    game,
    earned: ['hot-work'],
    preview: true,
    unseen: ['gun:kiln', 'outfit:forgehand'],
    viewed(id) {
      notices.push(id);
    },
    equip(selection) {
      game.cosmetics = selection;
    },
    logbook() {},
  });
  view();
  root.choices.choice('gun', 'standard').onclick!();
  view();
  assert.deepEqual(notices, []);
  view.dispose();
});
