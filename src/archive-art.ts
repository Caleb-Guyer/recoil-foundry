import type { EnemyKind } from './levels.ts';
import { PATROL_MACHINES } from './patrol-machines.ts';

export const ENEMY_GUIDES: Record<EnemyKind, string> = {
  shutter: PATROL_MACHINES.shutter.guide,
  strider: PATROL_MACHINES.strider.guide,
  mortar: PATROL_MACHINES.mortar.guide,
  cableweaver:
    'Rare optional hunt. Its cable anchors flash before becoming live. Jump over cables or shoot an anchor to expose the machine.',
  bulwark:
    'Rare optional hunt. Solid movable plates shield the core. Push or break them with shots, or fire from above. It has only two sets of plates.',
  demolisher:
    'Rare optional hunt. Planted charges show their blast radius and fuse. Shoot them to disarm them, or leave the circle. Its supply is finite.',
  repairer:
    'Repairs a wounded patrol through a green tether after a dashed warning. Shoot the tether or drone, or move the pair behind cover. Its repair supply is finite; it cannot repair bosses or support units.',
  relay:
    'An amber tether charges one patrol shot. Cut the tether or defeat the unit before the marked shot fires. Charges expire, never stack, and keep the patrol’s normal attack warning and projectile speed.',
  runner: 'Closes the distance on foot. Leave room to move and fire while it approaches.',
  shooter: 'Fires aimed rounds from its position. Use cover and move after it commits.',
  flyer: 'Approaches through open air and fires a spread. Change height to leave its firing lane.',
  charger: 'Warns before charging across the floor. Move out of the committed path.',
  sniper: 'Tracks, locks an aim, then fires. Move after the warning locks.',
  hopper: 'Jumps between attacks. Watch the landing position rather than chasing its takeoff.',
  scrapper: 'Launches surface saws. Leave the marked floor or platform before they arrive.',
  harpooner:
    'Warns before firing a hook that can pull you. Break the firing line or move after it locks.',
  sapper: 'Throws physical charges. Watch their countdown and keep away from the blast.',
  wallcrawler:
    'Travels along connected surfaces and attacks from walls or ceilings. Watch its route.',
  angler:
    'Uses a terrain-backed firing position and a warned attack. Check walls and overhead surfaces.',
  borer: 'Drills through factory cover. A safe firing angle can change when machinery breaks.',
  sifter: 'An airborne reclamation unit. Track its attacks across changes in height.',
  skimmer: 'A mobile airborne attacker. Reposition instead of following its firing lane.',
  fabricator:
    'Builds sentries while protected. Interrupt its production and clear its deployed units.',
  sentry: 'A deployed gun emplacement. Find a clear angle around its cover.',
  switchman: 'Disrupts factory orders. Watch its signal and the patrols around it.',
  caller: 'Fires at recorded positions. Keep moving after its warning captures your location.',
  loader: 'Commits to warned rams and volleys. Cargo supports can turn its own charge against it.',
  crane: 'Sweeps its head across the arena. Recoil above the sweep and attack during recovery.',
  press: 'Locks a position before slamming. Leave the marked crush lane before impact.',
  kiln: 'Controls the Furnace with heat and warned attacks. Keep a route out of the hot lanes.',
  condenser: 'A Cooling Works supervisor. Read the machinery warnings and leave pressure lanes.',
  turbine: 'Uses rotating machinery and warned attacks. Move through the gaps between releases.',
  sorter:
    'Directs reclamation machinery and firing patterns. Read the next lane before committing.',
  welder: 'Closes routes with molten seams and barricades. Attack while its cooling shutters open.',
  auditor:
    'Pursues company property and shields damaged parts. Change the angle as its armor closes.',
  switchboard:
    'Coordinates the Annex through its signal panels. Follow the warnings between circuits.',
  interceptor:
    'Adapts familiar weapon systems to its own attacks. Read the weapon and its recovery.',
  boss: 'The factory’s final supervisor. Watch each committed attack and use the arena’s cover.',
};

// Images are filled by archive-images using the production renderer.
export function archiveMark(id: string) {
  return /^(enemy|elite|mutation|machine|area|region|room|trial|remix):/.test(id)
    ? '<canvas class="archive-image" width="640" height="320" data-archive-image="' +
        id +
        '" aria-hidden="true"></canvas>'
    : '';
}
