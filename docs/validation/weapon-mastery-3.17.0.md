# Weapon Mastery 3.17.0 validation

## Rules and persistence

The three new commendation IDs and cosmetic styles use the existing validated progress store and backup format. Discovery gates apply in both the Logbook and Appearance. Earned reports remain visible even if an old backup lacks the associated discovery. No checkpoint schema, campaign generation, damage, enemy behavior or Daily/Practice rule version changes.

Per-boss damage totals use accepted credited HP loss after armor, capped at remaining health. Each boss has its own denominator; unrelated bosses, uncredited hits and cleanup cannot contribute bank credit. Provenance is attached only after a friendly gun projectile's actual surface rebound or portal traversal, and separately to each traced beam segment. Shell, Fuse, cluster, aftershock, splinter, surface-saw and portal-resonator payloads retain their originating path; unrelated arcs, Death Bloom volleys and environmental chains do not invent travel. Reflected hostile rounds are excluded from weapon-path credit.

Airborne kills use physical support checks, sampled before and after physics and at each kill. Landing between kills resets the streak. Room load, Continue, death and return to title discard partial evidence; pause retains it. Earned rewards persist immediately. Normal runs, Security, Daily and Overtime can qualify; Practice, Workshop and test presets cannot.

## Checks

- 19 focused Weapon Mastery tests cover exact-half damage, armor/overkill, real ricochets, separate boss totals, six-kill streaks, stale movement flags, ground contact, actual portal travel and killing blows, shell/fragment/beam provenance, reflected/allied exclusions, piercing multi-kills, reset/mode guards, discovery gates, backup restore and strict preview links.
- The focused suite including existing boss mastery, commendations, Logbook, Torch, portals, demolition and Grindshot: **140 passed**, zero failures.
- Full local suite: **2,169 passed**, zero failures/skips/cancellations. This run began before the final preview-seed and notification-timing adjustments; their 19 focused tests and production build passed afterward. The exact runtime commit's Pages CI is the publication gate.
- Final exact-commit [Pages CI](https://github.com/Caleb-Guyer/recoil-foundry/actions/runs/36657268063): **2,169 passed**, zero failures/skips/cancellations, followed by a successful build and deployment. Runtime commit: `234303f2c3ae510f52e850c57b89754fd53e186f`.
- TypeScript and production build pass. The existing Vite large-chunk advisory remains.
- The ordinary-input audit runs eight seeds per challenge with legal room-count builds, unchanged health, physical obstacles, enemies and AI. [Bank Job](weapon-mastery-bank-job-3.17.0.json) earns the reward in six of eight attempts; both other attempts defeat the Loader without meeting the ricochet share. [Air Traffic](weapon-mastery-air-traffic-3.17.0.json) earns the reward in all eight attempts. [Special Delivery](weapon-mastery-special-delivery-3.17.0.json) earns it in two of eight attempts, including one using just two portal placements; the other attempts end in death or a room clear below the delivery threshold. These are pilot results, not human win rates or universal room suitability.

Reproduce each eight-seed sample with `node --experimental-strip-types scripts/weapon-mastery-audit.ts bank-job`, replacing the final argument with `air-traffic` or `special-delivery`. The script observes counters and sends ordinary movement, aim, fire and portal-request inputs. It does not inject damage, change health, reposition bodies or disable enemies. Air/portal probes stop once the requested award is earned, so their remaining room-clear flags are intentionally false.

## Browser checks

The in-app browser verifies the final local production build at 1280×720: all three selectable finishes have distinct markings and correct captions; the Logbook shows the new objectives/rewards and authored reports. The unmodified empty profile still has one known equipment entry and hides all three mastery names. Preview finish selections remain temporary. All three challenge links start and pause correctly. Bank Job's gun lists Bank shot, Banker and Heavy hitter; Air Traffic and Special Delivery start at `TEST · 10 / 20`, and Special Delivery exposes its portal controls. No browser warning/error logs appear. No public profile is imported or replaced. Fresh physical standalone-browser/hardware tests are not claimed.

Before replacing the itch.io upload, its existing profile shows Continue daily and Room 1, with zero discovered upgrades, Practice victories, blueprints and Practice records. Its Sound and Music controls are enabled. These UI values provide the before/after publication comparison; no progress file is imported or replaced.

## Publication

Both public About panels report **3.17.0**. GitHub Pages retains its room 2 save, one discovered upgrade and zero Practice victories, blueprints and Practice records. itch.io retains Continue daily, its room 1 save and the zero counts above. Sound and Music remain enabled on both. The public Pages preview shows all 13 sample commendations, including the three new objectives, rewards and reports. Both public tabs have empty warning/error logs during these checks.

All four preview links return HTTP 200 and current entry assets. The three entry JavaScript/CSS files match the final local build by SHA-256. Tag `v3.17.0` passed the [release workflow](https://github.com/Caleb-Guyer/recoil-foundry/actions/runs/36658926556). Its [official archive](https://github.com/Caleb-Guyer/recoil-foundry/releases/tag/v3.17.0) contains 17 files, a root `index.html`, all four referenced entry assets and no source/test/dependency directories, source maps or path traversal.

The archive's **9,802,183 bytes** and SHA-256 **`fa735b3e515751df0dce32bd164b4838e5092b6e0feef2bdf85c06b8478c4ca5`** match GitHub's metadata. [Artifact receipt](weapon-mastery-3.17.0-artifact.json). An identical copy replaced the existing itch.io browser upload under its historical basename. The new upload is **19477711**, displayed as **Recoil Foundry 3.17.0 — Weapon Mastery**, with browser playback enabled. The editor confirmed Saved and the actual public iframe served this upload. This cumulative release also completes the previously pending Security Levels publication on itch.io. No devlog or public message was posted.

The release description and main-branch notes correct the discovery upgrade's display name to **Bank shot**; the tested runtime and immutable tag are unchanged. Publication is complete.
