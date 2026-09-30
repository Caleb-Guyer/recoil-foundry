# Weapon Mastery 3.17.0 validation

## Rules and persistence

The three new commendation IDs and cosmetic styles use the existing validated progress store and backup format. Discovery gates apply in both the Logbook and Appearance. Earned reports remain visible even if an old backup lacks the associated discovery. No checkpoint schema, campaign generation, damage, enemy behavior or Daily/Practice rule version changes.

Per-boss damage totals use accepted credited HP loss after armor, capped at remaining health. Each boss has its own denominator; unrelated bosses, uncredited hits and cleanup cannot contribute bank credit. Provenance is attached only after a friendly gun projectile's actual surface rebound or portal traversal, and separately to each traced beam segment. Shell, Fuse, cluster, aftershock, splinter, surface-saw and portal-resonator payloads retain their originating path; unrelated arcs, Death Bloom volleys and environmental chains do not invent travel. Reflected hostile rounds are excluded from weapon-path credit.

Airborne kills use physical support checks, sampled before and after physics and at each kill. Landing between kills resets the streak. Room load, Continue, death and return to title discard partial evidence; pause retains it. Earned rewards persist immediately. Normal runs, Security, Daily and Overtime can qualify; Practice, Workshop and test presets cannot.

## Checks

- 19 focused Weapon Mastery tests cover exact-half damage, armor/overkill, real ricochets, separate boss totals, six-kill streaks, stale movement flags, ground contact, actual portal travel and killing blows, shell/fragment/beam provenance, reflected/allied exclusions, piercing multi-kills, reset/mode guards, discovery gates, backup restore and strict preview links.
- The focused suite including existing boss mastery, commendations, Logbook, Torch, portals, demolition and Grindshot: **140 passed**, zero failures.
- TypeScript and production build pass. The existing Vite large-chunk advisory remains.
- The ordinary-input audit runs eight seeds per challenge with legal room-count builds, unchanged health, physical obstacles, enemies and AI. [Bank Job](weapon-mastery-bank-job-3.17.0.json) earns the reward in six of eight attempts; both other attempts defeat the Loader without meeting the ricochet share. [Air Traffic](weapon-mastery-air-traffic-3.17.0.json) earns the reward in all eight attempts. [Special Delivery](weapon-mastery-special-delivery-3.17.0.json) earns it in two of eight attempts, including one using just two portal placements; the other attempts end in death or a room clear below the delivery threshold. These are pilot results, not human win rates or universal room suitability.

Reproduce each eight-seed sample with `node --experimental-strip-types scripts/weapon-mastery-audit.ts bank-job`, replacing the final argument with `air-traffic` or `special-delivery`. The script observes counters and sends ordinary movement, aim, fire and portal-request inputs. It does not inject damage, change health, reposition bodies or disable enemies. Air/portal probes stop once the requested award is earned, so their remaining room-clear flags are intentionally false.

## Browser checks

The in-app browser verifies the final local production build at 1280×720: all three selectable finishes have distinct markings and correct captions; the Logbook shows the new objectives/rewards and authored reports. The unmodified empty profile still has one known equipment entry and hides all three mastery names. Preview finish selections remain temporary. The Special Delivery link starts at `TEST · 10 / 20`, exposes its portal controls, pauses correctly and reports no browser warning/error logs. No public profile is imported or replaced. Fresh physical standalone-browser/hardware tests are not claimed.

The full suite, final browser scope and publication receipts will be recorded after completion.
