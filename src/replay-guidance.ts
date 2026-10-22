import { damageCauseText, loadDamageCause, type DamageCause } from './damage-cause.ts';

// Advice follows the recorded damage category. It never invents an attacker,
// attack variant, missed input, or exact dodge that the recording cannot prove.
export function replayGuidance(value: DamageCause | null) {
  const cause = loadDamageCause(value);
  let tip: string;
  if (cause.enemy === 'mortar' && cause.type === 'blast')
    tip =
      'Leave the marked landing area before the shell arrives. You can also shoot down the shell.';
  else if (cause.enemy === 'sniper' && cause.type === 'shot')
    tip =
      'Use the aiming line to find the shot. Change height or get behind solid cover before it fires.';
  else if (cause.type === 'shot')
    tip =
      'Change height or use solid cover to break the firing line. Keep an escape route when you return fire.';
  else if (cause.type === 'contact')
    tip = 'Leave space around the machine. A jump and downward shot can help you pass above it.';
  else if (cause.type === 'volatile' || cause.type === 'blast' || cause.type === 'fuel')
    tip =
      'Move outside the blast warning. Solid cover can give you space to separate from the explosion.';
  else if (cause.type === 'cargo' || cause.type === 'crate')
    tip =
      'Watch the load above you and move away from its falling path. Keep a clear landing beside it.';
  else if (cause.type === 'slam' || cause.type === 'crusher')
    tip =
      'Leave the marked strike area before the machine commits. Use its recovery to move back in.';
  else if (cause.type === 'train')
    tip =
      'Leave the train lane when the crossing warns. Use the raised platforms to wait out the pass.';
  else if (cause.type === 'coolant' || cause.type === 'heat' || cause.type === 'weld')
    tip =
      'Land on a dry platform or clear floor. Use recoil to cross the dangerous surface instead of standing on it.';
  else if (cause.type === 'steam')
    tip = 'Wait outside the jet lane, then cross between releases. Keep a dry landing in reach.';
  else if (cause.type === 'lightning' || cause.type === 'induction')
    tip =
      'Move out of the marked strike area before the discharge. Pick a different landing while it charges.';
  else if (cause.type === 'hook')
    tip =
      'Change direction when the harpoon aims, or put solid cover between you and its firing line.';
  else if (cause.type === 'blade' || cause.type === 'saw')
    tip =
      'Watch the blade path and change height to cross it. Leave yourself room to land beyond its reach.';
  else if (cause.type === 'fall')
    tip = 'Keep a landing in reach. Shooting down while airborne gives you lift to recover.';
  else
    tip =
      'Review the final moments for the incoming attack or hazard. Try a different route through the room.';
  return { label: damageCauseText(cause), tip };
}
