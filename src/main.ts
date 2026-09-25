import { MUTATIONS, mutationTestFromUrl } from './mutations.ts';
import { creditsMarkup } from './credits.ts';
import { installDialogDismissal } from './dialog-dismissal.ts';
import { annexTestFromUrl } from './annex-layout.ts';
import { switchboardTestFromUrl } from './switchboard-layout.ts';
import { annexRouteTestFromUrl } from './annex-route.ts';
import { ANNEX_ALTERNATES } from './annex-alternates.ts';
import { REGION_NAMES } from './regions.ts';
import { createReportDraft, issueReportMenu, type ReportDraft } from './issue-report.ts';
import { endingCopy } from './ending.ts';
import { presentationTestFromUrl, finishPresentationTest } from './presentation-test.ts';
import { courierTestFromUrl } from './courier-layout.ts';
import { auditorTestFromUrl } from './auditor-layout.ts';
import { floodgateTestFromUrl } from './floodgate-layout.ts';
import { reforgeTestFromUrl } from './reforge-rules.ts';
import { shutdownTestFromUrl } from './shutdown-layout.ts';
import { STORY_ROOMS, storyTestFromUrl } from './story-layout.ts';
import { fabricatorTestFromUrl } from './fabricator-layout.ts';
import { replayTestFromUrl } from './death-replay.ts';
import { DeathReplay, ReplayView } from './death-replay-view.ts';
import { damageCauseText } from './damage-cause.ts';
import {
  LOGBOOK_KEY,
  loadLogbook,
  mergeLogbook,
  migrateLogbook,
  recordLogbook,
  logbookEntries,
  logbookPreviewEntries,
  logbookLink,
} from './logbook.ts';
import { logbookMenu, type LogbookViewState } from './logbook-menu.ts';
import type { EnemyKind } from './levels.ts';
import { TURF_FORMATIONS, type TurfFormation } from './turf-formations.ts';
import { AREA_EVENTS, eventTestFromUrl } from './area-events.ts';
import { countershotTestFromUrl, pressureTestFromUrl, tripwireTestFromUrl } from './practice.ts';
import { torchTestFromUrl } from './practice.ts';
import { branchTestFromUrl, BRANCH_TEST_BUILDS } from './branch-builds.ts';
import { anglerTestFromUrl } from './practice.ts';
import { vectorTestFromUrl } from './practice.ts';
import { wallcrawlerTestFromUrl } from './practice.ts';
import { counterweightTestFromUrl } from './practice.ts';
import { grindshotTestFromUrl, interceptorGrindTestFromUrl } from './practice.ts';
import './style.css';
import {
  COMMENDATIONS,
  COMMENDATIONS_KEY,
  loadCommendations,
  mergeCommendations,
  commendationPreviewLink,
} from './commendations.ts';
import { COSMETICS_KEY, loadCosmetics } from './cosmetics.ts';
import { Game } from './game.ts';
import {
  DISCOVERIES_KEY,
  WORKSHOP_BUILD_KEY,
  discoverBuild,
  loadDiscoveries,
  workshopBuild,
  workshopLink,
} from './workshop-build.ts';
import { workshopMenu } from './workshop-menu.ts';
import {
  RUN_HISTORY_KEY,
  addRun,
  canPracticeRunBuild,
  canReplayRun,
  loadRunHistory,
  snapshotRun,
  type RunRecap,
} from './run-history.ts';
import { bindRecapActions, resultRecap, runHistoryMenu } from './run-history-menu.ts';
import type { Input } from './game.ts';
import { Renderer } from './render.ts';
import { Sound, volumeLevel } from './audio.ts';
import { loadBindings, matches, held, keyLabel, bindingLabel } from './keyboard.ts';
import { keyboardMenu } from './keyboard-menu.ts';
import { DisplaySafety, watchSessionEvents } from './display-safety.ts';
import { Controller, controllerSettings } from './controller.ts';
import {
  confirmControllerMenu,
  focusControllerMenu,
  navigateControllerMenu,
} from './controller-menu.ts';
import { controllerPortalTarget } from './controller-target.ts';
import { musicScene } from './music-score.ts';
import { ProgressStore, PROGRESS_KEY, CHECKPOINT_KEY, mergeDailyRecords } from './progress.ts';
import { progressMenu } from './progress-menu.ts';
import { newSeed, retrySeed } from './run-seed.ts';
import {
  FirstSessionGuide,
  FIRST_SESSION_KEY,
  audioState,
  controlsIntro,
  type ControlDevice,
} from './first-session.ts';
import { AREAS } from './areas.ts';
import {
  MODS,
  loadCheckpoint,
  STAGES,
  modPathLabel,
  modDescription,
  buildPath,
  PATH_NAMES,
  REROLL_COST,
} from './rules.ts';
import type { Checkpoint, Mod } from './rules.ts';
import {
  VICTORIES_KEY,
  PRACTICE_BOSSES,
  loadEncounters,
  testEncounterFromUrl,
  expandedTestFromUrl,
  cargoTestFromUrl,
  squadsTestFromUrl,
  conveyorsTestFromUrl,
  freightTestFromUrl,
  scrapperTestFromUrl,
  harpoonerTestFromUrl,
  routesTestFromUrl,
  destructionTestFromUrl,
  sapperTestFromUrl,
  tetherTestFromUrl,
  arcTestFromUrl,
  salvageTestFromUrl,
  crossingTestFromUrl,
  layoutTestFromUrl,
  reclamationTestFromUrl,
  upgradeTestFromUrl,
  rerollTestFromUrl,
  massDriverTestFromUrl,
  dropworksTestFromUrl,
  overtimeTestFromUrl,
  exitTestFromUrl,
  UPGRADE_TEST_BUILDS,
  FUSION_TEST_BUILDS,
  fusionTestFromUrl,
} from './practice.ts';
import { canPractice, practiceBuild, type Encounter, type PracticeBoss } from './practice.ts';
import { PHYSICS_LAYOUTS } from './physics-layouts.ts';
import {
  DAILY_BESTS_KEY,
  dailyFromSeed,
  dailyFromUrl,
  dailyLink,
  formatDailyTime,
  isUnsupportedDailySeed,
  loadDailyBests,
  recordDailyWin,
  todayDaily,
} from './daily.ts';
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const progress = new ProgressStore(
  () => localStorage,
  (action) =>
    navigator.locks
      ? navigator.locks.request('rf-progress-write', action)
      : Promise.resolve().then(action),
);
let settingsSaveFailed = false;
function read(key: string): unknown {
  if (progress.owns(key)) return progress.read(key);
  if (['rf-checkpoint-v4', 'rf-checkpoint-v3'].includes(key)) return null;
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null');
  } catch {
    return null;
  }
}
function write(key: string, value: unknown) {
  if (progress.owns(key)) {
    void progress.write(key, value);
    return;
  }
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
    settingsSaveFailed = false;
  } catch {
    settingsSaveFailed = true;
  }
  updateSaveStatus();
}
const storedCheckpoint = loadCheckpoint(
  read('rf-checkpoint-v5') ?? read('rf-checkpoint-v4') ?? read('rf-checkpoint-v3'),
);
let unavailableDailySave = !!storedCheckpoint && isUnsupportedDailySeed(storedCheckpoint.seed);
let checkpoint = unavailableDailySave ? null : storedCheckpoint;
const encounters = loadEncounters(read(VICTORIES_KEY));
let discovered = discoverBuild(
  loadDiscoveries(read(DISCOVERIES_KEY)),
  storedCheckpoint?.mods ?? [],
  storedCheckpoint?.legacyMods,
);
let workshopMods = workshopBuild(read(WORKSHOP_BUILD_KEY), discovered);
let practiceTarget: Encounter | null = null;
let practiceEditorParent = 'practice-setup';
const practiceDrafts: Partial<Record<PracticeBoss, string[]>> = {};
let commendations = loadCommendations(read(COMMENDATIONS_KEY));
let runCommendations: typeof commendations = [];
let equippedCosmetics = loadCosmetics(read(COSMETICS_KEY), commendations);
let logbookFromWorkshop = false;
let runHistory = loadRunHistory(read(RUN_HISTORY_KEY));
let logbookProgress = migrateLogbook(read(LOGBOOK_KEY), storedCheckpoint, runHistory, encounters);
const logbookView: LogbookViewState = { section: 'equipment', selected: 'tool', query: '' };
let finishedRun: RunRecap | null = null;
let creditsParent = 'settings';
let reportParent = 'settings';
let reportDraft: ReportDraft | undefined;
function openReport() {
  reportParent = dialogKind;
  reportDraft ??= createReportDraft(game);
  showDialog('issue');
}
function backFromReport() {
  showDialog(reportParent);
  $('open-report').focus();
}
function openCredits() {
  creditsParent = dialogKind;
  showDialog('credits');
}
function backFromCredits() {
  showDialog(creditsParent);
  $('open-credits').focus();
}
function backFromUpdate() {
  closeDialog();
  $('whats-new').focus();
}
document.getElementById('app')!.innerHTML = `
<main id="arena">
 <canvas id="game" tabindex="0" aria-label="Recoil Foundry. A and D to move. Space to jump. Mouse to aim and fire. Shoot down in the air to climb."></canvas>
 <div class="hud"><progress id="health" max="100" value="100" aria-label="Health"></progress><div class="run-info"><span id="stage">01 / ${String(STAGES).padStart(2, '0')}</span><button id="pause" class="icon" aria-label="Pause" title="Pause · Esc"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7 5v10M13 5v10"/></svg></button></div></div>
 <section id="title-screen">
  <div class="title-content"><button id="whats-new" class="update-link" aria-haspopup="dialog"><span>Dead Signal</span><span>What’s new ↗</span></button><h1><span>RECOIL</span><small>FOUNDRY</small></h1>
   <button id="play" class="primary">Play <span aria-hidden="true">↗</span></button>
   <div class="title-actions"><button id="daily" class="quiet">Daily run</button><button id="continue" class="quiet" ${checkpoint ? '' : 'hidden'}>Continue</button><button id="practice" class="quiet" hidden>Practice</button><button id="workshop" class="quiet">Workshop</button><button id="learn" class="quiet" hidden>Learn to play</button></div>
   <p id="title-controls" class="title-controls"><kbd>A</kbd><kbd>D</kbd> move <i>·</i> <kbd>Space</kbd> jump <i>·</i> Mouse fire</p>
   <p id="title-hint" class="recoil-hint">Shoot down. Go up.</p>
  </div><div class="title-settings"><button id="controls" class="quiet">Controls</button><button id="logbook" class="quiet">Logbook</button><button id="history" class="quiet" ${runHistory.length ? '' : 'hidden'}>Recent runs</button><button id="settings" class="quiet">Settings</button></div>
 </section>
 <button id="save-warning" data-save-warning class="save-warning" hidden></button>
 <div id="first-session-tip" class="first-session-tip" hidden><span id="first-session-copy" role="status"></span><button id="dismiss-tip" class="quiet" aria-label="Hide first-run tips">×</button></div>
 <div class="touch-controls" aria-label="Touch controls"><div><button data-touch="left" aria-label="Move left">←</button><button data-touch="right" aria-label="Move right">→</button></div><div><button id="portal-touch" aria-label="Place portal: select, then tap a surface" aria-pressed="false" hidden>◎</button><button data-touch="jump" aria-label="Jump">↑</button></div></div>
</main><dialog id="modal" aria-labelledby="dialog-title"><div id="dialog-content"></div><button data-save-warning class="save-warning modal-save-warning" hidden></button></dialog><span id="save-status" class="sr-only" role="status"></span>`;
const game = new Game(),
  canvas = $<HTMLCanvasElement>('game'),
  renderer = new Renderer(canvas, game),
  sound = new Sound();
const deathReplay = new DeathReplay();
const firstSession = new FirstSessionGuide();
let needsGuidance =
  read(FIRST_SESSION_KEY) !== true &&
  !storedCheckpoint &&
  !runHistory.length &&
  !discovered.length &&
  !encounters.length;
let firstRewardHelp = needsGuidance;
let controlsParent = '';
let progressParent = '';
let updateProgressPanel: (() => void) | undefined;
let allowProgressReload = false;
game.cosmetics = { ...equippedCosmetics };
let replayView: ReplayView | null = null;
let replayRoom = game.level;
const workshopTools = document.createElement('div');
workshopTools.className = 'workshop-tools';
workshopTools.hidden = true;
workshopTools.innerHTML =
  '<button id="workshop-edit" class="quiet">Build</button><button id="workshop-reset" class="icon" aria-label="Reset Workshop" title="Reset room · R">↻</button>';
document.querySelector('.run-info')!.prepend(workshopTools);
const warmupTools = document.createElement('div');
warmupTools.className = 'workshop-tools';
warmupTools.hidden = true;
warmupTools.innerHTML =
  '<button id="warmup-controls" class="quiet">Controls</button><button id="warmup-done" class="quiet">Done</button>';
document.querySelector('.run-info')!.prepend(warmupTools);
const rawSettings = read('rf-settings-v2');
const prefs = (rawSettings && typeof rawSettings === 'object' ? rawSettings : {}) as {
  sound?: boolean;
  music?: boolean;
  reduced?: boolean;
  controller?: unknown;
  bindings?: unknown;
  effectsVolume?: unknown;
  musicVolume?: unknown;
};
const controller = new Controller(controllerSettings(prefs.controller));
const bindings = loadBindings(prefs.bindings);
let bindingEditor: ReturnType<typeof keyboardMenu> | null = null;
let inputDevice: 'pointer' | 'controller' = 'pointer';
let padAim = { x: 1, y: 0 };
sound.enabled = prefs.sound !== false;
sound.musicEnabled = prefs.music !== false;
sound.effectsVolume = volumeLevel(prefs.effectsVolume);
sound.musicVolume = volumeLevel(prefs.musicVolume);
renderer.reduced =
  typeof prefs.reduced === 'boolean'
    ? prefs.reduced
    : matchMedia('(prefers-reduced-motion: reduce)').matches;
const modal = $<HTMLDialogElement>('modal'),
  keys = new Set<string>(),
  touch = { left: false, right: false, jump: false },
  pointer = { x: 500, y: 400 };
let portalTouch = false;
let pointerArmed = false;
let mouseButtons = 0,
  touchAim = new Set<number>(),
  dialogKind = '',
  lastTime = performance.now(),
  accumulator = 0,
  hudAt = 0,
  shownRoom = '',
  pageActive = !document.hidden;
