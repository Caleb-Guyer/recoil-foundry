# Browser release operations

## Stable release and rollback points

- Stable tag: `v2.98.1`.
- Previous stable rollback tag: `v2.98.0`.
- Previous verified candidate: `v2.98.0-rc.1` at `ce13cc258e26c13f5504856e76b458a17d3cdb1a`.
- Earlier rollback tag: `browser-rollback-2.97.0` at `9f5707fa7a6c3f9fab507f48ad026d37da2b8e02`.
- Deployment: [GitHub Actions](https://github.com/Caleb-Guyer/recoil-foundry/actions/workflows/deploy.yml), tests and build before Pages publication.

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
