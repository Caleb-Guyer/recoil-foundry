# Factory Uprising room and interface verification

Version 4.0.1, 3 October 2026.

## Room design and pacing

All eleven jobs now have distinct authored geometry rather than sharing one flat corridor. Structural checks cover terrain, patrol hulls, props, supported objectives, warning sites and the final 220 units reserved for exits. Machinery is sampled through its complete travel: moving cars do not intersect fixed platforms, and Core sabotage leaves at least 44 units of floor clearance for the 36-unit player body. Narrow standing corridors are rejected.

Ordinary-input pilots complete each objective and physically reach its normal reward door, with normal health and enemy behavior. Prototype train takes about 11 seconds, and Last train out takes about 12 seconds with either the preset gun or the starting gun in these fixtures. Defense jobs take roughly 23–32 seconds, including approach, activation, defense and departure. These are regression-pilot measurements, not a required minimum time for skilled players.

Evacuation checks reject a five-second floor rush, interaction through a supporting platform, out-of-order switches and treating the ordinary exit as the boarding pad. Successful boarding can leave patrol enemies alive without crediting false kills. Late arrival, job abandonment, Continue, pause and extraction retain their progression behavior. Boarding geometry is absent after changing rooms or entering final extraction.

Six full campaigns exercise all four final defenses plus Freight surge and Power failure. They use real upgrade choices, normal inputs and the existing Factory fixtures; checkpoints emitted by the finale campaigns pass the normal validator. Authored missions retain Security squads while preserving their own terrain and objective placements.

## Interface

The Core choice screen was checked at the size of the reported screenshot. Compact cards show each objective and consequence without the oversized symbol, repeated district name or duplicated health bonus. The campaign map and finale status remain available through a collapsed Campaign progress section. Keyboard route selection still leads to the normal fitting reward.

Browser checks cover two-card and unlocked three-card menus at 784 × 760, narrow-screen scrolling at 320 × 568, expanded progress, mission instructions and distinct boarding/exit locations at 2200 × 900. No browser warnings or errors were recorded. Objective props use a single drawing pass and resolved props no longer remain visible. District banners keep their short name and omit the duplicated generic mission paragraph.

## Automated validation

The final release regression run passed 2,262 of 2,262 tests, covering every test file except `tests/max-combos.test.ts`. The 36-test Uprising suite includes complete mission-to-exit playthroughs, all finale campaigns, machinery clearance and compatibility checks. TypeScript checking, the production build, release-note generation, formatting and Git whitespace checks passed.

The exhaustive Workshop build check remains part of the full GitHub Pages workflow. It was not rerun locally because gun calculations and Workshop physics are unchanged. The existing large branch-builds chunk warning remains; controller and touch remain experimental.
