import test from 'node:test';
import assert from 'node:assert/strict';
import {
  confirmControllerMenu,
  focusControllerMenu,
  navigateControllerMenu,
} from '../src/controller-menu.ts';

// Minimal layout adapter: unlike a DOM emulation library, this explicitly models the
// browser quirk where closed-details children still have non-empty layout rectangles.
class Element {
  parentElement: Element | null = null;
  disabled = false;
  hidden = false;
  visibility = 'visible';
  children: Element[] = [];
  clicked = 0;
  scrolled = false;
  rect: {
    x: number;
    y: number;
    width: number;
    height: number;
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
  constructor(x = 0, y = 0, width = 100, height = 40) {
    this.rect = { x, y, width, height, left: x, right: x + width, top: y, bottom: y + height };
  }
  getBoundingClientRect() {
    return this.rect;
  }
  getClientRects() {
    return [this.rect];
  }
  querySelectorAll() {
    return this.children.filter((el) => !el.disabled);
  }
  querySelector() {
    return this.children[0];
  }
  closest() {
    return this.hidden ? this : null;
  }
  focus() {
    dom.activeElement = this;
  }
  scrollIntoView() {
    this.scrolled = true;
  }
  click() {
    this.clicked++;
  }
}
class Input extends Element {
  type = 'checkbox';
  value = 18;
  events: string[] = [];
  stepUp() {
    this.value = Math.min(40, this.value + 1);
  }
  stepDown() {
    this.value = Math.max(5, this.value - 1);
  }
  dispatchEvent(event: Event) {
    this.events.push(event.type);
  }
}
class Details extends Element {
  open = false;
}
const dom: { activeElement: Element | null } = { activeElement: null };
Object.assign(globalThis, {
  HTMLInputElement: Input,
  HTMLDetailsElement: Details,
  document: dom,
  getComputedStyle: (el: Element) => ({ visibility: el.visibility }),
});
const root = (...children: Element[]) => {
  const el = new Element();
  el.children = children;
  for (const child of children) child.parentElement ??= el;
  return el as unknown as HTMLElement;
};

test('menu navigation skips hidden, disabled and closed disclosure controls', () => {
  const top = new Input(680, 0, 18, 18),
    summary = new Element(0, 60, 700, 32);
  const hiddenChild = new Input(680, 150, 18, 18),
    details = new Details();
  details.children = [summary, hiddenChild];
  summary.parentElement = hiddenChild.parentElement = details;
  const back = new Element(0, 200),
    disabled = new Element(0, 240),
    hidden = new Element(0, 280);
  disabled.disabled = true;
  hidden.hidden = true;
  const page = root(top, summary, hiddenChild, back, disabled, hidden);
  details.parentElement = page as unknown as Element;
  top.focus();
  navigateControllerMenu(page, 'down');
  assert.equal(dom.activeElement, summary);
  navigateControllerMenu(page, 'down');
  assert.equal(dom.activeElement, back);
  navigateControllerMenu(page, 'down');
  assert.equal(dom.activeElement, back);
  details.open = true;
  summary.focus();
  navigateControllerMenu(page, 'down');
  assert.equal(dom.activeElement, hiddenChild);
});
test('wide disclosure rows lead to the first checkbox, and sliders change with left/right', () => {
  const summary = new Element(0, 0, 700, 32),
    checkbox = new Input(680, 80, 18, 18);
  const slider = new Input(510, 140, 140, 18);
  slider.type = 'range';
  const page = root(summary, checkbox, slider);
  summary.focus();
  navigateControllerMenu(page, 'down');
  assert.equal(dom.activeElement, checkbox);
  navigateControllerMenu(page, 'down');
  assert.equal(dom.activeElement, slider);
  navigateControllerMenu(page, 'right');
  assert.equal(slider.value, 19);
  navigateControllerMenu(page, 'left');
  assert.equal(slider.value, 18);
  assert.deepEqual(slider.events, ['input', 'change', 'input', 'change']);
  navigateControllerMenu(page, 'up');
  assert.equal(dom.activeElement, checkbox);
});
test('upgrade grids navigate spatially and never confirm an unfocused or disabled option', () => {
  const first = new Element(0, 0, 200, 240),
    second = new Element(220, 0, 200, 240);
  const third = new Element(440, 0, 200, 240),
    reroll = new Element(220, 270, 150, 40);
  const page = root(first, second, third, reroll);
  dom.activeElement = null;
  confirmControllerMenu(page);
  assert.equal(first.clicked, 0);
  assert.equal(dom.activeElement, first);
  navigateControllerMenu(page, 'right');
  assert.equal(dom.activeElement, second);
  confirmControllerMenu(page);
  assert.equal(second.clicked, 1);
  navigateControllerMenu(page, 'down');
  assert.equal(dom.activeElement, reroll);
  navigateControllerMenu(page, 'up');
  assert.equal(dom.activeElement, second);
  second.disabled = true;
  confirmControllerMenu(page);
  assert.equal(second.clicked, 1);
  assert.equal(dom.activeElement, first);
  focusControllerMenu(page);
  assert.equal(dom.activeElement, first);
  assert(reroll.scrolled);
});
