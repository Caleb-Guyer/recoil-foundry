import './reward-cards.css';
import './combat-report.css';
import { combatReportMenu, type ReportGun } from './combat-report-menu.ts';
import { drawCombatReportImages } from './combat-report-art.ts';
import { SUPPORT_MASTERIES, type SupportMasteryAttempt } from './support-mastery.ts';
import './support-drill.css';
import { SupportDrillView } from './support-drill-view.ts';
import { SUPPORT_DRILLS, supportDrillFromUrl, type SupportDrillId } from './support-drill-info.ts';
import {
  WEAPON_UNLOCKS_KEY,
  loadWeaponUnlocks,
  migrateWeaponUnlocks,
  unlockedStartingGuns,
  availableStartingGun,
} from './weapon-unlocks.ts';
import {
  RUN_REWARDS_KEY,
  loadRunRewards,
  addRunRewards,
  commendationRewards,
} from './run-rewards.ts';
import { rewardCards, drawRewardImages } from './reward-cards.ts';
import { modMark } from './upgrade-icons.ts';
import './upgrade-preview.css';
import { inspectUpgrade } from './upgrade-inspection.ts';
import { UpgradePreviewView, upgradePreviewMarkup } from './upgrade-preview-view.ts';
import { upgradePreviewTestFromUrl } from './upgrade-preview-test.ts';
import {
  UPRISING_RECORDS_KEY,
  UPRISING_DISTRICTS,
  newUprising,
  recordUprising,
  uprisingContracts,
  uprisingFinale,
  uprisingPlan,
  type UprisingRun,
} from './uprising-model.ts';
import { uprisingMap, uprisingRouteMenu } from './uprising-menu.ts';
import { uprisingTestFromUrl } from './uprising-test.ts';
import {
  ARCHIVE_KEY,
  encounterArchive,
  acknowledgeArchiveEntry,
  enemyArchiveIds,
  archiveToken,
  loadArchive,
} from './archive.ts';
import { logbookCatalog } from './logbook-catalog.ts';
import {
  MILESTONES_KEY,
  loadMilestones,
  loadUnlocks,
  unlockGoals,
  type LongevityId,
} from './longevity.ts';
import { welderTestFromUrl } from './welder-test.ts';
import {
  SECURITY_KEY,
  isSecurityLevel,
  loadSecurityProfile,
  recordSecurityClear,
  securityLabel,
  securityMenu,
  type SecurityLevel,
} from './security.ts';
import { securityTestFromUrl } from './security-test.ts';
import { weaponMasteryTestFromUrl } from './weapon-mastery-test.ts';
import { maintenanceTestFromUrl } from './maintenance-test.ts';
import { SHAFT_NAMES } from './maintenance.ts';
import { MUTATIONS, mutationTestFromUrl } from './mutations.ts';
import { overtimeBalanceTestFromUrl } from './overtime-balance.ts';
import { creditsMarkup } from './credits.ts';
import { installDialogDismissal } from './dialog-dismissal.ts';
import { annexTestFromUrl } from './annex-layout.ts';
import { switchboardTestFromUrl } from './switchboard-layout.ts';
import { annexRouteTestFromUrl } from './annex-route.ts';
import { ANNEX_ALTERNATES } from './annex-alternates.ts';
import { REGION_NAMES } from './regions.ts';
import { createReportDraft, issueReportMenu, type ReportDraft } from './issue-report.ts';
import { endingCopy } from './ending.ts';
import { clockOutTestFromUrl, prepareClockOutTest } from './clock-out-test.ts';
import { presentationTestFromUrl, finishPresentationTest } from './presentation-test.ts';
import { combatFeelTestFromUrl } from './combat-feel-test.ts';
import { encounterTestFromUrl } from './encounter-test.ts';
import { teamworkTestFromUrl } from './teamwork-test.ts';
import { huntTestFromUrl } from './hunt-test.ts';
import { HUNTS, isHunt, huntSeed } from './hunt-rules.ts';
import { drawArchiveImages } from './archive-images.ts';
import { bossRemixTestFromUrl } from './boss-remix-test.ts';
import {
  BOSS_REMIXES,
  BOSS_REMIXES_KEY,
  loadBossRemixes,
  recordBossRemix,
  remixEncounters,
  type BossRemixId,
} from './boss-remix-rules.ts';
import { bossRemixMenu } from './boss-remix-menu.ts';
import { courierTestFromUrl } from './courier-layout.ts';
import { auditorTestFromUrl } from './auditor-layout.ts';
import { floodgateTestFromUrl } from './floodgate-layout.ts';
import { sortingPitTestFromUrl } from './sorting-pit-layout.ts';
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
import {
  continuityTestFromUrl,
  CONTINUITY_BUILDS,
  type ContinuityBuild,
} from './continuity-test.ts';
import { supportTestFromUrl, SUPPORT_BUILDS, type SupportBuild } from './support-test.ts';
import {
  toolroomTestFromUrl,
  toolroomTestTitle,
  TOOLROOM_BUILDS,
  type ToolroomBuild,
} from './toolroom-test.ts';
import { anglerTestFromUrl } from './practice.ts';
import { vectorTestFromUrl } from './practice.ts';
import { wallcrawlerTestFromUrl } from './practice.ts';
import { counterweightTestFromUrl } from './practice.ts';
import { grindshotTestFromUrl, interceptorGrindTestFromUrl } from './practice.ts';
import './style.css';
import './starting-gun.css';
import {
  COMMENDATIONS,
  COMMENDATIONS_KEY,
  loadCommendations,
  mergeCommendations,
  commendationPreviewLink,
} from './commendations.ts';
import { COSMETICS_KEY, loadCosmetics } from './cosmetics.ts';
import {
  APPEARANCE_SEEN_KEY,
  APPEARANCE_ITEMS_SEEN_KEY,
  acknowledgeAppearanceItem,
  unseenAppearanceItems,
} from './appearance-notices.ts';
import { Game } from './game.ts';
import { FACTORY_CONDITIONS, factoryHint, freshFactorySeed } from './factory.ts';
import {
  DISCOVERIES_KEY,
  WORKSHOP_BUILD_KEY,
  discoverBuild,
  loadDiscoveries,
  workshopBuild,
  workshopLink,
} from './workshop-build.ts';
import { workshopMenu } from './workshop-menu.ts';
import { BLUEPRINTS_KEY, loadBlueprints } from './blueprints.ts';
import {
  STARTING_GUNS,
  dailyStartingGun,
  isStartingGun,
  type StartingGun,
} from './starting-guns.ts';
import { startingGunMenu } from './starting-gun-menu.ts';
import { blueprintMenu, type BlueprintStore, type MenuBack } from './blueprint-menu.ts';
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
import { newCampaignSeed, retrySeed } from './run-seed.ts';
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
  overtimeDocksTestFromUrl,
  overtimeFurnaceTestFromUrl,
  overtimeCoolingTestFromUrl,
  overtimeReclamationTestFromUrl,
  overtimeRooftopsTestFromUrl,
  exitTestFromUrl,
  UPGRADE_TEST_BUILDS,
  FUSION_TEST_BUILDS,
  fusionTestFromUrl,
} from './practice.ts';
import { canPractice, practiceCheckpoint, type Encounter, type PracticeBoss } from './practice.ts';
import {
  PRACTICE_RECORDS_KEY,
  PRACTICE_RULESET,
  loadPracticeRecords,
  snapshotPracticeWin,
  recordPracticeWin,
  practiceBuildKey,
  practiceTime,
  challengeAccess,
  type PracticeChallenge,
  type PracticeWin,
} from './practice-records.ts';
import { practiceRecordsMenu } from './practice-records-menu.ts';
import { maintenanceTrialsMenu, trialResultHtml } from './maintenance-trials-menu.ts';
import {
  RECOIL_TRIALS,
  RECOIL_TRIALS_KEY,
  loadRecoilProfile,
  recordRecoilTrial,
  recoilTrialFromUrl,
  type RecoilTrialKind,
} from './recoil-trial-rules.ts';
import { recoilTrialMenu } from './recoil-trial-menu.ts';
import {
  GAUNTLET_KEY,
  recordGauntlet,
  gauntletPreviewFromUrl,
  type GauntletRecord,
} from './gauntlet-rules.ts';
import { gauntletSetup, gauntletRunMenu } from './gauntlet-menu.ts';
import {
  RECOIL_GHOSTS_KEY,
  loadRecoilGhosts,
  recordRecoilGhost,
  recoilChallengeAccess,
  recoilChallengeFromUrl,
  recoilDelta,
  type RecoilChallenge,
} from './recoil-race-rules.ts';
import {
  SHAFT_PROFILE_KEY,
  loadShaftProfile,
  recordShaftClear,
  maintenanceCertified,
  trialFromUrl,
  trialAccess,
  snapshotTrial,
  recordTrial,
  trialChallenge,
  type TrialRoute,
  type TrialChallenge,
  type ShaftProfile,
} from './maintenance-trials.ts';
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
let workshopStartingGun: StartingGun = 'pistol';
const blueprintStore: BlueprintStore = {
  read: () => loadBlueprints(read(BLUEPRINTS_KEY)),
  write: (slots) => {
    progress.checkExternal();
    return progress.blocked ? Promise.resolve(false) : progress.write(BLUEPRINTS_KEY, slots);
  },
};
let blueprintSource: RunRecap | null = null;
let blueprintParent = 'result';
let buildMenu: MenuBack | null = null;
let practiceTarget: Encounter | null = null;
let practiceEditorParent = 'practice-setup';
const practiceDrafts: Partial<Record<PracticeBoss, string[]>> = {};
let practiceRecords = loadPracticeRecords(read(PRACTICE_RECORDS_KEY));
let practiceTest = false;
let practiceEligible = false;
let practiceCaptured = false;
let practiceWin: PracticeWin | null = null;
let practiceOutcome: ReturnType<typeof recordPracticeWin> | null = null;
let activePracticeChallenge: PracticeChallenge | null = null;
let sharedPracticeChallenge: PracticeChallenge | undefined;
let practiceRecordsBoss: PracticeBoss | undefined;
let practiceRecordsRemix: BossRemixId | undefined;
let practiceRecordsParent = 'practice-setup';
let trialCaptured = false;
let trialOutcome: ReturnType<typeof recordTrial> | null = null;
let activeTrialChallenge: TrialChallenge | undefined;
let trialMenuChallenge: TrialChallenge | undefined;
let trialMenuShare: TrialChallenge | undefined;
let trialMenuParent = 'practice';
let recoilMenuParent = 'practice';
let recoilOutcome: ReturnType<typeof recordRecoilTrial> | null = null;
let recoilMenuChallenge: RecoilChallenge | undefined;
let recoilMenuShare: RecoilChallenge | undefined;
let recoilGhostEnabled = true;
let recoilGhostSaved = false;
let savedGauntlet: GauntletRecord | null = null;
let gauntletOutcome: ReturnType<typeof recordGauntlet> | null = null;
let gauntletReward = false;
let commendations = loadCommendations(read(COMMENDATIONS_KEY));
let runCommendations: typeof commendations = [];
let fittingNotice: { name: string; until: number | null; stage: number } | null = null;
let commendationNotice: {
  id: (typeof commendations)[number];
  until: number | null;
  stage: number;
} | null = null;
let equippedCosmetics = loadCosmetics(read(COSMETICS_KEY), commendations);
let logbookFromWorkshop = false;
let runHistory = loadRunHistory(read(RUN_HISTORY_KEY));
let logbookProgress = migrateLogbook(read(LOGBOOK_KEY), storedCheckpoint, runHistory, encounters);
let selectedSecurity: SecurityLevel = 0;
function securityProfile() {
  return loadSecurityProfile(
    read(SECURITY_KEY),
    logbookProgress.escaped || !!logbookProgress.shutdown || !!checkpoint?.overtime,
  );
}
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
 <div class="hud"><progress id="health" max="100" value="100" aria-label="Health"></progress><div id="factory-condition" class="factory-condition" hidden><strong id="factory-name"></strong><span id="factory-hint"></span></div><div class="run-info"><span id="stage">01 / ${String(STAGES).padStart(2, '0')}</span><button id="pause" class="icon" aria-label="Pause" title="Pause · Esc"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7 5v10M13 5v10"/></svg></button></div></div>
 <section id="title-screen">
  <div class="title-content"><button id="whats-new" class="update-link" aria-haspopup="dialog"><span>Toolroom Expansion</span><span>What’s new ↗</span></button><h1><span>RECOIL</span><small>FOUNDRY</small></h1>
   <button id="play" class="primary">Play <span aria-hidden="true">↗</span></button>
   <button id="security" class="quiet security-selector" aria-haspopup="dialog" hidden>Security · Standard</button>
   <div class="title-actions"><button id="daily" class="quiet">Daily run</button><button id="continue" class="quiet" ${checkpoint ? '' : 'hidden'}>Continue</button><button id="practice" class="quiet" hidden>Practice</button><button id="workshop" class="quiet">Workshop <span id="workshop-badge" class="new-badge" aria-hidden="true" hidden>New</span></button><button id="learn" class="quiet" hidden>Learn to play</button></div>
   <p id="title-controls" class="title-controls"><kbd>A</kbd><kbd>D</kbd> move <i>·</i> <kbd>Space</kbd> jump <i>·</i> Mouse fire</p>
   <p id="title-hint" class="recoil-hint">Shoot down. Go up.</p>
  </div><div class="title-settings"><button id="controls" class="quiet">Controls</button><button id="logbook" class="quiet">Logbook <span id="logbook-badge" class="new-badge" aria-hidden="true" hidden>New</span></button><button id="history" class="quiet" ${runHistory.length ? '' : 'hidden'}>Recent runs</button><button id="settings" class="quiet">Settings</button></div>
 </section>
 <div id="clock-out-controls" hidden><span class="sr-only" role="status">Clock Out. Your shift is complete.</span><button id="skip-clock-out" class="quiet">Skip ↗</button></div>
 <button id="save-warning" data-save-warning class="save-warning" hidden></button>
 <div id="commendation-notice" class="commendation-notice" role="status" hidden></div>
 <p id="uprising-status" class="uprising-status" hidden></p>
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
let upgradePreview: UpgradePreviewView | null = null;
let supportDrill: SupportDrillView | null = null;
let selectedDrill: SupportDrillId = 'heat';
let drillPreview = false;
const previewMotion = matchMedia('(prefers-reduced-motion: reduce)');
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
const linkedDrill = supportDrillFromUrl(entryUrl);
const linkedGauntletPreview = gauntletPreviewFromUrl(entryUrl);
let linkedTrial = trialFromUrl(entryUrl);
let linkedRecoilChallenge = recoilChallengeFromUrl(entryUrl);
let invalidRecoilLink = entryUrl.searchParams.has('recoil') && !linkedRecoilChallenge;
let invalidTrialLink =
  (entryUrl.searchParams.has('shaft') ||
    entryUrl.searchParams.get('test') === 'maintenance-trial') &&
  !linkedTrial;
