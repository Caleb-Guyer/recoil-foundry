import type { CourierSave } from './courier-layout.ts';
export function courierRewardCue(bonus: boolean, stage: number, courier: CourierSave | null) {
  const followup = !bonus && courier?.stage === stage && courier.status === 'claimed';
  if (!bonus && !followup) return '';
  return (
    '<div class="courier-reward-cue"><svg viewBox="0 0 56 48" aria-hidden="true"><path d="M19 13V8h18v5M8 14h40v27H8zM8 23h40M21 19v13M35 19v13"/></svg><div><strong>' +
    (bonus ? 'Recovered cargo · bonus choice' : 'Cargo fitted · room reward') +
    '</strong><span>' +
    (bonus
      ? 'Choose one extra upgrade. No healing or room advance; your normal reward follows.'
      : 'Your extra cargo upgrade is fitted. Choose the normal room reward to continue.') +
    '</span></div></div>'
  );
}
