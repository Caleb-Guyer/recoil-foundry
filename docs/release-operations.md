# Browser release operations

## Stable release and rollback points

- Stable tag: `v2.98.1`.
- Previous stable rollback tag: `v2.98.0`.
- Previous verified candidate: `v2.98.0-rc.1` at `ce13cc258e26c13f5504856e76b458a17d3cdb1a`.
- Earlier rollback tag: `browser-rollback-2.97.0` at `9f5707fa7a6c3f9fab507f48ad026d37da2b8e02`.
- Deployment: [GitHub Actions](https://github.com/Caleb-Guyer/recoil-foundry/actions/workflows/deploy.yml), tests and build before Pages publication.

## Dead Signal candidate — 25 September 2026

The current presentation candidate is **`3.0.0-rc.2`** on `feature/dead-signal`: [notes](releases/3.0.0-rc.2.md), [launch kit](launch/dead-signal/README.md). It adds the optional title-screen update notes, with no gameplay, save or Daily changes. All 1,885 tests pass and the production build succeeds. The local site archive is `.release-assets/recoil-foundry-v3.0.0-rc.2-site.zip`, SHA-256 `35D2391B064BC38119B7E1E98D5FAB9A5551070EDE7C18F7437FF70B84FE1E67`. The launch media are stored in documentation and excluded from the 16-file game ZIP. The earlier rc.1 archive below remains preserved. Neither candidate is published.

For launch-day copy use `docs/launch/dead-signal/announcement.md`; the teaser and its upload text are explicitly **Coming soon**. Review availability wording before publishing. Promotion and public-host verification remain pending.

The rc.2 archive was extracted into its own local preview. Startup, optional update notes/Back/Escape, About's `3.0.0-rc.2` version, and route-test startup/pause were verified there; warning/error logs were empty. The media preview separately completed the 23-second MP4. Its files are not included in the playable ZIP. Both checks were local, not public-host acceptance.

`3.0.0-rc.1` is prepared on **`feature/dead-signal`**, with [release notes](releases/3.0.0-rc.1.md) and [validation evidence](plans/dead-signal-balance.md). It is not tagged, merged to main, published to GitHub Releases, or uploaded to either public host. The existing workflow requires a successful Pages run for the exact main commit before tagged publication; do not bypass that gate to publish a feature-branch candidate.

The local artifact is `.release-assets/recoil-foundry-v3.0.0-rc.1-site.zip`, with `index.html` at the archive root, 16 files, relative asset URLs, and no development harness, source code, dependencies or private files. It was extracted and served locally to verify startup, normal gameplay, death/retry, pause, About/version and issue-report details. No issue was submitted. The final About copy includes the new regional score without the obsolete five-theme count. Browser warning/error logs were empty.

SHA-256: `A7B54CA2438EEACB8A5B0EE8E3D3F61050FACB6F48975C6F33E1013DEEC44860`.

The candidate's matching checksum is also committed in [validation evidence](validation/dead-signal-rc/SHA256SUMS.txt). Rebuilding may change ZIP metadata and therefore the archive hash; always verify the artifact actually distributed. Keep stable `v2.98.1` (`b9de8d4ee52d8ee7d2f34e3d3bb1d1762f0322f7`) as the public reference until promotion. To abandon this local candidate, keep serving the unchanged stable release; no public rollback is necessary. If a later promoted update needs rollback, make a reviewed revert/new version as described below rather than moving tags or rewriting history.

Remaining promotion checks: ordinary player feedback on the documented balance limits, Pages CI and deployed version, itch.io upload/iframe version, and both hosts' existing-progress/startup/reward/report smoke checks. There is no scheduled deployment job in this task.

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

Back up local work and inspect `git status` first. For this single-commit patch, `git revert v2.98.1` restores the previous gameplay with a new commit. If later commits exist, identify the failing change and review its revert rather than blindly reverting a range. Assign a new patch version and Daily ruleset before publishing a rollback; never reuse a published challenge identity. Run tests/build and push `main`; the Pages workflow redeploys the restored source. Verify the public game afterward.

Do not force-push, move a published version tag, or overwrite player storage. This patch adds no save migration. If only Pages failed, retry the failed workflow rather than changing game files; the last successful deployment remains the reference.