let previewCommendations = commendationPreviewLink(entryUrl);
if (previewCommendations) logbookView.section = 'commendations';
const linkedLogbook = logbookLink(entryUrl);
let previewLogbook = linkedLogbook === 'preview';
let linkedTest = testEncounterFromUrl(entryUrl);
let linkedRunTest =
  toolroomTestFromUrl(entryUrl) ??
  supportTestFromUrl(entryUrl) ??
  continuityTestFromUrl(entryUrl) ??
  weaponMasteryTestFromUrl(entryUrl) ??
  securityTestFromUrl(entryUrl) ??
  switchboardTestFromUrl(entryUrl) ??
  annexRouteTestFromUrl(entryUrl) ??
  annexTestFromUrl(entryUrl) ??
  clockOutTestFromUrl(entryUrl) ??
  presentationTestFromUrl(entryUrl) ??
  combatFeelTestFromUrl(entryUrl) ??
  encounterTestFromUrl(entryUrl) ??
  teamworkTestFromUrl(entryUrl) ??
  huntTestFromUrl(entryUrl) ??
  bossRemixTestFromUrl(entryUrl) ??
  upgradePreviewTestFromUrl(entryUrl) ??
  auditorTestFromUrl(entryUrl) ??
  shutdownTestFromUrl(entryUrl) ??
  storyTestFromUrl(entryUrl) ??
  replayTestFromUrl(entryUrl) ??
  fabricatorTestFromUrl(entryUrl) ??
  reforgeTestFromUrl(entryUrl) ??
  floodgateTestFromUrl(entryUrl) ??
  sortingPitTestFromUrl(entryUrl) ??
  uprisingTestFromUrl(entryUrl) ??
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
  welderTestFromUrl(entryUrl) ??
  recoilTrialFromUrl(entryUrl) ??
  maintenanceTestFromUrl(entryUrl) ??
  overtimeTestFromUrl(entryUrl) ??
  overtimeDocksTestFromUrl(entryUrl) ??
  overtimeFurnaceTestFromUrl(entryUrl) ??
  overtimeCoolingTestFromUrl(entryUrl) ??
  overtimeReclamationTestFromUrl(entryUrl) ??
  overtimeRooftopsTestFromUrl(entryUrl) ??
  overtimeBalanceTestFromUrl(entryUrl) ??
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
let selectedStartingGun: StartingGun =
  seedParam &&
  entryUrl.searchParams.getAll('sg').length === 1 &&
  isStartingGun(entryUrl.searchParams.get('sg'))
    ? (entryUrl.searchParams.get('sg') as StartingGun)
    : 'pistol';
let dailyResult: { best?: number; newBest: boolean; saved: boolean } | null = null;

