// The seed owns boss order so Continue, replays and earned Practice agree.
// Earlier Campaigns and pinned Dailies retain their recorded encounters.
// Revision 94 is the brief 5.11.1 order, preserved for its existing saves.
export const reclaimerFinale = (seed: string) => Number(/^RF-C(\d+)-/.exec(seed)?.[1] ?? 0) === 94;
export const finalArsenalSeed = (seed: string) => Number(/^RF-C(\d+)-/.exec(seed)?.[1] ?? 0) >= 95;

// Revision 96 owns the transforming arena and its three physical forms.
export const transformedFinale = (seed: string) => Number(/^RF-C(\d+)-/.exec(seed)?.[1] ?? 0) >= 96;

// Revision 97 owns the visual, independently depleted three-form finale.
export const cinematicFinale = (seed: string) => Number(/^RF-C(\d+)-/.exec(seed)?.[1] ?? 0) >= 97;

// Revision 98 adds the final approach rooms and one service choice per shift.
export const finalApproachSeed = (seed: string) => Number(/^RF-C(\d+)-/.exec(seed)?.[1] ?? 0) >= 98;

// Repair current Factory Unbound Campaign checkpoints in place. Archived
// Campaigns through C106 and every pinned Daily keep their encounter rules.
export const reclaimerPressureSeed = (seed: string) =>
  Number(/^RF-C(\d+)-/.exec(seed)?.[1] ?? 0) >= 107;
