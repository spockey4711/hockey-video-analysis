/**
 * Password hashing for coach accounts, built on Node's memory-hard `scrypt`
 * (OWASP-approved, no native dependency). A hash is self-describing:
 *
 *   scrypt$<N>$<r>$<p>$<saltBase64>$<hashBase64>
 *
 * so the cost parameters travel with each stored value and can be raised later
 * without invalidating older hashes (verify reads them back from the string).
 *
 * Never log or store a plaintext password; only the derived hash is persisted.
 */
import {
  randomBytes,
  scrypt,
  timingSafeEqual,
  type ScryptOptions,
} from "node:crypto";

/** Promise wrapper around `scrypt` that keeps the cost-parameter options. */
function scryptAsync(
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keylen, options, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey);
    });
  });
}

// Cost parameters. N is the CPU/memory work factor; 2^15 keeps per-hash memory
// (~128 * N * r bytes ~= 34 MB) modest for a self-hosted app while staying well
// above brute-force comfort. `maxmem` is raised so scrypt does not reject that.
const N = 2 ** 15;
const R = 8;
const P = 1;
const KEY_LEN = 64;
const SALT_LEN = 16;
const MAX_MEM = 128 * 1024 * 1024;

/** Hash a plaintext password into a self-describing, salted scrypt string. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LEN);
  const derived = await scryptAsync(password, salt, KEY_LEN, {
    N,
    r: R,
    p: P,
    maxmem: MAX_MEM,
  });
  return [
    "scrypt",
    N,
    R,
    P,
    salt.toString("base64"),
    derived.toString("base64"),
  ].join("$");
}

/**
 * Verify a plaintext password against a stored scrypt hash. Returns `false`
 * (never throws) for a wrong password or an unparseable/foreign hash, and uses
 * a constant-time comparison so timing does not leak how far a guess matched.
 */
export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;

  const [, nRaw, rRaw, pRaw, saltB64, hashB64] = parts;
  const n = Number(nRaw);
  const r = Number(rRaw);
  const p = Number(pRaw);
  if (!Number.isInteger(n) || !Number.isInteger(r) || !Number.isInteger(p)) {
    return false;
  }

  const expected = Buffer.from(hashB64, "base64");
  const derived = await scryptAsync(
    password,
    Buffer.from(saltB64, "base64"),
    expected.length,
    { N: n, r, p, maxmem: MAX_MEM },
  );

  return (
    expected.length === derived.length && timingSafeEqual(expected, derived)
  );
}
