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

The focused files, `game.test.ts`, and `release-balance.test.ts` passed **98 distinct tests** locally (97 together, then the final six-test perch file including its added brief-landing check). All 15 scripted weapon campaigns reached extraction, as did the campaign and preserved Daily 78 with actual rewards/current encounters. The latter finished with 52 health. No campaign assertions or pilot controls were changed. Full CI and public-host verification are recorded after deployment. These are automated simulation checks, not a new Chromebook hardware test.

An additional six-case probe used Heavy Hitter + Hair Trigger + Bank Shot from near each shelf edge. Real banked rounds damaged the Loader, but it reached and damaged the stationary shooter in every case. This checks the higher-damage early build without changing the live gun's balance.

The production build passed TypeScript and Vite. The existing large shared-chunk warning remains. In the embedded browser, the local production preview started the isolated Loader fight, paused, and showed version 3.13.1. Its stored Room 1 / 65 discoveries / no Practice victories, blueprints or records remained intact. Pointer activation was unreliable in this tool session; keyboard activation worked. This is a tooling limitation, not evidence of a game input regression.