const input: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: false,
  fire: false,
  aim: { x: 600, y: 550 },
};
const entryUrl = new URL(location.href);
let previewCommendations = commendationPreviewLink(entryUrl);
if (previewCommendations) logbookView.section = 'commendations';
const linkedLogbook = logbookLink(entryUrl);
let previewLogbook = linkedLogbook === 'preview';
let linkedTest = testEncounterFromUrl(entryUrl);
let linkedRunTest =
  switchboardTestFromUrl(entryUrl) ??
  annexRouteTestFromUrl(entryUrl) ??
  annexTestFromUrl(entryUrl) ??
  presentationTestFromUrl(entryUrl) ??
  auditorTestFromUrl(entryUrl) ??
  shutdownTestFromUrl(entryUrl) ??
  storyTestFromUrl(entryUrl) ??
  replayTestFromUrl(entryUrl) ??
  fabricatorTestFromUrl(entryUrl) ??
  reforgeTestFromUrl(entryUrl) ??
  floodgateTestFromUrl(entryUrl) ??
  courierTestFromUrl(entryUrl) ??
  mutationTestFromUrl(entryUrl) ??
  eventTestFromUrl(entryUrl) ??
  dropworksTestFromUrl(entryUrl) ??
  massDriverTestFromUrl(entryUrl) ??
  rerollTestFromUrl(entryUrl) ??
  countershotTestFromUrl(entryUrl) ??
  pressureTestFromUrl(entryUrl) ??
  tripwireTestFromUrl(entryUrl) ??
  torchTestFromUrl(entryUrl) ??
  branchTestFromUrl(entryUrl) ??
  anglerTestFromUrl(entryUrl) ??
  vectorTestFromUrl(entryUrl) ??
  counterweightTestFromUrl(entryUrl) ??
  wallcrawlerTestFromUrl(entryUrl) ??
  interceptorGrindTestFromUrl(entryUrl) ??
  grindshotTestFromUrl(entryUrl) ??
  crossingTestFromUrl(entryUrl) ??
  salvageTestFromUrl(entryUrl) ??
  arcTestFromUrl(entryUrl) ??
  layoutTestFromUrl(entryUrl) ??
  tetherTestFromUrl(entryUrl) ??
  sapperTestFromUrl(entryUrl) ??
  destructionTestFromUrl(entryUrl) ??
  routesTestFromUrl(entryUrl) ??
  harpoonerTestFromUrl(entryUrl) ??
  fusionTestFromUrl(entryUrl) ??
  overtimeTestFromUrl(entryUrl) ??
  exitTestFromUrl(entryUrl) ??
  upgradeTestFromUrl(entryUrl) ??
  reclamationTestFromUrl(entryUrl) ??
  scrapperTestFromUrl(entryUrl) ??
  freightTestFromUrl(entryUrl) ??
  conveyorsTestFromUrl(entryUrl) ??
  squadsTestFromUrl(entryUrl) ??
  cargoTestFromUrl(entryUrl) ??
  expandedTestFromUrl(entryUrl);
let linkedDaily = dailyFromUrl(entryUrl);
let linkedWorkshop = workshopLink(entryUrl);
let invalidDailyLink = entryUrl.searchParams.has('daily') && !linkedDaily;
let seedParam = entryUrl.searchParams.has('daily')
  ? undefined
  : entryUrl.searchParams.get('seed')?.slice(0, 40);
let activeDaily = dailyFromSeed(game.seed);
let dailyResult: { best?: number; newBest: boolean; saved: boolean } | null = null;

