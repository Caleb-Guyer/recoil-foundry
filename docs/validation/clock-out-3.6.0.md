# Clock Out 3.6.0 validation

## Scope

Overtime's final escape enters the safe end of the existing departure layout at x6500, preserving the physical lift and checkpoint format. The ordinary campaign, Daily and first-lap New Game+ lifts retain their existing behavior. Overtime no longer emits timed collapse feedback during departure. Final-room rain fades over three seconds after clear; lightning already stops on clear.

At boarding, the existing commendation tracker awards After Hours while the run remains eligible. Checkpoint removal and the won transition happen immediately. The main UI captures run history and lore, waits for the existing profile write queue to settle, then releases a separate twelve-second presentation clock. Failed writes retain the existing save warning and do not trap the player. A skip requested while saving is honored when the queue settles. The result screen waits for presentation completion; the run and simulation clocks stay frozen. New runs and title reset the presentation object, so an old asynchronous save completion cannot revive it.

The lift shows deterministic silhouettes of Rooftops, Reclamation, Cooling, Furnace and Docks. Reduced effects uses stationary dissolves. The score is four bars at 80 BPM with a final D-major resolution; it follows music settings and focus state. Night Shift is the existing After Hours reward, without automatic equipping or duplicate unlocks. The real final gun uses existing weapon art.

## Checks

Nine added automated checks cover valid/strict preview URLs, retry and progress isolation, immediate victory and single reward, skip-before-save, repeated skip, reset, invalid/long frame deltas, background freeze, unassisted departure traversal, persisted victory/reward/checkpoint removal after reload, storage failure, twelve-second score structure, and audio cancellation on result/focus loss/mute. The final 58 focused finale, audio, extraction and presentation checks pass. Existing escape, Overtime, commendation and audio checks also pass.

Local production-browser checks verified the ride, daylight arrival, completed reward screen, Again, button skip, Escape and Enter skip, reduced-effects dissolves, and an 800×450 viewport. At compact height the result dialog scrolls; its actions remain reachable. Test previews left no saved run and zero discoveries, Practice victories, blueprints or Practice records. Reduced effects was restored to Off. Browser warning/error logs were empty.

The local full suite passed all 1,987 tests with zero failures or skips in 320,417.6648 ms. Final camera-start and save-gated music adjustments then passed the 58 focused checks and a fresh TypeScript/production build. The existing large-chunk advisory remains. Publication evidence will be recorded after deployment. Physical controller/touch testing and independent listening/playtester feedback were not performed for this change.
