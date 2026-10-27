import { getGun, MODS } from './rules.ts';
import { torchRayCount, legacyTorchPattern } from './torch-pattern.ts';
import { STARTING_GUNS, type StartingGun } from './starting-guns.ts';
import { GUN_FINISHES, OUTFITS, type Cosmetics } from './cosmetics.ts';
import type { CombatResults } from './combat-report.ts';
import { SUPPORT_MASTERIES } from './support-mastery.ts';
import { buildMotionConnections } from './build-motion.ts';
import type { BuildActivationId } from './combat-report.ts';

export interface ReportGun {
  mods: readonly string[];
  seed: string;
  startingGun?: StartingGun;
  appearance?: Cosmetics;
  combatResults?: CombatResults;
  kills: number;
  elapsed: number;
}
export interface BuildConnection {
  title: string;
  detail: string;
}
const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!,
  );
const amount = (n: number) => (Math.round(n * 10) / 10).toLocaleString('en-US');
const modName = (id: string) => MODS.find((m) => m.id === id)?.name ?? id;

// Explain the final owned build, not hypothetical upgrades or a guessed DPS ranking.
export function buildConnections(
  run: Pick<ReportGun, 'mods' | 'seed' | 'startingGun'>,
): BuildConnection[] {
  const mods = run.mods,
    has = (id: string) => mods.includes(id);
  const gun = getGun([...mods], run.startingGun ?? 'pistol');
  const connections: BuildConnection[] = buildMotionConnections(mods).slice(0, 2);
  const pair = (ids: string[], detail: string, title?: string) => {
    if (ids.every(has)) connections.push({ title: title ?? ids.map(modName).join(' + '), detail });
  };
  if (has('cutting-torch')) {
    const beams = torchRayCount(gun, mods, run.seed);
    connections.push({
      title: `${beams} ${has('charge-lens') ? 'charged ' : ''}beam${beams === 1 ? '' : 's'}`,
      detail:
        (legacyTorchPattern(run.seed) && gun.pellets > 1
          ? 'Your pellet spread becomes beam width under this run’s preserved rules.'
          : has('prism-array')
            ? has('scatter')
              ? 'Scattershot keeps its separate beams; Prism splits each one.'
              : 'Prism splits each beam while keeping your firing pattern.'
            : gun.pellets > 1
              ? 'Your pellets remain separate beams after the conversion.'
              : 'Your gun’s fittings work through the beam.') +
        (gun.rearVolley ? ` Backfire adds ${beams} rear beam${beams === 1 ? '' : 's'}.` : '') +
        (has('collimator') ? ' Steady aim tightens the whole pattern.' : ''),
    });
  } else if (has('mass-driver')) {
    connections.push({
      title: `${gun.pellets * gun.lanes} steel ball${gun.pellets * gun.lanes === 1 ? '' : 's'}`,
      detail:
        'Your pellet and lane fittings carry into the ball volley.' +
        (gun.rearVolley ? ' Backfire keeps a separate rear volley.' : '') +
        (has('collimator') ? ' Steady aim tightens every lane.' : ''),
    });
  } else if (!has('rail-spike') && gun.pellets * gun.lanes > 1) {
    connections.push({
      title: `${gun.pellets * gun.lanes} projectiles per volley`,
      detail:
        'Your starting tool, pellet and lane fittings set the full pattern.' +
        (has('collimator') ? ' Collimator tightens the spread without removing projectiles.' : ''),
    });
  }
  pair(
    ['thermal-runaway', 'heat-relay'],
    `A tracked beam kill carries ${has('heat-exchanger') ? '75%' : 'half'} of its heat to your next exposed target within ${has('insulated-line') ? '1.8 seconds' : 'one second'}.`,
  );
  if (has('overkill-bank'))
    connections.push({
      title: 'Overkill Bank + your discharge',
      detail:
        'Excess direct-kill damage powers one later discharge. Its projectiles and rear fire share the reserve.' +
        (has('bank-capacitor') ? ' The reserve can boost it by up to 75%.' : '') +
        (has('bank-memory') ? ' Bank Memory keeps 25% after spending it.' : ''),
    });
  pair(['ricochet', 'banker'], 'Wall banks earn your Banker damage bonus.');
  pair(['capacitor', 'scatter'], 'One stored charge boosts the entire pellet pattern.');
  pair(['rail-spike', 'capacitor'], 'Your charged rail inherits the stored Capacitor bonus.');
  pair(['recall', 'homecoming'], 'Returning rounds keep their return-flight penetration.');
  pair(['shellshock', 'fuse'], 'Your shells can attach before their delayed explosion.');
  if (!connections.length) {
    const first = MODS.find((m) => mods.includes(m.id));
    connections.push(
      first
        ? { title: first.name, detail: first.description }
        : {
            title: STARTING_GUNS[run.startingGun ?? 'pistol'].name,
            detail: STARTING_GUNS[run.startingGun ?? 'pistol'].description,
          },
    );
  }
  return connections.slice(0, 3);
}