function updateTitle() {
  $('play').innerHTML =
    `${linkedRunTest ? (linkedRunTest.seed.startsWith('SCRAPPER-') ? 'Test the Scrapper' : linkedRunTest.seed.startsWith('FREIGHT-') ? 'Test freight elevator' : linkedRunTest.seed.startsWith('BELT-') ? 'Test conveyor belts' : linkedRunTest.seed.startsWith('SQUAD-') ? 'Test enemy squads' : linkedRunTest.seed === 'CARGO-DROP' ? 'Test hanging cargo' : 'Test new rooms') : linkedTest ? 'Test ' + PRACTICE_BOSSES[linkedTest.kind].name.replace(/^The /, 'the ') : linkedDaily ? 'Play daily' : 'Play'} <span aria-hidden="true">↗</span>`;
  $('daily').textContent = linkedDaily ? 'Random run' : 'Daily run';
  if (linkedWorkshop) $('play').innerHTML = 'Open Workshop <span aria-hidden="true">↗</span>';
  if (linkedRunTest?.reforge)
    $('play').innerHTML = 'Test Reforge <span aria-hidden="true">↗</span>';
  if (linkedRunTest?.story)
    $('play').textContent =
      (linkedRunTest.seed.endsWith('-INSPECT') ? 'Explore ' : 'Test ') +
      STORY_ROOMS[linkedRunTest.story.kind].name;
  if (linkedRunTest?.seed.startsWith('FABRICATOR-85-'))
    $('play').innerHTML = 'Test the Fabricator <span aria-hidden="true">↗</span>';
  if (linkedRunTest?.seed === 'DEATH-REPLAY-86')
    $('play').innerHTML = 'Test death replay <span aria-hidden="true">↗</span>';
  if (linkedRunTest?.seed.startsWith('FLOODGATE-'))
    $('play').innerHTML = 'Test Floodgate <span aria-hidden="true">↗</span>';
  if (linkedRunTest?.seed.startsWith('COURIER-'))
    $('play').innerHTML =
      (linkedRunTest.reward ? 'Test courier reward' : 'Test Scrap Courier') +
      ' <span aria-hidden="true">↗</span>';
  if (linkedRunTest?.seed.startsWith('MUTATION-')) {
    const kind = Object.keys(MUTATIONS).find((key) =>
      linkedRunTest!.seed.endsWith('-' + key),
    ) as keyof typeof MUTATIONS;
    if (kind)
      $('play').innerHTML =
        'Test ' +
        MUTATIONS[kind].name +
        (linkedRunTest.areaEvent ? ' · Turf War' : '') +
        ' <span aria-hidden="true">↗</span>';
  }
  if (linkedRunTest?.areaEvent && !linkedRunTest.seed.startsWith('MUTATION-'))
    $('play').innerHTML =
      'Test ' +
      (linkedRunTest.areaEvent.kind === 'turf' && entryUrl.searchParams.has('formation')
        ? TURF_FORMATIONS[entryUrl.searchParams.get('formation') as TurfFormation].name
        : AREA_EVENTS[linkedRunTest.areaEvent.kind].name) +
      ' <span aria-hidden="true">↗</span>';
  if (linkedRunTest?.seed === 'RECLAMATION-20')
    $('play').innerHTML = 'Test Reclamation Works <span aria-hidden="true">↗</span>';
  if (linkedRunTest?.seed.startsWith('UPGRADES-'))
    $('play').innerHTML = 'Test new upgrades <span aria-hidden="true">↗</span>';
  if (linkedRunTest?.seed === 'REROLL-61')
    $('play').innerHTML = 'Test upgrade reroll <span aria-hidden="true">↗</span>';
  if (linkedRunTest?.annex)
    $('play').innerHTML = 'Enter the Annex <span aria-hidden="true">↗</span>';
  if (linkedRunTest?.switchboardTest)
    $('play').innerHTML = 'Test the Switchboard <span aria-hidden="true">↗</span>';
  if (linkedRunTest?.annexRouteTest)
    $('play').innerHTML =
      (linkedRunTest.annexRouteTest.fork
        ? 'Test the route fork'
        : linkedRunTest.annexRouteTest.layout === 'alternate'
          ? 'Test ' + ANNEX_ALTERNATES[linkedRunTest.stage].name
          : 'Enter the Annex') + ' <span aria-hidden="true">↗</span>';
  if (linkedRunTest?.seed.startsWith('DROPWORKS-64-'))
    $('play').innerHTML =
      (linkedRunTest.stage === 17 ? 'Test Dropworks Roof' : 'Test the Dropworks') +
      ' <span aria-hidden="true">↗</span>';
  if (linkedRunTest?.seed.startsWith('MASSDRIVER-62-'))
    $('play').innerHTML =
      (entryUrl.searchParams.get('build') === 'forge' ? 'Test Drop Forge' : 'Test Mass Driver') +
      ' <span aria-hidden="true">↗</span>';
  if (linkedRunTest?.overtime)
    $('play').innerHTML = 'Test Overtime <span aria-hidden="true">↗</span>';
  if (linkedRunTest?.shutdown)
    $('play').innerHTML = 'Test shutdown route <span aria-hidden="true">↗</span>';
  if (linkedRunTest?.auditor)
    $('play').innerHTML = 'Test the Auditor <span aria-hidden="true">↗</span>';
  if (linkedRunTest?.seed === 'EXITS-73')
    $('play').innerHTML = 'Test exit elevators <span aria-hidden="true">↗</span>';
  if (linkedRunTest?.seed.startsWith('FUSIONS-'))
    $('play').innerHTML = 'Test fusions <span aria-hidden="true">↗</span>';
  if (linkedRunTest?.seed.startsWith('HARPOONER-'))
    $('play').innerHTML = 'Test the Harpooner <span aria-hidden="true">↗</span>';
  if (linkedRunTest?.seed.startsWith('ROUTES-'))
    $('play').innerHTML = 'Test branching routes <span aria-hidden="true">↗</span>';
  if (linkedRunTest?.seed === 'DESTRUCTION-44')
    $('play').innerHTML = 'Test destructible terrain <span aria-hidden="true">↗</span>';
  if (linkedRunTest?.seed === 'SAPPER-45')
    $('play').innerHTML = 'Test the Sapper <span aria-hidden="true">↗</span>';
  if (linkedRunTest?.seed === 'TETHER-46')
    $('play').innerHTML = 'Test Tether rounds <span aria-hidden="true">↗</span>';
  if (linkedRunTest?.seed.startsWith('ROOM47-'))
    $('play').innerHTML = 'Test new layouts <span aria-hidden="true">↗</span>';
  if (linkedRunTest && entryUrl.searchParams.get('test') === 'arc')
    $('play').innerHTML = 'Test Arc Coil <span aria-hidden="true">↗</span>';
  if (linkedRunTest?.seed === 'SALVAGE-49')
    $('play').innerHTML =
      (entryUrl.searchParams.get('evolved') === '1'
        ? 'Test salvage evolutions'
        : 'Test boss salvage') + ' <span aria-hidden="true">↗</span>';
  if (linkedRunTest?.seed.startsWith('CRAWLER-54-'))
    $('play').innerHTML = 'Test the Wallcrawler <span aria-hidden="true">↗</span>';
  if (linkedRunTest?.seed === 'TRIPWIRE-59')
    $('play').innerHTML = 'Test Tripwire <span aria-hidden="true">↗</span>';
  if (linkedRunTest?.seed === 'TORCH-58')
    $('play').innerHTML = 'Test Cutting Torch <span aria-hidden="true">↗</span>';
  if (linkedRunTest?.seed.startsWith('BRANCHES-71-')) {
    const name = entryUrl.searchParams.has('combo')
      ? 'max combo'
      : (BRANCH_TEST_BUILDS[entryUrl.searchParams.get('build') ?? 'pulse']?.name ??
        'upgrade branches');
    $('play').innerHTML = 'Test ' + name + ' <span aria-hidden="true">↗</span>';
  }
  if (linkedRunTest?.seed.startsWith('ANGLER-57-'))
    $('play').innerHTML = 'Test the Angler <span aria-hidden="true">↗</span>';
  if (linkedRunTest?.seed === 'VECTOR-56')
    $('play').innerHTML = 'Test Vector rounds <span aria-hidden="true">↗</span>';
  if (linkedRunTest?.seed.startsWith('BALANCE-55-'))
    $('play').innerHTML = 'Test counterweights <span aria-hidden="true">↗</span>';
  if (linkedRunTest?.seed.startsWith('PRESSURE-60-'))
    $('play').innerHTML = 'Test pressure vents <span aria-hidden="true">↗</span>';
  if (linkedRunTest?.seed.startsWith('COUNTERSHOT-61-'))
    $('play').innerHTML = 'Test Countershot <span aria-hidden="true">↗</span>';
  if (linkedRunTest?.seed.startsWith('SAW-BOSS-53-'))
    $('play').innerHTML = 'Test Interceptor saws <span aria-hidden="true">↗</span>';
  if (linkedRunTest?.seed === 'GRIND-52')
    $('play').innerHTML = 'Test Grindshot <span aria-hidden="true">↗</span>';
  if (linkedRunTest?.seed.startsWith('CROSSING-51-'))
    $('play').innerHTML = 'Test Freight Crossing <span aria-hidden="true">↗</span>';
  $('daily').title = linkedDaily
    ? 'Start a fresh random run'
    : "Today's shared challenge · resets at midnight UTC";
  $('continue').hidden = !checkpoint;
  $('practice').hidden = encounters.length === 0;
  $('continue').textContent =
    checkpoint && dailyFromSeed(checkpoint.seed) ? 'Continue daily' : 'Continue';
  $('title-hint').textContent = linkedRunTest
    ? linkedRunTest.seed.startsWith('SCRAPPER-')
      ? 'Watch the second wave. Shoot the held crate. R to retry.'
      : linkedRunTest.seed.startsWith('FREIGHT-')
        ? 'Ride up. Watch the doors. R to restart test.'
        : linkedRunTest.seed.startsWith('BELT-')
          ? 'Ride the rollers. R to restart test.'
          : linkedRunTest.seed.startsWith('SQUAD-')
            ? 'Squad in the second wave. R to restart test.'
            : linkedRunTest.seed === 'CARGO-DROP'
              ? 'Shoot the cable. R to restart test.'
              : 'Full health. Preset gun. R to restart test.'
    : linkedTest
      ? `Full health. ${PRACTICE_BOSSES[linkedTest.kind].stage} upgrades. R to retry.`
      : linkedDaily
        ? `Daily · ${linkedDaily.date}`
        : invalidDailyLink
          ? 'Challenge link unavailable. Start a fresh run.'
          : unavailableDailySave
            ? 'Saved daily unavailable. Start a new daily.'
            : 'Shoot down. Go up.';
  if (linkedRunTest?.seed.startsWith('UPGRADES-'))
    $('title-hint').textContent = 'Choose a build. Try its follow-up. R to retry.';
  if (linkedRunTest?.seed === 'REROLL-61')
    $('title-hint').textContent = 'Start at a reward. 64 health. R to restart test.';
  if (linkedRunTest?.annex)
    $('title-hint').textContent =
      'Dead Signal prototype. ' +
      (linkedRunTest.mods.includes('priority-target')
        ? 'Priority Target equipped. '
        : linkedRunTest.mods.includes('dead-switch')
          ? 'Dead Switch equipped. '
          : linkedRunTest.mods.includes('standing-orders')
            ? 'Standing Orders equipped. '
            : linkedRunTest.mods.includes('cross-talk')
              ? 'Cross Talk equipped. '
              : linkedRunTest.annex.spoof
                ? 'Spoof equipped. '
                : '') +
      'R to retry.';
  if (linkedRunTest?.annexRouteTest)
    $('title-hint').textContent = linkedRunTest.annexRouteTest.fork
      ? 'Climb to the Annex. Continue along the floor for Cooling Works.'
      : 'Four rooms. One new route. R to retry.';
  if (linkedRunTest?.reforgeRoom)
    $('title-hint').textContent = 'One exchange. 64 health. R to restart test.';
  if (linkedRunTest?.shutdown)
    $('title-hint').textContent =
      'Isolated route test. Your save and discoveries stay untouched. R to retry.';
  if (linkedRunTest?.story)
    $('title-hint').textContent =
      'Explore the room. Test discoveries stay in this run. R to retry.';
  if (linkedRunTest?.auditor)
    $('title-hint').textContent =
      linkedRunTest.auditor.status === 'sealed'
        ? 'Approach and shoot the sealed case on the left. R to retry.'
        : 'Watch the amber door. Full health. R to retry.';
  if (linkedRunTest?.seed.startsWith('FABRICATOR-85-'))
    $('title-hint').textContent = 'Interrupt the weld. Full health. R to retry.';
  if (linkedRunTest?.seed === 'DEATH-REPLAY-86')
    $('title-hint').textContent = 'One health. Let an enemy hit you, then watch the replay.';
  if (linkedRunTest?.seed.startsWith('COURIER-') && linkedRunTest.reward)
    $('title-hint').textContent = 'Recovered cargo. 64 health. R to restart test.';
  else if (
    linkedRunTest?.seed.startsWith('COURIER-') &&
    entryUrl.searchParams.get('build') === 'starter'
  )
    $('title-hint').textContent = 'Full health. Starting gun. R to restart test.';
  if (linkedRunTest?.seed === 'EXITS-73')
    $('title-hint').textContent = 'Up: New Game+. Right: finish. R to restart test.';
  if (linkedRunTest?.seed.startsWith('DROPWORKS-64-'))
    $('title-hint').textContent = 'Climb the stairs. Drop the loads. R to restart test.';
  if (linkedRunTest?.seed.startsWith('MASSDRIVER-62-'))
    $('title-hint').textContent =
      entryUrl.searchParams.get('build') === 'forge'
        ? 'Get above them. Let the shots fall. R to restart test.'
        : 'Arc your shots. Launch the crates. R to restart test.';
  if (linkedRunTest?.seed.startsWith('FUSIONS-'))
    $('title-hint').textContent = 'Choose a fusion. Full health. R to retry.';
  if (linkedRunTest?.seed.startsWith('HARPOONER-'))
    $('title-hint').textContent = 'Dodge the hook. Shoot the winch. R to retry.';
  if (linkedRunTest?.seed.startsWith('ROUTES-'))
    $('title-hint').textContent = linkedRunTest.route
      ? (linkedRunTest.route === 'high' ? 'High road. ' : 'Low road. ') + 'R to retry.'
      : 'Clear the room. Below: cover. Above: platforms. R to retry.';
  if (linkedRunTest?.seed === 'DESTRUCTION-44')
    $('title-hint').textContent = 'Shoot cracked cover. Drop the ledges. R to retry.';
  if (linkedRunTest?.seed === 'SAPPER-45')
    $('title-hint').textContent = 'Watch the fuse. Shoot charges back. R to retry.';
  if (linkedRunTest?.seed === 'TETHER-46')
    $('title-hint').textContent = 'Hit two enemies. Stretch the cable. R to retry.';
  if (linkedRunTest?.seed.startsWith('ROOM47-'))
    $('title-hint').textContent = 'Choose a room. Full health. R to retry.';
  if (linkedRunTest && entryUrl.searchParams.get('test') === 'arc')
    $('title-hint').textContent = 'Three hits. Follow the spark. R to retry.';
  if (linkedRunTest?.seed === 'SALVAGE-49')
    $('title-hint').textContent = 'Salvage equipped. Shoot backward to ram. R to retry.';
  if (linkedRunTest?.seed === 'SALVAGE-49' && entryUrl.searchParams.get('evolved') === '1')
    $('title-hint').textContent = 'Salvage evolutions equipped. R to retry.';
  if (linkedRunTest?.seed.startsWith('BRANCHES-71-')) {
    const hints: Record<string, string> = {
      icebreaker: 'Build cold. Hit a frozen enemy to shatter it. R to retry.',
      coldfront: 'Cold bursts chill nearby enemies. Follow up with shots. R to retry.',
      crosshatch: 'Hold fire, aim, then release the volley. R to retry.',
      tripline: 'Fire to place traps. Draw enemies close to trigger them. R to retry.',
      retrace: 'Returning rounds follow your banks and portals. R to retry.',
      wallrunner: 'Shoot away from a wall to grip it, then jump. R to retry.',
      airbrake: 'Fire in the air, release to brake, then fire to redirect. R to retry.',
      grapnel: 'Shoot a wall in midair. Recoil swings the cable; jump detaches. R to retry.',
      convoy: 'Hold fire while moving, then release the trailing volley. R to retry.',
      thermal: 'Chill enemies beside your burning impacts to burst steam. R to retry.',
      pocket: 'Bank off walls to redirect shots toward exposed enemies. R to retry.',
      scrap: 'Shoot crates or cover apart, then fire the loaded shrapnel. R to retry.',
    };
    const hint = hints[entryUrl.searchParams.get('build') ?? ''];
    if (hint) $('title-hint').textContent = hint;
  }
  if (linkedRunTest?.seed.startsWith('PRESENTATION-')) {
    $('play').textContent = 'Preview ending';
    $('title-hint').textContent = 'Ending preview. Your save and discoveries stay untouched.';
  }
  $('title-hint').textContent = $('title-hint').textContent!.replace(
    /\bR to /g,
    bindingLabel(bindings, 'retry') + ' to ',
  );
}
function clearInput(disarm = true) {
  if (disarm) controller.disarm();
  keys.clear();
  mouseButtons = 0;
  pointerArmed = false;
  touchAim.clear();
  touch.left = touch.right = touch.jump = false;
  input.left = input.right = input.jump = input.jumpHeld = input.fire = false;
  input.firePressed = false;
  input.portal = undefined;
  input.move = undefined;
  renderer.portalAim = undefined;
  portalTouch = false;
  $('portal-touch').setAttribute('aria-pressed', 'false');
}
function closeDialog() {
  bindingEditor?.cancel();
  bindingEditor = null;
  replayView?.dispose();
  replayView = null;
  if (modal.open) modal.close();
  dialogKind = '';
  clearInput();
}
function persistSettings() {
  write('rf-settings-v2', {
    sound: sound.enabled,
    music: sound.musicEnabled,
    reduced: renderer.reduced,
    controller: controller.settings,
    bindings,
    effectsVolume: sound.effectsVolume,
    musicVolume: sound.musicVolume,
  });
  updateAudioState();
  updateTitle();
  updateControlHints();
}
function controlDevice(): ControlDevice {
  return inputDevice === 'controller'
    ? 'controller'
    : matchMedia('(pointer: coarse)').matches
      ? 'touch'
      : 'keyboard';
}
function updateAudioState() {
  const state = audioState(
    sound.enabled,
    sound.musicEnabled,
    sound.effectsVolume,
    sound.musicVolume,
  );
  $('settings').textContent = state.settings;
  for (const [id, text] of [
    ['sound-state', state.sound],
    ['music-state', state.music],
    ['audio-note', state.note],
  ]) {
    const el = document.getElementById(id);
    if (el) {
      el.textContent = text;
      if (id === 'audio-note') el.hidden = !text;
    }
  }
  for (const channel of ['effects', 'music'] as const) {
    const level = channel === 'effects' ? sound.effectsVolume : sound.musicVolume;
    const muted = !sound.enabled || level === 0 || (channel === 'music' && !sound.musicEnabled);
    const slider = document.getElementById(channel + '-volume') as HTMLInputElement | null;
    const output = document.getElementById(channel + '-volume-value');
    if (output) output.textContent = muted ? 'Muted' : `${Math.round(level * 100)}%`;
    slider?.setAttribute(
      'aria-valuetext',
      `${Math.round(level * 100)} percent${muted ? ', muted' : ''}`,
    );
  }
}
function updateSaveStatus() {
  const failed =
    settingsSaveFailed || ['unavailable', 'unreadable', 'conflict'].includes(progress.state);
  const message =
    progress.state === 'conflict'
      ? 'Progress changed in another tab · Review'
      : settingsSaveFailed && progress.state === 'saved'
        ? 'Settings not saved · Details'
        : 'Progress not saved · Backup';
  document.querySelectorAll<HTMLButtonElement>('[data-save-warning]').forEach((button) => {
    button.hidden = !failed || (button.closest('dialog') !== null && dialogKind === 'progress');
    button.textContent = message;
  });
  if (failed) $('save-status').textContent = message;
  if (dialogKind === 'progress') {
    updateProgressPanel?.();
    if (settingsSaveFailed) {
      const status = document.getElementById('progress-state');
      if (status) status.textContent += ' Settings changes could not be saved.';
    }
  }
  if (dailyResult?.best !== undefined) {
    const row = document.querySelector('.daily-best');
    if (row)
      row.textContent =
        (failed
          ? 'Time not saved · '
          : progress.state === 'saving'
            ? 'Saving time · '
            : dailyResult.newBest
              ? 'New best · '
              : 'Personal best · ') + formatDailyTime(dailyResult.best);
  }
  if (
    progress.state === 'conflict' &&
    game.mode === 'playing' &&
    !game.testRun &&
    !game.practice &&
    !game.workshop.active
  ) {
    queueMicrotask(() => {
      if (game.mode === 'playing') openProgress();
    });
  }
}
function openProgress() {
  progressParent = modal.open && dialogKind !== 'progress' ? dialogKind : '';
  showDialog('progress');
}
function backFromProgress() {
  if (progress.restoring) return;
  if (progressParent) showDialog(progressParent);
  else resume();
}
function reloadProgress() {
  // Leave test, seed and Daily links behind when restoring the saved profile.
  allowProgressReload = true;
  location.assign(location.pathname + '?progress=1');
}
function finishGuidance() {
  needsGuidance = false;
  write(FIRST_SESSION_KEY, true);
  $('learn').hidden = true;
}
function updateFirstSession() {
  if (firstSession.active && (firstSession.complete || (!firstSession.warmup && game.stage > 0))) {
    if (needsGuidance) finishGuidance();
    if (!firstSession.warmup && game.stage > 0) firstSession.stop();
  }
  const text = firstSession.message(game, controlDevice(), bindings);
  $('first-session-tip').hidden = !text;
  if ($('first-session-copy').textContent !== text) $('first-session-copy').textContent = text;
  $('dismiss-tip').hidden = firstSession.warmup;
  warmupTools.hidden = !firstSession.warmup || game.mode !== 'playing';
  workshopTools.hidden = !game.workshop.active || firstSession.warmup;
  if (firstSession.warmup) $('stage').textContent = 'WARM-UP';
}
function openControls() {
  if (!['title', 'playing', 'paused'].includes(game.mode)) return;
  controlsParent = modal.open && ['pause', 'settings'].includes(dialogKind) ? dialogKind : '';
  showDialog('controls');
}
function backFromControls() {
  if (controlsParent) showDialog(controlsParent);
  else {
    resume();
    if (game.mode === 'title') $('controls').focus();
  }
}
function updateMusic(active = pageActive && document.hasFocus() && !document.hidden) {
  sound.updateMusic(musicScene(game), active);
  sound.updateTorch(
    active && game.mode === 'playing' && game.torch.active && game.hitStop <= 0,
    game.torch.heat,
  );
}
function start(save?: Checkpoint, retry = false, seedOverride?: string) {
  if (progress.restoring) return;
  progress.checkExternal();
  if (progress.state === 'conflict') {
    openProgress();
    return;
  }
  if (retry && game.workshop.active) {
    startWorkshop(game.mods, firstSession.warmup);
    return;
  }
  if (retry && game.testRun) {
    startRunTest(game.testRun);
    return;
  }
  if (retry && game.practice) {
    startPractice(game.practice, game.practice.build ?? null);
    return;
  }
  finishedRun = null;
  firstSession.stop();
  runCommendations = [];
  linkedTest = null;
  linkedRunTest = null;
  linkedWorkshop = false;
  previewCommendations = false;
  commendations = mergeCommendations(commendations, read(COMMENDATIONS_KEY));
  equippedCosmetics = loadCosmetics(equippedCosmetics, commendations);
  game.cosmetics = { ...equippedCosmetics };
  sound.unlock();
  sound.resetMusic();
  closeDialog();
  const seed =
    save?.seed ??
    (retry ? retrySeed(game.seed) : (seedOverride ?? linkedDaily?.seed ?? seedParam ?? newSeed()));
  activeDaily = dailyFromSeed(seed);
  linkedDaily = activeDaily;
  invalidDailyLink = false;
  unavailableDailySave = false;
  if (activeDaily) {
    seedParam = undefined;
    history.replaceState(null, '', dailyLink(activeDaily, location.href));
  } else {
    const url = new URL(location.href);
    url.searchParams.delete('test');
    url.searchParams.delete('workshop');
    url.searchParams.delete('area');
    url.searchParams.delete('formation');
    url.searchParams.delete('build');
    url.searchParams.delete('daily');
    url.searchParams.delete('dv');
    if (seedParam !== seed) {
      seedParam = undefined;
      url.searchParams.delete('seed');
    }
    history.replaceState(null, '', url);
  }
  dailyResult = null;
  game.start(seed, save);
  if (needsGuidance && !save && !activeDaily) firstSession.start(game);
  updateFirstSession();
  renderer.reset();
  pointer.x = canvas.clientWidth * 0.55;
  pointer.y = canvas.clientHeight * 0.6;
  if (game.mode === 'playing') canvas.focus();
}
function startPractice(encounter: Encounter, mods: readonly string[] | null = null) {
  if (!canPractice(encounter, encounters, mods === null ? linkedTest : null)) return;
  firstSession.stop();
  finishedRun = null;
  runCommendations = [];
  sound.unlock();
  sound.resetMusic();
  closeDialog();
  activeDaily = null;
  dailyResult = null;
  game.startPractice(encounter, mods, discovered);
  renderer.reset();
  pointer.x = canvas.clientWidth * 0.55;
  pointer.y = canvas.clientHeight * 0.6;
  canvas.focus();
}
function openPracticeBuild(encounter: Encounter, parent = 'practice-setup') {
  if (!canPractice(encounter, encounters)) return;
  practiceTarget = encounter;
  practiceEditorParent = parent;
  if (parent !== 'practice-setup' && game.practice?.build)
    practiceDrafts[encounter.kind] = [...game.practice.build];
  showDialog('practice-build');
}
function backFromPracticeBuild() {
  showDialog(practiceEditorParent);
  document.querySelector<HTMLButtonElement>('#practice-edit, #practice-workshop')?.focus();
}
function startRunTest(save: Checkpoint) {
  firstSession.stop();
  finishedRun = null;
  runCommendations = [];
  sound.unlock();
  sound.resetMusic();
  closeDialog();
  activeDaily = null;
  dailyResult = null;
  game.startTest(save);
  finishPresentationTest(game);
  renderer.reset();
  pointer.x = canvas.clientWidth * 0.55;
  pointer.y = canvas.clientHeight * 0.6;
  if (game.mode === 'playing') canvas.focus();
}
function startWorkshop(mods: readonly string[] = workshopMods, warmup = false) {
  firstSession.stop();
  finishedRun = null;
  runCommendations = [];
  sound.unlock();
  sound.resetMusic();
  closeDialog();
  activeDaily = null;
  dailyResult = null;
  if (!warmup) {
    workshopMods = workshopBuild(mods, discovered);
    if (!previewCommendations) write(WORKSHOP_BUILD_KEY, workshopMods);
  }
  game.startWorkshop(discovered, warmup ? [] : workshopMods);
  if (warmup) firstSession.start(game, true);
  updateFirstSession();
  renderer.reset();
  pointer.x = canvas.clientWidth * 0.55;
  pointer.y = canvas.clientHeight * 0.6;
  canvas.focus();
}
function menu() {
  firstSession.stop();
  closeDialog();
  game.setMode('title');
}
function backFromPractice() {
  if (game.mode === 'dead' || game.mode === 'won') showDialog('result');
  else if (game.mode === 'paused') showDialog('pause');
  else resume();
}
function captureFinishedRun() {
  if (
    finishedRun ||
    game.practice ||
    game.testRun ||
    game.workshop.active ||
    (game.mode !== 'dead' && game.mode !== 'won')
  )
    return;
  const id = Array.from(crypto.getRandomValues(new Uint32Array(4)), (n) =>
    n.toString(16).padStart(8, '0'),
  ).join('');
  finishedRun = snapshotRun(game, id);
  if (!finishedRun) return;
  runHistory = addRun([...runHistory, ...loadRunHistory(read(RUN_HISTORY_KEY))], finishedRun);
  write(RUN_HISTORY_KEY, runHistory);
}
function replayFinishedRun(run: RunRecap) {
  if (!canReplayRun(run)) return;
  // A replay begins at room one; the archived gun belongs only in Workshop.
  const url = new URL(location.href);
  url.search = '';
  url.hash = '';
  url.searchParams.set('seed', run.seed);
  history.replaceState(null, '', url);
  linkedDaily = null;
  seedParam = run.seed;
  start(undefined, false, run.seed);
}
function workshopFromRun(run: RunRecap) {
  discovered = loadDiscoveries([...discovered, ...loadDiscoveries(read(DISCOVERIES_KEY))]);
  if (canPracticeRunBuild(run, discovered)) startWorkshop(run.mods);
}
function backFromHistory() {
  if (game.mode === 'dead' || game.mode === 'won') showDialog('result');
  else resume();
}
function backFromLogbook() {
  if (logbookFromWorkshop) {
    logbookFromWorkshop = false;
    showDialog('workshop');
    document.querySelector<HTMLButtonElement>('[data-workshop-tab="appearance"]')?.click();
    return;
  }
  previewLogbook = false;
  if (game.mode === 'paused') {
    showDialog('pause');
    $('back').focus();
  } else if (game.mode === 'dead' || game.mode === 'won') showDialog('result');
  else {
    resume();
    if (game.mode === 'title') $('logbook').focus();
  }
}
function updateLogbook(enemy?: EnemyKind) {
  if (game.practice || game.testRun || game.workshop.active || game.mode === 'title') return;
  const before = logbookProgress;
  logbookProgress = recordLogbook(
    mergeLogbook(before, loadLogbook(read(LOGBOOK_KEY))),
    game,
    enemy,
  );
  if (JSON.stringify(before) !== JSON.stringify(logbookProgress))
    write(LOGBOOK_KEY, logbookProgress);
}
game.onEnemyDefeated = updateLogbook;
game.onCommendation = (id) => {
  if (!game.commendations.eligible) return;
  commendations = mergeCommendations(commendations, read(COMMENDATIONS_KEY));
  if (!commendations.includes(id)) runCommendations.push(id);
  commendations = mergeCommendations(commendations, [id]);
  write(COMMENDATIONS_KEY, commendations);
};
game.onCheckpoint = (s) => {
  if (game.practice || game.testRun || game.workshop.active) return;
  if (s) {
    const next = discoverBuild(
      loadDiscoveries([...discovered, ...loadDiscoveries(read(DISCOVERIES_KEY))]),
      s.mods,
      s.legacyMods,
    );
    if (next.length !== discovered.length) {
      discovered = next;
      write(DISCOVERIES_KEY, discovered);
    }
  }
  checkpoint = s;
  write(CHECKPOINT_KEY, s);
};
game.onSound = (kind) => sound.play(kind);
game.onHaptic = (kind, strength) => {
  if (inputDevice === 'controller' && pageActive && document.hasFocus() && !document.hidden)
    controller.rumble(kind, strength, performance.now());
};
game.onBossDefeated = (kind) => {
  if (game.practice || game.testRun || game.workshop.active) return;
  const victory = loadEncounters([{ kind, seed: game.layoutSeed }])[0];
  if (!victory || encounters.some((record) => record.kind === kind)) return;
  encounters.push(victory);
  write(VICTORIES_KEY, encounters);
  updateTitle();
};
deathReplay.onReady = () => {
  const button = document.getElementById('watch-replay');
  if (button) button.hidden = !deathReplay.ready;
};
game.onDeath = (origin) => {
  // This hook runs before transient combat objects are removed by setMode.
  try {
    renderer.draw(performance.now());
    deathReplay.finish(canvas, game.elapsed, {
      player: renderer.toCanvas(game.player.position),
      ...(origin ? { origin: renderer.toCanvas(origin) } : {}),
      label: damageCauseText(game.deathCause),
    });
  } catch {
    // Optional replay capture must never block the result screen or saving.
    deathReplay.reset();
  }
};
game.onChange = () => {
  if (game.mode === 'playing' || game.mode === 'title') reportDraft = undefined;
  updateLogbook();
  if (replayRoom !== game.level || game.mode === 'title' || game.mode === 'won') {
    replayRoom = game.level;
    deathReplay.reset();
  }
  captureFinishedRun();
  $('history').hidden = runHistory.length === 0;
  updateMusic();
  if (game.mode !== 'playing') controller.stopRumble();
  const room = game.layoutSeed + ':' + game.stage + ':' + game.level.id;
  if (room !== shownRoom) {
    renderer.reset();
    shownRoom = room;
    padAim = { x: 1, y: 0 };
  }
  document.body.dataset.mode = game.mode;
  document.body.dataset.workshop = String(game.workshop.active);
  workshopTools.hidden = !game.workshop.active;
  $('title-screen').hidden = game.mode !== 'title';
  $('stage').textContent = game.workshop.active
    ? 'WORKSHOP'
    : game.practice
      ? 'PRACTICE'
      : (game.testRun ? 'TEST · ' : activeDaily ? 'DAILY · ' : '') +
        (game.overtime ? 'OT · ' : '') +
        (game.escape
          ? 'ESCAPE'
          : game.detour
            ? 'CHALLENGE'
            : String(game.stage + 1).padStart(2, '0') + ' / ' + String(STAGES).padStart(2, '0'));
  $('stage').title = game.practice
    ? PRACTICE_BOSSES[game.practice.kind].name
    : `${activeDaily ? 'Daily · ' + activeDaily.date + ' · ' : ''}${game.level.annex ? REGION_NAMES.annex : AREAS[game.level.area].name} · ${game.level.name}`;
  if (game.testRun?.annex) {
    $('stage').textContent = 'DEAD SIGNAL · TEST';
    $('stage').title = 'Transmission Annex · One-room prototype';
  }
  updateTitle();
  updateFirstSession();
  if (game.mode === 'upgrade') showDialog('upgrade');
  if (game.mode === 'reforge') showDialog('reforge');
  if (game.mode === 'dead' || game.mode === 'won') showDialog('result');
};
function modMark(mod: Mod) {
  const paths: Record<string, string> = {
    spoof: 'M12 11h23v26H12zM17 18h10M17 24h7M35 14h8v20h-8M39 20l7 4-7 4',
    'standing-orders': 'M15 9h26v22L28 41 15 31zM21 17h14M21 23h14M24 29h8',
    'priority-target': 'M16 8h-7v8M40 8h7v8M9 32v8h7M47 32v8h-7M17 24h22M28 13v22',
    'cross-talk': 'M7 12h16v24H7zM33 12h16v24H33zM23 18h10M27 14l6 4-6 4M33 30H23l6 4',
    'dead-switch': 'M17 9h22v27H17zM28 14l-6 10h10l-4 8M8 5l4 5M48 5l-4 5M8 41l4-5M48 41l-4-5',
    'coolant-rounds': 'M28 7v34M13 15l30 18M13 33l30-18M22 10l6 6 6-6M22 38l6-6 6 6',
    'deep-freeze': 'M15 10h26v28H15zM28 14v20M19 19l18 10M19 29l18-10',
    icebreaker: 'M7 24h21M19 17l9 7-9 7M35 7l-6 14 10 6-6 14M43 12l6-5M44 35l6 5',
    'cold-snap': 'M28 7l4 11 12-3-8 9 8 9-12-3-4 11-4-11-12 3 8-9-8-9 12 3z',
    'cold-front': 'M8 24h12M15 18l6 6-6 6M30 7v34M23 15l14 18M23 33l14-18M44 16v16',
    suspension: 'M8 24h9M24 17v14M30 17v14M40 24h10M44 18l6 6-6 6',
    crosshatch: 'M8 8l40 32M8 40L48 8M8 24h40M28 18v12',
    'thread-the-needle': 'M7 24h41M17 14v20M28 10v28M40 6v36M44 20l5 4-5 4',
    tripline: 'M10 24h36M10 18v12M46 18v12M25 21h6v6h-6zM22 8l6 7 6-7',
    'chain-release': 'M8 25h8M24 25h8M40 25h8M9 19v12M25 19v12M41 19v12M13 10h29l-6-5',
    retrace: 'M8 34l12-23 18 26 10-17M8 39l12-22 17 25M7 31v8h8',
    wallrunner: 'M10 7v35M16 34V18l15-7M25 10l6 1-1 7M23 27h9v9h-9z',
    'air-brake': 'M7 17l15 7-15 7M49 17l-15 7 15 7M26 13v22M30 13v22',
    grapnel: 'M10 40L39 11M30 9h13v13M10 31v9h9',
    convoy: 'M7 34l8-6 8 2 8-11 13-3M7 34h1M15 28h1M23 30h1M39 12l8 4-6 7',
    'thermal-shock': 'M12 38l5-9-5-8 5-10M26 38l5-9-5-8 5-10M40 38l5-9-5-8 5-10',
    'corner-pocket': 'M8 9h40M12 36l16-23 14 20M35 30l7 3 2-8',
    'scrap-feed': 'M9 9h15v15H9zM12 12l9 9M33 25l10-8M35 33l12 1M29 40l5 7M10 36h12',
    'pulse-chamber': 'M6 16h10M21 24h10M36 32h15M44 26l7 6-7 6M37 7v11',
    'charge-lens': 'M7 24h12M30 10a14 14 0 1 0 0 28M28 17v14M35 24h16M44 17l7 7-7 7',
    'prism-array': 'M5 24h16l10-12 10 12-10 12-10-12M41 24l11-12M41 24l11 12',
    pinwheel: 'M7 24h42M7 24l34-15M7 24l34 15M44 11q9 13 0 26',
    'follow-through': 'M7 12h19v7H7zM28 30h19v7H28zM12 32h9M17 27l5 5-5 5M26 15h14',
    'shaped-charge': 'M8 24l34-16v32L8 24M17 24h30M35 18l12 6-12 6',
    'cluster-shell':
      'M7 20h12v8H7zM19 24l17-13M19 24h23M19 24l17 13M39 8h6v6h-6zM44 21h6v6h-6zM39 34h6v6h-6z',
    'skid-plate': 'M5 40h46M17 29a8 8 0 1 0 16 0 8 8 0 0 0-16 0M5 17l13 5M34 29h15M43 24l6 5-6 5',
    'relay-gate': 'M17 8c-13 0-13 32 0 32M17 8c13 0 13 32 0 32M29 34l11-22 10 22M35 12h5v7',
    'short-circuit': 'M28 6l-9 18h10l-4 18 14-23H29l4-13M8 16v16M46 16v16',
    triphammer: 'M7 12l16 11-9 15M23 23h17M34 16l8 7-8 7M11 25l-5 9M38 39l11-9',
    crosscut: 'M5 39h46M26 26H5M12 19l-7 7 7 7M30 26h21M44 19l7 7-7 7M28 8v14',
    resonator: 'M7 13v30M13 20v16M18 28h17M38 13v30M44 20v16M35 23l5 5-5 5',
    flywheel: 'M38 16a16 16 0 1 0 5 17M38 8v9h9M28 19v9l8 5M9 47h38',
    'storm-cell': 'M8 42l20-30 20 30ZM24 23l-5 10h9l-3 9 13-17h-9l3-6',
    'drop-forge':
      'M28 6v8M19 10l2 7M37 10l-2 7M35 24a7 7 0 1 0-14 0 7 7 0 0 0 14 0M17 39h22M28 34v5M13 32l5 4M43 32l-5 4',
    'mass-driver': 'M8 12h14l8 8M8 36h14l8-8M27 24h5M49 24a8 8 0 1 0-16 0 8 8 0 0 0 16 0M38 20l4-1',
    heavy: 'M10 24h34M34 17l10 7-10 7',
    spread: 'M9 24h12M27 24h18M27 13l16-5M27 35l16 5',
    rapid: 'M8 24h8M24 24h8M40 24h8',
    bounce: 'M10 38l18-28 18 28M20 10h8v8',
    pierce: 'M8 24h42M22 10v28M36 10v28',
    split: 'M8 24h17M25 24l21-14M25 24h21M25 24l21 14',
    air: 'M12 34l14-22 14 22M19 12h7v8M9 40h34',
    kick: 'M45 24H10M20 14L10 24l10 10',
    heal: 'M26 10v28M12 24h28',
    light: 'M10 33l14-20M24 33l14-20M38 33l10-14',
    burst: 'M8 16h10M22 24h10M36 32h10M46 12v6',
    shellshock: 'M8 30l12-12 12 12-12 12zM28 8l2 7M39 13l-5 6M43 26l-8 1M7 8l5 5',
    'blast-surf': 'M8 36l12-8 12 8M20 28V8m-7 8 7-8 7 8M34 25l8 11 5-3',
    aftershock: 'M26 14a10 10 0 1 0 0 20M26 7a17 17 0 1 0 0 34M33 16l8 8-8 8M41 24H26',
    'chain-reaction': 'M9 24h8m14 0h8M4 19h10v10H4zM19 17h10v14H19zM36 19h10v10H36z',
    fold: 'M17 8C3 8 3 40 17 40M17 8c14 0 14 32 0 32M35 8c14 0 14 32 0 32M35 8c-14 0-14 32 0 32',
    backblast: 'M27 24h21M39 17l9 7-9 7M21 24L8 12M21 24H5M21 24L8 36',
    banker: 'M8 37l15-25 15 25 10-17M17 12h6v8M40 20h8v8',
    landing: 'M12 8v19M6 20l6 7 6-7M6 36h18M30 24h19M41 17l8 7-8 7',
    crossfire: 'M8 24h40M8 24L44 9M8 24l36 15',
    bloom: 'M28 9v30M15 16l26 16M15 32l26-16M24 20h8v8h-8z',
    deadeye: 'M8 24h40M28 7v10M28 31v10M18 14h20v20H18z',
    execute: 'M10 10v28h12M28 10v28M36 24h14M43 17l7 7-7 7',
    rewire: 'M12 16C20 3 38 6 43 18M36 17l7 1 1-8M44 32C36 45 18 42 13 30M20 31l-7-1-1 8',
    slingshot: 'M12 9c-9 0-9 30 0 30M12 9c9 0 9 30 0 30M23 24h24M37 14l10 10-10 10',
    redline: 'M8 34a20 20 0 0 1 40 0M28 34l13-18M10 27l5 2M20 15l2 6M34 15l-2 6',
    breach: 'M30 9v30M30 24h18M22 24H7M16 17l-7 7 7 7M10 10l5 3M10 38l5-3',
    shatter: 'M34 7v34M8 24h26M32 24L14 9M32 24L9 16M32 24L9 32M32 24L14 39',
    convergence: 'M7 24l18-14 23 23M7 24h41M7 24l18 14L48 15',
    deadlock: 'M16 12h24v24H16zM8 24h12M36 24h12M24 20h8v8h-8zM24 7h8M24 41h8',
    shockfront: 'M26 17a7 7 0 1 0 0 14M26 9a15 15 0 1 0 0 30M34 24h14M41 17l7 7-7 7',
    backfire: 'M6 24h44M16 14L6 24l10 10M40 14l10 10-10 10',
    recall: 'M9 16h27a10 10 0 0 1 0 20H15m8-7-8 7 8 7',
    homecoming: 'M9 13h28a11 11 0 0 1 0 22H9m8-7-8 7 8 7M24 28v14M32 28v14',
    capacitor: 'M21 10v28M33 10v28M8 24h13M33 24h15',
    'reserve-cell': 'M16 10v28M23 10v28M33 10v28M40 10v28M7 24h9M40 24h9',
    countershot: 'M8 16h30l-8-7M38 16l-8 7M48 33H18l8-7M18 33l8 7',
    reprisal: 'M44 15H15l8-7M15 15l8 7M9 34h37M27 28v12M36 28v12',
    rivet: 'M8 24h32M32 17l8 7-8 7M44 8v32M48 8v32',
    fracture: 'M8 24h24M32 15l-6 9 6 9M43 8l-5 11 7 9-5 12',
    fuse: 'M10 32h14v10H10zM17 32V20q0-9 10-9h8M39 7v8M35 11h8',
    'linked-fuse': 'M8 30h10v10H8zM34 12h10v10H34zM13 30V18h21M25 13v10',
    afterimage: 'M7 13h25v8H7zM17 27h25v8H17zM32 17h10M42 31h7',
    parallax: 'M7 10h19v6H7zM7 32h19v6H7zM26 13l20 11-20 11M40 24h10',
    tether: 'M7 13h10v10H7zM39 26h10v10H39zM17 18q10 20 22 13',
    'wrecking-ball': 'M7 12l16 12M14 8l13 12M37 19a11 11 0 1 0 0 22 11 11 0 0 0 0-22M23 24l6 6',
    flashpoint: 'M25 6l4 12 13-4-7 11 11 8-14 1-4 13-6-12-14 4 8-12-9-9 14 2z',
    slipstream: 'M6 16h28q12 0 8-7M6 25h29M25 19l10 6-10 6M6 36h26q11 0 8 7',
    ramjet: 'M9 15h20l12 9-12 9H9l7-9zM5 20h7M5 28h7M35 14l10 10-10 10',
    cinder: 'M18 34c-9-10 4-14 5-24 12 9 6 15 11 12 8 15-12 21-16 12M12 40h28',
    crosswind: 'M7 17h28q12 0 8-7M7 25h34M7 33h23q13 0 9 8',
    grindshot: 'M5 38h46M16 17l7-6 4 5 8-2 1 8 6 4-5 6-8-1-5 5-5-7-7-2 4-7zM24 23h7v7h-7z',
    tripwire: 'M7 9v12M4 15h7L41 37h7M45 31v12',
    tension: 'M6 11v12M3 17h8l30 18h8M45 29v12M23 9v7M31 13l-3 6',
    torch: 'M7 20h15v10H7zM22 22h9v6h-9M34 25h14M40 18l5-4M40 32l5 4',
    thermal: 'M8 34h27M15 31c-9-9 10-12 5-25 17 10 17 20 7 25M36 24h12M41 18l5-5',
    vector: 'M6 36h10c19 0 8-24 28-24M36 5l8 7-8 7',
    afterburner: 'M7 36h9c13 0 7-20 20-20h13M41 8l8 8-8 8M12 26h9M16 18h8',
    'corner-cutter': 'M8 40V16h30v24M18 31V8h28v20M41 23l5 5 5-5',
    'arc-coil': 'M8 24h10l9-15-3 13h9l-9 17 3-13H8M40 17h8v14h-8z',
    'daisy-chain': 'M5 12h8v8H5zM25 29h8v8h-8zM43 10h8v8h-8zM13 16l8 3-3 5 7 9M33 33l8-7-4-5 6-7',
    snapback: 'M7 13h10v10H7zM39 26h10v10H39zM17 18l7 3M32 27l7 4M24 12l8 6-8 5 8 5-8 7',
    'rail-spike': 'M7 12l14 9M7 36l14-9M7 24h42M23 19h17l9 5-9 5H23M33 9v7M33 32v7',
    orbit: 'M38 13a16 16 0 1 0 5 19M39 9l5 7-8 2M23 20h8v8h-8zM6 18h4M17 38h4',
    implosion:
      'M7 8l13 12M36 28l13 12M7 40l13-12M36 20L49 8M13 20h7v-7M36 35v-7h7M13 28h7v7M36 13v7h7',
  };
  return (
    '<svg class="mod-mark" viewBox="0 0 56 48" aria-hidden="true"><path d="' +
    paths[mod.mark] +
    '"/></svg>'
  );
}
function showDialog(kind: string) {
  bindingEditor?.cancel();
  bindingEditor = null;
  replayView?.dispose();
  replayView = null;
  if (game.mode === 'playing') game.setMode('paused');
  clearInput();
  dialogKind = kind;
  const singleUpgrade =
    (kind === 'upgrade' && game.offers.length === 1) ||
    (kind === 'reforge' && game.reforge.offers.length === 1);
  modal.classList.toggle('single-upgrade', singleUpgrade);
  modal.classList.toggle('practice-dialog', kind === 'practice' || kind === 'practice-setup');
  modal.classList.toggle('workshop-dialog', kind === 'workshop' || kind === 'practice-build');
  modal.classList.toggle('replay-dialog', kind === 'replay');
  modal.classList.toggle('logbook-dialog', kind === 'logbook');
  modal.classList.toggle(
    'ending-dialog',
    kind === 'result' && game.mode === 'won' && !game.practice,
  );
  modal.classList.toggle('controls-dialog', kind === 'controls');
  modal.classList.toggle('progress-dialog', kind === 'progress');
  modal.classList.toggle('settings-dialog', kind === 'settings' || kind === 'pause');
  modal.classList.toggle('update-dialog', kind === 'update');
  const content = $('dialog-content');
  modal.scrollTop = 0;
  if (kind === 'logbook' || kind === 'workshop')
    commendations = mergeCommendations(commendations, read(COMMENDATIONS_KEY));
  const visibleCommendations = previewCommendations
    ? COMMENDATIONS.map((c) => c.id)
    : commendations;
  if (kind === 'update') {
    content.innerHTML =
      '<p class="eyebrow">A FREE CONTENT UPDATE</p><h2 id="dialog-title">Dead Signal.</h2>' +
      '<p class="update-tagline">The shift ended. The orders didn’t.</p>' +
      '<dl class="update-notes"><div><dt>A different way through.</dt><dd>After Furnace, take the upper exit into the Transmission Annex. Four rooms. Six possible layouts. Something is still issuing orders.</dd></div>' +
      '<div><dt>Make them change sides.</dt><dd>Five Subversion upgrades let your gun reboot fallen machines. Keep one stronger ally, or command a short-lived pair.</dd></div>' +
      '<div><dt>Follow the transmission.</dt><dd>New machines, an original synth-rock theme, and factory records to discover. Your saved progress stays with you.</dd></div></dl>' +
      '<div class="actions"><button id="back" class="primary">Back</button></div>';
    $('back').onclick = backFromUpdate;
  } else if (kind === 'credits') {
    content.innerHTML = creditsMarkup();
    $('back').onclick = backFromCredits;
  } else if (kind === 'issue') {
    reportDraft ??= createReportDraft(game);
    issueReportMenu(content, game, backFromReport, reportDraft, reportParent === 'result');
  } else if (kind === 'progress') {
    updateProgressPanel = progressMenu(
      content,
      progress,
      game.mode === 'title',
      backFromProgress,
      reloadProgress,
    );
  } else if (kind === 'controls') {
    content.innerHTML =
      '<h2 id="dialog-title">Controls.</h2><div id="controls-grid">' +
      controlsIntro(controlDevice(), bindings) +
      '</div>' +
      '<div class="recoil-demo"><svg viewBox="0 0 100 100" aria-hidden="true"><path class="recoil-rise" d="M24 57V17m-8 9 8-9 8 9"/><rect x="44" y="24" width="22" height="30" rx="4"/><path d="M59 43v24m0 10v7m0 8v4"/><path class="recoil-floor" d="M12 98h75"/></svg><div><strong>Shoot down. Go up.</strong><p>Jump first. Recoil pushes you opposite your shots, much harder in the air.</p></div></div>' +
      '<p class="controls-flow">Clear the room → take the lit right door → choose one upgrade.<br>Your gun keeps its upgrades for the run.</p>' +
      '<div id="equipped-controls" class="controls-copy"></div><div class="actions"><button id="back" class="primary">Back</button>' +
      (game.mode === 'title'
        ? '<button id="try-controls" class="quiet">Try controls</button>'
        : '') +
      '</div>';
    $('back').onclick = backFromControls;
    const practiceControls = document.getElementById('try-controls');
    if (practiceControls) practiceControls.onclick = () => startWorkshop([], true);
  } else if (kind === 'logbook') {
    discovered = loadDiscoveries([...discovered, ...loadDiscoveries(read(DISCOVERIES_KEY))]);
    logbookProgress = mergeLogbook(logbookProgress, loadLogbook(read(LOGBOOK_KEY)));
    logbookMenu(
      content,
      previewLogbook
        ? logbookPreviewEntries()
        : logbookEntries(
            discovered,
            game.mode !== 'title' &&
              game.testRun &&
              (game.story.state?.recovered || game.testRun.shutdown)
              ? mergeLogbook(logbookProgress, {
                  version: 1,
                  enemies: [],
                  areas: [],
                  escaped: false,
                  stories: game.story.state?.recovered ? [game.story.state.kind] : [],
                  disconnects: game.shutdown.state?.disabled ?? [],
                  ...(game.mode === 'won' && game.shutdown.complete
                    ? { shutdown: true as const }
                    : {}),
                })
              : logbookProgress,
            visibleCommendations,
          ),
      logbookView,
      modMark,
      backFromLogbook,
      previewLogbook || previewCommendations,
      () => {
        logbookFromWorkshop = false;
        showDialog('workshop');
        content.querySelector<HTMLButtonElement>('[data-workshop-tab="appearance"]')?.click();
      },
    );
  } else if (kind === 'replay' && deathReplay.ready) {
    replayView = new ReplayView(deathReplay, content);
    $('retry').onclick = () => start(undefined, true);
    $('back').onclick = () => showDialog('result');
  } else if (kind === 'history') {
    discovered = loadDiscoveries([...discovered, ...loadDiscoveries(read(DISCOVERIES_KEY))]);
    runHistory = loadRunHistory([...runHistory, ...loadRunHistory(read(RUN_HISTORY_KEY))]);
    content.innerHTML = runHistoryMenu(runHistory, discovered);
    bindRecapActions(content, runHistory, discovered, replayFinishedRun, workshopFromRun);
    $('back').onclick = backFromHistory;
  } else if (kind === 'workshop') {
    discovered = loadDiscoveries([...discovered, ...loadDiscoveries(read(DISCOVERIES_KEY))]);
    workshopMenu(
      content,
      discovered,
      game.workshop.active ? game.mods : workshopMods,
      game.workshop.active,
      startWorkshop,
      backFromHistory,
      {
        game,
        earned: visibleCommendations,
        preview: previewCommendations,
        equip: (selection) => {
          game.cosmetics = selection;
          if (!previewCommendations) {
            equippedCosmetics = selection;
            write(COSMETICS_KEY, selection);
          }
        },
        logbook: () => {
          logbookFromWorkshop = true;
          logbookView.section = 'commendations';
          logbookView.query = '';
          logbookView.selected = '';
          showDialog('logbook');
        },
      },
    );
  } else if (kind === 'layout-test') {
    const descriptions = [
      'Staggered platforms. Stretch a tether.',
      'Cracked barriers. Shoot the fuel.',
      'Hanging loads. Cut the cables.',
    ];
    content.innerHTML =
      '<h2 id="dialog-title">Try a room</h2><div class="choices">' +
      PHYSICS_LAYOUTS.map(
        (layout, i) =>
          '<button class="mod" data-layout="' +
          layout.id +
          '"><strong>' +
          layout.name +
          '</strong><span class="mod-copy">' +
          descriptions[i] +
          '</span></button>',
      ).join('') +
      '</div><div class="dialog-actions"><button id="back" class="quiet">Back</button></div>';
    content.querySelectorAll<HTMLButtonElement>('[data-layout]').forEach((button) => {
      button.onclick = () => {
        const url = new URL(location.href);
        url.searchParams.set('layout', button.dataset.layout!);
        const save = layoutTestFromUrl(url);
        if (!save) return;
        history.replaceState(null, '', url);
        linkedRunTest = save;
        startRunTest(save);
      };
    });
    $('back').onclick = resume;
  } else if (kind === 'upgrade-test') {
    const fusions = linkedRunTest?.seed.startsWith('FUSIONS-');
    content.innerHTML =
      '<h2 id="dialog-title">' +
      (fusions ? 'Try a fusion' : 'Try a build') +
      '</h2><div class="choices">' +
      Object.keys(fusions ? FUSION_TEST_BUILDS : UPGRADE_TEST_BUILDS)
        .map((id) => {
          const mod = MODS.find((m) => m.id === id)!;
          return (
            '<button class="mod" data-build="' +
            id +
            '"><span class="mod-top">' +
            modMark(mod) +
            '</span><strong>' +
            mod.name +
            '</strong><span class="mod-copy">' +
            mod.description +
            '</span></button>'
          );
        })
        .join('') +
      '</div><div class="dialog-actions"><button id="back" class="quiet">Back</button></div>';
    content.querySelectorAll<HTMLButtonElement>('[data-build]').forEach((button) => {
      button.onclick = () => {
        const url = new URL(location.href);
        url.search =
          '?test=' + (fusions ? 'fusions' : 'upgrades') + '&build=' + button.dataset.build;
        const save = (fusions ? fusionTestFromUrl(url) : upgradeTestFromUrl(url))!;
        history.replaceState(null, '', url);
        linkedRunTest = save;
        startRunTest(save);
      };
    });
    $('back').onclick = resume;
  } else if (kind === 'practice') {
    content.innerHTML =
      '<h2 id="dialog-title">Practice.</h2><div class="practice-list">' +
      encounters
        .map(
          (record) =>
            '<button class="practice-fight" data-boss="' +
            record.kind +
            '"><span>' +
            PRACTICE_BOSSES[record.kind].name +
            '</span><span aria-hidden="true">↗</span></button>',
        )
        .join('') +
      '</div><div class="actions"><button id="practice-back" class="quiet">Back</button></div>';
    content.querySelectorAll<HTMLButtonElement>('[data-boss]').forEach((button) => {
      button.onclick = () => {
        const encounter = encounters.find((record) => record.kind === button.dataset.boss);
        if (encounter) {
          practiceTarget = encounter;
          showDialog('practice-setup');
        }
      };
    });
    $('practice-back').onclick = backFromPractice;
  } else if (kind === 'practice-setup' && practiceTarget) {
    const encounter = practiceTarget;
    const boss = PRACTICE_BOSSES[encounter.kind];
    content.innerHTML =
      '<p class="eyebrow">PRACTICE</p><h2 id="dialog-title">' +
      boss.name +
      '</h2><p class="practice-note">Full health · Up to ' +
      boss.stage +
      ' upgrades</p><div class="practice-list">' +
      '<button id="practice-preset" class="practice-fight"><span>Preset</span><span aria-hidden="true">↗</span></button>' +
      '<button id="practice-workshop" class="practice-fight"><span>Workshop build</span><span aria-hidden="true">↗</span></button>' +
      '</div><div class="actions"><button id="practice-back" class="quiet">Back</button></div>';
    $('practice-preset').onclick = () => startPractice(encounter);
    $('practice-workshop').onclick = () => openPracticeBuild(encounter);
    $('practice-back').onclick = () => {
      showDialog('practice');
      content.querySelector<HTMLButtonElement>('[data-boss="' + encounter.kind + '"]')?.focus();
    };
  } else if (kind === 'practice-build' && practiceTarget) {
    const encounter = practiceTarget;
    discovered = loadDiscoveries([...discovered, ...loadDiscoveries(read(DISCOVERIES_KEY))]);
    workshopMenu(
      content,
      discovered,
      practiceBuild(encounter.kind, practiceDrafts[encounter.kind] ?? workshopMods, discovered),
      false,
      (mods) => {
        practiceDrafts[encounter.kind] = [...mods];
        startPractice(encounter, mods);
      },
      backFromPracticeBuild,
      undefined,
      {
        title: 'Practice build.',
        note: PRACTICE_BOSSES[encounter.kind].name + ' · Collected upgrades only.',
        limit: PRACTICE_BOSSES[encounter.kind].stage,
        applyLabel: 'Start fight ↗',
        change: (mods) => {
          practiceDrafts[encounter.kind] = mods;
        },
      },
    );
  } else if (kind === 'reforge') {
    content.innerHTML =
      '<p class="eyebrow">' +
      (dailyFromSeed(game.seed) ? 'DAILY · ' : '') +
      'ONE EXCHANGE</p><h2 id="dialog-title">Reforge.</h2><div class="choices">' +
      game.reforge.offers
        .map((swap, i) => {
          const from = MODS.find((m) => m.id === swap.from)!,
            to = MODS.find((m) => m.id === swap.to)!;
          return (
            '<button class="mod reforge-choice" data-swap="' +
            i +
            '"><span class="mod-top">' +
            modMark(to) +
            '<kbd>' +
            (i + 1) +
            '</kbd></span><span class="reforge-from">Give up ' +
            from.name +
            '</span><span class="reforge-loss">' +
            modDescription(from, game.mods) +
            '</span><span class="reforge-arrow" aria-hidden="true">↓</span><strong>' +
            to.name +
            '</strong><span class="mod-copy">' +
            modDescription(
              to,
              game.mods.filter((id) => id !== swap.from),
            ) +
            '</span>' +
            (modPathLabel(to.id)
              ? '<span class="mod-path">' + modPathLabel(to.id) + '</span>'
              : '') +
            '</button>'
          );
        })
        .join('') +
      '</div><div class="dialog-actions"><button id="back" class="quiet">Walk away</button></div>';
    content.querySelectorAll<HTMLButtonElement>('[data-swap]').forEach((button) => {
      button.onclick = () => {
        sound.unlock();
        if (game.reforge.choose(Number(button.dataset.swap))) {
          closeDialog();
          canvas.focus();
        }
      };
    });
    $('back').onclick = () => {
      closeDialog();
      game.reforge.close();
      canvas.focus();
    };
  } else if (kind === 'upgrade') {
    content.innerHTML =
      '<p class="eyebrow">' +
      (activeDaily ? 'DAILY · ' : '') +
      (game.overtime ? 'OVERTIME · ' : '') +
      (game.auditorReward
        ? 'COMPANY PROPERTY · NO HEALING'
        : game.courierReward
          ? 'RECOVERED CARGO · NO HEALING'
          : game.detour
            ? 'BONUS UPGRADE · NO HEALING'
            : game.enteringDetour
              ? 'ROOM CLEAR · CHALLENGE NEXT'
              : 'ROOM CLEAR') +
      '</p><h2 id="dialog-title">' +
      (game.auditorReward
        ? 'Break the seal.'
        : game.offers[0]?.id === 'repair'
          ? 'Keep going.'
          : singleUpgrade
            ? 'Next upgrade.'
            : 'Make it kick.') +
      '</h2>' +
      (firstRewardHelp && game.stage === 0 && !game.testRun && !game.practice
        ? '<p class="first-reward-note">Choose one. It stays on your gun for this run.</p>'
        : '') +
      '<div class="choices">' +
      game.offers
        .map(
          (m, i) =>
            '<button class="mod" data-mod="' +
            m.id +
            '"><span class="mod-top">' +
            modMark(m) +
            '<kbd>' +
            (i + 1) +
            '</kbd></span><strong>' +
            m.name +
            '</strong><span class="mod-copy">' +
            modDescription(m, game.mods) +
            '</span>' +
            (modPathLabel(m.id) ? '<span class="mod-path">' + modPathLabel(m.id) + '</span>' : '') +
            '</button>',
        )
        .join('') +
      '</div>' +
      (!activeDaily &&
      !game.practice &&
      !game.courierReward &&
      !game.auditorReward &&
      game.offers[0]?.id !== 'repair'
        ? '<div class="reward-actions"><button id="reroll" class="quiet"' +
          (game.canReroll ? '' : ' disabled') +
          ' title="' +
          (game.rewardRerolled
            ? 'Once per reward'
            : !game.areaEvents.freeReroll && game.hp <= REROLL_COST
              ? 'Requires more than ' + REROLL_COST + ' health'
              : !game.canReroll
                ? 'No full set of new upgrades available'
                : 'Replace every card. Once per reward.') +
          '">' +
          (game.rewardRerolled
            ? 'Reroll used'
            : game.areaEvents.freeReroll
              ? 'Reroll · free'
              : 'Reroll · −' + REROLL_COST + ' health') +
          '</button><span id="reward-status" class="sr-only" role="status"></span></div>'
        : '');
    const reroll = document.getElementById('reroll');
    if (reroll)
      reroll.onclick = () => {
        sound.unlock();
        const free = game.areaEvents.freeReroll;
        if (game.rerollReward()) {
          $('reward-status').textContent = free
            ? 'Choices replaced. Salvage used.'
            : 'Choices replaced. ' + REROLL_COST + ' health spent.';
          // Do not let a second Enter on the reroll accept an unfamiliar card.
          $('dialog-title').tabIndex = -1;
          $('dialog-title').focus();
        }
      };
    content.querySelectorAll<HTMLButtonElement>('[data-mod]').forEach(
      (b) =>
        (b.onclick = () => {
          const id = b.dataset.mod!;
          firstRewardHelp = false;
          sound.unlock();
          closeDialog();
          game.chooseMod(id);
          renderer.reset();
          canvas.focus();
        }),
    );
  } else if (kind === 'result' && (game.testRun?.annex || game.testRun?.switchboardTest)) {
    content.innerHTML =
      '<p class="eyebrow">DEAD SIGNAL · TEST</p>' +
      '<h2 id="dialog-title">' +
      (game.mode === 'won' ? 'Transmission cut.' : 'Try another frequency.') +
      '</h2><p class="result-line">' +
      formatTime(game.elapsed) +
      ' <span>·</span> ' +
      game.kills +
      ' kills</p><div class="actions"><button id="retry" class="primary">Again ↗</button>' +
      '<button id="menu" class="quiet">Menu</button></div>';
    $('retry').onclick = () => start(undefined, true);
    $('menu').onclick = menu;
  } else if (kind === 'result' && game.practice) {
    const win = game.mode === 'won';
    content.innerHTML =
      '<p class="eyebrow">PRACTICE · ' +
      PRACTICE_BOSSES[game.practice.kind].name +
      '</p><h2 id="dialog-title">' +
      (win ? 'Fight cleared.' : 'Try again.') +
      '</h2><p class="result-line">' +
      formatTime(game.elapsed) +
      '</p><div class="actions"><button id="retry" class="primary" title="Retry · R">Retry ↗</button>' +
      (canPractice(game.practice, encounters)
        ? '<button id="practice-edit" class="quiet">Edit build</button>'
        : '') +
      '<button id="choose-fight" class="quiet"' +
      (encounters.length ? '' : ' hidden') +
      '>Choose fight</button><button id="menu" class="quiet">Menu</button></div>';
    $('retry').onclick = () => start(undefined, true);
    $('choose-fight').onclick = () => showDialog('practice');
    const edit = document.getElementById('practice-edit');
    if (edit) edit.onclick = () => openPracticeBuild(game.practice!, 'result');
    $('menu').onclick = menu;
  } else if (kind === 'result') {
    const win = game.mode === 'won';
    if (activeDaily && !dailyResult) {
      const stored = read(DAILY_BESTS_KEY);
      const record = win ? recordDailyWin(stored, activeDaily, game.elapsed) : null;
      dailyResult = record
        ? {
            best: record.best,
            newBest: record.newBest,
            saved: true,
          }
        : { best: loadDailyBests(stored)[activeDaily.seed], newBest: false, saved: true };
      if (record?.newBest) write(DAILY_BESTS_KEY, mergeDailyRecords(stored, record.bests));
    }
    content.innerHTML =
      '<p class="eyebrow">' +
      (activeDaily
        ? 'DAILY · ' + activeDaily.date
        : win
          ? 'ALL ' +
            (game.overtime ? STAGES * 2 : STAGES) +
            ' ROOMS' +
            (game.detours.length ? ' · ' + game.detours.length + ' CHALLENGES' : '')
          : game.detour
            ? 'CHALLENGE'
            : (game.overtime ? 'OVERTIME · ' : '') +
              'ROOM ' +
              String(game.stage + 1).padStart(2, '0')) +
      '</p><h2 id="dialog-title">' +
      (win ? endingCopy(game.shutdown.complete, !!game.overtime).title : 'One more run?') +
      '</h2><p class="result-line">' +
      (activeDaily ? formatDailyTime(game.elapsed * 100) : formatTime(game.elapsed)) +
      ' <span>·</span> ' +
      game.kills +
      ' kills</p>' +
      (game.testRun?.seed.startsWith('PRESENTATION-')
        ? '<p class="presentation-note">Preview · progress is not saved.</p>'
        : '') +
      (win
        ? '<p class="ending-note">' +
          endingCopy(game.shutdown.complete, !!game.overtime).note +
          '</p>'
        : '') +
      (dailyResult?.best !== undefined
        ? '<p class="daily-best">' +
          (!dailyResult.saved
            ? 'Time not saved · '
            : dailyResult.newBest
              ? 'New best · '
              : 'Personal best · ') +
          formatDailyTime(dailyResult.best) +
          (!dailyResult.saved ? '<span>Saving unavailable in this browser.</span>' : '') +
          '</p>'
        : '') +
      '<div class="actions"><button id="retry" class="primary">Again ↗</button><button id="menu" class="quiet">Menu</button>' +
      (win
        ? '<button id="ending-logbook" class="quiet">Logbook</button><button id="open-credits" class="quiet">Credits</button>'
        : '') +
      (activeDaily ? '<button id="share" class="quiet">Copy challenge link</button>' : '') +
      '</div>' +
      (activeDaily
        ? '<div id="share-fallback" class="share-fallback" hidden><label for="challenge-link">Copy this link</label><input id="challenge-link" class="share-link" readonly spellcheck="false" /></div><span id="share-status" class="sr-only" role="status"></span>'
        : '');
    if (runCommendations.length) {
      content.querySelector('.actions')!.insertAdjacentHTML(
        'beforebegin',
        '<div class="result-commendations"><span>Commendation earned</span><button class="quiet" id="earned-commendations">' +
          COMMENDATIONS.filter((c) => runCommendations.includes(c.id))
            .map((c) => c.name)
            .join(' · ') +
          ' ↗</button></div>',
      );
      $('earned-commendations').onclick = () => {
        logbookView.section = 'commendations';
        logbookView.query = '';
        logbookView.selected = 'commendation:' + runCommendations[0];
        showDialog('logbook');
      };
    }
    if (win) {
      $('ending-logbook').onclick = () => showDialog('logbook');
      $('open-credits').onclick = openCredits;
    }
    if (activeDaily) {
      const link = dailyLink(activeDaily, location.href);
      $('share').onclick = async () => {
        const button = $<HTMLButtonElement>('share');
        button.disabled = true;
        try {
          await navigator.clipboard.writeText(link);
          if (!button.isConnected) return;
          button.textContent = 'Copied';
          $('share-status').textContent = 'Challenge link copied.';
        } catch {
          if (!button.isConnected) return;
          button.textContent = 'Copy challenge link';
          $('share-fallback').hidden = false;
          const field = $<HTMLInputElement>('challenge-link');
          field.value = link;
          field.focus();
          field.select();
          $('share-status').textContent = 'Select and copy the challenge link below.';
        } finally {
          button.disabled = false;
        }
      };
    }
    if (finishedRun) {
      content.insertAdjacentHTML('beforeend', resultRecap(finishedRun, discovered));
      bindRecapActions(content, [finishedRun], discovered, replayFinishedRun, workshopFromRun);
      $('recap-history').onclick = () => showDialog('history');
    }
    $('retry').onclick = () => start(undefined, true);
    $('menu').onclick = menu;
  } else {
    const paused = game.mode === 'paused';
    content.innerHTML =
      (paused && game.practice
        ? '<p class="eyebrow">PRACTICE · ' + PRACTICE_BOSSES[game.practice.kind].name + '</p>'
        : paused && activeDaily
          ? '<p class="eyebrow">DAILY · ' + activeDaily.date + '</p>'
          : '') +
      '<h2 id="dialog-title">' +
      (paused ? 'Paused.' : 'Settings.') +
      '</h2><div class="settings-scroll">' +
      '<div class="settings-list"><label>Sound<span class="setting-value"><span id="sound-state"></span><input id="sound" type="checkbox" ' +
      (sound.enabled ? 'checked' : '') +
      ' /></span></label>' +
      volumeControl('effects', sound.effectsVolume) +
      volumeControl('music', sound.musicVolume) +
      '<label>Music enabled<span class="setting-value"><span id="music-state"></span><input id="music" type="checkbox" ' +
      (sound.musicEnabled ? 'checked' : '') +
      ' /></span></label><label>Reduced effects<input id="shake" type="checkbox" aria-describedby="reduced-note" ' +
      (renderer.reduced ? 'checked' : '') +
      ' /></label></div><p id="reduced-note" class="controller-note">Less shake, flashes and particles. Attack warnings stay visible.</p><p id="audio-note" class="controller-note" role="status" hidden></p><details id="keyboard-settings" class="controller-settings"></details>' +
      controllerOptions() +
      `<div class="controls-copy" ${paused ? '' : 'hidden'}><div id="device-controls"></div><p>` +
      (game.workshop.active
        ? firstSession.warmup
          ? 'Targets reset automatically. Reset warm-up starts over. Done returns to the menu.'
          : 'Targets reset automatically. Reset room starts over. Build changes your gun.'
        : game.practice
          ? 'Defeat the boss. Retry starts over.'
          : game.testRun
            ? game.testRun.annex
              ? 'Clear the Annex, then leave through the right door. Restart test starts over.'
              : 'Preset test. Restart test starts over.'
            : game.escape
              ? game.canOvertime
                ? 'Climb to the New Game+ elevator to keep your gun and continue. The lower Exit lift finishes your run.'
                : 'Reach the Exit lift to finish your run.'
              : game.detour
                ? 'Survive for an extra upgrade, without a health refill.'
                : game.overtime
                  ? 'Second lap. Clear all twenty rooms, then extract.'
                  : game.canDetour
                    ? 'After clearing, the upper door offers an optional challenge.'
                    : 'Clear the room, then leave through the right door.') +
      '</p></div>' +
      (paused && game.mods.length
        ? '<details class="build"><summary>Your gun' +
          (buildPath(game.mods) ? ' · ' + PATH_NAMES[buildPath(game.mods)!] : '') +
          '</summary><ul>' +
          game.mods.map((id) => '<li>' + MODS.find((m) => m.id === id)!.name + '</li>').join('') +
          '</ul></details>'
        : '') +
      '<div class="settings-links"><button id="open-credits" class="quiet settings-credits">About & credits</button><button id="open-report" class="quiet settings-credits">Report an issue</button></div></div><div class="actions"><button id="back" class="primary">' +
      (paused ? 'Resume' : 'Back') +
      '</button>' +
      '<button id="pause-controls" class="quiet">Controls</button>' +
      '<button id="progress" class="quiet">Progress</button>' +
      (paused && game.workshop.active
        ? firstSession.warmup
          ? '<button id="workshop-pause-reset" class="quiet">Reset warm-up</button>'
          : '<button id="workshop-pause-build" class="quiet">Build</button><button id="workshop-pause-reset" class="quiet">Reset room</button>'
        : paused && game.practice
          ? '<button id="retry" class="quiet">Retry</button>' +
            (canPractice(game.practice, encounters)
              ? '<button id="practice-edit" class="quiet">Edit build</button>'
              : '') +
            '<button id="choose-fight" class="quiet"' +
            (encounters.length ? '' : ' hidden') +
            '>Choose fight</button>'
          : paused && game.testRun
            ? '<button id="retry" class="quiet">Restart test</button>'
            : '') +
      (paused
        ? '<button id="pause-logbook" class="quiet">Logbook</button><button id="menu" class="quiet">Menu</button>'
        : '') +
      '</div>';
    $('open-credits').onclick = openCredits;
    $('open-report').onclick = openReport;
    $<HTMLInputElement>('sound').onchange = (e) => {
      sound.enabled = (e.target as HTMLInputElement).checked;
      if (sound.enabled) sound.unlock();
      persistSettings();
      updateMusic();
    };
    $<HTMLInputElement>('music').onchange = (e) => {
      sound.musicEnabled = (e.target as HTMLInputElement).checked;
      if (sound.musicEnabled) sound.unlock();
      persistSettings();
      updateMusic();
    };
    $<HTMLInputElement>('shake').onchange = (e) => {
      renderer.reduced = (e.target as HTMLInputElement).checked;
      persistSettings();
    };
    for (const channel of ['effects', 'music'] as const) {
      const slider = $<HTMLInputElement>(channel + '-volume');
      slider.oninput = () => {
        if (channel === 'effects') sound.effectsVolume = slider.valueAsNumber / 100;
        else sound.musicVolume = slider.valueAsNumber / 100;
        sound.unlock();
        updateAudioState();
        updateMusic();
      };
      slider.onchange = persistSettings;
    }
    bindingEditor = keyboardMenu($('keyboard-settings'), bindings, persistSettings);
    $<HTMLInputElement>('rumble').onchange = (e) => {
      controller.settings.rumble = (e.target as HTMLInputElement).checked;
      if (!controller.settings.rumble) controller.stopRumble();
      persistSettings();
    };
    for (const [id, key] of [
      ['move-zone', 'moveDeadzone'],
      ['aim-zone', 'aimDeadzone'],
    ] as const) {
      const slider = $<HTMLInputElement>(id);
      slider.oninput = () => {
        controller.settings[key] = slider.valueAsNumber / 100;
        $(id + '-value').textContent = slider.value + '%';
      };
      slider.onchange = persistSettings;
    }
    $('back').onclick = resume;
    $('pause-controls').onclick = openControls;
    $('progress').onclick = openProgress;
    updateAudioState();
    if (paused && game.workshop.active) {
      const edit = document.getElementById('workshop-pause-build');
      if (edit) edit.onclick = () => showDialog('workshop');
      $('workshop-pause-reset').onclick = () => startWorkshop(game.mods, firstSession.warmup);
    }
    if (paused && (game.practice || game.testRun)) {
      $('retry').onclick = () => start(undefined, true);
      if (game.practice) $('choose-fight').onclick = () => showDialog('practice');
      const edit = document.getElementById('practice-edit');
      if (edit) edit.onclick = () => openPracticeBuild(game.practice!, 'pause');
    }
    if (paused) {
      $('menu').onclick = menu;
      $('pause-logbook').onclick = () => showDialog('logbook');
    }
  }
  if (kind === 'result' && game.mode === 'dead') {
    const watch = document.createElement('button');
    watch.id = 'watch-replay';
    watch.className = 'quiet';
    watch.textContent = 'Watch replay';
    watch.hidden = !deathReplay.ready;
    watch.onclick = () => showDialog('replay');
    content.querySelector('.actions')?.append(watch);
  }
  if (kind === 'result') {
    const feedback = document.createElement('button');
    feedback.id = 'open-report';
    feedback.className = 'quiet';
    feedback.textContent = 'Feedback';
    feedback.onclick = openReport;
    content.querySelector('.actions')?.append(feedback);
  }
  if (!modal.open) modal.showModal();
  updateControlHints();
  updateSaveStatus();
  if (kind === 'settings') {
    $('sound').focus({ preventScroll: true });
    modal.scrollTop = 0;
  } else if (kind === 'pause') {
    $('back').focus({ preventScroll: true });
    modal.scrollTop = 0;
  } else if (['controls', 'progress', 'credits', 'issue'].includes(kind)) $('back').focus();
  if (['upgrade', 'reforge', 'practice', 'practice-setup', 'result'].includes(kind))
    content.querySelector<HTMLButtonElement>('button')?.focus();
  if (kind === 'practice-build') $('workshop-apply').focus({ preventScroll: true });
  if (kind === 'history') content.querySelector<HTMLElement>('summary, #back')?.focus();
  if (kind === 'replay') $('replay-play').focus();
  if (kind === 'logbook')
    content.querySelector<HTMLElement>('[data-section][aria-pressed="true"]')?.focus();
  if (inputDevice === 'controller') focusControllerMenu(modal);
}
function volumeControl(channel: 'effects' | 'music', level: number) {
  const value = Math.round(level * 100);
  return `<label for="${channel}-volume">${channel === 'effects' ? 'Effects' : 'Music'} volume<span class="controller-slider volume-slider"><input id="${channel}-volume" type="range" min="0" max="100" step="1" value="${value}"><output id="${channel}-volume-value" for="${channel}-volume">${value}%</output></span></label>`;
}
function controllerOptions() {
  return (
    '<details class="controller-settings"><summary>Controller</summary>' +
    '<p id="controller-status" class="controller-note"></p><div class="settings-list">' +
    '<label>Rumble<input id="rumble" type="checkbox"' +
    (controller.settings.rumble ? ' checked' : '') +
    '></label>' +
    (['move', 'aim'] as const)
      .map((id) => {
        const value = Math.round(
          controller.settings[id === 'move' ? 'moveDeadzone' : 'aimDeadzone'] * 100,
        );
        return (
          '<label for="' +
          id +
          '-zone">' +
          (id === 'move' ? 'Move' : 'Aim') +
          ' deadzone' +
          '<span class="controller-slider"><input id="' +
          id +
          '-zone" type="range" min="5" max="40" step="1" value="' +
          value +
          '"><output id="' +
          id +
          '-zone-value" for="' +
          id +
          '-zone">' +
          value +
          '%</output></span></label>'
        );
      })
      .join('') +
    '</div><p class="controller-note">Left stick: move · Right stick: aim<br>' +
    'LB / L1: jump · RT / R2: fire · LT / L2: portal<br>' +
    'A / ✕: jump or confirm · B / ○: back · Start / Options: pause<br>' +
    'D-pad: menus · Left / right: adjust sliders<br>Rumble depends on your controller and browser.</p></details>'
  );
}
function updateControlHints() {
  const pad = inputDevice === 'controller';
  document.body.dataset.input = inputDevice;
  $('title-controls').innerHTML = pad
    ? 'Left stick move <i>·</i> Right stick aim <i>·</i> LB jump <i>·</i> RT fire'
    : `<kbd>${keyLabel(bindings.left[0])}</kbd><kbd>${keyLabel(bindings.right[0])}</kbd> move <i>·</i> <kbd>${keyLabel(bindings.jump[0])}</kbd> jump <i>·</i> Mouse fire`;
  canvas.setAttribute(
    'aria-label',
    pad
      ? 'Recoil Foundry. Left stick to move. Right stick to aim. Left bumper to jump. Right trigger to fire. Left trigger to place a portal. Start to pause.'
      : `Recoil Foundry. ${bindingLabel(bindings, 'left')} to move left. ${bindingLabel(bindings, 'right')} to move right. ${bindingLabel(bindings, 'jump')} to jump. Mouse to aim. Left click or ${bindingLabel(bindings, 'fire')} to fire. Escape to pause. Shoot down in the air to climb.`,
  );
  const copy = document.getElementById('device-controls');
  const grid = document.getElementById('controls-grid');
  if (grid) grid.innerHTML = controlsIntro(controlDevice(), bindings);
  const equipped = document.getElementById('equipped-controls');
  if (equipped)
    equipped.innerHTML =
      (game.portals.equipped
        ? '<p>' +
          (pad
            ? 'LT / L2'
            : controlDevice() === 'touch'
              ? '◎, then tap a surface'
              : 'Right-click or ' + bindingLabel(bindings, 'portal')) +
          ': place a portal. ' +
          (game.mods.includes('rewire') ? 'Reposition freely.' : 'One pair per room.') +
          '</p>'
        : '') +
      (game.mods.includes('charge-lens') ? '<p>Hold fire to charge. Release to shoot.</p>' : '');
  if (copy)
    copy.innerHTML =
      (game.portals.equipped
        ? '<p>' +
          (game.portals.canPlace
            ? (pad
                ? 'Aim at a surface and press LT / L2.'
                : `Right-click or ${bindingLabel(bindings, 'portal')} on a surface.`) +
              (game.mods.includes('rewire')
                ? ' Place or move either portal.'
                : ' One portal pair per room.')
            : 'Portals are fixed until the next room.') +
          '</p>'
        : '') +
      (pad
        ? '<p>Left stick: move · Right stick: aim</p><p>LB / L1: jump · RT / R2: fire</p>'
        : `<p><kbd>${keyLabel(bindings.left[0])}</kbd> <kbd>${keyLabel(bindings.right[0])}</kbd> Move <span>·</span> <kbd>${keyLabel(bindings.jump[0])}</kbd> Jump</p><p>Mouse to aim. Left click or ${bindingLabel(bindings, 'fire')} to fire.</p>`) +
      (game.mods.includes('charge-lens')
        ? '<p>Hold ' +
          (pad ? 'RT / R2' : 'left click or ' + bindingLabel(bindings, 'fire')) +
          ' to charge. Release to fire.</p><p>Release downward in the air to climb.</p>'
        : '<p>Shoot down in the air to climb.</p>');
  const status = document.getElementById('controller-status');
  $('workshop-reset').title = 'Reset room · ' + bindingLabel(bindings, 'retry');
  const retry = document.getElementById('retry');
  if (retry) retry.title = 'Retry · ' + bindingLabel(bindings, 'retry');
  if (status)
    status.textContent = controller.pad
      ? 'Controller connected.'
      : 'Connect a controller and press a button.';
}
function useInputDevice(device: 'pointer' | 'controller') {
  if (inputDevice === device) return;
  const dx = game.aim.x - game.player.position.x,
    dy = game.aim.y - game.player.position.y;
  if (Math.hypot(dx, dy) > 0.01)
    padAim = { x: dx / Math.hypot(dx, dy), y: dy / Math.hypot(dx, dy) };
  clearInput(device !== 'controller');
  inputDevice = device;
  updateControlHints();
  if (device === 'controller') {
    sound.unlock();
    if (modal.open) focusControllerMenu(modal);
    else if (game.mode === 'title') focusControllerMenu($('title-screen'));
  }
}
function pollController(now: number) {
  const wasConnected = !!controller.pad;
  const sample = controller.poll(now, pageActive && document.hasFocus() && !document.hidden);
  if (sample.connected !== wasConnected) updateControlHints();
  if (sample.disconnected && inputDevice === 'controller') {
    useInputDevice('pointer');
    if (game.mode === 'playing') showDialog('pause');
    $('save-status').textContent = 'Controller disconnected. Game paused.';
    return null;
  }
  if (sample.activity) useInputDevice('controller');
  if (inputDevice !== 'controller') return null;
  if (sample.pause) {
    if (bindingEditor?.cancel()) return null;
    if (!modal.open || dialogKind === 'pause') pause();
    return null;
  }
  if (modal.open || game.mode === 'title') {
    const root = modal.open ? modal : $('title-screen');
    if (sample.navigation) navigateControllerMenu(root, sample.navigation);
    if (sample.back && modal.open) {
      if (!bindingEditor?.cancel()) {
        if (dialogKind === 'result' && ['dead', 'won'].includes(game.mode)) menu();
        else cancelDialog();
      }
    } else if (sample.confirm) confirmControllerMenu(root);
    return null;
  }
  return sample;
}
function resume() {
  if (progress.restoring) return;
  sound.unlock();
  closeDialog();
  if (game.mode === 'paused') game.setMode('playing');
  if (game.mode === 'title') $('settings').focus();
  else canvas.focus();
}
function pause() {
  if (game.mode === 'playing') showDialog('pause');
  else if (game.mode === 'paused') resume();
}
function formatTime(n: number) {
  return Math.floor(n / 60) + ':' + String(Math.floor(n % 60)).padStart(2, '0');
}
$('play').onclick = () =>
  linkedWorkshop
    ? showDialog('workshop')
    : linkedRunTest?.seed.startsWith('ROOM47-') && entryUrl.searchParams.get('test') !== 'arc'
      ? showDialog('layout-test')
      : linkedRunTest?.seed.startsWith('UPGRADES-') || linkedRunTest?.seed.startsWith('FUSIONS-')
        ? showDialog('upgrade-test')
        : linkedRunTest
          ? startRunTest(linkedRunTest)
          : linkedTest
            ? startPractice(linkedTest)
            : start();
