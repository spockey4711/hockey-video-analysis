// Dependabot's generated commit messages (release notes in the body) routinely
// exceed body-max-line-length and are not authored by a human following
// Conventional Commits, so they are exempt from commitlint here. The commit
// checks workflow (.github/workflows/commit-checks.yml) only writes a default
// config when none is committed - this one takes over instead.
module.exports = {
  extends: ["@commitlint/config-conventional"],
  ignores: [(message) => /Signed-off-by: dependabot\[bot\]/.test(message)],
};