export const BUILD_ACTIVATION_UNITS: Readonly<Record<BuildActivationId, string>> = {
  'polarity-rounds': 'charged volleys',
  'ricochet-harness': 'recoil rebounds',
  'spring-rivets': 'spring launches',
  'slip-gauge': 'air bursts used',
  'wake-wire': 'ribbons armed',
  'false-silhouette': 'decoys created',
  'gimbal-mount': 'steered discharges',
  'momentum-exchange': 'velocity exchanges',
  'offset-nozzle': 'remote volleys fired',
  'momentum-battery': 'banked jumps released',
  'piston-lance': 'piston discharges',
  'cable-saw': 'saw discharges',
  'seeker-rack': 'painted salvos released',
  foamcaster: 'foam supports fitted',
  'catch-chamber': 'enemy rounds caught',
  'gate-snare': 'portal traps triggered',
  'hot-wire': 'energizing pulses',
  'ghost-shift': 'ally volleys repeated',
  windmill: 'cutting traps formed',
  'scrap-comet': 'debris clusters formed',
};
const singleActivationUnits: Readonly<Record<BuildActivationId, string>> = {
  'polarity-rounds': 'charged volley',
  'ricochet-harness': 'recoil rebound',
  'spring-rivets': 'spring launch',
  'slip-gauge': 'air burst used',
  'wake-wire': 'ribbon armed',
  'false-silhouette': 'decoy created',
  'gimbal-mount': 'steered discharge',
  'momentum-exchange': 'velocity exchange',
  'offset-nozzle': 'remote volley fired',
  'momentum-battery': 'banked jump released',
  'piston-lance': 'piston discharge',
  'cable-saw': 'saw discharge',
  'seeker-rack': 'painted salvo released',
  foamcaster: 'foam support fitted',
  'catch-chamber': 'enemy round caught',
  'gate-snare': 'portal trap triggered',
  'hot-wire': 'energizing pulse',
  'ghost-shift': 'ally volley repeated',
  windmill: 'cutting trap formed',
  'scrap-comet': 'debris cluster formed',
};
const activationUnit = (id: BuildActivationId, value: number) =>
  value === 1 ? singleActivationUnits[id] : BUILD_ACTIVATION_UNITS[id];
export interface BuildHighlight {
  id: string;
  label: string;
  value: number;
  unit: string;
}
/** At most three distinct, measured effects; never a guessed damage attribution. */
export function measuredBuildHighlights(run: Pick<ReportGun, 'combatResults'>): BuildHighlight[] {
  const r = run.combatResults;
  if (!r) return [];
  const activity = Object.keys(BUILD_ACTIVATION_UNITS) as BuildActivationId[];
  const fields: BuildHighlight[] = activity
    .filter((id) => Number.isSafeInteger(r.activations?.[id]) && r.activations![id]! > 0)
    .map((id) => ({
      id,
      label: modName(id),
      value: r.activations![id]!,
      unit: activationUnit(id, r.activations![id]!),
    }));
  // Authored order surfaces distinct actions instead of ranking unlike counts as damage.
  const priority: BuildActivationId[] = [
    'catch-chamber',
    'gate-snare',
    'hot-wire',
    'ghost-shift',
    'windmill',
    'scrap-comet',
    'offset-nozzle',
    'momentum-battery',
    'ricochet-harness',
    'spring-rivets',
    'slip-gauge',
  ];
  fields.sort((a, b) => {
    const ai = priority.indexOf(a.id as BuildActivationId),
      bi = priority.indexOf(b.id as BuildActivationId);
    return (ai < 0 ? priority.length : ai) - (bi < 0 ? priority.length : bi);
  });
  for (const [id, label, value, unit] of [
    ['heat-relay', 'Heat transfers', r.heatTransfers, 'completed'],
    ['overkill-bank', 'Overkill charges', r.bankCharges, 'used'],
    ['scrap-armor', 'Scrap Armor', r.armorBlocks, 'bullets blocked'],
    ['leech', 'Bloodwork', r.bloodworkHealing, 'health restored'],
  ] as const)
    if (value > 0) fields.push({ id, label, value, unit });
  return fields.slice(0, 3);
}

