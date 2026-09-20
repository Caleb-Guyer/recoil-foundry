# Browser release closeout — 2.98.0

20 September 2026 · Stable browser release · Daily ruleset 78

The owner requested: “Ok in one final pass finish the game.” Together with the preceding instruction to do the best available work when human checks could not be performed, this closes the browser launch under the documented desktop support scope. External observation and physical listening are deferred from the launch requirements. They are not represented as completed tests.

## Finished release

The full twenty-room campaign, five areas, 100 upgrades and branching paths, bosses, optional routes/events, Daily, Overtime, Practice, Workshop, Logbook, recaps, death replays and endings are included. This final pass promotes the verified release candidate without changing combat balance, progression, Daily identity or save schemas.

The player README, credits/version, issue reporting, media kit, announcement draft and support information are in place. The release checklist has no remaining launch tasks. Future content and tuning can be ordinary updates.

## Final verification

- Full automated regression suite: **1,562 tests passed**, no failures or skips. Coverage includes campaign/upgrade interactions, Daily rewards, progress recovery, input settings, bosses/routes, replay behavior, presentation and release packaging.
- TypeScript and Vite production build passed. The existing large shared-chunk warning remains documented; it does not prevent the build.
- Runtime dependency audit: **zero reported vulnerabilities** from `npm audit --omit=dev`. This is a dependency-advisory check, not a claim that all possible security issues have been excluded.
- GitHub open-issue triage found no open bug reports at the start of this pass.
- Browser smoke review covers the title, Controls/warm-up, Pause, Settings, version/credits, issue reporting, Daily identity and ending navigation. Isolated previews preserve campaign progress; physical device acceptance is not implied.
- Stable release packaging validates the exact package version/tag, requires a successful Pages workflow for the same commit on main, and marks stable releases as latest while retaining RC prerelease status.
- Published game, release status and downloadable static-site archive are verified after deployment. Public [Pages checks](https://github.com/Caleb-Guyer/recoil-foundry/actions/workflows/deploy.yml) and [release checks](https://github.com/Caleb-Guyer/recoil-foundry/actions/workflows/release.yml) record their commit and results.

## Accepted limitations

No external first-time-player sessions, human first-win/run-duration measurements, full-route readability/replayability judgments, or physical headphone/laptop-speaker listening were available. The observation forms remain blank and available for optional future feedback. These checks were removed as mandatory launch gates in response to the owner's final-release direction.

The established target is Windows desktop/laptop with keyboard and mouse. Coverage differs between Edge, Chrome and Firefox. Low-end hardware, physical controllers/touch, Safari, macOS and Linux remain unverified. Existing stress hitches and the unresolved long-session embedded-browser slowdown remain documented in the [support list](browser-support.md); stable publication does not mean those limitations were fixed.

## Release and recovery

- Stable tag: [v2.98.0](https://github.com/Caleb-Guyer/recoil-foundry/releases/tag/v2.98.0).
- Previous verified candidate: `v2.98.0-rc.1`, source `ce13cc258e26c13f5504856e76b458a17d3cdb1a`.
- Earlier rollback point: `browser-rollback-2.97.0`.
- The release includes a static-site ZIP; serve its extracted files over HTTP. No installation or account is needed for the public play link.
- [Release operations](release-operations.md) explains incident triage and reverting a failing commit without rewriting history or touching player saves.

[Play the full browser release](https://caleb-guyer.github.io/recoil-foundry/?v=2.98.0).
