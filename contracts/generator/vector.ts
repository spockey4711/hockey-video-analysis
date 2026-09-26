/**
 * The shape of a golden-vector file in `contracts/vectors/` and the helper that
 * records one case by running the TypeScript reference (ADR 0013).
 *
 * A vector file pins a rule the Mac app ports to Swift: every case names the
 * reference function, its input, and either the value it returned or the fact
 * that it rejected the input. Both languages read the same file, so a rule
 * change in TypeScript fails the port's tests until the port follows.
 */

/** One call of a reference function: its input and its outcome. */
export interface VectorCase {
  /** Unique within the file; says what the case pins. */
  readonly name: string;
  /** The reference function's name, e.g. `toSourcePoint`. */
  readonly call: string;
  /** The arguments, by parameter name. */
  readonly input: Readonly<Record<string, unknown>>;
  /** What the call returned (`null` for no value); absent when it threw. */
  readonly returns?: unknown;
  /** Present and `true` when the reference rejected the input. */
  readonly throws?: true;
}

/** A whole golden-vector file: one rule area and its cases. */
export interface VectorFile {
  readonly contract: string;
  readonly description: string;
  /** The TypeScript modules that are the reference for this file. */
  readonly reference: readonly string[];
  /** Absolute tolerance for comparing numbers in `returns`. */
  readonly tolerance: number;
  /** Named limits the rules use, so a port can assert its own copies. */
  readonly constants?: Readonly<Record<string, number>>;
  readonly cases: readonly VectorCase[];
}

/**
 * The tolerance every vector file uses: far below a video frame (20 ms at 50
 * fps) and a millimetre on the pitch, far above the last-bit differences two
 * math libraries may show for the same trigonometry.
 */
export const DEFAULT_TOLERANCE = 1e-9;

/**
 * Record one case by running `run` on `input`. A `RangeError` is the
 * reference's way of rejecting an input, so it becomes `throws: true`; any
 * other error is a bug in the generator and fails the run.
 */
export function vectorCase<Input extends Record<string, unknown>>(
  name: string,
  call: string,
  input: Input,
  run: (input: Input) => unknown,
): VectorCase {
  let value: unknown;
  try {
    value = run(input);
  } catch (error) {
    if (error instanceof RangeError) return { name, call, input, throws: true };
    throw error;
  }
  return { name, call, input, returns: value === undefined ? null : value };
}
