import { COMMENDATIONS, commendationVisible, type CommendationId } from './commendations.ts';
import type { LogbookProgress } from './logbook.ts';
import { unlockGoals, draftUnlocked, LONGEVITY_IDS, type LongevityId } from './longevity.ts';
import { MODS, MOD_REQUIRES, FUSION_REQUIRES, SALVAGE_BOSSES, isSalvage } from './rules.ts';
import { BRANCH_PARENTS } from './upgrade-branches.ts';
import type { SecurityProfile } from './security.ts';
import { unlockedStartingGuns, type WeaponUnlocks } from './weapon-unlocks.ts';
import { newCampaignSeed } from './run-seed.ts';

export interface GoalProgress {
  weapons: WeaponUnlocks;
  security: SecurityProfile;
  book: LogbookProgress;
  earned: readonly CommendationId[];
  victories: readonly string[];
  discovered: readonly string[];
  milestones: unknown;
}
export interface NextGoal {
  id: string;
  kind: 'campaign' | 'weapon' | 'difficulty' | 'license' | 'achievement' | 'discovery' | 'complete';
  title: string;
  summary: string;
  requirement: string;
  hint: string;
  reward?: string;
  progress?: { current: number; target: number; unit: string };
}
const HUNTS = ['cable-cut', 'plate-breaker', 'fuse-pulled'] as const;
const CERTIFICATIONS = ['launch-certified', 'cargo-certified', 'flight-certified'];
const DISCOVERY_SEED = newCampaignSeed(undefined, () => 0);

// A suggestion, never a condition on Play. Stable catalog order prevents the
// target from changing each time the player visits the title screen.
export function nextGoal(p: GoalProgress): NextGoal {
  return selectGoal(p);
}

// Resolve the original target after its completion, rather than replacing it
// with the next suggestion partway through an attempt.
export function goalById(p: GoalProgress, id: string): NextGoal | null {
  const goal = selectGoal(p, id);
  return goal.id === id && id !== 'complete' ? goal : null;
}

