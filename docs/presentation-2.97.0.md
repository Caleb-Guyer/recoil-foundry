# Presentation, sound and endings · 2.97.0

20 September 2026. Item 6 implementation and available software/browser checks. Daily ruleset 78 and gameplay balance are unchanged.

## What changed

- Reward grids can shrink without spilling horizontally. Narrow Reforge cards keep the surrendered fitting, its effect, the arrow and replacement in one reading column.
- Workshop now gives its scrolling Build/Appearance panel and action buttons separate space. On short screens the buttons no longer paint over selectable content. Small title screens keep their navigation in normal layout flow; the Logbook gives more space to the document at intermediate widths and short heights.
- All three campaign endings have distinct closing copy and consistent Again, Menu, Logbook and Credits actions. The normal ending does not reveal the alternate routes. Credits opened from an ending return to that result; credits opened from Pause return to a still-paused run. Keyboard focus returns to the launching control.
- Settings → About & credits includes the running version, creator, original audio description, source and shipped licenses. Credits, backups and diagnostic reports now share the package version. No extra combat HUD text was added.
- Auditor tells/recalls, live charge ticks and approaching trains now use reserved warning voices and duck ordinary effects/music. Longer cues keep the mix lowered through their complete sounded phrase. A later short warning cannot restore the effects mix before an earlier long warning finishes.
- Completion, defeat and shutdown cues can use reserved voices after dense gunfire. Existing mute switches, volume settings, voice limits, compressor, music cancellation and context unlock behavior remain intact.
- Corrected the contextual Backfire/Crosshatch description: the penalty is **20% longer shot delay**, not 20% slower firing. No mechanics changed.

## Browser soundtrack decision

Retain the current original procedural score as the browser release soundtrack. Its five authored area phrases use different tempos and arrangements; percussion/intensity follows combat, cleared rooms settle, and attack cues lower the music. No replacement soundtrack is required for this release. A commissioned soundtrack remains possible for a later update or the Steam remake.

The software mix uses a shared output compressor, bounded voice counts, separate music/effect volume controls, reserved warning voices and warning-driven gain automation. These properties have regression coverage. **Physical headphone and laptop-speaker listening was not performed.** That human acceptance check remains visible in checklist section 7, with no claim that it passed or was waived.

## Review coverage

The browser UI review used the in-app Chromium browser at 1280×720, 960×600, 800×450 and 390×844 across the reviewed screens. Small dimensions check graceful layout, not a new promise of touch-device support.

Reviewed title navigation, Settings/Pause, Controls, Progress, reward choices, multi-part Reforge descriptions, Logbook records/commendations, Workshop/Appearance, expanded Recent runs recaps and the three ending screens. Checked credits return paths with both Back and Escape, temporary cosmetic selection, reachable scrollable content and horizontal bounds. Existing Practice, replay and reward behavior also retain their regression coverage; this is not a claim of new physical input certification.

Combat review retained the existing bright player silhouette, separate enemy/ally markings, outlined hostile projectiles, readable terrain edges, local particle fading around threats and reduced-effects warning geometry. No enemy attacks or warning timing were changed. Extraction and shutdown progression, automatic departure, paused transitions, reward grants and isolation are covered by the existing encounter tests.

Read the 100 base upgrade descriptions, contextual beam/branch descriptions and authored equipment/factory/commendation lore. Records retain the established factory writers and setting. Existing catalog tests verify complete, distinct records, no placeholders and spoiler-safe discovery. Aside from the delay wording above, no further content change was needed.

## Verification

- Full suite: **1,556 tests passed**, zero failures (118.6 seconds).
- Added regressions: all three preview endings are valid isolated checkpoints; previews cannot write saves, create run records, earn commendations or finish ordinary runs; threat and ending cues survive saturated effects; short warnings cannot truncate longer audio ducking.
- **67 focused tests passed** after final copy/audio refinements; TypeScript and production build passed. The existing shared-chunk size advisory remains.
- The support scope and unresolved performance limitations from item 5 are unchanged. This pass does not replace external playtests or hardware listening.

## Test links

[Play the game](https://caleb-guyer.github.io/recoil-foundry/?v=2.97.0). Open Settings → About & credits for version and credits.

Isolated visual checks do not change campaign saves or unlock rewards:

- [Normal result preview](https://caleb-guyer.github.io/recoil-foundry/?test=presentation&scene=escape&v=2.97.0).
- [Overtime result preview](https://caleb-guyer.github.io/recoil-foundry/?test=presentation&scene=overtime&v=2.97.0).
- [Alternate ending preview — spoilers](https://caleb-guyer.github.io/recoil-foundry/?test=presentation&scene=shutdown&v=2.97.0).
- [Reforge layout](https://caleb-guyer.github.io/recoil-foundry/?test=reforge&build=beam&v=2.97.0).
- [Appearance/commendation samples](https://caleb-guyer.github.io/recoil-foundry/?test=commendations&v=2.97.0).

Ending previews deliberately show sample totals and do not simulate a completed campaign. Actual extraction/shutdown sequencing is exercised separately by the encounter tests.
