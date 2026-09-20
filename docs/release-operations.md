# Browser release operations

## Candidate and rollback point

- Candidate tag: `v2.98.0-rc.1`.
- Previous deployed version: 2.97.0 at `9f5707fa7a6c3f9fab507f48ad026d37da2b8e02`.
- Rollback tag: `browser-rollback-2.97.0`.
- Deployment: [GitHub Actions](https://github.com/Caleb-Guyer/recoil-foundry/actions/workflows/deploy.yml), tests and build before Pages publication.

## Triage

Use [GitHub issues](https://github.com/Caleb-Guyer/recoil-foundry/issues). Record version, mode, seed, room, build, exact steps, expected and observed behavior. Ask for browser/device details only when relevant. Never require a whole browser profile or private information.

Stop final promotion for repeatable crashes, lost saves, progression blocks, inaccessible core controls or a broken deployed build. Fix the smallest cause, add a meaningful regression check, retest the affected flow and rerun the required suite/build. Keep lesser problems in [known limitations](browser-support.md) with a workaround and evidence. No human feedback has been collected yet; an empty feedback queue does not establish that the game has no bugs.

## Publish

1. Run `npm ci`, `npm test`, `npm run build` on the candidate source. Review the diff and release notes.
2. Commit and push `main`. Wait for that exact commit's Pages workflow to succeed.
3. Open the public base URL, verify the version in About & credits, start a fresh run, check Settings → Report an issue and inspect production logs. Verify sharing assets resolve.
4. Create an annotated version tag for the verified commit. Publish GitHub release notes with prerelease status for an RC. Preserve the prior source tag.
5. Close only completed checklist work; record deferred tests accurately. Publish the announcement only when ready, using wording matching the release status.

## Roll back without rewriting history

Back up local work and inspect `git status` first. For this one-commit candidate, `git revert v2.98.0-rc.1` restores the previous tracked source with a new commit. If later commits exist, identify the failing change and review its revert rather than blindly reverting a range. Run tests/build and push `main`; the existing Pages workflow redeploys the restored source. Verify the public game afterward. Do not force-push, move a published version tag, or overwrite player storage. The candidate adds no save migration.

If the source is healthy and only Pages failed, retry its failed workflow rather than changing game files. The last successful deployment stays the reference until a new deployment succeeds.
