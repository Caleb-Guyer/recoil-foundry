import test from 'node:test';
import assert from 'node:assert/strict';
import {
  quickShiftPlayMenu,
  quickShiftSetup,
  quickShiftSetupSelection,
  quickShiftChoice,
  quickShiftResult,
  quickShiftResultMarkup,
  type QuickShiftSetupOptions,
} from '../src/quick-shift-menu.ts';
import {
  quickShiftFromSeed,
  quickShiftOffers,
  type QuickShiftRecord,
} from '../src/quick-shift-rules.ts';

class NodeSurface {
  onclick: (() => void) | null = null;
  onchange: (() => void) | null = null;
  oninput: (() => void) | null = null;
  onblur: (() => void) | null = null;
  innerHTML = '';
  textContent = '';
  value = '';
  dataset: Record<string, string> = {};
  attributes = new Map<string, string>();
  hidden = false;
  open = false;
  disabled = false;
  focused = false;
  selected = false;
  isConnected = true;
  details: NodeSurface | null = null;
  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
  }
  removeAttribute(name: string) {
    this.attributes.delete(name);
  }
  closest() {
    return this.details;
  }
  focus() {
    this.focused = true;
  }
  select() {
    this.selected = true;
  }
}
class MenuRoot {
  private markup = '';
  nodes = new Map<string, NodeSurface>();
  choices: NodeSurface[] = [];
  details = new NodeSurface();
  get innerHTML() {
    return this.markup;
  }
  set innerHTML(value: string) {
    this.markup = value;
    this.nodes.clear();
    this.choices = [];
    for (const match of value.matchAll(/<([a-z]+)\b([^>]*)>/g)) {
      const attrs = match[2];
      const node = new NodeSurface();
      node.details = this.details;
      node.hidden = /(?:^|\s)hidden(?:\s|$)/.test(attrs);
      node.disabled = /(?:^|\s)disabled(?:\s|$)/.test(attrs);
      const id = /\bid="([^"]+)"/.exec(attrs)?.[1];
      if (id) this.nodes.set('#' + id, node);
      for (const attr of attrs.matchAll(/\b(data-[a-z-]+)(?:="([^"]*)")?/g)) {
        const selector = '[' + attr[1] + ']';
        this.nodes.set(selector, node);
        node.dataset[attr[1].slice(5).replace(/-([a-z])/g, (_, char) => char.toUpperCase())] =
          attr[2] ?? '';
        if (attr[1] === 'data-quick-shift-choice') this.choices.push(node);
      }
    }
  }
  querySelector(selector: string) {
    return this.nodes.get(selector) ?? null;
  }
  querySelectorAll(selector: string) {
    return selector === '[data-quick-shift-choice]' ? this.choices : [];
  }
  node(id: string) {
    const node = this.querySelector('#' + id);
    assert.ok(node, 'Expected rendered node ' + id);
    return node;
  }
  asElement() {
    return this as unknown as HTMLElement;
  }
}
const record = (change: Partial<QuickShiftRecord> = {}): QuickShiftRecord => {
  const result: QuickShiftRecord = {
    version: 1,
    rules: 1,
    seed: 'RF-Q1-TEST',
    gun: 'pistol',
    route: 'low',
    job: 'skip',
    jobWon: false,
    outcome: 'won',
    rooms: 5,
    timeMs: 123450,
    hits: 2,
    shots: 60,
    kills: 20,
    mods: [],
    ...change,
  };
  if (!change.mods) {
    const challenge = quickShiftFromSeed(result.seed)!;
    for (let completed = 0; completed <= Math.min(result.rooms, 4); completed++)
      for (let pick = 0; pick < (completed === 0 ? 3 : 2); pick++) {
        const offers = quickShiftOffers(challenge, result.mods, completed, result.gun, pick);
        assert(offers.length, 'A result fixture must come from the actual seeded draft');
        result.mods.push(offers[0]);
      }
  }
  return result;
};
const actions = () => ({ replay() {}, newShift() {}, back() {} });
const setup = (root: MenuRoot, change: Partial<QuickShiftSetupOptions> = {}) =>
  quickShiftSetup(root.asElement(), { seed: 'RF-Q1-TEST', start() {}, back() {}, ...change });

