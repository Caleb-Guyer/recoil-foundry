// The seed owns boss order so Continue, replays and earned Practice agree.
// Earlier Campaigns and pinned Dailies retain their recorded encounters.
export const reclaimerFinale = (seed: string) => Number(/^RF-C(\d+)-/.exec(seed)?.[1] ?? 0) >= 94;