function selectGoal(p: GoalProgress, target?: string): NextGoal {
  const wants = (id: string, missing: boolean) => (target ? target === id : missing);
  if (wants('campaign', !p.weapons.cleared))
    return {
      id: 'campaign',
      kind: 'campaign',
      title: 'Beat the Campaign',
      summary: 'Clear twenty rooms and escape the factory.',
      requirement: 'Complete the Campaign escape or factory shutdown.',
      hint: 'Choose Play to begin. Continue picks up your saved run; failed attempts still keep your discoveries.',
      reward: 'Recoil shotgun, Security I and Boss Gauntlet access.',
    };
  const guns = unlockedStartingGuns(p.weapons);
  if (wants('weapon:twinbore', !guns.includes('twinbore')))
    return {
      id: 'weapon:twinbore',
      kind: 'weapon',
      title: 'Unlock the Twinbore',
      summary: 'Defeat the Press or Kiln.',
      requirement: 'Defeat the Press or Kiln in Campaign or Daily.',
      hint: 'These machines guard the Furnace halls. Practice victories do not award this license.',
      reward: 'Twinbore starting gun and the precision fitting family.',
    };
  if (wants('weapon:carbine', !guns.includes('carbine')))
    return {
      id: 'weapon:carbine',
      kind: 'weapon',
      title: 'Unlock the Coil carbine',
      summary: 'Win two different Campaign miniboss hunts.',
      requirement: 'Defeat two different hunt bosses: the Cableweaver, Bulwark or Demolisher.',
      hint: 'Look for an optional side door from the second zone onward. Victories carry across runs; repeating the same hunt counts once.',
      reward: 'Coil carbine starting gun. Each first hunt victory also earns a cosmetic.',
      progress: {
        current: Math.min(2, HUNTS.filter((id) => p.earned.includes(id)).length),
        target: 2,
        unit: 'different hunts won',
      },
    };
  if (wants('weapon:repeater', !guns.includes('repeater')))
    return {
      id: 'weapon:repeater',
      kind: 'weapon',
      title: 'Unlock the Pressure repeater',
      summary: 'Complete all five Boss Gauntlet rounds.',
      requirement: 'Complete the Boss Gauntlet with an unlocked starting gun.',
      hint: 'Open Practice → Boss Gauntlet. Health carries between fights; choose a fitting or repair after each round.',
      reward: 'Pressure repeater starting gun and the Victor outfit.',
    };
  if (wants('weapon:nailgun', !guns.includes('nailgun')))
    return {
      id: 'weapon:nailgun',
      kind: 'weapon',
      title: 'Unlock the Burst nailgun',
      summary: 'Complete Overtime and take the exit elevator.',
      requirement:
        'Finish a Campaign, choose Overtime, then complete it and leave through the exit elevator.',
      hint: 'Overtime continues your winning build. Entering Overtime alone does not unlock the gun.',
      reward: 'Burst nailgun starting gun and the Night Shift outfit.',
    };
  for (const level of [1, 2, 3] as const) {
    const cleared =
      p.security.unlocked > level ||
      p.security.bests.some((b) => b.level === level) ||
      (level === 3 && p.earned.includes('redline'));
    if (wants('security:' + level, !cleared))
      return {
        id: 'security:' + level,
        kind: 'difficulty',
        title: 'Clear Security ' + ['I', 'II', 'III'][level - 1],
        summary:
          level === 3
            ? 'Beat the factory at its highest Security level.'
            : 'Beat the Campaign with tougher security.',
        requirement: 'Clear the full Campaign on Security ' + ['I', 'II', 'III'][level - 1] + '.',
        hint: 'Use the Security selector below Play before starting a new Campaign. Continue keeps the saved run’s level.',
        reward:
          level === 3
            ? 'Redline outfit and a Security III best time.'
            : 'Security ' + ['II', 'III'][level - 1] + ' access and a separate best time.',
      };
  }
  const licenses = unlockGoals(p.book, p.earned, p.victories, p.milestones);
  const locked = licenses.find((g) => wants('license:' + g.id, !g.unlocked));
  if (locked)
    return {
      id: 'license:' + locked.id,
      kind: 'license',
      title: 'Unlock ' + locked.name,
      summary: locked.requirement.replace(/ in Campaign or Daily\./, '.'),
      requirement: locked.requirement,
      hint: 'This unlock adds fittings to future Campaign drafts. You still need to collect the fitting in a run to own it in Workshop.',
      reward:
        licenses
          .filter((g) => g.requirement === locked.requirement)
          .map((g) => g.name)
          .join(', ') + ' added to Campaign drafts.',
      ...(locked.target > 1
        ? { progress: { current: locked.current, target: locked.target, unit: 'completed' } }
        : {}),
    };
  const challenge = COMMENDATIONS.find(
    (c) =>
      wants('commendation:' + c.id, !p.earned.includes(c.id)) &&
      commendationVisible(c.id, p.victories, p.earned, p.discovered),
  );
  if (challenge)
    return {
      id: 'commendation:' + challenge.id,
      kind: 'achievement',
      title: 'Earn ' + challenge.name,
      summary: challenge.objective,
      requirement: challenge.objective,
      hint: CERTIFICATIONS.includes(challenge.id)
        ? 'Clear this optional course in Campaign to unlock it in Practice → Recoil Trials. You can earn the certificate in Campaign or on a normal Practice attempt.'
        : 'Earn this in Campaign or Daily unless the requirement names a specific mode. Isolated playtests and Workshop do not award commendations.',
      reward: challenge.reward + ' · ' + challenge.slot,
    };
  const unlocked = licenses.filter((g) => g.unlocked).map((g) => g.id);
  const missing = MODS.find((mod) =>
    target
      ? target === 'discover:' + mod.id
      : !p.discovered.includes(mod.id) &&
        draftUnlocked(mod.id, unlocked, DISCOVERY_SEED) &&
        [
          MOD_REQUIRES[mod.id],
          ...(FUSION_REQUIRES[mod.id] ?? []),
          ...(BRANCH_PARENTS[mod.id] ?? []),
        ].every((id) => !id || p.discovered.includes(id)),
  );
  if (missing) {
    const parents = [
      ...new Set(
        [
          MOD_REQUIRES[missing.id],
          ...(FUSION_REQUIRES[missing.id] ?? []),
          ...(BRANCH_PARENTS[missing.id] ?? []),
        ].filter(Boolean),
      ),
    ];
    const names = parents.map((id) => MODS.find((m) => m.id === id)!.name).join(' + ');
    const fittingHint = LONGEVITY_IDS.includes(missing.id as LongevityId)
      ? 'Start a fresh Campaign to use earned fittings. '
      : '';
    return {
      id: 'discover:' + missing.id,
      kind: 'discovery',
      title: 'Discover ' + missing.name,
      summary: 'Collect it in a Campaign run.',
      requirement:
        'Choose ' +
        missing.name +
        ' as a run reward. Seeing it offered does not count as collecting it.',
      hint:
        fittingHint +
        (isSalvage(missing.id)
          ? missing.id === 'melt-through'
            ? 'Defeat The Welder in Campaign or Daily, then choose its Melt Through salvage reward.'
            : 'Look for this salvage reward after defeating ' +
              Object.entries(SALVAGE_BOSSES)
                .filter(([, id]) => id === missing.id)
                .map(([boss]) =>
                  boss === 'boss'
                    ? 'the final boss'
                    : 'the ' + boss[0].toUpperCase() + boss.slice(1),
                )
                .join(' or ') +
              '.'
          : parents.length
            ? 'Collect ' +
              names +
              ' in the same run first, then look for this follow-up. Competing branches may require a fresh build.' +
              (FUSION_REQUIRES[missing.id] ? ' Fusion offers begin after room 8.' : '')
            : 'Look for this fitting at upgrade rewards. Different runs offer different choices.'),
      reward: 'Workshop ownership and its Logbook equipment record.',
    };
  }
  // Boss-specific challenges stay concealed until the machine is defeated.
  // Do not report completion merely because every currently revealed one is done.
  const hidden = COMMENDATIONS.find((c) =>
    target ? 'boss' in c && target === 'encounter:' + c.boss : !p.earned.includes(c.id),
  );
  if (hidden && 'boss' in hidden)
    return {
      id: 'encounter:' + hidden.boss,
      kind: 'achievement',
      title: 'Find another machine challenge',
      summary: 'A Loading docks boss still has a challenge to reveal.',
      requirement:
        'Defeat another Loading docks boss in Campaign or Daily to reveal its commendation.',
      hint: 'New Campaigns can encounter different bosses. The Logbook reveals the challenge after your first victory over its machine.',
    };
  return {
    id: 'complete',
    kind: 'complete',
    title: 'Core goals complete',
    summary: 'Try a new build or chase a best time.',
    requirement:
      'All six weapons, three Security clears, fitting licenses and commendations earned. Every upgrade collected.',
    hint: 'Return for a Daily run, try a different Gauntlet route or improve a Practice best. Factory stories and personal records are still yours to explore.',
  };
}
