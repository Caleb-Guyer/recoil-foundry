// A support family: it coexists with every gun path, with two exclusive forks.
export const SUBVERSION_MODS = [
  {
    id: 'spoof',
    name: 'Spoof',
    mark: 'spoof',
    description:
      'Reboot a defeated patrol unit for 4s. Resistant machines take feedback hits. One ally; 8s recharge.',
  },
  {
    id: 'standing-orders',
    name: 'Standing Orders',
    mark: 'standing-orders',
    description:
      'Your ally lasts 7.5s with more health. Stronger feedback against resistant machines.',
  },
  {
    id: 'priority-target',
    name: 'Priority Target',
    mark: 'priority-target',
    description:
      'Gun hits mark one target for 3s. Your ally focuses it when exposed and hits 40% harder. Marked feedback gains 25% damage.',
  },
  {
    id: 'cross-talk',
    name: 'Cross Talk',
    mark: 'cross-talk',
    description:
      'Keep two fragile allies for 3.5s, at 70% damage. Reboot every 2.5s. Stronger feedback splits into two pulses.',
  },
  {
    id: 'dead-switch',
    name: 'Dead Switch',
    mark: 'dead-switch',
    description:
      'Expiring allies overload nearby enemies. The second feedback pulse adds an overload, including against a lone boss.',
  },
] as const;
export const SUBVERSION_PARENTS: Readonly<Record<string, string>> = {
  'standing-orders': 'spoof',
  'priority-target': 'standing-orders',
  'cross-talk': 'spoof',
  'dead-switch': 'cross-talk',
};
export const isSubversion = (id: string) => SUBVERSION_MODS.some((m) => m.id === id);
export const SPOOF = {
  duration: 4,
  cooldown: 8,
  roomLimit: 4,
  health: 0.65,
  ordersDuration: 7.5,
  ordersHealth: 1.15,
  crossDuration: 3.5,
  crossCooldown: 2.5,
  crossHealth: 0.45,
  crossDamage: 0.7,
  crossRoomLimit: 6,
  markDuration: 3,
  priorityDamage: 1.4,
  priorityFeedback: 1.25,
  feedbackDelay: 0.6,
  secondDelay: 0.25,
  feedbackLimit: 16,
  pulseLimit: 32,
  overloadDamage: 42,
  overloadRadius: 145,
  feedbackOverload: 0.75,
};
