// Dependabot's generated commit messages (release notes in the body) routinely
// exceed body-max-line-length and are not authored by a human following
// Conventional Commits, so they are exempt from commitlint here.
//
// The commit checks workflow (.github/workflows/commit-checks.yml) lints with
// wagoid/commitlint-github-action, which loads only its `configFile` input
// (default ./commitlint.config.mjs, and it rejects .js) and silently falls back
// to plain config-conventional when that file is missing. Keep this file at
// that exact path and in ESM; the workflow fails fast if it is absent.
const config = {
  extends: ["@commitlint/config-conventional"],
  ignores: [(message) => /Signed-off-by: dependabot\[bot\]/.test(message)],
};

export default config;
