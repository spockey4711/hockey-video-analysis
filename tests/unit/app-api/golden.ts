/**
 * Golden app API payloads (ADR 0013, Mac plan S3). Route handler tests write
 * their example responses to `contracts/api/<name>.json`, and the Swift client
 * decodes the same files in its tests, so a changed payload shows up as a diff
 * here and fails the Mac's decoding until both sides agree.
 *
 * A missing file is written on a local run; a changed one fails the test
 * until it is accepted with `pnpm test -u`, and in CI any difference fails.
 * `contracts:check` does not own this folder.
 */
import path from "node:path";

import { format } from "prettier";
import { expect } from "vitest";

// Vitest runs from the repository root (the jsdom environment gives
// `import.meta.url` an http scheme, so it cannot anchor the path).
const API_DIR = path.join(process.cwd(), "contracts", "api");

/** Pin a JSON body as the golden payload `contracts/api/<name>.json`. */
export async function expectGoldenPayload(
  name: string,
  body: unknown,
): Promise<void> {
  const text = await format(JSON.stringify(body), { parser: "json" });
  await expect(text).toMatchFileSnapshot(path.join(API_DIR, `${name}.json`));
}

/**
 * Every secret a payload must never carry: share tokens and session token
 * hashes planted in the fixture rows. Asserted against the serialized body.
 */
export function expectNoSecrets(body: unknown, secrets: readonly string[]) {
  const text = JSON.stringify(body);
  for (const secret of secrets) expect(text).not.toContain(secret);
  expect(text).not.toMatch(/shareToken|share_token|tokenHash|token_hash/i);
}
