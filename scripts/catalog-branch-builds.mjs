// Exact legal acquisition lists and stable links, generated from runtime rules.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import {
  MODS,
  PATH_NAMES,
  FUSION_REQUIRES,
  isFusion,
  availableMods,
  validBuild,
  modDescription,
} from '../src/rules.ts';
import { DAILY_RULESET } from '../src/daily.ts';
import { maxCombos, BRANCH_TEST_BUILDS, branchTestFromUrl } from '../src/branch-builds.ts';
import { BRANCH_PARENTS, BRANCH_GROUPS, isBranch } from '../src/upgrade-branches.ts';
const { version } = JSON.parse(await readFile(new URL('../package.json', import.meta.url)));
const names = new Map(MODS.map((m) => [m.id, m.name]));
const name = (id) => names.get(id);
const base = 'https://caleb-guyer.github.io/recoil-foundry/';
const link = (query) => base + '?test=branches&' + query + '&v=' + version;
const combos = maxCombos().filter((c) => c.mods.some(isBranch));
const cells = (row) => row.map((v) => '"' + String(v).replaceAll('"', '""') + '"').join(',');
const csv = [
  [
    'combo',
    'path',
    'weapon',
    'branches',
    'fusion',
    'upgrade_count',
    'upgrades_in_acquisition_order',
    'upgrade_ids_in_acquisition_order',
    'room_test',
    'boss_test',
    'mirrored_room_test',
  ],
];
const max = [
  '# Every new fully maxed combination',
  '',
  `Game **${version}**. **${combos.length}** distinct legal completed builds contain a new specialization.`,
  '',
  `“Maxed” means every remaining compatible upgrade is fitted, including boss salvage. These contain ${Math.min(...combos.map((c) => c.mods.length))}–${Math.max(...combos.map((c) => c.mods.length))} upgrades: Overtime/stress builds, beyond the ordinary run’s 19 picks. Different acquisition orders of the same gun are counted once. The four completed builds containing only old upgrades are omitted.`,
  '',
  '[Download the complete CSV](max-upgrade-combos.csv) · [Focused builds and controls](new-upgrade-builds.md)',
  '',
  'Each expandable entry gives **every upgrade in a valid acquisition order**. Test links preserve Continue, Daily records, discoveries and Practice unlocks. Click the test button on the title screen; R repeats that preset.',
  '',
];
let path;
for (const c of combos) {
  assert(validBuild(c.mods));
  assert.equal(availableMods(c.mods, true).length, 0);
  const query = 'combo=' + c.code;
  const room = link(query),
    boss = link(query + '&room=boss'),
    mirror = link(query + '&mirror=1');
  assert.deepEqual(branchTestFromUrl(new URL(room)).mods, c.mods);
  csv.push([
    c.code,
    PATH_NAMES[c.path],
    name(c.weapon),
    c.choices.map(name).join(' + '),
    name(c.mods.find(isFusion)),
    c.mods.length,
    c.mods.map(name).join(' > '),
    c.mods.join(' > '),
    room,
    boss,
    mirror,
  ]);
  if (path !== c.path) {
    path = c.path;
    max.push('## ' + PATH_NAMES[path], '');
  }
  max.push(
    '<details>',
    `<summary>${[...new Set([c.weapon, ...c.choices, c.mods.find(isFusion)])].filter(Boolean).map(name).join(' · ')}</summary>`,
    '',
    `${c.mods.length} upgrades. [Test room](${room}) · [Mirror](${mirror}) · [Final boss](${boss})`,
    '',
    c.mods.map(name).join(' → '),
    '',
    '</details>',
    '',
  );
}
const tips = {
  resonator:
    'Right-click/E or LT/L2 to place both portals, then hold fire through the entrance. Every third pulse repeats its transmitted energy from the exit at 60% power after a short delay. The first two pulses are 25% lighter. Repeats keep the original exit aim and spent range, check current cover and cannot trigger more repeats.',
  flywheel:
    'Fire shallowly into a floor. After 600 units of actual rolling travel, the final saw pair reaches double damage. The ball has two fewer banks. Air travel, riding a moving platform and teleporting do not charge it; the saw pair spends its charge once.',
  storm:
    'Aim near floors so the three bomblets can land apart. Two landings arm a cell after 0.12 seconds, linking exposed nodes for 1.3 seconds. Each cell hits an enemy once for half the original shell payload. Shell explosions have 28% less radius; at most three cells can remain. Cover interrupts links.',
  pulse:
    'Hold fire. Two light pulses lead into a narrow piercing finisher. Burst fire is a required parent.',
  charge:
    'Hold left click or RT/R2, then release. Aim while charging; Thermal needs one exposed target. Burst adds three release lances. Pause cancels the charge.',
  prism:
    'Hold fire. Aim along either angled ray for one target, or put separate targets in both lanes. The middle is a gap; Scattershot widens the rays.',
  pinwheel:
    'Keep the center lane on target while successive volleys sweep the outer lanes. Alternatives: Pinwheel or Convergence.',
  follow:
    'Fire, then move. The echo starts at your new muzzle with your original aim. Vector echoes replay recorded turns. Alternatives: Follow-through or Parallax.',
  shaped:
    'Aim into the target. The blast reaches farther forward and sacrifices side/rear coverage; real cover still blocks it. Fuse retains impact direction as its host rotates.',
  cluster:
    'Use floors and exposed cover to scatter three physical bomblets. Parent plus children share the shell payload. Aftershock echoes the same divided budget.',
  skid: 'Fire shallowly into a floor to turn a ball into a rolling shot. It follows real moving support and spends its existing banks and lifetime.',
  relay:
    'Right-click/E or LT/L2 to place the fixed pair. Friendly primary shots get one extra bank and 15% speed on first transit; beams get remaining range instead. Rewire is the alternative.',
  short:
    'Land three hits on the same enemy. The stored arc damage discharges into that target. Daisy Chain is the crowd-control alternative.',
  triphammer:
    'Fire away from a target to launch into it. A successful fast ram rebounds you upward. Move at least 64 units away and fire again to rearm; boss armor still applies.',
  crosscut:
    'Spend a shot against a solid surface after its banks/return. Two saws travel opposite ways at 60% payload each. Rail and echo payloads carry through; Corner Cutter is the alternative.',
};
const guide = [
  '# New upgrade builds',
  '',
  `Implemented in **${version}** · Daily ruleset **${DAILY_RULESET}**.`,
  '',
  'Twelve local specializations and three rare fusions extend the existing gun. New specialization offers start at reward stage 7 with their parents fitted. Choose one member of each local fork; unrelated families still combine. Resonator, Flywheel and Storm Cell each require both named parents and obey the one-fusion limit. The chosen broad path retains its slight reward preference. Daily still gives one predetermined legal card.',
  '',
  `For **every upgrade in every new max combo**, use the [${combos.length}-build catalog](max-upgrade-combos.md) or [CSV](max-upgrade-combos.csv).`,
  '',
  '## Quick tests',
  '',
  'These start in a real room with 100 health and a ten-upgrade gun. Each link opens a title-screen test button. R restarts the preset. Boss variants have 19 picks; “max” variants exhaust the legal pool. They preserve ordinary saves, discoveries, Daily records and boss unlocks.',
  '',
  '| Build | Normal room | Mirrored room | Final boss | Fully maxed |',
  '| --- | --- | --- | --- | --- |',
];
for (const [key, b] of Object.entries(BRANCH_TEST_BUILDS))
  guide.push(
    `| ${b.name} | [Play](${link('build=' + key)}) | [Play](${link('build=' + key + '&mirror=1')}) | [Play](${link('build=' + key + '&room=boss')}) | [Play](${link('build=' + key + '&max=1')}) |`,
  );
