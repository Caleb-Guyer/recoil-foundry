import { getGun, MODS, MOD_REQUIRES, FUSION_REQUIRES, modDescription, type Mod } from './rules.ts';
import { BRANCH_PARENTS } from './upgrade-branches.ts';
import type { StartingGun } from './starting-guns.ts';
import { SHELL_DIRECT } from './demolition.ts';
import { legacyTorchPattern, torchRayCount } from './torch-pattern.ts';

export interface UpgradeChange {
  label: string;
  before: string;
  after: string;
}
export interface UpgradeInspection {
  mod: Mod;
  description: string;
  beforeMods: string[];
  afterMods: string[];
  startingGun: StartingGun;
  seed?: string;
  changes: UpgradeChange[];
  connections: string[];
}
const number = (n: number) => String(Math.round(n * 10) / 10);
const seconds = (n: number) => String(Math.round(n * 100) / 100) + 's';
const beams = (n: number) => n + (n === 1 ? ' beam' : ' beams');
const name = (id: string) => MODS.find((m) => m.id === id)?.name ?? id;
const fireKind = (mods: readonly string[]) =>
  mods.includes('cutting-torch')
    ? mods.includes('charge-lens')
      ? 'Charged lance'
      : 'Beam'
    : mods.includes('mass-driver')
      ? 'Steel balls'
      : mods.includes('shellshock')
        ? 'Shells'
        : 'Rounds';