test('Play opens either mode through distinct actions without starting on render', () => {
  const root = new MenuRoot();
  const called: string[] = [];
  const menu = quickShiftPlayMenu(root.asElement(), {
    campaign() {
      called.push('campaign');
    },
    quickShift() {
      called.push('quick');
    },
    back() {
      called.push('back');
    },
  });
  assert.deepEqual(called, []);
  root.querySelector('[data-play-campaign]')!.onclick!();
  root.querySelector('[data-play-quick]')!.onclick!();
  assert.equal(menu.back(), true);
  assert.deepEqual(called, ['campaign', 'quick', 'back']);
  assert.match(root.innerHTML, /Twenty rooms/);
  assert.match(root.innerHTML, /five rooms/);
});

test('first-run setup hides weapon selection and starts with pistol despite a supplied earned gun', () => {
  const root = new MenuRoot();
  const starts: unknown[] = [];
  setup(root, {
    selectedGun: 'shotgun',
    unlockedGuns: ['pistol', 'shotgun'],
    showWeapons: false,
    start(seed, gun) {
      starts.push([seed, gun]);
    },
  });
  assert.equal(root.querySelector('#quick-shift-gun'), null);
  assert.doesNotMatch(root.innerHTML, /Recoil shotgun|Earned starting weapons|Starting tool/);
  root.node('quick-shift-start').onclick!();
  assert.deepEqual(starts, [['RF-Q1-TEST', 'pistol']]);
});

test('earned weapon menu refuses a locked tool injected into the select', () => {
  const root = new MenuRoot();
  const starts: unknown[] = [];
  setup(root, {
    selectedGun: 'shotgun',
    unlockedGuns: ['pistol', 'shotgun'],
    showWeapons: true,
    start(seed, gun) {
      starts.push([seed, gun]);
    },
  });
  assert.match(root.innerHTML, /value="shotgun" selected/);
  assert.doesNotMatch(root.innerHTML, /value="nailgun"/);
  const select = root.node('quick-shift-gun');
  select.value = 'nailgun';
  select.onchange!();
  assert.equal(select.value, 'pistol');
  root.node('quick-shift-start').onclick!();
  assert.deepEqual(starts, [['RF-Q1-TEST', 'pistol']]);
  select.value = 'shotgun';
  select.onchange!();
  root.node('quick-shift-start').onclick!();
  assert.deepEqual(starts.at(-1), ['RF-Q1-TEST', 'shotgun']);
});

test('typed full seeds preserve their rules and unsupported input cannot begin a shift', () => {
  const root = new MenuRoot();
  const starts: unknown[] = [];
  setup(root, {
    start(seed, gun) {
      starts.push([seed, gun]);
    },
  });
  const field = root.node('quick-shift-seed');
  field.value = 'RF-Q3-TEST';
  root.node('quick-shift-start').onclick!();
  assert.deepEqual(starts, []);
  assert.equal(field.attributes.get('aria-invalid'), 'true');
  assert.equal(root.details.open, true);
  assert.equal(field.focused, true);
  assert.match(root.node('quick-shift-status').textContent, /12 letters or numbers/);
  field.value = '  rf-q1-abc123  ';
  field.oninput!();
  field.onblur!();
  assert.equal(field.value, 'RF-Q1-ABC123');
  assert.equal(field.attributes.has('aria-invalid'), false);
  root.node('quick-shift-start').onclick!();
  assert.deepEqual(starts, [['RF-Q1-ABC123', 'pistol']]);
});