guide.push('', '## What to fit', '');
for (const [key, b] of Object.entries(BRANCH_TEST_BUILDS)) {
  const save = branchTestFromUrl(new URL(link('build=' + key)));
  assert(save && validBuild(save.mods));
  const mod = MODS.find((m) => m.name === b.name);
  guide.push(
    '### ' + b.name,
    '',
    tips[key],
    '',
    '**Parents:** ' +
      (BRANCH_PARENTS[mod.id] ?? FUSION_REQUIRES[mod.id]).map(name).join(' + ') +
      '.',
    '',
    '**Complete room build:** ' + save.mods.map(name).join(' → ') + '.',
    '',
    '**Card:** ' + modDescription(mod, save.mods),
    '',
  );
}
guide.push('## Local forks', '', '| Family | Choose one |', '| --- | --- |');
for (const [family, members] of Object.entries(BRANCH_GROUPS))
  guide.push(`| ${family} | ${members.map(name).join(' / ')} |`);
guide.push(
  '',
  '## Existing combinations repaired',
  '',
  '- Rail spike + Vector/Afterburner are alternatives for new builds. Existing saved runs and recaps keep owned legacy builds.',
  '- Charged Backfire fires a real rear rail. Spent rails and Afterimage rounds can produce payload-correct saws.',
  '- Mass Driver + Recall permits one hit per enemy on each flight leg. Banks and portals cannot refresh that allowance.',
  '- Guided Recall gets a half-second outward window. Echo guidance follows recorded turns, including one earned Afterburner boost.',
  '- Breach clears at most two small rounds per 0.45 seconds. Heavy rounds and blades resist it; Countershot retains its separate shared charge.',
  '- Contextual cards explain beam, charged-lance, rail, trap and direct-impact adaptations.',
  '',
  'Regenerate these documents with `node --experimental-strip-types scripts/catalog-branch-builds.mjs`.',
  '',
);
await writeFile(
  new URL('../docs/max-upgrade-combos.csv', import.meta.url),
  csv.map(cells).join('\n') + '\n',
);
await writeFile(new URL('../docs/max-upgrade-combos.md', import.meta.url), max.join('\n'));
await writeFile(new URL('../docs/new-upgrade-builds.md', import.meta.url), guide.join('\n'));
console.log(
  JSON.stringify({
    version,
    newMaxCombos: combos.length,
    branchPresets: Object.keys(BRANCH_TEST_BUILDS).length,
  }),
);
