/**
 * Generate or check the shared contract files in `contracts/` (ADR 0013).
 *
 *   pnpm contracts:generate   rewrite every generated file from the TypeScript
 *   pnpm contracts:check      fail if a committed file no longer matches it
 *
 * Generated files are formatted with the repo's Prettier config, so a commit
 * through lint-staged leaves them byte for byte as written here.
 */
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { format, resolveConfig } from "prettier";

import {
  CONTRACT_DOCUMENTS,
  CONTRACTS_ROOT,
  findContractProblems,
  listVectorFiles,
  renderContract,
} from "../contracts/generator";

async function generate(): Promise<void> {
  const generated = new Set<string>();
  for (const document of CONTRACT_DOCUMENTS) {
    const file = path.join(CONTRACTS_ROOT, document.path);
    const config = await resolveConfig(file);
    const text = await format(renderContract(document), {
      ...config,
      filepath: file,
    });
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, text);
    generated.add(document.path);
    console.log(`wrote contracts/${document.path}`);
  }
  for (const leftover of await listVectorFiles()) {
    if (generated.has(leftover)) continue;
    await rm(path.join(CONTRACTS_ROOT, leftover));
    console.log(`removed contracts/${leftover} (no longer generated)`);
  }
}

async function check(): Promise<void> {
  const problems = await findContractProblems();
  if (problems.length === 0) {
    console.log(
      `contracts: ${CONTRACT_DOCUMENTS.length} files match the TypeScript`,
    );
    return;
  }
  for (const { path: file, problem } of problems) {
    console.error(`contracts/${file}: ${problem}`);
  }
  console.error(
    "The shared contract files no longer match the TypeScript reference. Run " +
      "`pnpm contracts:generate`, review the diff and commit it together with " +
      "the rule change (ADR 0013).",
  );
  process.exitCode = 1;
}

async function main(mode: string): Promise<void> {
  if (mode === "generate") {
    await generate();
  } else if (mode === "check") {
    await check();
  } else {
    console.error(`unknown mode "${mode}"; use generate or check`);
    process.exitCode = 2;
  }
}

main(process.argv[2] ?? "generate").catch((error: unknown) => {
  console.error("contracts: the generator failed", error);
  process.exit(1);
});
