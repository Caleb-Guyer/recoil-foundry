# Browser release operations

## Practice records 3.0.5 — 25 September 2026

**Published on Pages and itch.io.** Runtime commit `b0b2fe9a326ab8fdb7ec212bdf9df7ff6b73129d` passed all **1,922 tests**, build and deployment in [Pages CI](https://github.com/Caleb-Guyer/recoil-foundry/actions/runs/36185757134). Tag `v3.0.5` passed the [release workflow](https://github.com/Caleb-Guyer/recoil-foundry/actions/runs/36186797071); the verified official ZIP is itch.io upload `19400641`. Both public games show 3.0.5 and preserve existing saves. [Validation and artifact evidence](validation/practice-records-3.0.5.md) records the checksum, record/challenge flows, backup migration/export/undo and test scope.

Practice wins save fastest and fewest-hit records for the exact arena, ordered gun and balance rules. Players can share that fight and target through a challenge code, with earned boss/discovery gates and fixed-build retries. Records remain local, are included in backups, and archive earlier balance rules. Campaign and Daily behavior is unchanged. Publication checks are complete.

## Build blueprints 3.0.4 — 25 September 2026

**Published on Pages and itch.io.** Runtime commit `6aa155fed508e9db5bd07255293da6033b385ced` passed all **1,912 tests**, build and deployment in [Pages CI](https://github.com/Caleb-Guyer/recoil-foundry/actions/runs/36182346336). Tag `v3.0.4` passed the [release workflow](https://github.com/Caleb-Guyer/recoil-foundry/actions/runs/36183367664); the matching official ZIP is itch.io upload `19400245`. Both public games show 3.0.4 and preserve their existing saves. [Validation and artifact evidence](validation/blueprints-3.0.4.md) records the checksum, blueprint flows, backup migration/round trip/undo, and test scope.

Six named slots save Workshop and finished-run guns, share versioned codes, and load discovered legal upgrades into Workshop or earned boss Practice. Oversized practice builds require manual trimming without changing the saved blueprint. Blueprint fields are included in progress backups; older backups migrate to empty slots. Combat balance, campaign checkpoints and Daily rules are unchanged. Publication checks are complete.

## Practice builds 3.0.3 — 25 September 2026

**Published on Pages and itch.io.** Runtime commit `2fcba8531d8feae036f94e2d253342b18e327993` passed all **1,903 tests**, build and deployment in [Pages CI](https://github.com/Caleb-Guyer/recoil-foundry/actions/runs/36178571167). Tag `v3.0.3` passed the [release workflow](https://github.com/Caleb-Guyer/recoil-foundry/actions/runs/36179836841); the matching official ZIP is itch.io upload `19399784`. Both public games show 3.0.3, with their existing campaign/Daily saves intact. [Validation and artifact evidence](validation/practice-builds-3.0.3.md) records the checksum, browser flows and test scope.

Players can choose Preset or Workshop build for an earned boss, fit only discovered upgrades within its normal upgrade count, retry that gun, and edit between attempts. Practice does not change the saved Workshop gun or award campaign progress. A related backup defect found during verification is fixed: imports now accept the existing Annex logbook discovery field. Campaign/Daily rules and save formats are unchanged. Publication checks are complete.

## Run feedback 3.0.2 — 25 September 2026

The [beam balance investigation](validation/beam-balance-3.0.2.md) is complete. It corrects test-pilot recoil and input assumptions, preserves the failed configurations, and records a 112-fight matching-input comparison plus focused regression checks. It provides no justification for a live damage buff; production balance, saves and Daily rules remain unchanged, with no new release or deployment.

The subsequent [opening/replay-flow self-audit](validation/first-session-3.0.2.md) found no new reproducible blocker: 110 focused checks passed, five scripted openings reached room 4 with legal varied rewards, and a fresh-profile browser check confirmed recoil guidance and a new seed after death. Keep 3.0.2 stable; no runtime patch was made. The [player session sheet](playtest-3.0.2.md) remains unfilled because independent human feedback is unavailable.

**Published on Pages and itch.io.** Commit `0bc55580cf8878908731d53bd4670129a470ada8` passed all **1,891 tests**, build and deployment in [Pages CI](https://github.com/Caleb-Guyer/recoil-foundry/actions/runs/36171302497), then tag `v3.0.2` passed the [release workflow](https://github.com/Caleb-Guyer/recoil-foundry/actions/runs/36172630191). The matching ZIP is itch.io upload `19398808`. Both public games show 3.0.2 and preserve existing progress. [Publication evidence](validation/run-feedback-3.0.2.md) records the checksum and result/form checks.

A quiet Feedback action on result screens opens Bug, Difficulty or Suggestion, with editable run details and drafts retained until gameplay resumes or the player returns to the title. The same form is available through Settings/Pause. No report is automatically submitted. Gameplay, checkpoint formats and Daily rules are unchanged; no publication checks remain open.

## Dead Signal 3.0.1 patch — 25 September 2026

**Published on Pages and itch.io.** Commit `3a9eee707a23ea91bdd111427e6172e61285c111` passed all **1,889 tests**, build and deployment in [Pages CI](https://github.com/Caleb-Guyer/recoil-foundry/actions/runs/36167770811), then the `v3.0.1` tag passed the [release workflow](https://github.com/Caleb-Guyer/recoil-foundry/actions/runs/36168968718). The matching ZIP is itch.io upload `19398338`. Both public games show 3.0.1 and preserve existing progress. [Audit and publication evidence](validation/dead-signal-3.0.1.md) include the full probe results, checksum and smoke-test scope.

The patch tightens the Cooling doorway trigger, lights the Annex climb after combat, and offers optional Subversion choices at Annex entry and its first clear. Fresh normal runs use Annex revision 6; old saves and Daily 84 retain their rules. Combat stats are unchanged. Completed checks have no pending checklist entries; independent human feedback remains unavailable.

## Dead Signal 3.0 promotion — 25 September 2026

The owner authorized publication of Dead Signal 3.0 to both hosts, including the screenshots and announcement. The final package contains the unchanged rc.2 gameplay, stable `3.0.0` version metadata, release notes, updated store copy, and the trailer's **Play now** closing card. The trailer is available as an optional static media file and is not loaded by game startup. Existing checkpoint and Daily rules remain unchanged.

**Published on both hosts.** Commit `50f9c5a514255994fb60d13d620161d4ba90c936` passed [Pages CI](https://github.com/Caleb-Guyer/recoil-foundry/actions/runs/36161216441) before the immutable `v3.0.0` tag triggered the successful [release workflow](https://github.com/Caleb-Guyer/recoil-foundry/actions/runs/36162154559). The verified GitHub ZIP is also itch.io upload `19397514`. Both live About and issue-report panels show `3.0.0`; existing progress, warm-up/reset and isolated reward checks passed. [Publication evidence and checksum](validation/dead-signal-3.0.md) record the exact scope and retained human/hardware limits. The [itch.io announcement](https://caleb-guyer.itch.io/recoil-foundry/devlog/1676915/dead-signal-is-here-recoil-foundry-30), screenshots and trailer link are public. No YouTube upload or direct recruitment messages were sent.

## Stable release and rollback points

- Stable tag: `v3.0.5` at `b0b2fe9a326ab8fdb7ec212bdf9df7ff6b73129d`. Rollbacks must preserve the Practice records and blueprint profile fields/decoders; unchanged older builds reject profiles saved by 3.0.5.
- Previous stable reference: `v3.0.4` at `6aa155fed508e9db5bd07255293da6033b385ced`.
- Previous stable reference: `v3.0.3` at `2fcba8531d8feae036f94e2d253342b18e327993`.
- Earlier stable reference: `v3.0.2` at `0bc55580cf8878908731d53bd4670129a470ada8`.
- Previous stable reference: `v3.0.1` at `3a9eee707a23ea91bdd111427e6172e61285c111`.
- Earlier stable reference: `v3.0.0` at `50f9c5a514255994fb60d13d620161d4ba90c936`. A rollback must preserve revision-6 checkpoint decoding; do not deploy the unchanged old build over those saves.
- Earlier stable rollback tag: `v2.98.1` at `4d579d148840a3078eb968616a6d58e0d41530b5`.
- Earlier stable tag: `v2.98.0`.
- Previous verified candidate: `v2.98.0-rc.1` at `ce13cc258e26c13f5504856e76b458a17d3cdb1a`.
- Earlier rollback tag: `browser-rollback-2.97.0` at `9f5707fa7a6c3f9fab507f48ad026d37da2b8e02`.
- Deployment: [GitHub Actions](https://github.com/Caleb-Guyer/recoil-foundry/actions/workflows/deploy.yml), tests and build before Pages publication.

## Archived candidate evidence — 25 September 2026

The presentation candidate was **`3.0.0-rc.2`** on `feature/dead-signal`: [notes](releases/3.0.0-rc.2.md), [launch kit](launch/dead-signal/README.md). It added the optional title-screen update notes, with no gameplay, save or Daily changes. All 1,885 tests passed and the production build succeeded. Its preserved local site archive is `.release-assets/recoil-foundry-v3.0.0-rc.2-site.zip`, SHA-256 `35D2391B064BC38119B7E1E98D5FAB9A5551070EDE7C18F7437FF70B84FE1E67`. That 16-file candidate excluded launch media. The stable 3.0 ZIP now also contains the optional trailer. The rc.1/rc.2 archives were never published as releases.

The final `docs/launch/dead-signal/announcement.md` is published, and the trailer/upload copy now say **Play now**. The public verification above supersedes the old candidate promotion checklist.

The rc.2 archive was extracted into its own local preview. Startup, optional update notes/Back/Escape, About's `3.0.0-rc.2` version, and route-test startup/pause were verified there; warning/error logs were empty. The media preview separately completed the 23-second MP4. Its files are not included in the playable ZIP. Both checks were local, not public-host acceptance.

`3.0.0-rc.1` was prepared on **`feature/dead-signal`**, with [release notes](releases/3.0.0-rc.1.md) and [validation evidence](plans/dead-signal-balance.md). It was checked locally before promotion as stable 3.0. The existing workflow requires a successful Pages run for the exact main commit before tagged publication; do not bypass that gate.

The local artifact is `.release-assets/recoil-foundry-v3.0.0-rc.1-site.zip`, with `index.html` at the archive root, 16 files, relative asset URLs, and no development harness, source code, dependencies or private files. It was extracted and served locally to verify startup, normal gameplay, death/retry, pause, About/version and issue-report details. No issue was submitted. The final About copy includes the new regional score without the obsolete five-theme count. Browser warning/error logs were empty.

SHA-256: `A7B54CA2438EEACB8A5B0EE8E3D3F61050FACB6F48975C6F33E1013DEEC44860`.

The candidate's matching checksum is also committed in [validation evidence](validation/dead-signal-rc/SHA256SUMS.txt). Rebuilding may change ZIP metadata and therefore the archive hash; always verify the artifact actually distributed. Retain `v2.98.1` as the previous stable rollback reference. If the update needs rollback, make a reviewed revert/new version as described below rather than moving tags or rewriting history.

Completed promotion checks have been removed from the weekend checklist. Independent player feedback and low-end hardware remain disclosed limitations, not fabricated passes. No future deployment job is scheduled.

## Triage

Use [GitHub issues](https://github.com/Caleb-Guyer/recoil-foundry/issues). Record version, mode, seed, room, build, exact steps, expected and observed behavior. Ask for browser/device details only when relevant. Never require a whole browser profile or private information.

Prioritize repeatable crashes, lost saves, progression blocks, inaccessible core controls or a broken deployed build. Fix the smallest cause, add a meaningful regression check, retest the affected flow and run required tests/build. Keep lesser problems in [known limitations](browser-support.md) with a workaround and evidence. An empty feedback queue does not establish that the game has no bugs.

## Publish an update

1. Set the package/lockfile version and write `docs/releases/<version>.md`. Run tests and build; review the diff and notes.
2. Commit and push `main`. Wait for that exact commit's Pages workflow to succeed.
3. Open the public base URL, verify About & credits, startup, Settings → Report an issue and browser logs. Preserve existing player saves during smoke tests.
4. Create and push an annotated `v<version>` tag. The release workflow rejects malformed or mismatched versions and requires a successful Pages run for the exact commit on main before packaging.
5. The workflow rebuilds the already-tested source and publishes the static-site ZIP and notes. `-rc.N` versions are prereleases; plain versions are stable and marked latest. This avoids rerunning the full suite a third time while retaining the same-commit test/deployment gate.
6. Verify the GitHub release and ZIP contents. Keep prior tags immutable and retain their rollback points. Match any announcement to the actual release status.

The API uses GitHub's [workflow-run endpoint](https://docs.github.com/en/rest/actions/workflow-runs#list-workflow-runs-for-a-workflow) and checks commit, branch and successful completion. Tagged builds are not accepted merely because a different commit passed.

## Roll back without rewriting history

Back up local work and inspect `git status` first. Identify the failing change and review a focused revert against the previous stable reference; 3.0 spans multiple commits, so do not blindly revert only its version commit or a whole range. Preserve newer checkpoint fields and saved Daily identities. Assign a new patch version and, if Daily behavior changes, a new ruleset; never reuse a published challenge identity. Run tests/build and push `main`; the Pages workflow deploys the corrected source. Verify both public hosts afterward.

Do not force-push, move a published version tag, or overwrite player storage. If only Pages failed, retry the failed workflow rather than changing game files; the last successful deployment remains the reference.
