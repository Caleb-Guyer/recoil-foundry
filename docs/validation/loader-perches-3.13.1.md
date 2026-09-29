# Loader ledge regression — 3.13.1

## Report and reproduction

[GitHub issue #4](https://github.com/Caleb-Guyer/recoil-foundry/issues/4) reports camping above the Loader while bouncing Bank Shot rounds off the ceiling. Before the fix, a player holding position on each of the three authored shelves, in both mirrors, remained at 100 health for 20 seconds. The Loader started no attack warnings and fired no bolts in all six cases.

Its hypothetical firing-angle search could reverse during the hop and send it back beneath the platform. Small props could also support a tread between its three grounding probes, leaving the AI unable to jump.

## Fix and checks

A transient per-enemy climb plan holds a physical route around the shelf. The Loader clears its full hull vertically before steering across, with jump strength calculated for gravity and air drag. The plan is discarded when the player leaves, its platform disappears, or the Loader lands on top. A hull-width ground ray detects narrow physical supports. Existing attack warnings, armor, crash recovery and player weapon balance remain unchanged.

- `tests/loader-perches.test.ts`: 54 perch positions (three shelves × two mirrors × three player offsets × three approach offsets), with real Matter collisions, bounded per-step travel and no terrain penetration.
- Six sustained ceiling Bank Shot cases. A stationary shooter can no longer stall or kill the Loader from an untouched perch.
- Six escape cases: no contact damage during the approach, the full 0.9-second ram warning, and an ordinary jump/movement escape without damage.
- Pause/hitstop, abandoned targets and retry reset.
- Existing Loader arena, boss-pressure, area-boss and Crane suites: both first bosses remain beatable with ordinary input; Crane platform/corner coverage and later-boss cover-pressure checks pass.

The five focused files passed **56 tests** locally. Full CI and public-host verification are recorded after deployment. These are automated simulation checks, not a new Chromebook hardware test.