export function combatReportMenu(run: ReportGun, index = 0) {
  const name = STARTING_GUNS[run.startingGun ?? 'pistol'].name;
  const results = run.combatResults;
  const fields: [string, number, string][] = [];
  if (results) {
    if (results.activations)
      for (const id of Object.keys(BUILD_ACTIVATION_UNITS) as BuildActivationId[])
        if (run.mods.includes(id) || (results.activations[id] ?? 0) > 0)
          fields.push([
            modName(id),
            results.activations[id] ?? 0,
            activationUnit(id, results.activations[id] ?? 0),
          ]);
    if (run.mods.includes('heat-relay') || results.heatTransfers)
      fields.push(['Heat transfers', results.heatTransfers, 'completed']);
    if (run.mods.includes('overkill-bank') || results.bankCharges)
      fields.push(['Overkill charges', results.bankCharges, 'used']);
    if (run.mods.includes('scrap-armor') || results.armorBlocks)
      fields.push([
        'Scrap Armor',
        results.armorBlocks,
        results.armorBlocks === 1 ? 'bullet blocked' : 'bullets blocked',
      ]);
    if (run.mods.includes('leech') || results.bloodworkHealing)
      fields.push(['Bloodwork', results.bloodworkHealing, 'health restored']);
  }
  const measured = measuredBuildHighlights(run);
  const highlights = measured
    .map(({ label, value, unit }) => `${label}: ${amount(value)} ${unit}`)
    .join(' · ');
  return (
    '<section class="combat-report" aria-label="Run combat report"><h3>What carried your run?</h3>' +
    '<figure class="report-gun"><canvas width="640" height="200" role="img" aria-label="' +
    escape(`${name} with this run’s final fittings`) +
    '" data-run-gun="' +
    index +
    '"></canvas>' +
    '<figcaption><strong>' +
    escape(name) +
    '</strong><span>' +
    (run.appearance
      ? escape(GUN_FINISHES[run.appearance.gun].name + ' · ' + OUTFITS[run.appearance.outfit].name)
      : 'Original appearance not recorded · Standard finish shown') +
    '</span></figcaption></figure>' +
    '<ul class="report-connections" aria-label="Final build connections">' +
    buildConnections(run)
      .map(
        (c) =>
          '<li><strong>' + escape(c.title) + '</strong><span>' + escape(c.detail) + '</span></li>',
      )
      .join('') +
    '</ul>' +
    (measured.length
      ? '<ul class="report-highlights" aria-label="Measured build highlights">' +
        measured
          .map(
            ({ label, value, unit }) =>
              '<li><strong>' +
              escape(label) +
              '</strong><span>' +
              amount(value) +
              ' ' +
              escape(unit) +
              '</span></li>',
          )
          .join('') +
        '</ul>'
      : '') +
    '<details class="report-results"><summary>Recorded results' +
    (highlights ? '<span>' + escape(highlights) + '</span>' : '') +
    '</summary>' +
    '<dl><dt>Enemies defeated</dt><dd>' +
    amount(run.kills) +
    '</dd><dt>Run time</dt><dd>' +
    Math.floor(run.elapsed / 60) +
    ':' +
    String(Math.floor(run.elapsed % 60)).padStart(2, '0') +
    '</dd>' +
    fields
      .map(
        ([label, value, unit]) =>
          '<dt>' + escape(label) + '</dt><dd>' + amount(value) + ' ' + unit + '</dd>',
      )
      .join('') +
    '</dl>' +
    (results
      ? '<ul class="report-masteries" aria-label="Mastery targets for this attempt">' +
        SUPPORT_MASTERIES.filter((m) => run.mods.includes(m.upgrades[0]) || results[m.counter] > 0)
          .map(
            (m) =>
              '<li><strong>' +
              escape(m.name) +
              '</strong><span>' +
              Math.min(m.target, results[m.counter]) +
              ' / ' +
              m.target +
              ' ' +
              escape(m.unit) +
              (results[m.counter] >= m.target ? ' · Target met' : '') +
              '</span><small>Reward: ' +
              escape(m.reward + ' · ' + m.slot) +
              '</small></li>',
          )
          .join('') +
        '</ul>'
      : '') +
    (results &&
    !results.activations &&
    run.mods.some((id) => Object.hasOwn(BUILD_ACTIVATION_UNITS, id))
      ? '<p>New fitting activations weren’t recorded for this run.</p>'
      : results?.activationPartial
        ? '<p>New fitting activations were recorded from room ' +
          ((results.activationFromStage ?? results.fromStage) + 1) +
          '. Earlier activity is unavailable.</p>'
        : '') +
    (!results
      ? '<p>Upgrade results weren’t recorded for this run.</p>'
      : results.partial
        ? '<p>Upgrade results were recorded from room ' +
          (results.fromStage + 1) +
          ' after Continue. Earlier activity is unavailable.</p>'
        : '') +
    '</details></section>'
  );
}
