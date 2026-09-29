# Loader ledge regression — 3.13.1

## Report and reproduction

[GitHub issue #4](https://github.com/Caleb-Guyer/recoil-foundry/issues/4) reports camping above the Loader while bouncing Bank Shot rounds off the ceiling. Before the fix, a player holding position on each of the three authored shelves, in both mirrors, remained at 100 health for 20 seconds. The Loader started no attack warnings and fired no bolts in all six cases.

Its hypothetical firing-angle search could reverse during the hop and send it back beneath the platform. Small props could also support a tread between its three grounding probes, leaving the AI unable to jump.

## Fix and checks

A transient per-enemy climb plan holds a physical route around the shelf after the player stays on it for 0.6 seconds. The Loader clears its full hull vertically before steering across, with jump strength calculated for gravity and air drag. The plan is discarded when the player leaves, its platform disappears, or the Loader lands on top. A descent plan follows players back to the floor, including stepping past hanging cargo that catches the descent. A hull-width ground ray detects narrow physical supports during these maneuvers; ordinary charge and low-bumper timing retain the original grounding checks. Existing attack warnings, armor, crash recovery and player weapon balance remain unchanged.

- `tests/loader-perches.test.ts`: 54 perch positions (three shelves × two mirrors × three player offsets × three approach offsets), with real Matter collisions, bounded per-step travel and no terrain penetration.
- Six sustained ceiling Bank Shot cases. A stationary shooter can no longer stall or kill the Loader from an untouched perch.
- Six escape cases: no contact damage during the approach, the full 0.9-second ram warning, and an ordinary jump/movement escape without damage.
- Pause/hitstop, abandoned targets and retry reset.
- Six returns from a shelf to the player on the floor, and six brief landings/jumps that retain the ordinary response.
- Existing Loader arena, boss-pressure, area-boss and Crane suites: both first bosses remain beatable with ordinary input; Crane platform/corner coverage and later-boss cover-pressure checks pass.

The focused files, `game.test.ts`, and `release-balance.test.ts` passed **98 distinct tests** locally (97 together, then the final six-test perch file including its added brief-landing check). All 15 scripted weapon campaigns reached extraction, as did the campaign and preserved Daily 78 with actual rewards/current encounters. The latter finished with 52 health. No campaign assertions or pilot controls were changed. These are automated simulation checks, not a new Chromebook hardware test.

An additional six-case probe used Heavy Hitter + Hair Trigger + Bank Shot from near each shelf edge. Real banked rounds damaged the Loader, but it reached and damaged the stationary shooter in every case. This checks the higher-damage early build without changing the live gun's balance.

The production build passed TypeScript and Vite. The existing large shared-chunk warning remains. In the embedded browser, the local production preview started the isolated Loader fight, paused, and showed version 3.13.1. Its stored Room 1 / 65 discoveries / no Practice victories, blueprints or records remained intact. Pointer activation was unreliable in this tool session; keyboard activation worked. This is a tooling limitation, not evidence of a game input regression.

## Published artifact and host checks — 28 September 2026

- Runtime commit: `dcb008d461aeeec8c66482f1c04d07fe142b52cd`.
- [Pages CI](https://github.com/Caleb-Guyer/recoil-foundry/actions/runs/36503320607): **2,103 tests passed**, zero failed, cancelled or skipped; production build and deployment passed. Test duration was 818.079 seconds.
- [Release workflow](https://github.com/Caleb-Guyer/recoil-foundry/actions/runs/36504684578): passed for tag `v3.13.1` on that exact runtime commit, including its successful-Pages-CI gate.
- [Official archive](https://github.com/Caleb-Guyer/recoil-foundry/releases/tag/v3.13.1): `recoil-foundry-v3.13.1-site.zip`, 9,791,234 bytes, SHA-256 `aecefa357079c03b478c1050cbcf24952c5fc049cb91ce9972cd7a20548ffbaf`. Download size and GitHub's digest matched. Its 17 files include root `index.html` and four valid relative entry assets, with no source, tests, dependency tree, source maps or traversal entries.
- itch.io upload `19458588` uses those same verified bytes, retaining the historical replacement filename and displaying **Recoil Foundry 3.13.1 — Loader ledge fix**. The browser-playable checkbox was checked and the editor confirmed Saved.
- Both public players visibly showed **3.13.1** in About & credits. Pages retained Room 2 / 1 discovery / no Practice victories, blueprints or records. itch.io retained Continue daily, Room 1 / no discoveries, Practice victories, blueprints or records. Existing Sound/Music settings were preserved; the updated itch.io player reported no console errors during this check.

Issue #4 is closed as completed. No save schema or weapon balance changed. The previous stable 3.13.0 release remains available for rollback; publication checks for this patch are complete.