$('daily').onclick = () => {
  if (linkedDaily) {
    linkedDaily = null;
    seedParam = undefined;
    start();
  } else start(undefined, false, todayDaily().seed);
};
$('continue').onclick = () => {
  if (checkpoint) start(checkpoint);
};
$('settings').onclick = () => showDialog('settings');
$('whats-new').onclick = () => showDialog('update');
document.querySelectorAll<HTMLButtonElement>('[data-save-warning]').forEach((button) => {
  button.onclick = openProgress;
});
$('controls').onclick = openControls;
$('learn').onclick = () => startWorkshop([], true);
$('learn').hidden = !needsGuidance;
$('warmup-controls').onclick = openControls;
$('warmup-done').onclick = menu;
$('dismiss-tip').onclick = () => {
  finishGuidance();
  firstSession.stop();
  updateFirstSession();
};
$('history').onclick = () => showDialog('history');
$('logbook').onclick = () => showDialog('logbook');
$('practice').onclick = () => {
  if (encounters.length) showDialog('practice');
};
$('workshop').onclick = () => showDialog('workshop');
$('workshop-edit').onclick = () => showDialog('workshop');
$('workshop-reset').onclick = () => startWorkshop(game.mods);
$('pause').onclick = pause;
installDialogDismissal(
  modal,
  () => {
    if (!bindingEditor?.cancel()) cancelDialog();
  },
  () => {
    if (dialogKind) showDialog(dialogKind);
  },
);
function cancelDialog() {
  if (dialogKind === 'update') {
    backFromUpdate();
    return;
  }
  if (dialogKind === 'issue') {
    backFromReport();
    return;
  }
  if (dialogKind === 'credits') {
    backFromCredits();
    return;
  }
  if (dialogKind === 'progress') {
    backFromProgress();
    return;
  }
  if (dialogKind === 'controls') {
    backFromControls();
    return;
  }
  if (dialogKind === 'logbook') {
    backFromLogbook();
    return;
  }
  if (dialogKind === 'workshop') {
    backFromHistory();
    return;
  }
  if (dialogKind === 'replay') {
    showDialog('result');
    return;
  }
  if (game.mode === 'reforge') {
    closeDialog();
    game.reforge.close();
    canvas.focus();
    return;
  }
  if (dialogKind === 'history') {
    backFromHistory();
    return;
  }
  if (dialogKind === 'practice') {
    backFromPractice();
    return;
  }
  if (dialogKind === 'practice-setup') {
    $('practice-back').click();
    return;
  }
  if (dialogKind === 'practice-build') {
    backFromPracticeBuild();
    return;
  }
  if (game.mode === 'upgrade' || game.mode === 'dead' || game.mode === 'won') return;
  resume();
}
window.addEventListener('keydown', (e) => {
  if (bindingEditor?.handleKey(e)) return;
  useInputDevice('pointer');
  if (
    e.ctrlKey ||
    e.metaKey ||
    e.altKey ||
    (e.target instanceof HTMLInputElement && e.target.type !== 'checkbox') ||
    e.target instanceof HTMLTextAreaElement
  )
    return;
  if (
    game.mode === 'playing' &&
    (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code) ||
      Object.values(bindings).some((codes) => codes.includes(e.code)))
  )
    e.preventDefault();
  if (e.repeat) return;
  // Let native buttons, checkboxes, sliders and scrolling keep their menu keys,
  // even when those physical keys have also been assigned to gameplay actions.
  if (
    (modal.open || game.mode === 'title') &&
    [
      'Space',
      'Enter',
      'Tab',
      'ArrowUp',
      'ArrowDown',
      'ArrowLeft',
      'ArrowRight',
      'Home',
      'End',
      'PageUp',
      'PageDown',
    ].includes(e.code)
  )
    return;
  if (
    matches(bindings, 'controls', e.code) &&
    (!modal.open || ['pause', 'settings'].includes(dialogKind)) &&
    ['title', 'playing', 'paused'].includes(game.mode)
  ) {
    e.preventDefault();
    openControls();
    return;
  }
  if (
    matches(bindings, 'retry', e.code) &&
    game.mode === 'dead' &&
    ['result', 'replay'].includes(dialogKind)
  ) {
    e.preventDefault();
    start(undefined, true);
    return;
  }
  if (
    matches(bindings, 'retry', e.code) &&
    (game.practice || game.testRun || game.workshop.active) &&
    game.mode !== 'title' &&
    (!modal.open || dialogKind === 'pause')
  ) {
    e.preventDefault();
    start(undefined, true);
    return;
  }
  if (game.mode === 'reforge') {
    const i = Number(e.key) - 1;
    if (Number.isInteger(i) && i >= 0 && i < game.reforge.offers.length) {
      sound.unlock();
      if (game.reforge.choose(i)) {
        closeDialog();
        canvas.focus();
      }
    }
    return;
  }
  if (game.mode === 'upgrade') {
    const i = Number(e.key) - 1;
    if (i >= 0 && i < game.offers.length) {
      const id = game.offers[i].id;
      firstRewardHelp = false;
      sound.unlock();
      closeDialog();
      game.chooseMod(id);
      renderer.reset();
      canvas.focus();
    }
    return;
  }
  if (e.code === 'Escape' || matches(bindings, 'pause', e.code)) {
    if (!modal.open || e.code !== 'Escape') {
      e.preventDefault();
      if (modal.open) cancelDialog();
      else pause();
    }
    return;
  }
  if (game.mode !== 'playing') return;
  if (Object.values(bindings).some((codes) => codes.includes(e.code))) e.preventDefault();
  keys.add(e.code);
  if (matches(bindings, 'portal', e.code)) input.portal = renderer.toWorld(pointer.x, pointer.y);
  if (matches(bindings, 'jump', e.code)) input.jump = true;
  if (matches(bindings, 'fire', e.code)) {
    input.firePressed = true;
    sound.unlock();
  }
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('pointerdown', () => useInputDevice('pointer'), { capture: true });
window.addEventListener(
  'pointermove',
  (e) => {
    if (Math.hypot(e.movementX, e.movementY) > 2) useInputDevice('pointer');
  },
  { capture: true },
);
function updatePointer(e: PointerEvent) {
  const r = canvas.getBoundingClientRect();
  pointer.x = e.clientX - r.left;
  pointer.y = e.clientY - r.top;
}
canvas.onpointerdown = (e) => {
  if (game.mode !== 'playing') return;
  pointerArmed = true;
  sound.unlock();
  canvas.focus();
  canvas.setPointerCapture(e.pointerId);
  updatePointer(e);
  if (e.button === 2 || (e.pointerType === 'touch' && portalTouch)) {
    input.portal = renderer.toWorld(pointer.x, pointer.y);
    portalTouch = false;
    $('portal-touch').setAttribute('aria-pressed', 'false');
    return;
  }
  if (e.pointerType === 'touch' || e.button === 0) input.firePressed = true;
  if (e.pointerType === 'touch') touchAim.add(e.pointerId);
  else mouseButtons = e.buttons;
};
canvas.onpointermove = (e) => {
  updatePointer(e);
  if (e.pointerType !== 'touch' && pointerArmed) mouseButtons = e.buttons;
};
window.addEventListener('pointerup', (e) => {
  if (e.pointerType === 'touch') touchAim.delete(e.pointerId);
  else {
    if (e.buttons === 0) pointerArmed = true;
    mouseButtons = pointerArmed ? e.buttons : 0;
  }
});
canvas.onpointercancel = (e) => {
  touchAim.delete(e.pointerId);
  mouseButtons = 0;
  pointerArmed = false;
};
canvas.oncontextmenu = (e) => e.preventDefault();
$('portal-touch').onpointerdown = (e) => {
  if (game.mode !== 'playing' || !game.portals.canPlace) return;
  e.preventDefault();
  portalTouch = !portalTouch;
  $('portal-touch').setAttribute('aria-pressed', String(portalTouch));
};
document.querySelectorAll<HTMLButtonElement>('[data-touch]').forEach((b) => {
  b.onpointerdown = (e) => {
    if (game.mode !== 'playing') return;
    e.preventDefault();
    b.setPointerCapture(e.pointerId);
    const action = b.dataset.touch as keyof typeof touch;
    touch[action] = true;
    if (action === 'jump') input.jump = true;
  };
  const release = () => (touch[b.dataset.touch as keyof typeof touch] = false);
  b.onpointerup = release;
  b.onpointercancel = release;
});
function loseFocus() {
  bindingEditor?.cancel();
  pageActive = false;
  updateMusic(false);
  clearInput();
  if (game.mode === 'playing') showDialog('pause');
}
function regainFocus() {
  pageActive = document.hasFocus() && !document.hidden;
  updateMusic();
}
function pauseForDisplayChange() {
  clearInput();
  if (game.mode === 'playing') showDialog('pause');
}
const displaySafety = new DisplaySafety();
new ResizeObserver(([entry]) => {
  if (displaySafety.resized(entry.contentRect.width, entry.contentRect.height))
    pauseForDisplayChange();
  renderer.resize();
}).observe($('arena'));
watchSessionEvents(window, document, {
  hidden: () => document.hidden,
  loseFocus,
  regainFocus,
  displayChanged: pauseForDisplayChange,
});
function frame(now: number) {
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  const pad = pollController(now);
  if (game.mode === 'playing') {
    accumulator += dt;
    input.left = held(bindings, 'left', keys) || touch.left;
    input.right = held(bindings, 'right', keys) || touch.right;
    input.jumpHeld = held(bindings, 'jump', keys) || touch.jump;
    input.fire = held(bindings, 'fire', keys) || (mouseButtons & 1) !== 0 || touchAim.size > 0;
    input.aim = renderer.toWorld(pointer.x, pointer.y);
    input.move = undefined;
    if (inputDevice === 'controller') {
      input.left = input.right = false;
      input.move = pad?.move ?? 0;
      input.jumpHeld = pad?.jumpHeld ?? false;
      input.fire = pad?.fire ?? false;
      input.jump ||= pad?.jump ?? false;
      input.firePressed ||= pad?.firePressed ?? false;
      if (pad && Math.hypot(pad.aim.x, pad.aim.y) > 0.05) {
        const length = Math.hypot(pad.aim.x, pad.aim.y);
        padAim = { x: pad.aim.x / length, y: pad.aim.y / length };
      }
      input.aim = {
        x: game.player.position.x + padAim.x * 400,
        y: game.player.position.y + padAim.y * 400,
      };
      renderer.portalAim = controllerPortalTarget(game, padAim, {
        ...renderer.camera,
        width: renderer.width / renderer.scale,
        height: renderer.height / renderer.scale,
      });
      if (pad?.portal && game.portals.equipped) {
        if (renderer.portalAim) input.portal = renderer.portalAim;
        else {
          game.portals.rejected = { pos: { ...input.aim }, until: game.time + 0.22 };
          sound.play('portal-denied');
        }
      }
    }
    let n = 0;
    while (accumulator >= 1 / 60 && n < 5) {
      if (inputDevice === 'controller')
        input.aim = {
          x: game.player.position.x + padAim.x * 400,
          y: game.player.position.y + padAim.y * 400,
        };
      game.tick(1 / 60, input);
      firstSession.observe(game, input);
      input.jump = false;
      input.firePressed = false;
      input.portal = undefined;
      accumulator -= 1 / 60;
      n++;
    }
    if (n === 5) accumulator = 0;
  } else accumulator = 0;
  updateMusic();
  renderer.draw(now);
  if (game.mode === 'playing' && !game.workshop.active) deathReplay.capture(canvas, game.elapsed);
  if (now - hudAt > 80) {
    hudAt = now;
    updateFirstSession();
    $('portal-touch').hidden = !game.portals.canPlace;
    if (!game.portals.canPlace && portalTouch) {
      portalTouch = false;
      $('portal-touch').setAttribute('aria-pressed', 'false');
    }
    $<HTMLProgressElement>('health').value = game.hp;
    $('health').setAttribute('aria-valuetext', Math.ceil(game.hp) + ' health');
    $('health').classList.toggle('low', game.hp <= 30);
  }
  requestAnimationFrame(frame);
}
game.onChange();
progress.onChange = updateSaveStatus;
updateSaveStatus();
window.addEventListener('storage', (e) => {
  if (e.key === PROGRESS_KEY || e.key === null) progress.checkExternal();
});
window.addEventListener('focus', () => progress.checkExternal());
window.addEventListener('beforeunload', (e) => {
  if (!allowProgressReload && (progress.dirty || progress.state === 'saving')) {
    e.preventDefault();
    e.returnValue = '';
  }
});
updateAudioState();
updateControlHints();
if (
  entryUrl.searchParams.get('help') === 'settings' &&
  !linkedRunTest &&
  !linkedTest &&
  !linkedDaily &&
  !linkedWorkshop
)
  showDialog('settings');
if (
  entryUrl.searchParams.get('help') === 'controls' &&
  !linkedRunTest &&
  !linkedTest &&
  !linkedDaily &&
  !linkedWorkshop
)
  openControls();
if (linkedLogbook || previewCommendations) showDialog('logbook');
if (
  entryUrl.searchParams.get('progress') === '1' &&
  !linkedRunTest &&
  !linkedTest &&
  !linkedDaily &&
  !linkedWorkshop
)
  openProgress();
requestAnimationFrame(frame);
