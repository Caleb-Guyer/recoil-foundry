# Boss mastery — validation

The feature adds two fight-local mastery records, two independently selectable cosmetic rewards and two factory incident reports. Both requirements and locked appearances are hidden until the corresponding recorded boss defeat. Earning a challenge on the first victory also reveals its report.

## Behavior checks

Focused regressions cover actual Loader ram attribution in both mirrored arenas; shots, phase-triggered collapses and cut cables; complete Crane hull crossings in both directions; real upward projectile/continuous-beam recoil; killing recovery hits; missed recovery windows, ordinary jumps, landings, elevated camping, ground contact, partial crossings and portals; unrelated bosses; death, cleanup, uncredited kills, Practice, isolated tests, Workshop and room reload; hidden requirements; independently locked cosmetics and backup/restore.

Eight scripted real-arena attempts use three legal upgrades and only ordinary movement, jump, aim and fire inputs after loading the room. Both challenges were earned with projectile and beam guns in both mirrors. All eight cleared their fight; the Crane finishes retained 4–28 health. AI, health, damage, terrain, physics and enemy positions were not altered. These are reproducible scripted feasibility checks, not independent human playtests.

Reproduce with `node --experimental-strip-types scripts/boss-mastery-audit.ts`. The [eight results](boss-mastery-inputs-3.15.0.json) preserve seeds, builds, health and awards. `recoveryHits` is an observation counter of credited hits after the Crane maneuver first qualified; it is not a count of separate recovery windows or repeated unlocks.

The initial generic combat pilot earned the Crane maneuver but died before winning. A pilot that continued reacting to the Crane’s sweep warnings completed the fights. Production combat was not weakened to accommodate the pilot. Early diagnostic beam loadouts contained two unrecognized names and were discarded; the final audit validates every upgrade choice.

The local browser preview verifies both reports, Appearance navigation and temporary reward selection. The desktop character preview stays pinned while the options scroll. Existing earned styles and save formats remain compatible.

Returning from the temporary reward preview to the ordinary local game shows 0/9 earned, with both new requirements hidden. The public Pages save before deployment shows Room 2, one discovered upgrade and zero Practice victories, blueprints and records. No saves were erased or imported for these checks. Local browser warning/error logs were empty.

The initial long local suite reported 2,134 passes and one obsolete assertion expecting all commendations to appear in a fresh Logbook. The corrected hidden-entry assertion and all affected regressions pass: 49 Loader/Crane/Logbook checks, followed by 44 final mastery/commendation/lore checks including the additional landing regression. The production build and type check pass. The initial CI candidate was superseded by a small accessibility correction that prevents repeatedly rewriting an unchanged live-region notification; the tagged release must pass the complete suite on that final commit.

## Release evidence

Runtime commit **`81ad220b41ad4961e2443e2d2c524534dcc3a101`** passed **2,136 tests**, with zero failures, cancellations or skips, in **1,148.941 seconds**, followed by build and deployment in [Pages CI](https://github.com/Caleb-Guyer/recoil-foundry/actions/runs/36513369737). The exhaustive maximum-build simulation accounted for the long run. The earlier candidate `c54e355` was cancelled and never tagged.

Tag **v3.15.0** passed the [release workflow](https://github.com/Caleb-Guyer/recoil-foundry/actions/runs/36514983547), which verifies that exact commit's successful Pages run before packaging.

- Archive: `recoil-foundry-v3.15.0-site.zip`, **9,795,074 bytes**.
- SHA-256: **`960506ce7c9d3c58f60dc99b338be9e08dadcb51191c5f9bf3d38cd454b947cc`**; downloaded bytes and size match GitHub's release digest.
- Archive inspection: **17 files**, root `index.html`, four present relative entry references, no source/dependencies/source maps or traversal paths.
- itch.io upload **19460201**, displayed as **Recoil Foundry 3.15.0 — Boss mastery**. The verified archive was copied byte-for-byte under the historical upload basename to replace the existing build. Browser-playable status was restored and the editor saved.
- Pages About reports **3.15.0**. Crane startup, pause and retry work; the public reward preview opens both styles. The existing Room 2 save and discovery/Practice/blueprint counts remain intact. Browser warning/error logs are empty.
- The public itch.io player loads upload **19460201** and its About panel reports **3.15.0**. Continue daily remains available; Progress retains Room 1 with zero discoveries, Practice victories, blueprints and records. Settings and Progress controls work; warning/error logs are empty. This is an in-app-browser check, not a new physical Chrome/Edge/Firefox acceptance run.

The public cosmetic preview is captured in `outputs/recoil-foundry-3.15.0-published.png` in the task workspace. Preview selections do not unlock or persist rewards.
