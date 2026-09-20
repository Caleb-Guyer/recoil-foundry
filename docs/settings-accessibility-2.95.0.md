# Settings and accessibility — 2.95.0

19 September 2026. Closeout for release checklist item 4. Daily remains ruleset 78; simulation, upgrade balance, rewards and saves are unchanged.

## Controls and preferences

Settings and Pause contain a collapsed **Keyboard & mouse** panel. Every existing movement/jump key can be changed independently, alongside fire, the equipped secondary action, pause, Controls and retry/reset. Defaults preserve A/D, arrows, Space/W/Up, E, P, H and R, with F as an additional keyboard fire option. Mouse aiming and left/right click remain available. Secondary-action naming does not reveal an undiscovered upgrade.

Selecting a key starts capture. Duplicate bindings leave the old assignment intact and name the conflict. Escape cancels capture, Tab cancels and moves focus, and losing focus cancels it. Escape, Tab, Enter, number-row reward shortcuts, modifier shortcuts and browser function keys stay reserved. Pause, Controls and retry also reject keys used for menu navigation; movement, jumping and firing can use arrows or numpad keys. Restore default keys resets only bindings. Invalid saved mappings fall back to a complete usable map. Controls, contextual hints, warm-up tips, canvas labels and retry tooltips follow saved bindings. Native menu keys retain their normal behavior even if assigned to gameplay actions.

Effects and music have separate 0–100% sliders. Zero means muted; the output and accessible value text say so. The existing Sound master and Music enabled switches retain their old values and do not erase channel levels. Raising a slider does not silently override an existing mute switch. Effects volume includes attack warnings and sustained weapon sounds. Warning ducking has a separate gain stage, so it cannot reset the user's volume. Both channels still share the limiter/compressor.

Preferences remain in the existing local settings key. Settings are device-local and are not part of progress backups. Storage failures use the existing visible saving warning.

## Menus, visuals and interruptions

The settings heading and Back/Resume actions remain visible while the middle panel scrolls. Opening Settings focuses Sound at the top; opening Pause focuses Resume. Native dialog focus containment and visible focus outlines remain in place. Controller menu navigation includes modal saving warnings, skips closed disclosures and can adjust sliders; Back cancels a pending rebind. The pause shortcut now respects submenu return routes.

Reduced effects retains spatial attack tells and hostile projectile outlines while removing camera shake, reducing cosmetic particles and common hit flashes, and hiding ejected shells. Existing reduced-motion variants of machinery/boss warnings remain active. OS reduced-motion preferences still set the initial value when no explicit preference exists; UI transitions also respect that OS preference.

Non-color cues audited: hostile rounds use hollow rings/diamonds with pale centers, ally rounds use solid strokes, aiming warnings use dashed/solid paths and arrowheads, and ready machinery uses shoot brackets or a jump arrow. Allies now carry a steady pale shield silhouette above their body as well as blue coloring. Commander crowns remain distinct. These changes add no combat instructions or new HUD text.

Focus loss, page suspension and controller disconnect pause play and clear held input. Returning focus does not resume a run. A changed play-area size or fullscreen event also pauses and clears input; initial ResizeObserver delivery and unchanged dimensions do not. Mouse fire requires release or a fresh press after interruption, and controller release/neutral gating remains in place.

## Verification

Browser checks used a separate local origin in the Chromium-based in-app browser:

| Check              | Observed result                                                                                                                                                                        |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rebinding          | Assigning D to Move left was rejected and named the Move right conflict. J was accepted, survived reload and appeared in the control hint.                                             |
| Cancel/defaults    | Escape canceled Jump capture without closing Settings. Restore default keys returned the canvas/title hints to A/D and preserved audio preferences.                                    |
| Volume persistence | Both sliders at zero showed Muted after reload. Reduced effects stayed checked. Master mute retained 100% slider positions and showed its explanation; unmuting restored those levels. |
| Laptop layout      | At 960×540, Settings opened at the top, scrolled internally and kept its action row visible.                                                                                           |
| Narrow layout      | At 390×740, the expanded binding panel had no horizontal overflow. Keyboard focus scrolled Jump into view; Escape canceled capture. Back/Controls/Progress remained reachable.         |
| Controls/pause     | Controls reflected the current mapping. Returning with P from Controls opened its parent Pause screen instead of unexpectedly resuming.                                                |
| Resize             | Resizing a live safe warm-up from 960×540 to 1000×620 opened Pause and focused Resume.                                                                                                 |
| Combat             | The isolated Turf War test rendered in Reduced effects with the new ally shields and no console errors.                                                                                |

Automated coverage checks mapping validation, JSON round trips, conflict/reserved-key rejection, rebound inputs in the real simulation, complete defaults, volume graph routing, zero-volume silence, independent channels, warning ducking, focus/page/fullscreen event dispatch, resize initialization, controller disconnect/reconnect/neutral gating, menu navigation, and preserved boss/sniper warning geometry. Ally symbols are tested for steady closed silhouettes independent of color.

All **1,538 tests passed**, with no failures or skipped tests. TypeScript and the production build passed; Vite retains its existing large-bundle advisory. Native fullscreen and focus event routes are exercised by automated event dispatch; this was not a physical-controller, native fullscreen or cross-browser certification. Chrome/Edge/Firefox, physical devices, low-end performance, audio listening on real speakers, and human accessibility acceptance remain in the appropriate release-checklist sections.

[Open Settings](https://caleb-guyer.github.io/recoil-foundry/?help=settings&v=2.95.0) · [Safe controls warm-up](https://caleb-guyer.github.io/recoil-foundry/?help=controls&v=2.95.0).
