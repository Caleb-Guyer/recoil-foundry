export function releaseMetadata(version, tag) {
  if (!/^v\d+\.\d+\.\d+(?:-rc\.\d+)?$/.test(tag ?? '') || tag !== `v${version}`)
    throw new Error('Release tag must match the stable or RC package version.');
  return { tag, version, prerelease: /-rc\./.test(version) };
}

export function hasVerifiedDeployment(runs, sha) {
  return runs.some(
    (run) =>
      run.head_sha === sha &&
      run.head_branch === 'main' &&
      run.status === 'completed' &&
      run.conclusion === 'success',
  );
}