test('Continue and New seed do not begin or replace an attempt until their explicit action', () => {
  const root = new MenuRoot();
  const called: unknown[] = [];
  setup(root, {
    continue() {
      called.push('continue');
    },
    newSeed() {
      return 'RF-Q1-NEXT';
    },
    start(seed) {
      called.push(seed);
    },
    back() {
      called.push('back');
    },
  });
  assert.deepEqual(called, []);
  root.node('quick-shift-new-seed').onclick!();
  assert.equal(root.node('quick-shift-seed').value, 'RF-Q1-NEXT');
  assert.deepEqual(called, []);
  root.node('quick-shift-continue').onclick!();
  assert.deepEqual(called, ['continue']);
  root.node('quick-shift-back').onclick!();
  assert.deepEqual(called, ['continue', 'back']);
  root.node('quick-shift-start').onclick!();
  assert.deepEqual(called, ['continue', 'back', 'RF-Q1-NEXT']);
});

test('setup keeps matching seed, tool, route and job bests separate', () => {
  const root = new MenuRoot();
  setup(root, {
    records: [
      record(),
      record({ route: 'high', job: 'accept', jobWon: true, timeMs: 150000 }),
      record({ seed: 'RF-Q1-OTHER', timeMs: 1000 }),
      record({ gun: 'shotgun', timeMs: 2000 }),
      record({ outcome: 'dead', rooms: 4, timeMs: 3000 }),
    ],
  });
  const best = root.node('quick-shift-bests').innerHTML;
  assert.match(best, /2:03.45/);
  assert.match(best, /2:30.00/);
  assert.match(best, /Low route · Job skipped/);
  assert.match(best, /High route · Job accepted/);
  assert.doesNotMatch(best, /0:01.00|0:02.00|0:03.00/);
});

test('setup parser treats first-run visibility and unlock ownership as independent gates', () => {
  assert.equal(
    quickShiftSetupSelection('test', 'shotgun', ['pistol', 'shotgun'], false).gun,
    'pistol',
  );
  assert.equal(quickShiftSetupSelection('test', 'shotgun', ['pistol'], true).gun, 'pistol');
  assert.equal(quickShiftSetupSelection('test', '__proto__', ['pistol'], true).gun, 'pistol');
  assert.equal(
    quickShiftSetupSelection('test', 'shotgun', ['pistol', 'shotgun'], true).gun,
    'shotgun',
  );
  assert.equal(
    quickShiftSetupSelection('test', 'pistol', ['pistol'], true).challenge!.seed,
    'RF-Q2-TEST',
  );
  assert.equal(quickShiftSetupSelection('bad seed', 'pistol', ['pistol'], true).challenge, null);
});

test('route and job choices escape supplied copy and never select a disabled choice', () => {
  const root = new MenuRoot();
  const chosen: string[] = [];
  const menu = quickShiftChoice(root.asElement(), {
    kind: 'route',
    room: 2,
    title: '<new route>',
    hint: 'A & B',
    choices: [
      { id: 'low', name: 'Low <route>', detail: 'Read <this>', consequence: 'A & B' },
      { id: 'high', name: 'High', detail: 'Blocked', disabled: true },
    ],
    choose(id) {
      chosen.push(id);
    },
  });
  assert.match(root.innerHTML, /&lt;new route&gt;/);
  assert.doesNotMatch(root.innerHTML, /<new route>/);
  assert.match(root.innerHTML, /A &amp; B/);
  root.choices[0].onclick!();
  root.choices[1].onclick!();
  assert.deepEqual(chosen, ['low']);
  assert.equal(menu.back(), false);
  assert.match(root.innerHTML, /ROOM 2 \/ 5/);
});

test('result reports completed rooms, end state and actual final fittings', () => {
  const html = quickShiftResultMarkup({
    record: record({ outcome: 'dead', rooms: 2, mods: ['scatter', '<untrusted>'] }),
    ...actions(),
  });
  assert.match(html, /Shift ended\./);
  assert.match(html, /2 \/ 5 rooms cleared/);
  assert.match(html, /Scattershot/);
  assert.match(html, /&lt;untrusted&gt;/);
  assert.doesNotMatch(html, /<untrusted>/);
  assert.match(html, /separate from Campaign/);
});

