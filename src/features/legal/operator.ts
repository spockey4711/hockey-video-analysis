/**
 * The operator details the Impressum and the Datenschutzerklärung name. They are
 * personal data of whoever runs this instance, and the repository is public, so
 * they come only from server-side environment variables (declared in
 * `.env.schema`) and are never hard-coded. Read at request time so a
 * self-hosted deploy picks up a changed value on restart without a rebuild.
 */
import "server-only";

/** Env variables the Impressum cannot do without; the pages flag any unset one. */
export const REQUIRED_OPERATOR_ENV = [
  "LEGAL_OPERATOR_NAME",
  "LEGAL_OPERATOR_STREET",
  "LEGAL_OPERATOR_CITY",
  "LEGAL_CONTACT_EMAIL",
] as const;

export type RequiredOperatorEnv = (typeof REQUIRED_OPERATOR_ENV)[number];

export interface LegalOperator {
  /** Person or club responsible for the app; `null` while unset. */
  readonly name: string | null;
  readonly street: string | null;
  /** Postal code and city, e.g. "12345 Musterstadt". */
  readonly city: string | null;
  readonly email: string | null;
  /** Optional; the Impressum omits the line when unset. */
  readonly phone: string | null;
  /** Optional hoster name and address; unset keeps the hosting text generic. */
  readonly hostingProvider: string | null;
  /** Required variables that are unset, in declaration order. */
  readonly missing: readonly RequiredOperatorEnv[];
}

/** A trimmed env value, or `null` when unset or blank. */
function readEnv(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

/** Resolve the operator details from the environment. */
export function getLegalOperator(): LegalOperator {
  return {
    name: readEnv("LEGAL_OPERATOR_NAME"),
    street: readEnv("LEGAL_OPERATOR_STREET"),
    city: readEnv("LEGAL_OPERATOR_CITY"),
    email: readEnv("LEGAL_CONTACT_EMAIL"),
    phone: readEnv("LEGAL_CONTACT_PHONE"),
    hostingProvider: readEnv("LEGAL_HOSTING_PROVIDER"),
    missing: REQUIRED_OPERATOR_ENV.filter((name) => readEnv(name) === null),
  };
}
