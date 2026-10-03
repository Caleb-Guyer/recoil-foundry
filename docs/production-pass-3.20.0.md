# Foundry Archive production pass

Verified on 2 October 2026 for version 3.20.0.

## Final polish

The Logbook's empty New filter previously said "No records recovered" even when the player already had a collection. It now says "No new records" and explains that the player is caught up in that view. Empty Locked and Undiscovered filters also describe the selected filter accurately. Search still explains how to recover from an unmatched query.

The search field's accessible label now matches "Find a record," including locked achievement cards. Empty equipment and machine views describe encounter-based discovery: taking an upgrade or defeating a machine is not required to recover its record.

This pass changes menu copy only. The previously validated combat, reward pools, achievements, saves, historical replays and Daily rules remain intact.

## Production verification

- GitHub's [test, build and Pages deployment workflow](https://github.com/Caleb-Guyer/recoil-foundry/actions/runs/37079968288) succeeded for the preceding runtime commit `92f8dd35b5079227c1e3c573e2e56e2d2f4db67a`. The deployed page served the matching production JavaScript and CSS assets with HTTP 200.
- The deployed game opened the Logbook, displayed exact locked achievement progress, and opened Settings → Progress with its saved checkpoint and backup/import actions available. This live check did not replace or restore the player's saved progress.
- The final local production build and TypeScript check passed. All **85 focused regression tests** passed, covering progression, archive acknowledgments, backups and restore, recap compatibility, Logbook records, keyboard/controller menus, issue reports and release packaging.
- The final production build was tested using isolated fresh and completed profiles. Empty New, Locked, Undiscovered and unmatched-search views showed the correct messages. The search field exposed the updated accessible name.
- Desktop and compact browser checks used 1280 × 720 and 320 × 568 viewports. The compact Logbook had no horizontal overflow and kept Back reachable. Browser console checks reported no warnings or errors.

The [release validation](releases/3.20.0.md#validation) already passed all 2,227 tests, including all 9,216 complete builds in the exhaustive Workshop physics check and all 6,328 dependency-closed upgrade pairs in the compatibility audit. This copy-only pass does not change those build combinations or physics paths.

The existing large JavaScript chunk build warning remains. Physical controller/touch testing and broader player balance feedback remain useful; browser viewport checks are not physical device tests. Pushing this final pass to main starts the normal GitHub Pages test/build/deploy workflow.
