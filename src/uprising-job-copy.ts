import type { UprisingRouteId } from './uprising-model.ts';
export const UPRISING_JOB_EFFECTS: Record<UprisingRouteId, string> = {
  'rail-heist': 'Stolen cargo draws pursuit crews into later transit rooms.',
  'rail-escape': 'Complete the evacuation without adding a cargo pursuit.',
  'rail-guard': 'Crew barricades shelter later boss arenas.',
  'core-sabotage':
    'Later powered hazards, coolant, vents and updraft shafts shut down. Command systems are isolated in the finale.',
  'core-defense': 'Complete the power hold and progress toward Core certification.',
  'core-recovery': 'Recovered research draws pursuit crews into later transit rooms.',
  'crew-relief': 'Restored crew stations provide cover in later boss arenas.',
  'scrap-raid': 'Seized inventory draws pursuit crews and can change the final security response.',
  'signal-cut': 'Isolate command systems in the final defense.',
  'roof-escape': 'Reach the final approach without adding another pursuit.',
  'roof-relief': 'Crew barricades shelter the final arena.',
};