// Compare the actual combined build. Conditional bonuses and secondary damage
// stay in contextual copy rather than becoming a misleading aggregate DPS stat.
export function inspectUpgrade(
  mods: readonly string[],
  mod: Mod,
  startingGun: StartingGun,
  hp = 100,
  remove?: string,
  seed?: string,
): UpgradeInspection {
  const base = mods.filter((id) => id !== remove);
  const afterMods = mod.id === 'repair' ? [...base] : [...new Set([...base, mod.id])];
  const changes: UpgradeChange[] = [];
  const add = (label: string, before: string, after: string) => {
    if (before !== after) changes.push({ label, before, after });
  };
  if (mod.id === 'repair') add('Health', number(hp), number(Math.min(100, hp + 24)));
  else {
    const before = getGun(mods, startingGun),
      after = getGun(afterMods, startingGun);
    const beforeKind = fireKind(mods),
      afterKind = fireKind(afterMods);
    add('Fire', beforeKind, afterKind);
    if (afterMods.includes('cutting-torch')) {
      const count = torchRayCount(after, afterMods, seed);
      add(
        'Pattern',
        mods.includes('cutting-torch')
          ? beams(torchRayCount(before, mods, seed))
          : before.pellets * before.lanes + ' pellets',
        beams(count),
      );
      add(
        'Rear beams',
        mods.includes('cutting-torch') && before.rearVolley
          ? number(torchRayCount(before, mods, seed))
          : '0',
        after.rearVolley ? number(count) : '0',
      );
    }
    if (beforeKind === afterKind) {
      const beam = afterMods.includes('cutting-torch');
      if (!beam) {
        const direct = beforeKind === 'Shells' ? SHELL_DIRECT : 1;
        add(
          before.pellets > 1 || after.pellets > 1 ? 'Hit / pellet' : 'Direct hit',
          number(before.damage * direct),
          number(after.damage * direct),
        );
        const rate = (g: typeof before) =>
          g.burstCount / (g.interval * (g.burstCount === 3 ? 3.1 : 1));
        add('Shots / s', number(rate(before)), number(rate(after)));
        add('Pellets', number(before.pellets), number(after.pellets));
        add('Lanes', number(before.lanes), number(after.lanes));
      } else {
        const cycle = (g: typeof before) => g.interval * (g.burstCount === 3 ? 3.1 : 1);
        if (afterKind === 'Charged lance')
          add('Full charge', seconds(before.interval * 3), seconds(after.interval * 3));
        else add('Pulse cycle', seconds(cycle(before)), seconds(cycle(after)));
      }
      if (Math.abs(before.recoil - after.recoil) > 0.0001)
        changes.push({
          label: 'Kick',
          before: 'Current',
          after:
            (after.recoil > before.recoil ? '+' : '') +
            Math.round((after.recoil / before.recoil - 1) * 100) +
            '%',
        });
      add('Banks', number(before.bounces), number(after.bounces));
      if (!beam) add('Pass-throughs', number(before.pierce), number(after.pierce));
    }
    add('Move speed', number(before.speed * 100) + '%', number(after.speed * 100) + '%');
    add('Healing / kill', number(before.heal), number(after.heal));
    for (const [id, label, value] of [
      ['collimator', 'Steady spread', 'Up to 50% tighter'],
      ['heat-relay', 'Heat carry', 'Half heat · 1s window'],
      ['overkill-bank', 'Excess reserve', 'Up to +50% next discharge'],
      ['scrap-armor', 'Scrap plate', '1 small bullet · 4s'],
    ])
      add(label, mods.includes(id) ? value : 'None', afterMods.includes(id) ? value : 'None');
    add('Air damage', number(before.airDamage * 100) + '%', number(after.airDamage * 100) + '%');
  }
  const connections: string[] = [];
  if (remove) {
    connections.push('Exchanges ' + name(remove) + ' for ' + mod.name + '.');
    const lost = MODS.find((m) => m.id === remove);
    if (lost) connections.push('Give up: ' + modDescription(lost, mods, startingGun, seed));
  }
  const parents = [
    ...new Set([
      ...(MOD_REQUIRES[mod.id] ? [MOD_REQUIRES[mod.id]] : []),
      ...(BRANCH_PARENTS[mod.id] ?? []),
      ...(FUSION_REQUIRES[mod.id] ?? []),
    ]),
  ].filter((id) => base.includes(id));
  if (parents.length)
    connections.push(
      'With ' + parents.map(name).join(' + ') + ': ' + modDescription(mod, base, startingGun, seed),
    );
  else {
    const pairs: [string, string[], string][] = [
      ['scatter', ['capacitor'], 'A stored charge boosts every pellet in the discharge.'],
      ['burst', ['capacitor'], 'Burst rounds spend stored charges separately.'],
      ['ricochet', ['banker'], 'Each wall bank also earns your Banker damage bonus.'],
      ['capacitor', ['scatter'], 'The charged discharge boosts all your pellets.'],
      ['rapid', ['cutting-torch'], 'Your beam gains sustained damage as its pulses speed up.'],
      [
        'scatter',
        ['cutting-torch'],
        legacyTorchPattern(seed)
          ? 'Your spread becomes beam width instead of separate pellets.'
          : 'Each pellet remains a separate beam; Prism splits each one.',
      ],
      ['magnum', ['cutting-torch'], 'Stronger beam pulses also take longer to recover.'],
      [
        'cutting-torch',
        ['scatter'],
        legacyTorchPattern(seed)
          ? 'Your Scattershot spread becomes beam width.'
          : 'Keep your Scattershot spread as separate beams.',
      ],
      ['cutting-torch', ['burst'], 'Your Burst fitting becomes concentrated beam pulses.'],
      ['backfire', ['rail-spike'], 'Charged fire keeps a separate rear rail.'],
      [
        'scatter',
        ['rail-spike'],
        'Charged pellets merge into a stronger rail; uncharged fire keeps its spread.',
      ],
    ];
    const pair = pairs.find(
      ([id, owned]) => id === mod.id && owned.every((id) => base.includes(id)),
    );
    if (pair) connections.push('With ' + pair[1].map(name).join(' + ') + ': ' + pair[2]);
  }
  return {
    mod,
    description: modDescription(mod, base, startingGun, seed),
    beforeMods: [...mods],
    afterMods,
    startingGun,
    ...(seed ? { seed } : {}),
    changes,
    connections,
  };
}
