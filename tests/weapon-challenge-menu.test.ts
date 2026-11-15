import test from 'node:test';
import assert from 'node:assert/strict';
import { startingGunMenu } from '../src/starting-gun-menu.ts';
import { logbookCatalog } from '../src/logbook-catalog.ts';
import { logbookArticle } from '../src/logbook-menu.ts';
import { loadLogbook } from '../src/logbook-progress.ts';
import { loadWeaponUnlocks, unlockedStartingGuns } from '../src/weapon-unlocks.ts';
import { EXPERIMENTAL_GUN_IDS, type StartingGun } from '../src/starting-guns.ts';
import { unlockGoals } from '../src/longevity.ts';

function menuRoot() {
  const root = {
    innerHTML: '',
    controls: new Map<string, { onclick?: () => void }>(),
    lockedTrials: [] as { dataset: { tryLockedGun: string }; onclick?: () => void }[],
    querySelectorAll(selector: string) {
      if (selector !== '[data-try-locked-gun]') return [];
      this.lockedTrials = [...this.innerHTML.matchAll(/data-try-locked-gun="([^"]+)"/g)].map(
        (match) => ({ dataset: { tryLockedGun: match[1] } }),
      );
      return this.lockedTrials;
    },
    querySelector(selector: string) {
      const control = {};
      this.controls.set(selector, control);
      return control;
    },
  };
  return root;
}
const profile = () =>
  loadWeaponUnlocks({
    version: 2,
    started: true,
    cleared: false,
    overtime: false,
    challenges: { bellows: 2, 'debt-collector': 1, switchjack: 500 },
  });

test('picker shows each best attempt outside disabled selection and keeps locked private trials usable', () => {
  const p = profile(),
    root = menuRoot(),
    tried: StartingGun[] = [],
    started: StartingGun[] = [],
    before = JSON.stringify(p);
  startingGunMenu(
    root as unknown as HTMLElement,
    'switchjack',
    (gun) => started.push(gun),
    () => {},
    unlockedStartingGuns(p),
    {
      profile: p,
      tryTool: (gun) => tried.push(gun),
    },
  );
  for (const gun of EXPERIMENTAL_GUN_IDS) {
    assert.match(root.innerHTML, new RegExp(`data-starting-gun="${gun}"[^>]+disabled`));
    assert.match(
      root.innerHTML,
      new RegExp(
        `</button><div class="logbook-goal starting-gun-challenge" data-weapon-challenge="${gun}"`,
      ),
    );
    root.lockedTrials.find((trial) => trial.dataset.tryLockedGun === gun)!.onclick!();
  }
  assert.deepEqual(tried, [...EXPERIMENTAL_GUN_IDS]);
  assert.match(root.innerHTML, /Best attempt · 2 \/ 3 close-range defeats/);
  assert.match(root.innerHTML, /Best attempt · 1 \/ 3 defeats in one hold/);
  assert.match(root.innerHTML, /Best attempt · 500 \/ 500 horizontal flight units/);
  assert.match(root.innerHTML, /Safe landing still required to unlock/);
  assert.match(root.innerHTML, /One room; best attempt, not a total/);
  root.controls.get('#start-with-gun')!.onclick!();
  assert.deepEqual(started, ['pistol'], 'a full unlanded best must not select the locked gun');
  assert.equal(JSON.stringify(p), before);
});

test('Logbook uses separate weapon challenge progress with full instructions and authoritative ownership', () => {
  const p = profile(),
    before = JSON.stringify(p),
    book = loadLogbook(null),
    entries = logbookCatalog([], book, [], null, [], null, p);
  for (const gun of EXPERIMENTAL_GUN_IDS) {
    const entry = entries.find((entry) => entry.weapon === gun)!;
    assert.equal(entry.state, 'locked');
    assert.equal(entry.goal, undefined, 'weapon challenges are not draft-fitting goals');
    assert(entry.weaponChallenge && !entry.weaponChallenge.complete);
    const html = logbookArticle(entry, () => '');
    assert.match(html, /logbook-weapon-challenge/);
    assert.match(html, /Best attempt/);
    assert.match(html, /Use any weapon in Campaign or Daily/);
    assert.match(html, /separate attempts do not add together/);
    assert(!html.includes('New fittings enter'));
    if (gun === 'switchjack') {
      assert.match(html, /Safe landing still required/);
      assert.match(html, /Damage, teleports and pausing cancel/);
      assert(!html.includes('Tool unlocked'));
    }
  }
  const owned = loadWeaponUnlocks({ ...p, licenses: [...EXPERIMENTAL_GUN_IDS] });
  for (const entry of logbookCatalog([], book, [], null, [], null, owned).filter(
    (entry) => entry.weaponChallenge,
  )) {
    assert.equal(entry.state, 'known');
    const html = logbookArticle(entry, () => '');
    assert.match(html, /Tool unlocked/);
    assert(!html.includes('Safe landing still required'));
    assert(
      !html.includes('Best attempt'),
      'grandfathered ownership must not invent a measured best',
    );
  }
  assert.equal(JSON.stringify(p), before);
});

test('existing fitting progress and locks keep their own markup and instructions', () => {
  const book = loadLogbook(null),
    goals = unlockGoals(book, [], [], null),
    entry = logbookCatalog([], book, [], null, goals, null, profile()).find(
      (entry) => entry.goal && !entry.goal.unlocked,
    )!;
  assert(entry);
  assert.equal(entry.weaponChallenge, undefined);
  const html = logbookArticle(entry, () => '');
  assert.match(html, /Unlock progress/);
  assert(!html.includes('logbook-weapon-challenge'));
  assert(!html.includes('Best attempt'));
});
