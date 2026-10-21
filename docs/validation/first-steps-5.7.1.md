# First steps 5.7.1 validation

## Automated checks

The focused first-session and upgrade-preview suite passes **22 tests**. It covers real-input movement, jump, fire, downward recoil and target learning; actions learned out of order; guidance remaining available to slow readers; pause, later-room and dismissal guards; controller/touch copy; and harmless warm-up behavior.

The three new preview links reject unknown, duplicate, mixed and unsupported parameters. Their pistol checkpoints have no starting upgrades and cannot save, grant Logbook progress or create a run recap. The upgrade scene uses the actual reward screen and accepts the normal Scattershot fitting. Unrelated isolated tests do not receive first-room guidance.

Existing comparison tests exercise every offered fitting and starting gun, native shotgun/nailgun output, beam/explosive/stored/rail/ball/portal previews, cleanup and isolation from the real pending reward and its random stream.

`npm run build`, formatting and `git diff --check` pass. The existing large-chunk advisory remains. Full regular regression and all eight maximal-build shards are required by Pages CI before deployment; the tagged release workflow requires a successful Pages run for its exact commit before packaging.

## Production browser checks

Checked the production preview at 1280 × 720 using ordinary browser controls:

- The first reward opens with a visible native before/after comparison before hovering a card. Keyboard focus changes Heavy hitter → Scattershot → Hair trigger. Moving focus to Reroll retains the comparison and does not choose a fitting.
- First-room movement changes the single hint from moving to jumping. Pause hides it, Resume restores it, and Hide first-run tips removes it.
- Returning to the title after dismissal still shows Learn to play, which opens the safe warm-up.
- The direct warm-up preview opens the same real pistol warm-up, with Controls and Done available.

Screenshots are stored in the workspace's `First Steps 5.7.1` folder. These checks do not claim controller hardware, mobile certification or a new human playtest. Public deployment and itch.io publication must be verified against the exact released commit and live About screen.