test('new-best claim requires a win, matching challenge configuration and a saved result', () => {
  const current = record();
  const render = (best: QuickShiftRecord, change = {}) =>
    quickShiftResultMarkup({ record: current, best, newBest: true, ...actions(), ...change });
  assert.match(render(current), /New best for this seed/);
  for (const best of [
    record({ gun: 'shotgun' }),
    record({ route: 'high' }),
    record({ job: 'accept' }),
    record({ seed: 'RF-Q1-OTHER' }),
  ])
    assert.doesNotMatch(render(best), /New best|Best matching clear/);
  assert.doesNotMatch(render(current, { preview: true }), /New best/);
  assert.doesNotMatch(
    render(current, { record: record({ outcome: 'dead', rooms: 4 }) }),
    /New best/,
  );
  assert.match(render(record({ timeMs: 100000 })), /Best matching clear · 1:40.00/);
});

test('result actions preserve separate replay, new shift and back callbacks', () => {
  const root = new MenuRoot();
  const called: string[] = [];
  const menu = quickShiftResult(root.asElement(), {
    record: record(),
    replay() {
      called.push('replay');
    },
    newShift() {
      called.push('new');
    },
    back() {
      called.push('back');
    },
  });
  assert.deepEqual(called, []);
  root.node('quick-shift-replay').onclick!();
  root.node('quick-shift-another').onclick!();
  menu.back();
  assert.deepEqual(called, ['replay', 'new', 'back']);
  assert.equal(root.querySelector('#quick-shift-copy-link'), null);
});

test('clipboard failure exposes and selects the exact seed or challenge link for manual copy', async () => {
  const root = new MenuRoot();
  quickShiftResult(root.asElement(), {
    record: record(),
    shareLink: 'https://example.test/?quick=TEST&qv=1&gun=pistol',
    ...actions(),
  });
  // Node has no clipboard. The supported manual fallback must remain usable.
  root.node('quick-shift-copy-seed').onclick!();
  await Promise.resolve();
  assert.equal(root.node('quick-shift-copy-fallback').hidden, false);
  const field = root.node('quick-shift-copy-text');
  assert.equal(field.value, 'RF-Q1-TEST');
  assert.equal(field.selected, true);
  assert.equal(field.focused, true);
  root.node('quick-shift-copy-link').onclick!();
  await Promise.resolve();
  assert.equal(field.value, 'https://example.test/?quick=TEST&qv=1&gun=pistol');
  assert.match(root.node('quick-shift-copy-status').textContent, /Ctrl\+C/);
});

test('setup preserves full archived seeds while a newly typed short code chooses Seed Lock', () => {
  const root = new MenuRoot();
  const starts: string[] = [];
  setup(root, {
    seed: 'RF-Q2-TEST',
    start(seed) {
      starts.push(seed);
    },
  });
  const field = root.node('quick-shift-seed');
  assert.equal(field.value, 'RF-Q2-TEST');
  field.value = ' rf-q1-test ';
  field.onblur!();
  assert.equal(field.value, 'RF-Q1-TEST');
  root.node('quick-shift-start').onclick!();
  field.value = 'test';
  field.onblur!();
  assert.equal(field.value, 'RF-Q2-TEST');
  root.node('quick-shift-start').onclick!();
  assert.deepEqual(starts, ['RF-Q1-TEST', 'RF-Q2-TEST']);
  for (const rules of [1, 2] as const) {
    const r = record({ rules, seed: `RF-Q${rules}-TEST` });
    assert.match(
      quickShiftResultMarkup({ record: r, ...actions() }),
      new RegExp('RF-Q' + rules + '-TEST'),
    );
  }
});