function updateAppearanceBadge() {
  const pending =
    unseenAppearanceItems(commendations, read(APPEARANCE_ITEMS_SEEN_KEY), read(APPEARANCE_SEEN_KEY))
      .length > 0;
  $('workshop-badge').hidden = !pending;
  if (pending)
    $('workshop').setAttribute('aria-label', 'Workshop, new appearance options available');
  else $('workshop').removeAttribute('aria-label');
}
function updateTitle() {
  updateAppearanceBadge();
  updateLogbookBadge();
  const security = securityProfile();
  if (selectedSecurity > security.unlocked) selectedSecurity = 0;
  $('security').hidden =
    !security.unlocked ||
    !!linkedDaily ||
    !!linkedTest ||
    !!linkedRunTest ||
    linkedWorkshop ||
    !!linkedTrial ||
    !!linkedRecoilChallenge ||
    invalidRecoilLink ||
    !!linkedGauntletPreview;
  $('security').textContent = selectedSecurity
    ? securityLabel(selectedSecurity)
    : 'Security · Standard';
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
  if (linkedRunTest?.uprising)
    $('play').innerHTML = 'Test Factory Uprising <span aria-hidden="true">↗</span>';
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
  if (linkedRunTest && /^(?:BRANCHES-71-|RF-C89-BRANCHES-)/.test(linkedRunTest.seed)) {
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
    : `Today's shared challenge · ${STARTING_GUNS[dailyStartingGun(todayDaily().seed) ?? 'pistol'].name} · resets at midnight UTC`;
  $('continue').hidden = !checkpoint;
  $('practice').hidden =
    encounters.length === 0 &&
    !loadShaftProfile(read(SHAFT_PROFILE_KEY)).unlocks.length &&
    !loadRecoilProfile(read(RECOIL_TRIALS_KEY)).clears.length &&
    !weaponUnlocks().cleared;
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
        ? `Daily · ${linkedDaily.date} · ${STARTING_GUNS[dailyStartingGun(linkedDaily.seed) ?? 'pistol'].name}`
        : invalidDailyLink
          ? 'Challenge link unavailable. Start a fresh run.'
          : unavailableDailySave
            ? 'Saved daily unavailable. Start a new daily.'
            : 'Shoot down. Go up.';
  if (linkedRunTest?.seed.startsWith('UPGRADES-'))
    $('title-hint').textContent = 'Choose a build. Try its follow-up. R to retry.';
  if (linkedRunTest?.security) {
    $('play').textContent =
      'Test ' + securityLabel(linkedRunTest.security.level).split(' · ')[0] + ' ↗';
    $('title-hint').textContent = 'Isolated preview · progress is not saved. R to retry.';
  }
  if (linkedRunTest?.seed === 'REROLL-61')
    $('title-hint').textContent = 'Start at a reward. 64 health. R to restart test.';
  if (linkedRunTest?.seed.startsWith('RF-C89-EXP-')) {
    $('play').textContent = 'Test ' + toolroomTestTitle(entryUrl) + ' ↗';
    $('title-hint').textContent =
      (entryUrl.searchParams.has('machine')
        ? 'Read the attack warning, then flank, dodge or break the shell.'
        : TOOLROOM_BUILDS[(entryUrl.searchParams.get('build') ?? 'native') as ToolroomBuild].hint) +
      ' Isolated playtest · R to retry.';
  }
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
  if (linkedRunTest && /^(?:BRANCHES-71-|RF-C89-BRANCHES-)/.test(linkedRunTest.seed)) {
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
  if (linkedRunTest?.seed.startsWith('CONTINUITY-4.12-')) {
    const build = (entryUrl.searchParams.get('build') ?? 'scatter') as ContinuityBuild;
    $('play').textContent = 'Test ' + CONTINUITY_BUILDS[build].name;
    $('title-hint').textContent =
      CONTINUITY_BUILDS[build].hint + ' R to retry. Progress stays untouched.';
  }
  if (linkedRunTest?.seed.startsWith('SUPPORT-4.13-')) {
    const build = (entryUrl.searchParams.get('build') ?? 'collimator') as SupportBuild;
    $('play').textContent = 'Test ' + SUPPORT_BUILDS[build].name;
    $('title-hint').textContent =
      SUPPORT_BUILDS[build].hint + ' R to retry. Progress stays untouched.';
  }
  if (linkedRunTest?.seed.startsWith('PRESENTATION-')) {
    $('play').textContent =
      linkedRunTest.seed === 'PRESENTATION-MASTERY' ? 'Preview mastery rewards' : 'Preview ending';
    $('title-hint').textContent =
      linkedRunTest.seed === 'PRESENTATION-MASTERY'
        ? 'Sample mastery rewards and totals. Your progress stays untouched.'
        : 'Ending preview. Your save and discoveries stay untouched.';
  }
  if (linkedRunTest?.seed.startsWith('CLOCK-OUT-')) {
    $('play').textContent = 'Preview Clock Out';
    $('title-hint').textContent = 'Overtime finale preview. Your progress stays untouched.';
  }
  if (linkedRunTest?.welder) {
    $('play').innerHTML = 'Test The Welder <span aria-hidden="true">↗</span>';
    $('title-hint').textContent = 'An Overtime encounter. R to retry.';
  }
  if (linkedRunTest?.maintenance) {
    $('play').textContent = 'Test ' + SHAFT_NAMES[linkedRunTest.maintenance.kind];
    $('title-hint').textContent = 'Reach the top. R to retry. Your progress stays untouched.';
  }
  if (linkedRunTest?.recoilTrial) {
    $('play').textContent = 'Test ' + RECOIL_TRIALS[linkedRunTest.recoilTrial.kind].name;
    $('title-hint').textContent = 'Optional movement course. R to retry. No progress is recorded.';
  }
  if (linkedRunTest?.sortingPit !== undefined) {
    $('play').textContent = 'Test the Sorting Pit';
    $('title-hint').textContent = 'Reclamation. R to restart test. Progress is untouched.';
  }
  if (linkedRunTest?.huntTest) {
    $('play').textContent = 'Test ' + HUNTS[linkedRunTest.huntTest].name;
    $('title-hint').textContent =
      HUNTS[linkedRunTest.huntTest].hint + ' R to retry. Progress stays untouched.';
  }
  if (linkedRunTest?.bossRemix) {
    $('play').textContent = 'Test ' + BOSS_REMIXES[linkedRunTest.bossRemix].name;
    $('title-hint').textContent = 'Boss remix. R restarts this fight. No progress is recorded.';
  }
  if (linkedDrill) {
    $('play').textContent = 'Train ' + SUPPORT_DRILLS[linkedDrill].name;
    $('title-hint').textContent = 'Optional firing range. Continue and saved progress stay intact.';
    $('security').hidden = true;
  }
  if (linkedTrial || invalidTrialLink) {
    $('daily').textContent = 'New run';
    $('daily').title = 'Start a fresh random run';
    $('play').textContent = linkedTrial?.preview
      ? 'Test Maintenance Trial'
      : 'Maintenance challenge';
    $('title-hint').textContent = linkedTrial?.preview
      ? 'Starting gun. Reach the summit. Your progress stays untouched.'
      : 'A shared climb. Clear its shaft in a normal run to enter.';
  }
  if (linkedRecoilChallenge || invalidRecoilLink) {
    $('daily').textContent = 'New run';
    $('daily').title = 'Start a fresh random run';
    $('play').textContent = 'Trial challenge';
    $('title-hint').textContent =
      'A shared course and starting gun. Open the challenge to check access.';
  }
  if (linkedGauntletPreview) {
    $('play').textContent = 'Gauntlet playtest';
    $('title-hint').textContent =
      'Five bosses. This playtest keeps your records and rewards untouched.';
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
  supportDrill?.dispose();
  supportDrill = null;
  upgradePreview?.dispose();
  upgradePreview = null;
  buildMenu = null;
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
function start(
  save?: Checkpoint,
  retry = false,
  seedOverride?: string,
  securityOverride?: SecurityLevel,
  factoryRules?: boolean | 1 | 2 | 3 | 4,
  unlockOverride?: readonly LongevityId[],
  uprisingOverride?: UprisingRun | null,
  startingGunOverride?: StartingGun,
  encounterOverride?: 0 | 1,
  recoilOverride?: boolean,
  teamworkOverride?: boolean,
  remixOverride?: boolean,
  huntOverride?: boolean,
) {
  if (progress.restoring) return;
  progress.checkExternal();
  if (progress.state === 'conflict') {
    openProgress();
    return;
  }
  if (retry && game.workshop.active) {
    startWorkshop(game.mods, firstSession.warmup, game.startingGun);
    return;
  }
  if (retry && game.maintenance.trial) {
    startTrial(game.maintenance.trial.route, game.maintenance.trial.preview, activeTrialChallenge);
    return;
  }
  if (retry && game.gauntlet.state) {
    startGauntlet(game.gauntlet.state.gun, game.gauntlet.state.preview);
    return;
  }
  if (retry && game.recoil.practice) {
    startRecoilPractice(
      game.recoil.practice.kind,
      game.recoil.practice.gun,
      game.recoil.race.challenge ?? undefined,
    );
    return;
  }
  if (retry && game.testRun) {
    startRunTest(game.testRun);
    return;
  }
  if (retry && game.practice) {
    startPractice(game.practice, game.practice.build ?? null, {
      test: practiceTest,
      challenge: activePracticeChallenge ?? undefined,
    });
    return;
  }
  finishedRun = null;
  firstSession.stop();
  runCommendations = [];
  linkedTest = null;
  linkedTrial = null;
  invalidTrialLink = false;
  linkedRunTest = null;
  linkedWorkshop = false;
  previewCommendations = false;
  commendations = mergeCommendations(commendations, read(COMMENDATIONS_KEY));
  equippedCosmetics = loadCosmetics(equippedCosmetics, commendations);
  game.cosmetics = { ...equippedCosmetics };
  sound.unlock();
  sound.resetMusic();
  closeDialog();
  const previousFactory = game.factory?.condition ?? runHistory.find((run) => run.factory)?.factory;
  const freshSeed = () => freshFactorySeed(() => newCampaignSeed(game.seed), previousFactory);
  const seed =
    save?.seed ??
    (retry
      ? dailyFromSeed(game.seed)
        ? retrySeed(game.seed)
        : game.bossRemixes || game.hunts.enabled
          ? game.seed
          : freshSeed()
      : (seedOverride ?? linkedDaily?.seed ?? seedParam ?? freshSeed()));
  activeDaily = dailyFromSeed(seed);
  const requestedGun = startingGunOverride ?? (retry ? game.startingGun : selectedStartingGun);
  const startingGun =
    save || activeDaily ? requestedGun : availableStartingGun(requestedGun, weaponUnlocks());
  if (!save) write(RUN_REWARDS_KEY, { version: 1, seed, ids: [] });
  write(WEAPON_UNLOCKS_KEY, { ...weaponUnlocks(), started: true });
  if (!activeDaily) selectedStartingGun = save ? (save.startingGun ?? 'pistol') : startingGun;
  linkedDaily = activeDaily;
  invalidDailyLink = false;
  unavailableDailySave = false;
  if (activeDaily) {
    seedParam = undefined;
    history.replaceState(null, '', dailyLink(activeDaily, location.href));
  } else {
    const url = new URL(location.href);
    url.searchParams.delete('test');
    url.searchParams.delete('shaft');
    url.searchParams.delete('workshop');
    url.searchParams.delete('area');
    url.searchParams.delete('formation');
    url.searchParams.delete('build');
    url.searchParams.delete('daily');
    url.searchParams.delete('dv');
    if (seedParam !== seed) {
      seedParam = undefined;
      url.searchParams.delete('seed');
      url.searchParams.delete('fv');
      url.searchParams.delete('ul');
      url.searchParams.delete('uv');
      url.searchParams.delete('ur');
      url.searchParams.delete('sg');
      url.searchParams.delete('ev');
      url.searchParams.delete('sv');
      url.searchParams.delete('bv');
      url.searchParams.delete('hv');
    } else {
      url.searchParams.set('sg', selectedStartingGun);
    }
    history.replaceState(null, '', url);
  }
  dailyResult = null;
  const requestedSecurity =
    securityOverride ?? (retry ? (game.security?.level ?? 0) : selectedSecurity);
  const security = requestedSecurity <= securityProfile().unlocked ? requestedSecurity : 0;
  if (!activeDaily) selectedSecurity = save?.security?.level ?? security;
  game.start(
    seed,
    save,
    null,
    null,
    false,
    activeDaily ? 0 : security,
    factoryRules ??
      (seedParam === seed && entryUrl.searchParams.get('fv') === '0'
        ? false
        : seedParam === seed && entryUrl.searchParams.get('fv') === '1'
          ? 1
          : seedParam === seed && ['2', '3', '4'].includes(entryUrl.searchParams.get('fv') ?? '')
            ? (Number(entryUrl.searchParams.get('fv')) as 2 | 3 | 4)
            : true),
    unlockOverride ??
      (retry && seed === game.seed
        ? game.unlocks
        : seedParam === seed && entryUrl.searchParams.has('ul')
          ? loadUnlocks(entryUrl.searchParams.get('ul')?.split(',').filter(Boolean))
          : currentGoals()
              .filter((g) => g.unlocked)
              .map((g) => g.id)),
    uprisingOverride !== undefined
      ? uprisingOverride
      : seedParam === seed &&
          (entryUrl.searchParams.get('uv') === '0' ||
            (entryUrl.searchParams.has('fv') && !entryUrl.searchParams.has('uv')))
        ? null
        : newUprising(
            read(UPRISING_RECORDS_KEY),
            seedParam === seed
              ? (uprisingPlan(entryUrl.searchParams.get('ur')) ?? undefined)
              : undefined,
          ),
    startingGun,
    encounterOverride ?? (seedParam === seed && entryUrl.searchParams.get('ev') === '0' ? 0 : 1),
    recoilOverride ?? !(seedParam === seed && entryUrl.searchParams.get('tv') === '0'),
    teamworkOverride ??
      (retry
        ? game.teamwork.enabled
        : !(seedParam === seed && entryUrl.searchParams.get('sv') === '0')),
    remixOverride ??
      (retry
        ? game.bossRemixes
        : weaponUnlocks().cleared &&
          !(seedParam === seed && entryUrl.searchParams.get('bv') === '0')),
    huntOverride ??
      (retry
        ? game.hunts.enabled
        : !(seedParam === seed && entryUrl.searchParams.get('hv') === '0')),
  );
  if (needsGuidance && !save && !activeDaily) firstSession.start(game);
  updateFirstSession();
  renderer.reset();
  pointer.x = canvas.clientWidth * 0.55;
  pointer.y = canvas.clientHeight * 0.6;
  if (game.mode === 'playing') canvas.focus();
}
function startPractice(
  encounter: Encounter,
  mods: readonly string[] | null = null,
  options: { test?: boolean; challenge?: PracticeChallenge } = {},
) {
  discovered = loadDiscoveries([...discovered, ...loadDiscoveries(read(DISCOVERIES_KEY))]);
  if (options.challenge) {
    if (
      !challengeAccess(options.challenge, practiceEncounters(), discovered).allowed ||
      options.challenge.kind !== encounter.kind ||
      options.challenge.seed !== encounter.seed ||
      options.challenge.remix !== encounter.remix ||
      JSON.stringify(options.challenge.mods) !== JSON.stringify(mods)
    )
      return;
  } else if (
    !canPractice(encounter, practiceEncounters(), options.test && mods === null ? linkedTest : null)
  )
    return;
  practiceTest = options.test === true;
  practiceEligible = !practiceTest;
  practiceCaptured = false;
  practiceWin = null;
  practiceOutcome = null;
  activePracticeChallenge = options.challenge ? structuredClone(options.challenge) : null;
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
function startPracticeChallenge(challenge: PracticeChallenge) {
  startPractice(challenge, challenge.mods, { challenge });
}
function startTrial(route: TrialRoute, preview = false, challenge?: TrialChallenge) {
  if (progress.restoring) return;
  progress.checkExternal();
  if (progress.blocked) {
    openProgress();
    return;
  }
  const profile = loadShaftProfile(read(SHAFT_PROFILE_KEY));
  if (!preview && !trialAccess(route, profile)) return;
  if (
    preview &&
    (!linkedTrial?.preview || JSON.stringify(linkedTrial.route) !== JSON.stringify(route))
  )
    return;
  clearInput();
  firstSession.stop();
  finishedRun = null;
  runCommendations = [];
  trialCaptured = false;
  trialOutcome = null;
  activeTrialChallenge = challenge;
  activeDaily = null;
  dailyResult = null;
  sound.unlock();
  sound.resetMusic();
  closeDialog();
  if (!game.maintenance.startTrial(route, profile, preview)) return;
  renderer.reset();
  pointer.x = canvas.clientWidth * 0.55;
  pointer.y = canvas.clientHeight * 0.6;
  canvas.focus();
}
function certifyMaintenance(profile: ShaftProfile) {
  if (!maintenanceCertified(profile)) return;
  commendations = mergeCommendations(commendations, read(COMMENDATIONS_KEY));
  if (!commendations.includes('maintenance-certified')) {
    runCommendations.push('maintenance-certified');
    earnRunRewards(commendationRewards('maintenance-certified'));
    commendations = mergeCommendations(commendations, ['maintenance-certified']);
    write(COMMENDATIONS_KEY, commendations);
  }
}
function openRecoilTrials(
  parent = 'practice',
  challenge?: RecoilChallenge,
  share?: RecoilChallenge,
) {
  recoilMenuParent = parent;
  recoilMenuChallenge = challenge;
  recoilMenuShare = share;
  showDialog('recoil-trials');
}
function startRecoilPractice(kind: RecoilTrialKind, gun: StartingGun, challenge?: RecoilChallenge) {
  progress.checkExternal();
  if (progress.blocked) {
    openProgress();
    return;
  }
  if (
    !loadRecoilProfile(read(RECOIL_TRIALS_KEY)).clears.includes(kind) ||
    !unlockedStartingGuns(weaponUnlocks()).includes(gun) ||
    (challenge &&
      (!recoilChallengeAccess(
        challenge,
        read(RECOIL_TRIALS_KEY),
        unlockedStartingGuns(weaponUnlocks()),
      ) ||
        challenge.kind !== kind ||
        challenge.gun !== gun))
  )
    return;
  clearInput();
  firstSession.stop();
  finishedRun = null;
  runCommendations = [];
  recoilOutcome = null;
  recoilGhostSaved = false;
  activeDaily = null;
  dailyResult = null;
  sound.unlock();
  sound.resetMusic();
  closeDialog();
  const ghost =
    loadRecoilGhosts(read(RECOIL_GHOSTS_KEY)).find((r) => r.kind === kind && r.gun === gun) ?? null;
  game.recoil.startPractice(
    kind,
    gun,
    read(RECOIL_TRIALS_KEY),
    ghost,
    challenge ?? null,
    recoilGhostEnabled,
  );
  renderer.reset();
  pointer.x = canvas.clientWidth * 0.55;
  pointer.y = canvas.clientHeight * 0.6;
  canvas.focus();
}
function startGauntlet(gun: StartingGun = 'pistol', preview = false) {
  progress.checkExternal();
  if (!preview && progress.blocked) {
    openProgress();
    return;
  }
  const access = weaponUnlocks();
  if (!preview && (!access.cleared || !unlockedStartingGuns(access).includes(gun))) return;
  firstSession.stop();
  clearInput();
  closeDialog();
  game.setMode('title');
  if (!game.gauntlet.begin(gun, access, preview)) return;
  finishedRun = null;
  runCommendations = [];
  savedGauntlet = null;
  gauntletOutcome = null;
  gauntletReward = false;
  activeDaily = null;
  dailyResult = null;
  showDialog('gauntlet-run');
}
function chooseGauntletBoss(kind: PracticeBoss) {
  if (!game.gauntlet.choices.includes(kind)) return;
  clearInput();
  sound.unlock();
  sound.resetMusic();
  closeDialog();
  game.gauntlet.chooseBoss(kind);
  renderer.reset();
  pointer.x = canvas.clientWidth * 0.55;
  pointer.y = canvas.clientHeight * 0.6;
  canvas.focus();
}
function captureGauntletResult() {
  const result = game.gauntlet.result;
  if (
    !result ||
    savedGauntlet === result ||
    game.mode !== 'won' ||
    game.gauntlet.state?.phase !== 'complete' ||
    game.gauntlet.state.preview
  )
    return;
  progress.checkExternal();
  if (progress.blocked) return;
  savedGauntlet = result;
  gauntletOutcome = recordGauntlet(read(GAUNTLET_KEY), result);
  write(GAUNTLET_KEY, gauntletOutcome.records);
  commendations = mergeCommendations(commendations, read(COMMENDATIONS_KEY));
  gauntletReward = !commendations.includes('gauntlet-cleared');
  if (gauntletReward) {
    commendations = mergeCommendations(commendations, ['gauntlet-cleared']);
    write(COMMENDATIONS_KEY, commendations);
    updateArchive(['commendation:gauntlet-cleared']);
    updateAppearanceBadge();
  }
}
function captureTrialResult() {
  if (trialCaptured) return;
  const win = snapshotTrial(game, read(SHAFT_PROFILE_KEY));
  if (!win) return;
  trialCaptured = true;
  progress.checkExternal();
  if (progress.blocked) return;
  trialOutcome = recordTrial(read(SHAFT_PROFILE_KEY), win.route, win.score);
  write(SHAFT_PROFILE_KEY, trialOutcome.profile);
  certifyMaintenance(trialOutcome.profile);
}
function openTrials(parent = 'practice', challenge?: TrialChallenge, share?: TrialChallenge) {
  trialMenuParent = parent;
  trialMenuChallenge = challenge;
  trialMenuShare = share;
  showDialog('shaft-trials');
}
function capturePracticeResult() {
  if (practiceCaptured) return;
  const win = snapshotPracticeWin(game, practiceEligible);
  if (!win) return;
  practiceCaptured = true;
  practiceWin = win;
  progress.checkExternal();
  if (progress.blocked) return;
  practiceOutcome = recordPracticeWin(read(PRACTICE_RECORDS_KEY), win);
  practiceRecords = practiceOutcome.records;
  if (practiceOutcome.newFastest || practiceOutcome.newCleanest)
    write(PRACTICE_RECORDS_KEY, practiceRecords);
}
function openPracticeRecords(boss: PracticeBoss) {
  if (!practiceEncounters().some((e) => e.kind === boss)) return;
  practiceRecordsBoss = boss;
  practiceRecordsRemix = (dialogKind === 'practice-setup' ? practiceTarget : game.practice)?.remix;
  practiceRecordsParent = dialogKind;
  showDialog('practice-records');
}
function presetBest(encounter: Encounter) {
  const mods = practiceCheckpoint(encounter)?.mods;
  if (!mods) return '';
  const key = practiceBuildKey({ ...encounter, rules: PRACTICE_RULESET, mods });
  const best = loadPracticeRecords(read(PRACTICE_RECORDS_KEY)).find(
    (r) => practiceBuildKey(r) === key,
  );
  return best
    ? '<p class="practice-record-note">Preset best ' +
        practiceTime(best.fastest.timeMs) +
        ' · Fewest hits ' +
        best.cleanest.hits +
        '</p>'
    : '';
}
function openPracticeBuild(encounter: Encounter, parent = 'practice-setup') {
  if (!canPractice(encounter, practiceEncounters())) return;
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
  prepareClockOutTest(game);
  finishPresentationTest(game);
  renderer.reset();
  pointer.x = canvas.clientWidth * 0.55;
  pointer.y = canvas.clientHeight * 0.6;
  if (game.mode === 'playing') canvas.focus();
}
function weaponUnlocks() {
  return loadWeaponUnlocks(read(WEAPON_UNLOCKS_KEY));
}
function practiceEncounters(): Encounter[] {
  return [
    ...encounters.filter((e) => !e.remix),
    ...remixEncounters(read(BOSS_REMIXES_KEY), weaponUnlocks().cleared),
  ];
}
function earnRunRewards(ids: readonly string[]) {
  if (
    !ids.length ||
    game.practice ||
    game.testRun ||
    game.workshop.active ||
    game.mode === 'title' ||
    progress.blocked
  )
    return;
  const before = read(RUN_REWARDS_KEY);
  const next = addRunRewards(before, game.seed, ids);
  if (JSON.stringify(before) !== JSON.stringify(next)) write(RUN_REWARDS_KEY, next);
}
function unlockStartingGun(gun: 'shotgun' | 'nailgun') {
  const before = weaponUnlocks();
  const field = gun === 'shotgun' ? 'cleared' : 'overtime';
  if (before[field]) return;
  write(WEAPON_UNLOCKS_KEY, {
    ...before,
    started: true,
    cleared: true,
    overtime: before.overtime || gun === 'nailgun',
  });
  earnRunRewards(['gun:' + gun]);
  updateArchive(['gun:' + gun]);
}
function startFreshCampaign() {
  if (weaponUnlocks().started) showDialog('starting-gun');
  else start(undefined, false, undefined, undefined, undefined, undefined, undefined, 'pistol');
}
function startWorkshop(
  mods: readonly string[] = workshopMods,
  warmup = false,
  startingGun: StartingGun = workshopStartingGun,
) {
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
    workshopStartingGun = startingGun = availableStartingGun(startingGun, weaponUnlocks());
    if (!previewCommendations) write(WORKSHOP_BUILD_KEY, workshopMods);
  }
  game.startWorkshop(discovered, warmup ? [] : workshopMods, warmup ? 'pistol' : startingGun);
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
  if (game.mode === 'dead' || (game.mode === 'won' && !game.clockOut.active)) showDialog('result');
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
  if (game.mode === 'won') {
    unlockStartingGun('shotgun');
    if (game.overtime) unlockStartingGun('nailgun');
  }
  finishedRun = snapshotRun(game, id);
  if (!finishedRun) return;
  if (
    finishedRun.outcome === 'won' &&
    finishedRun.uprising &&
    !finishedRun.overtime &&
    !finishedRun.shutdown
  )
    write(
      UPRISING_RECORDS_KEY,
      recordUprising(
        read(UPRISING_RECORDS_KEY),
        undefined,
        false,
        uprisingFinale(finishedRun.uprising),
      ),
    );
  runHistory = addRun([...runHistory, ...loadRunHistory(read(RUN_HISTORY_KEY))], finishedRun);
  write(RUN_HISTORY_KEY, runHistory);
  updateArchive();
}
function replayFinishedRun(run: RunRecap) {
  if (!canReplayRun(run)) return;
  // A replay begins at room one; the archived gun belongs only in Workshop.
  const url = new URL(location.href);
  url.search = '';
  url.hash = '';
  url.searchParams.set('seed', run.seed);
  url.searchParams.set('sg', run.startingGun ?? 'pistol');
  url.searchParams.set('ev', String(run.encounters ?? 0));
  url.searchParams.set('sv', String(run.teamwork ?? 0));
  url.searchParams.set('bv', String(run.bossRemixes ?? 0));
  url.searchParams.set('hv', String(run.huntRules ?? 0));
  url.searchParams.set('tv', run.recoilTrials ? '1' : '0');
  url.searchParams.set('fv', run.factory ? String(run.factoryVersion ?? 1) : '0');
  url.searchParams.set('ul', (run.unlocks ?? []).join(','));
  url.searchParams.set('uv', run.uprising ? '1' : '0');
  if (run.uprising) url.searchParams.set('ur', run.uprising.choices.join(','));
  history.replaceState(null, '', url);
  linkedDaily = null;
  seedParam = run.seed;
  start(
    undefined,
    false,
    run.seed,
    run.security ?? 0,
    run.factory ? (run.factoryVersion ?? 1) : false,
    run.unlocks ?? [],
    run.uprising
      ? { ...newUprising(null, run.uprising.choices), unlocks: [...run.uprising.unlocks] }
      : null,
    run.startingGun ?? 'pistol',
    run.encounters ?? 0,
    !!run.recoilTrials,
    run.teamwork === 1,
    run.bossRemixes === 1,
    run.huntRules === 1,
  );
}
function workshopFromRun(run: RunRecap) {
  discovered = loadDiscoveries([...discovered, ...loadDiscoveries(read(DISCOVERIES_KEY))]);
  if (canPracticeRunBuild(run, discovered))
    startWorkshop(run.mods, false, run.startingGun ?? 'pistol');
}
function saveRunBlueprint(run: RunRecap) {
  if (!canPracticeRunBuild(run, discovered)) return;
  blueprintSource = run;
  blueprintParent = dialogKind;
  showDialog('blueprints');
}
function backFromHistory() {
  if (game.mode === 'dead' || (game.mode === 'won' && !game.clockOut.active)) showDialog('result');
  else resume();
}
function backFromLogbook() {
  if (game.mode === 'upgrade' && game.hunts.rewarding && !logbookFromWorkshop) {
    showDialog('upgrade');
    return;
  }
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
  } else if (game.mode === 'dead' || (game.mode === 'won' && !game.clockOut.active))
    showDialog('result');
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
  updateArchive();
}
function updateArchive(ids: readonly string[] = []) {
  const toolsBefore = weaponUnlocks();
  const toolsAfter = migrateWeaponUnlocks(
    toolsBefore,
    checkpoint,
    runHistory,
    logbookProgress,
    commendations,
    securityProfile().unlocked > 0,
    loadEncounters(read(VICTORIES_KEY)).map((e) => e.kind),
  );
  const earnedTools = unlockedStartingGuns(toolsAfter).filter(
    (id) => !unlockedStartingGuns(toolsBefore).includes(id),
  );
  if (JSON.stringify(toolsBefore) !== JSON.stringify(toolsAfter))
    write(WEAPON_UNLOCKS_KEY, toolsAfter);
  const before = read(ARCHIVE_KEY);
  const newlyUnlocked = currentGoals().filter(
    (g) => g.unlocked && !loadArchive(before).encountered.includes('mod:' + g.id + ':unlocked'),
  );
  const newContracts = uprisingContracts(read(UPRISING_RECORDS_KEY)).filter(
    (c) =>
      c.unlocked && !loadArchive(before).encountered.includes('uprising:' + c.id + ':unlocked'),
  );
  if (game.commendations.eligible)
    earnRunRewards([
      ...newlyUnlocked.map((g) => 'mod:' + g.id),
      ...newContracts.map((c) => 'uprising:' + c.id),
      ...earnedTools.map((id) => 'gun:' + id),
    ]);
  if (newlyUnlocked.length && game.commendations.eligible)
    fittingNotice = {
      name:
        newlyUnlocked.length > 1
          ? `${newlyUnlocked.length} toolroom fittings`
          : newlyUnlocked[0].name,
      until: null,
      stage: game.stage,
    };
  const entries = logbookEntries(discovered, logbookProgress, commendations);
  const next = encounterArchive(before, [
    ...entries.map(archiveToken),
    ...ids,
    ...(!game.practice &&
    !game.testRun &&
    !game.workshop.active &&
    game.mode !== 'title' &&
    game.level.toolroom
      ? ['room:' + game.level.toolroom]
      : []),
    ...unlockedStartingGuns(toolsAfter)
      .filter((id) => id !== 'pistol')
      .map((id) => 'gun:' + id),
    ...currentGoals()
      .filter((g) => g.unlocked)
      .map((g) => 'mod:' + g.id + ':unlocked'),
    ...(logbookProgress.shutdown ? ['region:shutdown'] : []),
    ...uprisingContracts(read(UPRISING_RECORDS_KEY))
      .filter((c) => c.unlocked)
      .map((c) => 'uprising:' + c.id + ':unlocked'),
    ...(!game.practice &&
    !game.testRun &&
    !game.workshop.active &&
    game.mode !== 'title' &&
    ['railworks', 'core'].includes(game.level.uprising ?? '')
      ? ['region:' + game.level.uprising]
      : []),
  ]);
  if (JSON.stringify(before) !== JSON.stringify(next)) {
    write(ARCHIVE_KEY, next);
    updateLogbookBadge();
  }
}
function currentGoals() {
  return unlockGoals(
    mergeLogbook(logbookProgress, loadLogbook(read(LOGBOOK_KEY))),
    mergeCommendations(commendations, read(COMMENDATIONS_KEY)),
    loadEncounters(read(VICTORIES_KEY)).map((e) => e.kind),
    read(MILESTONES_KEY),
  );
}
function currentMasteryAttempt(): SupportMasteryAttempt | undefined {
  if (game.mode !== 'title' && !game.practice && !game.workshop.active)
    return {
      results: game.combatReport.snapshot(),
      label: game.testRun ? 'Preset test results · Progress stays untouched' : 'This attempt',
    };
  if (game.mode === 'title' && checkpoint?.combatResults)
    return { results: checkpoint.combatResults, label: 'Continue attempt' };
}
function updateLogbookBadge() {
  const unread = logbookCatalog(
    discovered,
    logbookProgress,
    commendations,
    read(ARCHIVE_KEY),
    currentGoals(),
    read(UPRISING_RECORDS_KEY),
    weaponUnlocks(),
    read(RECOIL_TRIALS_KEY),
  ).filter((e) => e.unread).length;
  const badge = document.getElementById('logbook-badge');
  if (badge) badge.hidden = !unread;
  const button = document.getElementById('logbook');
  if (unread) button?.setAttribute('aria-label', 'Logbook, ' + unread + ' new entries');
  else button?.removeAttribute('aria-label');
}
game.onEnemyDefeated = updateLogbook;
game.onUprisingMission = (route, clean) => {
  if (game.practice || game.testRun || game.workshop.active || game.overtime) return;
  progress.checkExternal();
  if (progress.blocked) return;
  write(UPRISING_RECORDS_KEY, recordUprising(read(UPRISING_RECORDS_KEY), route, clean));
  updateArchive();
};
game.onMilestone = (id) => {
  if (!game.commendations.eligible) return;
  progress.checkExternal();
  if (progress.blocked) return;
  const before = loadMilestones(read(MILESTONES_KEY));
  if (before[id]) return;
  write(MILESTONES_KEY, { ...before, [id]: true });
  updateArchive();
};
game.onEnemyEncountered = (enemy) => {
  if (!game.practice && !game.testRun && !game.workshop.active && game.mode === 'playing') {
    updateArchive(enemyArchiveIds(enemy));
    progress.checkExternal();
    if (!progress.blocked && game.level.bossRemix) {
      const before = loadBossRemixes(read(BOSS_REMIXES_KEY)),
        next = recordBossRemix(before, game, weaponUnlocks().cleared);
      if (JSON.stringify(before) !== JSON.stringify(next)) write(BOSS_REMIXES_KEY, next);
    }
  }
};
game.maintenance.onClear = (clear) => {
  progress.checkExternal();
  if (progress.blocked) return;
  const profile = recordShaftClear(read(SHAFT_PROFILE_KEY), clear);
  write(SHAFT_PROFILE_KEY, profile);
  certifyMaintenance(profile);
  updateTitle();
};
game.recoil.onComplete = (result) => {
  progress.checkExternal();
  if (progress.blocked) return;
  recoilOutcome = recordRecoilTrial(read(RECOIL_TRIALS_KEY), result);
  write(RECOIL_TRIALS_KEY, recoilOutcome.profile);
  if (game.recoil.practice && recoilOutcome.best && game.recoil.race.recording) {
    write(
      RECOIL_GHOSTS_KEY,
      recordRecoilGhost(read(RECOIL_GHOSTS_KEY), game.recoil.race.recording),
    );
    recoilGhostSaved = true;
  }
  const id = RECOIL_TRIALS[result.kind].commendation;
  commendations = mergeCommendations(commendations, read(COMMENDATIONS_KEY));
  if (recoilOutcome.newMastery && !commendations.includes(id)) {
    runCommendations.push(id);
    earnRunRewards(commendationRewards(id));
    commendations = mergeCommendations(commendations, [id]);
    write(COMMENDATIONS_KEY, commendations);
  } else recoilOutcome.newMastery = false;
  updateArchive(['trial:' + result.kind]);
  updateAppearanceBadge();
  updateTitle();
};
game.onCommendation = (id) => {
  if (!game.commendations.eligible) return;
  commendations = mergeCommendations(commendations, read(COMMENDATIONS_KEY));
  if (!commendations.includes(id)) {
    runCommendations.push(id);
    earnRunRewards(commendationRewards(id));
    if (id === 'after-hours' && !activeDaily) unlockStartingGun('nailgun');
    if (['unsafe-load', 'clearance', 'bank-job', 'air-traffic', 'special-delivery'].includes(id))
      commendationNotice = { id, until: null, stage: game.stage };
  }
  commendations = mergeCommendations(commendations, [id]);
  write(COMMENDATIONS_KEY, commendations);
  updateArchive();
  updateAppearanceBadge();
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
    updateArchive([...(s.reward?.offers ?? []), ...s.mods].map((id) => 'mod:' + id));
  }
  checkpoint = s;
  write(CHECKPOINT_KEY, s);
};
game.onSound = (kind) => sound.play(kind);
game.onCampaignClear = (score) => {
  progress.checkExternal();
  if (progress.blocked) return;
  unlockStartingGun('shotgun');
  const profile = recordSecurityClear(read(SECURITY_KEY), score, securityProfile().unlocked > 0);
  write(SECURITY_KEY, profile);
  updateTitle();
};
game.onHaptic = (kind, strength) => {
  if (inputDevice === 'controller' && pageActive && document.hasFocus() && !document.hidden)
    controller.rumble(kind, strength, performance.now());
};
game.hunts.onClear = (kind) => {
  progress.checkExternal();
  if (progress.blocked) return;
  const victory = { kind, seed: huntSeed(kind) };
  if (!encounters.some((r) => r.kind === kind)) {
    encounters.push(victory);
    write(VICTORIES_KEY, encounters);
  }
  updateArchive();
  updateTitle();
};
game.onBossDefeated = (kind) => {
  if (game.practice || game.testRun || game.workshop.active) return;
  const victory = loadEncounters([
    { kind, seed: kind === 'welder' ? game.seed : game.layoutSeed },
  ])[0];
  if (!victory || encounters.some((record) => record.kind === kind)) return;
  encounters.push(victory);
  write(VICTORIES_KEY, encounters);
  updateArchive();
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
let savingClockOut: Game['clockOut'] | null = null;
$('skip-clock-out').onclick = () => game.skipClockOut();
game.onChange = () => {
  if (!game.recoil.result) {
    recoilOutcome = null;
    recoilGhostSaved = false;
  }
  if (game.mode === 'playing' || game.mode === 'title') reportDraft = undefined;
  updateLogbook();
  if (replayRoom !== game.level || game.mode === 'title' || game.mode === 'won') {
    replayRoom = game.level;
    deathReplay.reset();
  }
  captureFinishedRun();
  capturePracticeResult();
  captureGauntletResult();
  captureTrialResult();
  const finale = game.clockOut;
  document.body.dataset.clockOut = String(finale.active);
  $('clock-out-controls').hidden = !finale.active;
  if (finale.active && savingClockOut !== finale) {
    savingClockOut = finale;
    clearInput();
    closeDialog();
    $('skip-clock-out').focus();
    // History, lore, reward and checkpoint removal are already queued. Start
    // the presentation only after the existing atomic profile writer settles.
    void progress.settled().then(() => {
      if (game.clockOut === finale) game.readyClockOut();
    });
  }
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
      : (game.recoil.practice
          ? 'PRACTICE · '
          : game.testRun
            ? 'TEST · '
            : activeDaily
              ? 'DAILY · '
              : '') +
        (game.overtime ? 'OT · ' : '') +
        (game.security ? 'S' + game.security.level + ' · ' : '') +
        (game.escape
          ? 'ESCAPE'
          : game.detour
            ? game.recoil.active
              ? 'RECOIL TRIAL'
              : game.maintenance.active
                ? 'MAINTENANCE'
                : 'CHALLENGE'
            : String(game.stage + 1).padStart(2, '0') + ' / ' + String(STAGES).padStart(2, '0'));
  $('stage').title = game.practice
    ? PRACTICE_BOSSES[game.practice.kind].name
    : `${activeDaily ? 'Daily · ' + activeDaily.date + ' · ' : ''}${game.level.annex ? REGION_NAMES.annex : AREAS[game.level.area].name} · ${game.level.name}`;
  $('factory-condition').hidden =
    !game.factory || game.stage === 0 || !!game.overtime || !!game.escape || game.detour;
  if (game.factory) {
    $('factory-hint').hidden = !!game.level.uprising;
    $('factory-name').textContent = game.level.uprising
      ? UPRISING_DISTRICTS[game.level.uprising]
      : FACTORY_CONDITIONS[game.factory.condition].name;
    $('factory-hint').textContent = game.level.uprising
      ? game.stage === 19
        ? 'Your completed jobs shaped this defense.'
        : 'Complete the job, then clear the patrol or reach evacuation.'
      : factoryHint(game.factory, game.stage);
  }
  if (game.maintenance.trial)
    $('stage').textContent =
      (game.maintenance.trial.preview ? 'TEST · ' : '') + 'MAINTENANCE TRIAL';
  if (game.gauntlet.state)
    $('stage').textContent = 'GAUNTLET · ' + game.gauntlet.state.route.length + ' / 5';
  if (game.testRun?.annex) {
    $('stage').textContent = 'DEAD SIGNAL · TEST';
    $('stage').title = 'Transmission Annex · One-room prototype';
  }
  updateTitle();
  updateFirstSession();
  if (game.mode === 'upgrade') showDialog('upgrade');
  if (game.mode === 'reforge') showDialog('reforge');
  if (game.mode === 'dead' || (game.mode === 'won' && !game.clockOut.active)) showDialog('result');
};
function openSupportDrill(id: SupportDrillId) {
  sound.unlock();
  selectedDrill = id;
  showDialog('support-drill');
}
function startLinkedSupportDrill(id: SupportDrillId) {
  drillPreview = true;
  logbookView.query = '';
  logbookView.filter = 'all';
  openSupportDrill(id);
}
function backFromDrill() {
  logbookView.section = 'commendations';
  logbookView.selected = 'commendation:' + SUPPORT_DRILLS[selectedDrill].mastery;
  showDialog('logbook');
  document.querySelector<HTMLButtonElement>('[data-support-drill]')?.focus({ preventScroll: true });
}
function showDialog(kind: string) {
  supportDrill?.dispose();
  supportDrill = null;
  upgradePreview?.dispose();
  upgradePreview = null;
  if (kind === 'upgrade' && game.uprising.choices.length) kind = 'uprising';
  buildMenu = null;
  modal.setAttribute('aria-labelledby', 'dialog-title');
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
  modal.classList.toggle('upgrade-dialog', kind === 'upgrade' || kind === 'reforge');
  modal.classList.toggle('practice-dialog', kind === 'practice' || kind === 'practice-setup');
  modal.classList.toggle(
    'workshop-dialog',
    [
      'workshop',
      'practice-build',
      'blueprints',
      'practice-records',
      'practice-import',
      'practice-share',
      'shaft-trials',
      'recoil-trials',
      'gauntlet-setup',
      'gauntlet-run',
    ].includes(kind) ||
      (kind === 'result' && !!game.gauntlet.state),
  );
  modal.classList.toggle('replay-dialog', kind === 'replay');
  modal.classList.toggle('logbook-dialog', kind === 'logbook');
  modal.classList.toggle('drill-dialog', kind === 'support-drill');
  modal.classList.toggle(
    'ending-dialog',
    kind === 'result' &&
      game.mode === 'won' &&
      !game.practice &&
      !game.maintenance.trial &&
      !game.recoil.practice,
  );
  modal.classList.toggle('controls-dialog', kind === 'controls');
  modal.classList.toggle('progress-dialog', kind === 'progress');
  modal.classList.toggle('settings-dialog', kind === 'settings' || kind === 'pause');
  modal.classList.toggle('update-dialog', kind === 'update');
  const content = $('dialog-content');
  modal.scrollTop = 0;
  if (kind === 'logbook' || kind === 'workshop')
    commendations = mergeCommendations(commendations, read(COMMENDATIONS_KEY));
  const masteryRewardPreview = game.testRun?.seed === 'PRESENTATION-MASTERY';
  const visibleCommendations = previewCommendations
    ? COMMENDATIONS.map((c) => c.id)
    : masteryRewardPreview
      ? mergeCommendations(
          commendations,
          SUPPORT_MASTERIES.map((m) => m.id),
        )
      : commendations;
  if (kind === 'support-drill') {
    supportDrill = new SupportDrillView(content, selectedDrill, bindings, backFromDrill, (kind) =>
      sound.play(kind),
    );
  } else if (kind === 'starting-gun') {
    startingGunMenu(
      content,
      selectedStartingGun,
      (gun) => start(undefined, false, undefined, undefined, undefined, undefined, undefined, gun),
      closeDialog,
      unlockedStartingGuns(weaponUnlocks()),
    );
    drawRewardImages(content, game);
  } else if (kind === 'gauntlet-setup') {
    buildMenu = gauntletSetup(
      content,
      unlockedStartingGuns(weaponUnlocks()),
      read(GAUNTLET_KEY),
      startGauntlet,
      () => showDialog('practice'),
    );
  } else if (kind === 'gauntlet-run' || (kind === 'result' && game.gauntlet.state)) {
    const session = game.gauntlet.state;
    if (!session) {
      showDialog('practice');
      return;
    }
    buildMenu = gauntletRunMenu(content, game, {
      outcome: gauntletOutcome,
      reward: gauntletReward && session.phase === 'complete',
      choose: chooseGauntletBoss,
      restart: () => startGauntlet(session.gun, session.preview),
      exit: menu,
    });
    const reward = document.getElementById('earned-rewards');
    if (reward)
      reward.onclick = () => {
        logbookView.section = 'commendations';
        logbookView.selected = 'commendation:gauntlet-cleared';
        showDialog('logbook');
      };
  } else if (kind === 'update') {
    content.innerHTML =
      '<p class="eyebrow">A FREE GAMEPLAY UPDATE</p><h2 id="dialog-title">Open the toolroom.</h2>' +
      '<p class="update-tagline">New tools to earn. New fittings to combine. New machines to outmaneuver.</p>' +
      '<dl class="update-notes"><div><dt>Six starting tools.</dt><dd>Earn the paired Twinbore by defeating the Press or Kiln, the penetrating Coil carbine through two different machine hunts, and the Pressure repeater by clearing the Gauntlet. Your first run starts with the pistol.</dd></div>' +
      '<div><dt>24 earned fittings.</dt><dd>Boss victories and Campaign completion open movement, precision, heat, banking, defense and cadence fittings. See each requirement in the Logbook; later runs can offer the parts you have earned.</dd></div>' +
      '<div><dt>A changing factory.</dt><dd>Nine later-zone layouts introduce Shutter Guards, Striders and Mortar Carts, plus six variants. Watch the committed warnings, flank closed shutters, and shoot mortar shells before they land. The opening stays familiar.</dd></div></dl>' +
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
        : logbookCatalog(
            drillPreview
              ? [...discovered, ...SUPPORT_DRILLS[selectedDrill].mods]
              : game.testRun?.seed.startsWith('SUPPORT-4.13-') || masteryRewardPreview
                ? [...discovered, ...game.mods]
                : discovered,
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
            read(ARCHIVE_KEY),
            currentGoals(),
            read(UPRISING_RECORDS_KEY),
            weaponUnlocks(),
            read(RECOIL_TRIALS_KEY),
            currentMasteryAttempt(),
          ),
      logbookView,
      modMark,
      backFromLogbook,
      previewLogbook || previewCommendations || masteryRewardPreview || drillPreview,
      () => {
        logbookFromWorkshop = false;
        showDialog('workshop');
        content.querySelector<HTMLButtonElement>('[data-workshop-tab="appearance"]')?.click();
      },
      (entry) => {
        if (previewLogbook || previewCommendations || game.testRun || drillPreview) return;
        write(ARCHIVE_KEY, acknowledgeArchiveEntry(read(ARCHIVE_KEY), entry));
        updateLogbookBadge();
      },
      (root) => drawRewardImages(root, game),
      openSupportDrill,
    );
  } else if (kind === 'replay' && deathReplay.ready) {
    replayView = new ReplayView(deathReplay, content);
    $('retry').onclick = () => start(undefined, true);
    $('back').onclick = () => showDialog('result');
  } else if (kind === 'security') {
    const profile = securityProfile();
    content.innerHTML = securityMenu(profile, selectedSecurity);
    content.querySelectorAll<HTMLButtonElement>('[data-security]').forEach((button) => {
      button.onclick = () => {
        const level = Number(button.dataset.security);
        if (!isSecurityLevel(level) || level > securityProfile().unlocked) return;
        selectedSecurity = level;
        updateTitle();
        closeDialog();
        $('security').focus();
      };
    });
    $('back').onclick = () => {
      closeDialog();
      $('security').focus();
    };
  } else if (kind === 'history') {
    discovered = loadDiscoveries([...discovered, ...loadDiscoveries(read(DISCOVERIES_KEY))]);
    runHistory = loadRunHistory([...runHistory, ...loadRunHistory(read(RUN_HISTORY_KEY))]);
    content.innerHTML = runHistoryMenu(runHistory, discovered);
    drawCombatReportImages(content, runHistory);
    bindRecapActions(
      content,
      runHistory,
      discovered,
      replayFinishedRun,
      workshopFromRun,
      saveRunBlueprint,
    );
    $('back').onclick = backFromHistory;
  } else if (kind === 'workshop') {
    discovered = loadDiscoveries([...discovered, ...loadDiscoveries(read(DISCOVERIES_KEY))]);
    buildMenu = workshopMenu(
      content,
      discovered,
      game.workshop.active ? game.mods : workshopMods,
      game.workshop.active,
      (mods, gun) => startWorkshop(mods, false, gun),
      backFromHistory,
      {
        game,
        earned: visibleCommendations,
        defeated: logbookProgress.enemies,
        discovered,
        preview: previewCommendations || masteryRewardPreview,
        unseen:
          previewCommendations || game.testRun
            ? []
            : unseenAppearanceItems(
                visibleCommendations,
                read(APPEARANCE_ITEMS_SEEN_KEY),
                read(APPEARANCE_SEEN_KEY),
              ),
        viewed: (id) => {
          if (previewCommendations || game.testRun) return;
          write(
            APPEARANCE_ITEMS_SEEN_KEY,
            acknowledgeAppearanceItem(read(APPEARANCE_ITEMS_SEEN_KEY), commendations, id),
          );
          updateAppearanceBadge();
        },
        equip: (selection) => {
          game.cosmetics = selection;
          if (!previewCommendations && !game.testRun) {
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
      {
        blueprints: blueprintStore,
        startingGun: game.workshop.active ? game.startingGun : workshopStartingGun,
        unlockedGuns: unlockedStartingGuns(weaponUnlocks()),
        showStartingGuns: weaponUnlocks().started,
      },
    );
  } else if (kind === 'blueprints' && blueprintSource) {
    buildMenu = blueprintMenu(
      content,
      blueprintStore,
      discovered,
      blueprintSource.mods,
      null,
      () => showDialog(blueprintParent),
      true,
      blueprintSource.startingGun ?? 'pistol',
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
        .filter((record) => !record.remix)
        .map(
          (record) =>
            '<button class="practice-fight" data-boss="' +
            record.kind +
            '">' +
            (isHunt(record.kind)
              ? '<canvas class="hunt-practice-image" data-archive-image="enemy:' +
                record.kind +
                '" aria-label="' +
                PRACTICE_BOSSES[record.kind].name +
                '"></canvas>'
              : '') +
            '<span>' +
            PRACTICE_BOSSES[record.kind].name +
            '</span><span aria-hidden="true">↗</span></button>',
        )
        .join('') +
      (weaponUnlocks().cleared
        ? '<button id="boss-gauntlet" class="practice-fight"><span>Boss Gauntlet</span><span aria-hidden="true">↗</span></button>'
        : '') +
      (remixEncounters(read(BOSS_REMIXES_KEY), weaponUnlocks().cleared).length
        ? '<button id="boss-remixes" class="practice-fight"><span>Boss remixes</span><span aria-hidden="true">↗</span></button>'
        : '') +
      (loadShaftProfile(read(SHAFT_PROFILE_KEY)).unlocks.length
        ? '<button id="shaft-trials" class="practice-fight"><span>Maintenance Trials</span><span aria-hidden="true">↗</span></button>'
        : '') +
      (loadRecoilProfile(read(RECOIL_TRIALS_KEY)).clears.length
        ? '<button id="recoil-trials" class="practice-fight"><span>Recoil Trials</span><span aria-hidden="true">↗</span></button>'
        : '') +
      '</div><div class="actions"><button id="practice-import" class="quiet">Import challenge</button><button id="practice-back" class="quiet">Back</button></div>';
    drawArchiveImages(content);
    if (document.getElementById('shaft-trials')) $('shaft-trials').onclick = () => openTrials();
    if (document.getElementById('boss-gauntlet'))
      $('boss-gauntlet').onclick = () => showDialog('gauntlet-setup');
    if (document.getElementById('boss-remixes'))
      $('boss-remixes').onclick = () => showDialog('boss-remixes');
    if (document.getElementById('recoil-trials'))
      $('recoil-trials').onclick = () => openRecoilTrials();
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
    $('practice-import').onclick = () => showDialog('practice-import');
  } else if (kind === 'boss-remixes') {
    buildMenu = bossRemixMenu(
      content,
      weaponUnlocks().cleared ? read(BOSS_REMIXES_KEY) : null,
      (encounter) => {
        practiceTarget = encounter;
        showDialog('practice-setup');
      },
      () => showDialog('practice'),
    );
  } else if (kind === 'recoil-trials') {
    buildMenu = recoilTrialMenu(
      content,
      loadRecoilProfile(read(RECOIL_TRIALS_KEY)),
      unlockedStartingGuns(weaponUnlocks()),
      startRecoilPractice,
      () => showDialog(recoilMenuParent),
      {
        ghosts: read(RECOIL_GHOSTS_KEY),
        showGhost: recoilGhostEnabled,
        ghostChange: (show) => {
          recoilGhostEnabled = show;
        },
        challenge: recoilMenuChallenge,
        share: recoilMenuShare,
        invalid: invalidRecoilLink && recoilMenuParent === 'title',
      },
    );
  } else if (kind === 'shaft-trials') {
    buildMenu = maintenanceTrialsMenu(content, {
      profile: loadShaftProfile(read(SHAFT_PROFILE_KEY)),
      challenge: trialMenuChallenge,
      share: trialMenuShare,
      invalid: invalidTrialLink && trialMenuParent === 'title',
      start: (route, challenge) => startTrial(route, false, challenge),
      startRun: startFreshCampaign,
      exit: () => (trialMenuParent === 'title' ? closeDialog() : showDialog(trialMenuParent)),
    });
  } else if (kind === 'practice-setup' && practiceTarget) {
    const encounter = practiceTarget;
    const boss = PRACTICE_BOSSES[encounter.kind];
    content.innerHTML =
      '<p class="eyebrow">PRACTICE</p><h2 id="dialog-title">' +
      boss.name +
      (encounter.remix ? ' · ' + BOSS_REMIXES[encounter.remix].name : '') +
      '</h2><p class="practice-note">Full health · Up to ' +
      boss.stage +
      ' upgrades</p>' +
      (encounter.remix
        ? '<p class="practice-note">' + BOSS_REMIXES[encounter.remix].hint + '</p>'
        : '') +
      presetBest(encounter) +
      '<div class="practice-list">' +
      '<button id="practice-preset" class="practice-fight"><span>Preset</span><span aria-hidden="true">↗</span></button>' +
      '<button id="practice-workshop" class="practice-fight"><span>Workshop build</span><span aria-hidden="true">↗</span></button>' +
      '</div><div class="actions"><button id="practice-records" class="quiet">Records</button><button id="practice-back" class="quiet">Back</button></div>';
    $('practice-records').onclick = () => openPracticeRecords(encounter.kind);
    $('practice-preset').onclick = () => startPractice(encounter);
    $('practice-workshop').onclick = () => openPracticeBuild(encounter);
    $('practice-back').onclick = () => {
      showDialog(encounter.remix ? 'boss-remixes' : 'practice');
      content.querySelector<HTMLButtonElement>('[data-boss="' + encounter.kind + '"]')?.focus();
    };
  } else if (['practice-records', 'practice-import', 'practice-share'].includes(kind)) {
    practiceRecords = loadPracticeRecords(read(PRACTICE_RECORDS_KEY));
    buildMenu = practiceRecordsMenu(content, {
      records: practiceRecords,
      known: discovered,
      victories: practiceEncounters(),
      boss: kind === 'practice-records' ? practiceRecordsBoss : undefined,
      remix: kind === 'practice-records' ? practiceRecordsRemix : undefined,
      share: kind === 'practice-share' ? sharedPracticeChallenge : undefined,
      start: startPracticeChallenge,
      exit: () =>
        showDialog(
          kind === 'practice-import'
            ? 'practice'
            : kind === 'practice-share'
              ? 'result'
              : practiceRecordsParent,
        ),
    });
  } else if (kind === 'practice-build' && practiceTarget) {
    const encounter = practiceTarget;
    discovered = loadDiscoveries([...discovered, ...loadDiscoveries(read(DISCOVERIES_KEY))]);
    buildMenu = workshopMenu(
      content,
      discovered,
      practiceDrafts[encounter.kind] ?? workshopMods,
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
        blueprints: blueprintStore,
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
            '</span><span class="reforge-arrow" aria-hidden="true">↓</span><strong>' +
            to.name +
            '</strong><span class="mod-copy">' +
            modDescription(
              to,
              game.mods.filter((id) => id !== swap.from),
              game.startingGun,
              game.seed,
            ) +
            '</span>' +
            (modPathLabel(to.id)
              ? '<span class="mod-path">' + modPathLabel(to.id) + '</span>'
              : '') +
            '</button>'
          );
        })
        .join('') +
      '</div>' +
      upgradePreviewMarkup() +
      '<div class="dialog-actions"><button id="back" class="quiet">Walk away</button></div>';
    upgradePreview = new UpgradePreviewView(
      content.querySelector('.upgrade-preview')!,
      new Map(
        Array.from(content.querySelectorAll<HTMLButtonElement>('[data-swap]')).map((button) => {
          const swap = game.reforge.offers[Number(button.dataset.swap)],
            mod = MODS.find((m) => m.id === swap.to)!;
          return [
            button,
            inspectUpgrade(game.mods, mod, game.startingGun, game.hp, swap.from, game.seed),
          ];
        }),
      ),
    );
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
  } else if (kind === 'uprising') {
    uprisingRouteMenu(content, game);
  } else if (kind === 'uprising-map') {
    content.innerHTML =
      '<h2 id="dialog-title">Factory routes.</h2>' +
      uprisingMap(game) +
      '<div class="actions"><button id="back" class="primary">Back</button></div>';
    $('back').onclick = () => showDialog('pause');
  } else if (kind === 'upgrade' && game.hunts.rewarding) {
    const hunt = game.hunts.state!.kind,
      info = HUNTS[hunt],
      ledger = loadRunRewards(read(RUN_REWARDS_KEY)),
      earned =
        runCommendations.includes(info.commendation) ||
        (ledger?.seed === game.seed &&
          commendationRewards(info.commendation).some((id) => ledger.ids.includes(id)));
    content.innerHTML =
      '<p class="eyebrow">OPTIONAL HUNT · COMPLETE</p><h2 id="dialog-title">' +
      info.name +
      ' stopped.</h2><p>Choose one, then return to the cleared patrol.</p>' +
      (earned ? rewardCards(commendationRewards(info.commendation)) : '') +
      '<div class="choices"><button class="mod" data-hunt-reward="repair"><strong>Field repair</strong><span class="mod-copy">Restore up to 30 health. Current health: ' +
      Math.ceil(game.hp) +
      '.</span></button><button class="mod" data-hunt-reward="reroll"><strong>Upgrade reroll</strong><span class="mod-copy">Keep one free reroll for your next upgrade choice.</span></button></div><p class="practice-record-note">' +
      info.name +
      ' is now available in Practice.</p>';
    drawRewardImages(content, game);
    const rewardsButton = document.getElementById('earned-rewards');
    if (rewardsButton)
      rewardsButton.onclick = () => {
        logbookView.section = 'commendations';
        logbookView.selected = 'commendation:' + info.commendation;
        showDialog('logbook');
      };
    content.querySelectorAll<HTMLButtonElement>('[data-hunt-reward]').forEach((button) => {
      button.onclick = () => {
        sound.unlock();
        const reward = button.dataset.huntReward as 'repair' | 'reroll';
        closeDialog();
        game.hunts.choose(reward);
        renderer.reset();
        canvas.focus();
      };
    });
  } else if (kind === 'upgrade') {
    content.innerHTML =
      '<p class="eyebrow">' +
      (activeDaily ? 'DAILY · ' : '') +
      (game.overtime ? 'OVERTIME · ' : '') +
      (game.welderReward
        ? 'WELDER SALVAGE · BONUS UPGRADE'
        : game.auditorReward
          ? 'COMPANY PROPERTY · NO HEALING'
          : game.courierReward
            ? 'RECOVERED CARGO · NO HEALING'
            : game.detour
              ? 'BONUS UPGRADE · NO HEALING'
              : game.enteringDetour
                ? game.recoil.scheduled
                  ? 'ROOM CLEAR · RECOIL TRIAL NEXT'
                  : game.maintenance.scheduled
                    ? 'ROOM CLEAR · MAINTENANCE NEXT'
                    : 'ROOM CLEAR · CHALLENGE NEXT'
                : 'ROOM CLEAR') +
      '</p><h2 id="dialog-title">' +
      (game.recoil.active && game.recoil.result
        ? 'Trial complete.'
        : game.welderReward
          ? 'Make it yours.'
          : game.auditorReward
            ? 'Break the seal.'
            : game.offers[0]?.id === 'repair'
              ? 'Keep going.'
              : singleUpgrade
                ? 'Next upgrade.'
                : 'Make it kick.') +
      '</h2>' +
      (game.recoil.active && game.recoil.result
        ? '<p class="practice-record-note">' +
          RECOIL_TRIALS[game.recoil.kind].name +
          ' · ' +
          practiceTime(game.recoil.result.timeMs) +
          (recoilOutcome?.best ? ' · Personal best for this build.' : '') +
          (recoilOutcome?.newMastery
            ? ' ' +
              COMMENDATIONS.find((c) => c.id === RECOIL_TRIALS[game.recoil.kind].commendation)!
                .reward +
              ' unlocked.'
            : '') +
          ' Extra upgrade · No health refill.</p>'
        : '') +
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
            modDescription(m, game.mods, game.startingGun, game.seed) +
            '</span>' +
            (modPathLabel(m.id) ? '<span class="mod-path">' + modPathLabel(m.id) + '</span>' : '') +
            '</button>',
        )
        .join('') +
      '</div>' +
      upgradePreviewMarkup() +
      (!activeDaily &&
      !game.practice &&
      !game.courierReward &&
      !game.auditorReward &&
      !game.welderReward &&
      game.offers[0]?.id !== 'repair'
        ? '<div class="reward-actions"><button id="reroll" class="quiet"' +
          (game.canReroll ? '' : ' disabled') +
          ' title="' +
          (game.rewardRerolled
            ? 'Once per reward'
            : !game.hunts.freeReroll && !game.areaEvents.freeReroll && game.hp <= REROLL_COST
              ? 'Requires more than ' + REROLL_COST + ' health'
              : !game.canReroll
                ? 'No full set of new upgrades available'
                : 'Replace every card. Once per reward.') +
          '">' +
          (game.rewardRerolled
            ? 'Reroll used'
            : game.hunts.freeReroll || game.areaEvents.freeReroll
              ? 'Reroll · free'
              : 'Reroll · −' + REROLL_COST + ' health') +
          '</button><span id="reward-status" class="sr-only" role="status"></span></div>'
        : '');
    upgradePreview = new UpgradePreviewView(
      content.querySelector('.upgrade-preview')!,
      new Map(
        Array.from(content.querySelectorAll<HTMLButtonElement>('[data-mod]')).map((button) => [
          button,
          inspectUpgrade(
            game.mods,
            game.offers.find((m) => m.id === button.dataset.mod)!,
            game.startingGun,
            game.hp,
            undefined,
            game.seed,
          ),
        ]),
      ),
    );
    const reroll = document.getElementById('reroll');
    if (reroll)
      reroll.onclick = () => {
        sound.unlock();
        const free = game.hunts.freeReroll || game.areaEvents.freeReroll;
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
  } else if (kind === 'result' && game.recoil.practice) {
    const won = game.mode === 'won',
      result = game.recoil.result,
      id = RECOIL_TRIALS[game.recoil.kind].commendation;
    content.innerHTML =
      '<p class="eyebrow">RECOIL TRIAL · ' +
      RECOIL_TRIALS[game.recoil.kind].name +
      '</p><h2 id="dialog-title">' +
      (won ? 'Course complete.' : 'Try again.') +
      '</h2><p class="result-line">' +
      practiceTime(result?.timeMs ?? game.recoil.timeMs) +
      ' <span>·</span> ' +
      game.recoil.shots +
      ' shots</p><p class="practice-record-note">' +
      (won
        ? (recoilOutcome?.best ? 'Personal best. ' : '') +
          (recoilOutcome
            ? 'Record saved. '
            : 'Record could not be saved. Check Progress in Settings. ')
        : '') +
      'Clean clear ≤ ' +
      RECOIL_TRIALS[game.recoil.kind].mastery / 1000 +
      's earns a cosmetic.</p>' +
      (won && result && game.recoil.race.target
        ? '<p class="practice-record-note">' +
          recoilDelta(result.timeMs - game.recoil.race.target.timeMs) +
          (game.recoil.race.challenge ? ' · Shared target.' : ' · Your previous ghost.') +
          '</p>'
        : '') +
      (recoilGhostSaved ? '<p class="practice-record-note">New ghost saved.</p>' : '') +
      (recoilOutcome?.newMastery ? rewardCards(commendationRewards(id)) : '') +
      '<div class="actions"><button id="retry" class="primary">Retry course ↗</button><button id="recoil-records" class="quiet">Trials & records</button>' +
      (won && game.recoil.race.score
        ? '<button id="recoil-share" class="quiet">Share this clear</button>'
        : '') +
      '<button id="menu" class="quiet">Menu</button></div>';
    drawRewardImages(content, game);
    const reward = document.getElementById('earned-rewards');
    if (reward)
      reward.onclick = () => {
        logbookView.section = 'commendations';
        logbookView.selected = 'commendation:' + id;
        showDialog('logbook');
      };
    $('retry').onclick = () => start(undefined, true);
    $('recoil-records').onclick = () => openRecoilTrials('result');
    const share = document.getElementById('recoil-share');
    if (share)
      share.onclick = () =>
        openRecoilTrials('result', undefined, game.recoil.race.score ?? undefined);
    $('menu').onclick = menu;
  } else if (kind === 'result' && game.maintenance.trial) {
    const session = game.maintenance.trial,
      won = game.mode === 'won';
    const timeMs = Math.max(1, Math.round(game.elapsed * 100) * 10);
    const note = [
      trialOutcome?.first
        ? 'First record.'
        : [
            trialOutcome?.faster ? 'New fastest climb.' : '',
            trialOutcome?.efficient ? 'New fewest shots.' : '',
          ]
            .filter(Boolean)
            .join(' '),
      runCommendations.includes('maintenance-certified')
        ? 'Servicewear unlocked. Equip it in Appearance.'
        : '',
      won && !session.preview && !trialOutcome
        ? 'Record could not be saved. Check Progress in Settings.'
        : '',
    ]
      .filter(Boolean)
      .join(' ');
    content.innerHTML =
      trialResultHtml({
        won,
        preview: session.preview,
        timeMs,
        shots: game.shotCount,
        hits: session.hits,
        note,
        challenge: activeTrialChallenge,
      }) +
      '<div class="actions"><button id="retry" class="primary">Retry ↗</button>' +
      (trialOutcome ? '<button id="shaft-share" class="quiet">Challenge a friend</button>' : '') +
      (!session.preview
        ? '<button id="shaft-choose" class="quiet">Trials & records</button>'
        : '') +
      '<button id="menu" class="quiet">Menu</button></div>';
    $('retry').onclick = () => start(undefined, true);
    if (trialOutcome)
      $('shaft-share').onclick = () =>
        openTrials(
          'result',
          undefined,
          trialChallenge(session.route, { timeMs, shots: game.shotCount }),
        );
    if (!session.preview && runCommendations.includes('maintenance-certified')) {
      content
        .querySelector('.actions')!
        .insertAdjacentHTML(
          'beforebegin',
          rewardCards(commendationRewards('maintenance-certified')),
        );
      drawRewardImages(content, game);
      $('earned-rewards').onclick = () => {
        logbookView.section = 'commendations';
        logbookView.selected = 'commendation:maintenance-certified';
        showDialog('logbook');
      };
    }
    if (!session.preview) $('shaft-choose').onclick = () => openTrials('result');
    $('menu').onclick = menu;
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
    const recordNote = practiceOutcome
      ? practiceOutcome.first
        ? 'First record for this arena and gun.'
        : [
            practiceOutcome.newFastest ? 'New fastest victory.' : '',
            practiceOutcome.newCleanest ? 'New cleanest victory.' : '',
          ]
            .filter(Boolean)
            .join(' ')
      : '';
    const targetNote = activePracticeChallenge
      ? win
        ? Math.round(game.elapsed * 100) * 10 < activePracticeChallenge.timeMs
          ? 'Target beaten by ' +
            practiceTime(activePracticeChallenge.timeMs - Math.round(game.elapsed * 100) * 10) +
            '.'
          : Math.round(game.elapsed * 100) * 10 === activePracticeChallenge.timeMs
            ? 'Target matched.'
            : practiceTime(Math.round(game.elapsed * 100) * 10 - activePracticeChallenge.timeMs) +
              ' behind the target.'
        : 'Target ' +
          practiceTime(activePracticeChallenge.timeMs) +
          ' · ' +
          activePracticeChallenge.hits +
          ' hits'
      : '';
    content.innerHTML =
      '<p class="eyebrow">PRACTICE · ' +
      PRACTICE_BOSSES[game.practice.kind].name +
      '</p><h2 id="dialog-title">' +
      (win ? 'Fight cleared.' : 'Try again.') +
      '</h2><p class="result-line">' +
      practiceTime(Math.round(game.elapsed * 100) * 10) +
      ' <span>·</span> ' +
      game.practiceHits +
      ' hits' +
      '</p>' +
      (recordNote || targetNote
        ? '<p class="practice-record-note">' +
          [recordNote, targetNote].filter(Boolean).join(' ') +
          '</p>'
        : '') +
      '<div class="actions"><button id="retry" class="primary" title="Retry · R">Retry ↗</button>' +
      (practiceWin ? '<button id="practice-share" class="quiet">Challenge a friend</button>' : '') +
      (!activePracticeChallenge && canPractice(game.practice, practiceEncounters())
        ? '<button id="practice-edit" class="quiet">Edit build</button>'
        : '') +
      '<button id="choose-fight" class="quiet"' +
      (encounters.length ? '' : ' hidden') +
      '>Choose fight</button>' +
      (encounters.some((e) => e.kind === game.practice!.kind)
        ? '<button id="practice-records" class="quiet">Records</button>'
        : '') +
      '<button id="menu" class="quiet">Menu</button></div>';
    $('retry').onclick = () => start(undefined, true);
    $('choose-fight').onclick = () => showDialog('practice');
    const edit = document.getElementById('practice-edit');
    if (edit) edit.onclick = () => openPracticeBuild(game.practice!, 'result');
    const records = document.getElementById('practice-records');
    if (records) records.onclick = () => openPracticeRecords(game.practice!.kind);
    const share = document.getElementById('practice-share');
    if (share)
      share.onclick = () => {
        const { rules, kind, seed, mods, timeMs, hits, remix } = practiceWin!;
        sharedPracticeChallenge = {
          rules,
          kind,
          seed,
          mods: [...mods],
          timeMs,
          hits,
          ...(remix ? { remix } : {}),
        };
        showDialog('practice-share');
      };
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
      (game.security ? securityLabel(game.security.level).split(' · ')[0] + ' · ' : '') +
      (activeDaily
        ? 'DAILY · ' + activeDaily.date
        : win
          ? 'ALL ' +
            (game.overtime ? STAGES * 2 : STAGES) +
            ' ROOMS' +
            (game.detours.length ? ' · ' + game.detours.length + ' CHALLENGES' : '')
          : game.detour
            ? game.maintenance.active
              ? 'MAINTENANCE'
              : 'CHALLENGE'
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
      (game.testRun?.seed.startsWith('PRESENTATION-') || game.testRun?.seed.startsWith('CLOCK-OUT-')
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
    const ledger = loadRunRewards(read(RUN_REWARDS_KEY));
    const rewards =
      game.testRun?.seed === 'PRESENTATION-OVERTIME'
        ? ['gun:nailgun', 'appearance:outfit:night']
        : game.testRun?.seed === 'PRESENTATION-ESCAPE'
          ? ['gun:shotgun', 'appearance:gun:inspector']
          : game.testRun?.seed === 'PRESENTATION-MASTERY'
            ? ['appearance:gun:heatline', 'appearance:gun:reservoir', 'appearance:outfit:patchwork']
            : !game.testRun && ledger?.seed === game.seed
              ? ledger.ids
              : [];
    content.querySelector('.actions')!.insertAdjacentHTML('beforebegin', rewardCards(rewards));
    drawRewardImages(content, game);
    const earnedRewards = document.getElementById('earned-rewards');
    if (earnedRewards)
      earnedRewards.onclick = () => {
        const first = rewards[0];
        logbookView.section = first.startsWith('appearance:')
          ? 'commendations'
          : first.startsWith('uprising:')
            ? 'records'
            : 'equipment';
        logbookView.query = '';
        logbookView.filter = 'all';
        logbookView.family = 'all';
        logbookView.selected = first.startsWith('appearance:')
          ? 'commendation:' +
            COMMENDATIONS.find((c) => commendationRewards(c.id).includes(first))?.id
          : first;
        showDialog('logbook');
      };
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
      drawCombatReportImages(content, [finishedRun]);
      bindRecapActions(
        content,
        [finishedRun],
        discovered,
        replayFinishedRun,
        workshopFromRun,
        saveRunBlueprint,
      );
      $('recap-history').onclick = () => showDialog('history');
    } else if (game.testRun) {
      const report: ReportGun = {
        mods: [...game.mods],
        seed: game.seed,
        startingGun: game.startingGun,
        appearance: { ...game.cosmetics },
        combatResults: game.combatReport.snapshot(),
        kills: game.kills,
        elapsed: game.elapsed,
      };
      content.insertAdjacentHTML(
        'beforeend',
        '<p class="recap-note">Preset test results · Progress stays untouched.</p>' +
          combatReportMenu(report),
      );
      drawCombatReportImages(content, [report]);
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
        : game.gauntlet.state
          ? 'Health carries between all five fights. Restart Gauntlet starts the whole run over. Menu abandons this attempt.'
          : game.maintenance.trial
            ? 'Reach the summit. Starting gun. Retry repeats this layout.'
            : game.recoil.active
              ? RECOIL_TRIALS[game.recoil.kind].instruction +
                ' ' +
                (game.recoil.practice
                  ? 'Retry repeats this course.'
                  : 'Leave trial skips the bonus and rejoins the campaign.')
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
                      ? game.maintenance.active
                        ? 'Reach the top for an extra upgrade, without a health refill.'
                        : 'Survive for an extra upgrade, without a health refill.'
                      : game.overtime
                        ? 'Second lap. Clear all twenty rooms, then extract.'
                        : game.canDetour
                          ? 'After clearing, the upper door offers an optional challenge.'
                          : 'Clear the room, then leave through the right door.') +
      '</p></div>' +
      (paused
        ? '<details class="build"><summary>Your gun · ' +
          STARTING_GUNS[game.startingGun].name +
          (activeDaily && !unlockedStartingGuns(weaponUnlocks()).includes(game.startingGun)
            ? ' · Daily loaner'
            : '') +
          (buildPath(game.mods) ? ' · ' + PATH_NAMES[buildPath(game.mods)!] : '') +
          '</summary><ul>' +
          game.mods.map((id) => '<li>' + MODS.find((m) => m.id === id)!.name + '</li>').join('') +
          '</ul></details>'
        : '') +
      (paused && game.level.bossRemix
        ? '<p class="practice-note">Arena · ' +
          BOSS_REMIXES[game.level.bossRemix].name +
          '<br>' +
          BOSS_REMIXES[game.level.bossRemix].hint +
          '</p>'
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
        : paused && game.gauntlet.state
          ? '<button id="retry" class="quiet">Restart Gauntlet</button>'
          : paused && game.practice
            ? '<button id="retry" class="quiet">Retry</button>' +
              (!activePracticeChallenge && canPractice(game.practice, practiceEncounters())
                ? '<button id="practice-edit" class="quiet">Edit build</button>'
                : '') +
              '<button id="choose-fight" class="quiet"' +
              (encounters.length ? '' : ' hidden') +
              '>Choose fight</button>'
            : paused && game.recoil.practice
              ? '<button id="retry" class="quiet">Retry course</button>'
              : paused && game.maintenance.trial
                ? '<button id="retry" class="quiet">Retry trial</button>'
                : paused && game.testRun
                  ? '<button id="retry" class="quiet">Restart test</button>'
                  : '') +
      (paused
        ? '<button id="pause-logbook" class="quiet">Logbook</button>' +
          (game.uprising.run && !game.overtime
            ? '<button id="factory-map" class="quiet">Factory routes</button>'
            : '') +
          (game.uprising.waiting
            ? '<button id="skip-job" class="quiet">Skip current job</button>'
            : '') +
          (game.recoil.active && !game.recoil.practice && !game.clear
            ? '<button id="leave-trial" class="quiet">Leave trial</button>'
            : '') +
          '<button id="menu" class="quiet">Menu</button>'
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
      $('workshop-pause-reset').onclick = () =>
        startWorkshop(game.mods, firstSession.warmup, game.startingGun);
    }
    if (paused && (game.practice || game.testRun)) {
      $('retry').onclick = () => start(undefined, true);
      if (game.practice && !game.gauntlet.state)
        $('choose-fight').onclick = () => showDialog('practice');
      const edit = document.getElementById('practice-edit');
      if (edit) edit.onclick = () => openPracticeBuild(game.practice!, 'pause');
    }
    if (paused) {
      $('menu').onclick = menu;
      $('pause-logbook').onclick = () => showDialog('logbook');
      const map = document.getElementById('factory-map');
      if (map) map.onclick = () => showDialog('uprising-map');
      const skip = document.getElementById('skip-job');
      const leave = document.getElementById('leave-trial');
      if (leave)
        leave.onclick = () => {
          closeDialog();
          game.recoil.abandon();
          renderer.reset();
          canvas.focus();
        };
      if (skip)
        skip.onclick = () => {
          game.uprising.abandon();
          showDialog('pause');
        };
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
  if (
    [
      'upgrade',
      'reforge',
      'practice',
      'practice-setup',
      'result',
      'gauntlet-setup',
      'gauntlet-run',
    ].includes(kind)
  )
    content.querySelector<HTMLButtonElement>('button')?.focus();
  if (kind === 'practice-build') $('workshop-apply').focus({ preventScroll: true });
  if (kind === 'uprising' || kind === 'uprising-map') {
    content.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true });
    modal.scrollTop = 0;
  }
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
  const jumpName = pad
    ? 'LB / L1 or A / ✕'
    : controlDevice() === 'touch'
      ? '↑'
      : bindingLabel(bindings, 'jump');
  const flightHints =
    (game.mods.includes('double-jump')
      ? '<p>Double Jump: press ' +
        jumpName +
        ' again in the air. Landing restores the extra jump.</p>'
      : '') +
    (game.mods.includes('wing-harness')
      ? '<p>Wing Harness: hold ' +
        jumpName +
        ' while descending. Landing restores 1.2 seconds of glide.</p>'
      : '');
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
      (game.mods.includes('charge-lens') ? '<p>Hold fire to charge. Release to shoot.</p>' : '') +
      flightHints;
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
        : '<p>Shoot down in the air to climb.</p>') +
      flightHints;
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
    if (supportDrill?.isPlaying) supportDrill.toggle();
    if (game.mode === 'playing') showDialog('pause');
    $('save-status').textContent = 'Controller disconnected. Game paused.';
    return null;
  }
  if (sample.activity) useInputDevice('controller');
  if (inputDevice !== 'controller') return null;
  if (supportDrill) {
    if (sample.back) backFromDrill();
    else if (sample.pause) supportDrill.toggle();
    else if (supportDrill.isPlaying) return sample;
    else {
      if (sample.navigation) navigateControllerMenu(modal, sample.navigation);
      if (sample.confirm) confirmControllerMenu(modal);
    }
    return null;
  }
  if (game.clockOut.active) {
    if (sample.confirm || sample.back || sample.pause) game.skipClockOut();
    return null;
  }
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
  linkedDrill
    ? startLinkedSupportDrill(linkedDrill)
    : linkedGauntletPreview
      ? startGauntlet(linkedGauntletPreview, true)
      : linkedRecoilChallenge || invalidRecoilLink
        ? openRecoilTrials('title', linkedRecoilChallenge ?? undefined)
        : linkedTrial?.preview
          ? startTrial(linkedTrial.route, true)
          : linkedTrial || invalidTrialLink
            ? openTrials('title', linkedTrial?.challenge)
            : linkedWorkshop
              ? showDialog('workshop')
              : linkedRunTest?.seed.startsWith('ROOM47-') &&
                  entryUrl.searchParams.get('test') !== 'arc'
                ? showDialog('layout-test')
                : linkedRunTest?.seed.startsWith('UPGRADES-') ||
                    linkedRunTest?.seed.startsWith('FUSIONS-')
                  ? showDialog('upgrade-test')
                  : linkedRunTest
                    ? startRunTest(linkedRunTest)
                    : linkedTest
                      ? startPractice(linkedTest, null, { test: true })
                      : linkedDaily
                        ? start()
                        : startFreshCampaign();
$('daily').onclick = () => {
  if (
    linkedDaily ||
    linkedTrial ||
    invalidTrialLink ||
    linkedRecoilChallenge ||
    invalidRecoilLink
  ) {
    linkedDaily = null;
    linkedTrial = null;
    invalidTrialLink = false;
    linkedRecoilChallenge = null;
    invalidRecoilLink = false;
    seedParam = undefined;
    const url = new URL(location.href);
    url.search = '';
    url.hash = '';
    history.replaceState(null, '', url);
    updateTitle();
    startFreshCampaign();
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
$('security').onclick = () => showDialog('security');
$('logbook').onclick = () => showDialog('logbook');
$('practice').onclick = () => {
  if (
    encounters.length ||
    loadShaftProfile(read(SHAFT_PROFILE_KEY)).unlocks.length ||
    loadRecoilProfile(read(RECOIL_TRIALS_KEY)).clears.length
  )
    showDialog('practice');
};
$('workshop').onclick = () => showDialog('workshop');
$('workshop-edit').onclick = () => showDialog('workshop');
$('workshop-reset').onclick = () => startWorkshop(game.mods, false, game.startingGun);
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
  if (dialogKind === 'support-drill') {
    backFromDrill();
    return;
  }
  if (dialogKind === 'uprising-map') {
    showDialog('pause');
    return;
  }
  if (buildMenu?.back()) return;
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
  if (dialogKind === 'security') {
    closeDialog();
    $('security').focus();
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
  if (supportDrill) {
    useInputDevice('pointer');
    supportDrill.keyDown(e);
    return;
  }
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
  if (game.clockOut.active) {
    if (['Escape', 'Enter', 'Space'].includes(e.code)) {
      e.preventDefault();
      game.skipClockOut();
    }
    return;
  }
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
    if (game.hunts.rewarding) {
      if (i === 0 || i === 1) {
        sound.unlock();
        closeDialog();
        game.hunts.choose(i === 0 ? 'repair' : 'reroll');
        renderer.reset();
        canvas.focus();
      }
      return;
    }
    if (game.uprising.choices.length) {
      const route = game.uprising.choices[i];
      if (route) {
        sound.unlock();
        game.uprising.choose(route.id);
      }
      return;
    }
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
window.addEventListener('keyup', (e) => {
  keys.delete(e.code);
  supportDrill?.keyUp(e);
});
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
  supportDrill?.frame(
    dt,
    now,
    renderer.reduced,
    modal.open && pageActive && document.hasFocus() && !document.hidden,
    pad,
  );
  upgradePreview?.frame(
    dt,
    now,
    renderer.reduced || previewMotion.matches,
    modal.open && pageActive && document.hasFocus() && !document.hidden,
  );
  game.updateClockOut(dt, pageActive && document.hasFocus() && !document.hidden);
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
    const notice = $('commendation-notice');
    if (
      commendationNotice &&
      ((commendationNotice.until !== null && game.time >= commendationNotice.until) ||
        game.stage !== commendationNotice.stage ||
        game.mode === 'title' ||
        game.mode === 'dead')
    )
      commendationNotice = null;
    if (
      fittingNotice &&
      ((fittingNotice.until !== null && game.time >= fittingNotice.until) ||
        fittingNotice.stage !== game.stage ||
        game.mode === 'title' ||
        game.mode === 'dead')
    )
      fittingNotice = null;
    notice.hidden =
      (!commendationNotice && !fittingNotice) ||
      game.mode !== 'playing' ||
      game.enemies.some((e) => e.hp > 0 && !e.allied);
    if (!notice.hidden && (commendationNotice || fittingNotice)) {
      if (fittingNotice) fittingNotice.until ??= game.time + 5;
      if (commendationNotice) commendationNotice.until ??= game.time + 5;
      const copy = fittingNotice
        ? 'Fitting unlocked · ' + fittingNotice.name + ' · next Campaign'
        : 'Commendation earned · ' +
          COMMENDATIONS.find((c) => c.id === commendationNotice!.id)!.name;
      if (notice.textContent !== copy) notice.textContent = copy;
    }
    $('portal-touch').hidden = !game.portals.canPlace;
    if (!game.portals.canPlace && portalTouch) {
      portalTouch = false;
      $('portal-touch').setAttribute('aria-pressed', 'false');
    }
    $<HTMLProgressElement>('health').value = game.hp;
    const objective = game.uprising.status;
    $('uprising-status').hidden = game.mode !== 'playing' || !objective;
    if ($('uprising-status').textContent !== objective)
      $('uprising-status').textContent = objective;
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
