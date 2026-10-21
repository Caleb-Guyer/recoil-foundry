import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Game } from '../src/game.ts';
import { dailyForDate } from '../src/daily.ts';
import { testCheckpoint } from '../src/practice.ts';
import {
  createReportDraft,
  issueDetails,
  issueDraftUrl,
  playtestDetails,
  runSummary,
  PLAYTEST_THREAD_URL,
} from '../src/issue-report.ts';
import { annexRouteTestFromUrl } from '../src/annex-route.ts';
import { GAME_VERSION } from '../src/version.ts';
import type { Checkpoint } from '../src/rules.ts';

test('report includes run details but title omits previous run information', () => {
  const g = new Game();
  g.startTest(testCheckpoint('REPORT-TEST', 2));
  g.elapsed = 125.9;
  const details = issueDetails(g);
  assert.ok(details.includes(`Version: ${GAME_VERSION}`));
  assert.match(details, /Mode: Preset test/);
  assert.match(details, /Seed: "REPORT-TEST"/);
  assert.match(details, /Room: 3 \/ docks/);
  assert.match(details, /Gun: magnum, rapid/);
  assert.match(details, /Upgrades: Heavy hitter, Hair trigger/);
  assert.match(details, /Active run time: 2:05 \(includes time before Continue; excludes pauses\)/);
  g.setMode('title');
  assert.match(issueDetails(g), /Mode: Title/);
  assert.doesNotMatch(
    issueDetails(g),
    /REPORT-TEST|Room:|Gun:|Seed:|Regional route:|Route revision:|Active run time:|Upgrades:/,
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
    ['playtest', 'playtest.md', 'Best moment:'],
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

test('playtest reports distinguish unanswered questions from a real self-report and do not infer a session', () => {
  const g = new Game();
  g.startTest(testCheckpoint('PLAYTEST', 5));
  g.elapsed = 3650.8;
  g.setMode('dead');
  const draft = createReportDraft(g, 'playtest');
  assert.equal(draft.type, 'playtest');
  assert.equal(draft.playtest.experience, '');
  assert.equal(draft.playtest.bestMoment, '');
  assert.equal(draft.playtest.friction, '');
  assert.equal(draft.playtest.restart, '');
  assert.match(draft.bodies.playtest, /First time playing: Not answered/);
  assert.match(
    draft.bodies.playtest,
    /did you actually restart\? Did you want another run, and why\?\nNot answered/,
  );
  assert.match(draft.playtest.summary, /Active run time: 60:50/);
  assert.match(draft.playtest.summary, /State: dead/);
  assert.match(draft.playtest.summary, /Room: 6/);
  assert.equal(issueDetails(g, 'playtest'), draft.bodies.playtest);
  assert.equal(createReportDraft(g).type, 'bug', 'issue reporting still starts on Bug');
});

test('reviewed playtest text preserves answers and redacted summaries without changing the run or other drafts', () => {
  const g = new Game();
  g.startTest(testCheckpoint('PRIVATE-SEED', 2));
  const before = [g.mode, g.seed, g.hp, g.time, g.elapsed, ...g.mods];
  let saves = 0;
  g.onCheckpoint = () => saves++;
  const draft = createReportDraft(g, 'playtest');
  const bug = draft.bodies.bug;
  Object.assign(draft.playtest, {
    experience: 'Returning player',
    bestMoment: 'Scattershot launches! 🚂 &labels=admin <script>example</script>',
    friction: 'The exit was unclear.\nI expected it to open.',
    restart: 'I stopped after dying. I wanted another try later.',
    summary: `Version: ${GAME_VERSION}\nRoom: 3\nSeed removed.`,
  });
  const report = playtestDetails(draft.playtest);
  const url = new URL(issueDraftUrl(report, 'playtest'));
  assert.equal(url.searchParams.get('body'), report);
  assert.equal(url.searchParams.get('template'), 'playtest.md');
  assert.equal(url.searchParams.has('labels'), false);
  assert.match(report, /Scattershot launches! 🚂 &labels=admin <script>example<\/script>/);
  assert.match(report, /I stopped after dying/);
  assert.doesNotMatch(report, /PRIVATE-SEED|Gun:|Starting gun:/);
  assert.equal(draft.bodies.bug, bug);
  assert.deepEqual([g.mode, g.seed, g.hp, g.time, g.elapsed, ...g.mods], before);
  assert.equal(saves, 0);
  draft.playtest.summary = '';
  assert.doesNotMatch(playtestDetails(draft.playtest), /Version:|Room:|PRIVATE-SEED/);
});

test('maximum playtest answers and summary fit the GitHub draft without dropping any section', () => {
  const report = playtestDetails({
    experience: 'First time',
    bestMoment: 'b'.repeat(900),
    friction: 'f'.repeat(900),
    restart: 'r'.repeat(900),
    summary: 's'.repeat(2700),
  });
  assert(report.length < 6000);
  assert.equal(new URL(issueDraftUrl(report, 'playtest')).searchParams.get('body'), report);
  assert(report.endsWith('s'.repeat(2700)));
});

test('summary reads the current continued checkpoint, omits title leftovers and does not collect account or storage data', () => {
  const original = new Game();
  let save: Checkpoint | undefined;
  original.onCheckpoint = (checkpoint) => {
    save = checkpoint;
  };
  original.start('CONTINUED');
  original.elapsed = 70.8;
  original.save();
  const continued = new Game();
  continued.start('CONTINUED', save!);
  const summary = runSummary(continued);
  assert.match(summary, /Active run time: 1:10/);
  assert.match(summary, /Starting gun: Service pistol/);
  assert.match(summary, /Upgrades: None/);
  assert.doesNotMatch(summary, /https?:\/\/|localStorage|navigator|email|account|profile/i);
  continued.setMode('title');
  assert.equal(runSummary(continued), `Version: ${GAME_VERSION}\nMode: Title`);
});

test('public playtest templates stay version-neutral and point to the same live itch discussion as the menu', () => {
  const form = readFileSync(
    new URL('../.github/ISSUE_TEMPLATE/first_ten_minutes.yml', import.meta.url),
    'utf8',
  );
  const paste = readFileSync(
    new URL('../.github/ISSUE_TEMPLATE/playtest.md', import.meta.url),
    'utf8',
  );
  for (const template of [form, paste]) {
    assert(template.includes(PLAYTEST_THREAD_URL));
    assert.doesNotMatch(template, /5\.6|5\.7|launch devlog/);
    assert.match(template, /includes earlier play before Continue/);
  }
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
