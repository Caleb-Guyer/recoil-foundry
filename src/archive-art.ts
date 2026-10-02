import type { EnemyKind } from './levels.ts';

export const ENEMY_GUIDES: Record<EnemyKind, string> = {
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

const machinePaths: Record<EnemyKind, string> = {
  runner: 'M17 12h22v23H17zM18 35l-7 8M38 35l7 8M22 20h12',
  shooter: 'M14 13h24v24H14zM38 20h12v7H38M18 37h20M22 19h8',
  flyer: 'M28 10a14 14 0 1 0 0 28 14 14 0 0 0 0-28M7 17l7 7-7 7M49 17l-7 7 7 7M23 23h10',
  charger: 'M14 13h23v24H14zM37 17l12 7-12 7M7 18h7M7 30h7',
  sniper: 'M13 13h22v24H13zM35 23h18M44 17v12M19 19h10M17 38h16',
  hopper: 'M16 10h24v21H16zM21 31l-8 5 7 7M35 31l8 5-7 7M22 18h12',
  scrapper: 'M10 13h23v24H10zM40 20l4-6 4 6 6 4-6 4-4 6-4-6-6-4z',
  harpooner: 'M10 13h23v24H10zM33 24h18M43 17l8 7-8 7M17 20h9',
  sapper: 'M10 13h23v24H10zM45 23a7 7 0 1 0 0 14 7 7 0 0 0 0-14M45 23v-8h5',
  wallcrawler:
    'M28 11a13 13 0 1 0 0 26 13 13 0 0 0 0-26M10 12l8 6M46 12l-8 6M10 36l8-6M46 36l-8-6M23 24h10',
  angler: 'M15 13h23v24H15zM38 17h11v15h-6M16 37l-7 6M24 19h8',
  borer: 'M12 14h22v21H12zM34 17l18 7-18 7M38 19v10M43 21v6',
  sifter: 'M28 9l16 15-16 15-16-15zM20 21h16M20 27h16M28 39v5',
  skimmer: 'M28 11a13 13 0 1 0 0 26 13 13 0 0 0 0-26M7 35h42M20 24h16M28 17v14',
  fabricator: 'M13 11h30v27H13zM19 17h18v9H19zM24 32h8M20 38v6M36 38v6',
  sentry: 'M17 12h23v20H17zM40 18h11v7H40M28 32v8M16 40h25',
  switchman: 'M15 11h26v28H15zM21 18h14M21 26h14M8 20h7M41 31h8M25 18v8',
  caller: 'M15 12h26v26H15zM21 20h14M41 17l8-5v26l-8-5M8 18v14',
  loader: 'M8 17h27v19H8zM35 25h10v12h7M13 36v7M29 36v7M11 13h19',
  crane: 'M8 36V12h31M27 12v14q0 10 10 6M8 36h13M17 20h8',
  press: 'M10 7h36v8H10zM24 15v11h8V15M16 26h24v10H16zM7 42h42',
  kiln: 'M12 8h32v34H12zM20 36c-8-8 8-13 7-21 11 8 12 17 3 21M18 12h20',
  condenser: 'M13 10h30v30H13zM20 17h16M20 25h16M7 20h6M43 30h6M22 40v5M34 40v5',
  turbine: 'M28 7a17 17 0 1 0 0 34 17 17 0 0 0 0-34M28 24l-3-12 12 7-9 5-3 12-8-10z',
  sorter: 'M10 13h36v24H10zM18 13V6h20v7M18 21h7M31 21h7M19 37l-7 7M37 37l7 7',
  welder: 'M10 11h26v28H10zM36 23h9M45 15l7 4-7 4 7 4-7 4M17 18h12M17 31h12',
  auditor: 'M15 7h26v34H15zM22 15h12v8H22zM7 15l8 6M49 15l-8 6M22 33h12',
  switchboard: 'M8 9h40v31H8zM15 16h6v10h-6zM25 16h6v10h-6zM35 16h6v10h-6zM14 34h28',
  interceptor: 'M17 8h22l7 16-7 17H17L10 24zM21 18h14M28 24v10M7 12l6 4M49 12l-6 4',
  boss: 'M12 9h32v30H12zM19 16h18M20 25h5M31 25h5M20 39v6M36 39v6M7 12v20M49 12v20',
};
const otherPaths: Record<string, string> = {
  'area:docks': 'M7 39h42M12 39V20h17v19M29 24h16v15M12 20l9-11 8 11M17 28h7',
  'area:furnace': 'M10 41V15h15V7h8v8h13v26M19 41V29h18v12M20 20h5M32 20h5',
  'area:cooling': 'M11 8h34v33H11zM19 15v19M28 15v19M37 15v19M7 24h4M45 24h4',
  'area:reclamation': 'M9 40h38M14 40V19h28v21M21 19V9h14v10M20 28l8-5 8 5-8 5z',
  'area:rooftops': 'M7 37h42M14 37V21h28v16M20 21V9h5M35 21v-8M7 14h9M40 7h10',
  'region:annex': 'M9 8h12v33H9zM25 8h12v33H25zM41 8h6v33h-6M12 16h6M28 16h6M12 30h6M28 30h6',
  'region:shutdown': 'M13 8h30v33H13zM28 14v13M20 18a11 11 0 1 0 16 0',
  'elite:shielded': 'M13 9h30v16L28 41 13 25zM20 18h16M28 14v17',
  'elite:twin': 'M8 12h17v24H8zM31 12h17v24H31zM25 22h6M25 28h6',
  'elite:volatile': 'M28 8l5 11 12-3-7 10 9 9-13-1-6 11-5-12-12 3 7-10-9-9 13 1z',
  'mutation:splitter': 'M20 8h16v12H20zM28 20v8M28 28l-13 7M28 28l13 7M9 35h12v8H9zM35 35h12v8H35z',
  'mutation:gunner': 'M11 12h22v24H11zM33 24h16M42 17l7 7-7 7M19 18l-3 7h8l-3 7',
  'mutation:blinker': 'M12 13h13v22H12M44 13H31v22h13M22 24h12M28 18v12M7 8h8M41 40h8',
};
export function archiveMark(id: string) {
  const path = id.startsWith('enemy:') ? machinePaths[id.slice(6) as EnemyKind] : otherPaths[id];
  return path
    ? '<svg class="mod-mark" viewBox="0 0 56 48" aria-hidden="true"><path d="' + path + '"/></svg>'
    : '';
}
