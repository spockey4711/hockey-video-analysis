import { describe, expect, it } from "vitest";

import commitlintConfig from "../../../commitlint.config.mjs";

const dependabotMessage = `chore(deps): bump foo from 1.0.0 to 1.0.1

Bumps foo from 1.0.0 to 1.0.1.

Signed-off-by: dependabot[bot] <support@github.com>`;

describe("commitlint.config.mjs", () => {
  it("ignores Dependabot-authored commits", () => {
    const [isIgnored] = commitlintConfig.ignores;
    expect(isIgnored(dependabotMessage)).toBe(true);
  });

  it("still lints human-authored commits", () => {
    const [isIgnored] = commitlintConfig.ignores;
    expect(isIgnored("fix: a normal commit message")).toBe(false);
  });
});
