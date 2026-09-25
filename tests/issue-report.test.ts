import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Game } from '../src/game.ts';
import { dailyForDate } from '../src/daily.ts';
import { testCheckpoint } from '../src/practice.ts';
import { createReportDraft, issueDetails, issueDraftUrl } from '../src/issue-report.ts';
import { annexRouteTestFromUrl } from '../src/annex-route.ts';
import { GAME_VERSION } from '../src/version.ts';

test('report includes run details but title omits previous run information', () => {
  const g = new Game();
  g.startTest(testCheckpoint('REPORT-TEST', 2));
  const details = issueDetails(g);
  assert.ok(details.includes(`Version: ${GAME_VERSION}`));
  assert.match(details, /Mode: Preset test/);
  assert.match(details, /Seed: "REPORT-TEST"/);
  assert.match(details, /Room: 3 \/ docks/);
  assert.match(details, /Gun: magnum, rapid/);
  g.setMode('title');
  assert.match(issueDetails(g), /Mode: Title/);
  assert.doesNotMatch(
    issueDetails(g),
    /REPORT-TEST|Room:|Gun:|Seed:|Regional route:|Route revision:/,
  );
});

test('feedback identifies the chosen regional route even after leaving the Annex and never exposes unchosen content', () => {
  const g = new Game();
  g.startTest(annexRouteTestFromUrl(new URL('https://test/?test=annex-route'))!);
  assert.match(issueDetails(g), /Regional route: Not chosen/);
  assert.doesNotMatch(issueDetails(g), /Transmission Annex|Cooling Works/);
  g.region = 'annex';
  g.setMode('dead');
  assert.match(issueDetails(g, 'difficulty'), /State: dead/);
  assert.match(issueDetails(g), /Regional route: Transmission Annex\nRoute revision: 6/);
  g.stage = 12;
  assert.match(issueDetails(g), /Regional route: Transmission Annex/);
  g.region = 'cooling';
  assert.match(issueDetails(g), /Regional route: Cooling Works/);
  assert.doesNotMatch(issueDetails(g), /Transmission Annex/);
});

test('each feedback category opens its real repository template and preserves the reviewed text exactly', () => {
  const g = new Game();
  g.startTest(testCheckpoint('FEEDBACK-TEST', 2));
  g.setMode('won');
  const before = [g.mode, g.seed, g.hp, g.time, ...g.mods];
  const draft = createReportDraft(g);
  for (const [type, template, question] of [
    ['bug', 'bug_report.md', 'Steps to reproduce:'],
    ['difficulty', 'difficulty_report.md', 'Too easy, too hard, or unclear?'],
    ['suggestion', 'suggestion.md', 'Why would it improve the game?'],
  ] as const) {
    assert(draft.bodies[type].includes(question));
    assert.match(draft.bodies[type], /State: won/);
    assert.match(draft.bodies[type], /Seed: "FEEDBACK-TEST"/);
    assert.match(draft.bodies[type], /Gun: magnum, rapid/);
    const reviewed = 'My edited feedback &labels=anything\nUnicode: 🚂\nDetails removed.';
    const url = new URL(issueDraftUrl(reviewed, type));
    assert.equal(url.searchParams.get('template'), template);
    assert.equal(url.searchParams.get('body'), reviewed);
    assert.equal(url.searchParams.size, 2);
    assert.match(
      readFileSync(new URL('../.github/ISSUE_TEMPLATE/' + template, import.meta.url), 'utf8'),
      /^---\r?\nname:/,
    );
  }
  assert.deepEqual([g.mode, g.seed, g.hp, g.time, ...g.mods], before);
});

test('Daily and campaign reports identify their modes without changing the run', () => {
  const g = new Game();
  g.start(dailyForDate('2026-09-20')!.seed);
  const before = [g.mode, g.seed, g.hp, g.time];
  assert.match(issueDetails(g), /Mode: Daily/);
  assert.deepEqual([g.mode, g.seed, g.hp, g.time], before);
  g.start('NORMAL');
  assert.match(issueDetails(g), /Mode: Campaign/);
});

test('draft encodes text into a fixed GitHub destination and bounds its length', () => {
  const body = 'An issue &labels=admin\n# <script>alert("x")</script> + ?seed=secret 🚂';
  const url = new URL(issueDraftUrl(body));
  assert.equal(url.origin, 'https://github.com');
  assert.equal(url.pathname, '/Caleb-Guyer/recoil-foundry/issues/new');
  assert.equal(url.searchParams.get('body'), body);
  assert.equal(url.searchParams.has('labels'), false);
  assert.equal(new URL(issueDraftUrl('x'.repeat(7000))).searchParams.get('body')!.length, 6000);
});
