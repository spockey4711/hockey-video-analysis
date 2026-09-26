import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  CONTRACT_DOCUMENTS,
  CONTRACTS_ROOT,
  findContractProblems,
  renderContract,
} from "../../../contracts/generator";
import {
  vectorCase,
  type VectorCase,
  type VectorFile,
} from "../../../contracts/generator/vector";

/**
 * The shared contract files (ADR 0013) are the TypeScript rules' output. A rule
 * change without `pnpm contracts:generate` fails here, as it fails
 * `pnpm contracts:check` in CI, so the Mac port never tests against stale data.
 */
describe("shared contracts", () => {
  it("every committed file matches the TypeScript reference", async () => {
    expect(await findContractProblems()).toEqual([]);
  });

  describe("vector files", () => {
    const vectorDocuments = CONTRACT_DOCUMENTS.filter((document) =>
      document.path.startsWith("vectors/"),
    );

    it.each(vectorDocuments)(
      "$path has unique case names and one outcome per case",
      (document) => {
        const file = document.build() as VectorFile;
        const names = file.cases.map((c: VectorCase) => c.name);
        expect(new Set(names).size).toBe(names.length);
        for (const c of file.cases) {
          const returned = "returns" in c;
          const threw = c.throws === true;
          expect(returned !== threw).toBe(true);
        }
      },
    );
  });

  describe("vectorCase", () => {
    it("records the returned value", () => {
      expect(
        vectorCase("sum", "add", { a: 1, b: 2 }, (i) => i.a + i.b),
      ).toEqual({
        name: "sum",
        call: "add",
        input: { a: 1, b: 2 },
        returns: 3,
      });
    });

    it("records no value as null", () => {
      expect(
        vectorCase("none", "find", {}, () => undefined).returns,
      ).toBeNull();
    });

    it("records a rejected input as throws", () => {
      const recorded = vectorCase("bad", "check", { a: -1 }, () => {
        throw new RangeError("out of range");
      });
      expect(recorded).toEqual({
        name: "bad",
        call: "check",
        input: { a: -1 },
        throws: true,
      });
    });

    it("fails on any other error, which is a bug in the generator", () => {
      expect(() =>
        vectorCase("bug", "check", {}, () => {
          throw new TypeError("not a function");
        }),
      ).toThrow(TypeError);
    });
  });

  describe("findContractProblems", () => {
    let root: string | null = null;

    afterEach(async () => {
      if (root) await rm(root, { recursive: true, force: true });
      root = null;
    });

    async function copyOfContracts(): Promise<string> {
      root = await mkdtemp(path.join(tmpdir(), "contracts-"));
      for (const document of CONTRACT_DOCUMENTS) {
        const target = path.join(root, document.path);
        await mkdir(path.dirname(target), { recursive: true });
        await writeFile(
          target,
          await readFile(path.join(CONTRACTS_ROOT, document.path), "utf8"),
        );
      }
      return root;
    }

    it("accepts any formatting of the same content", async () => {
      const dir = await copyOfContracts();
      const [first] = CONTRACT_DOCUMENTS;
      const reformatted = JSON.stringify(
        JSON.parse(renderContract(first)),
        null,
        4,
      );
      await writeFile(path.join(dir, first.path), reformatted);
      expect(await findContractProblems(dir)).toEqual([]);
    });

    it("reports a changed, a missing and a leftover file", async () => {
      const dir = await copyOfContracts();
      const [changed, missing] = CONTRACT_DOCUMENTS;
      const content = JSON.parse(renderContract(changed)) as Record<
        string,
        unknown
      >;
      await writeFile(
        path.join(dir, changed.path),
        JSON.stringify({ ...content, description: "edited by hand" }),
      );
      await rm(path.join(dir, missing.path));
      await writeFile(path.join(dir, "vectors", "retired.json"), "{}");

      expect(await findContractProblems(dir)).toEqual([
        { path: changed.path, problem: "out of date" },
        { path: missing.path, problem: "missing" },
        { path: "vectors/retired.json", problem: "not generated" },
      ]);
    });

    it("reports a file that is not JSON as out of date", async () => {
      const dir = await copyOfContracts();
      const [first] = CONTRACT_DOCUMENTS;
      await writeFile(path.join(dir, first.path), "<<<<<<< HEAD");
      expect(await findContractProblems(dir)).toEqual([
        { path: first.path, problem: "out of date" },
      ]);
    });
  });
});
