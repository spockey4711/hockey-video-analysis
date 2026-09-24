import { legalContent } from "./content";
import type { LegalOperator } from "./operator";

const { impressum, missing } = legalContent;

/** Postal lines of the operator; unset lines are skipped. */
export function OperatorAddress({ operator }: { operator: LegalOperator }) {
  const lines = [operator.name, operator.street, operator.city].filter(
    (line): line is string => line !== null,
  );
  if (lines.length === 0) return null;

  return (
    <address className="not-italic">
      {lines.map((line) => (
        <span key={line} className="block">
          {line}
        </span>
      ))}
    </address>
  );
}

/** Email and optional phone of the operator; unset lines are skipped. */
export function OperatorContact({ operator }: { operator: LegalOperator }) {
  if (!operator.email && !operator.phone) return null;

  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-[var(--space-3)]">
      {operator.email && (
        <>
          <dt>{impressum.emailLabel}:</dt>
          <dd>
            <a
              href={`mailto:${operator.email}`}
              className="text-[color:var(--text-primary)] underline underline-offset-2"
            >
              {operator.email}
            </a>
          </dd>
        </>
      )}
      {operator.phone && (
        <>
          <dt>{impressum.phoneLabel}:</dt>
          <dd>{operator.phone}</dd>
        </>
      )}
    </dl>
  );
}

/**
 * Shown while a required operator variable is unset. In development it names
 * the unset variables so the operator can fill them in; in production it only
 * says the details are being completed, without naming internals.
 */
export function MissingOperatorNotice({
  operator,
}: {
  operator: LegalOperator;
}) {
  if (operator.missing.length === 0) return null;
  const showVariables = process.env.NODE_ENV !== "production";

  return (
    <div
      role="status"
      className="flex flex-col gap-[var(--space-2)] rounded-[var(--radius-md)] border border-[color:var(--warning)] bg-[var(--surface)] px-[var(--space-4)] py-[var(--space-3)] text-[length:var(--fs-body-sm)]"
    >
      <p className="[font-weight:var(--fw-semibold)] text-[color:var(--text-primary)]">
        {missing.title}
      </p>
      {showVariables ? (
        <>
          <p>{missing.devBody}</p>
          <ul className="list-disc pl-[var(--space-6)] font-[family-name:var(--font-mono)]">
            {operator.missing.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
        </>
      ) : (
        <p>{missing.body}</p>
      )}
    </div>
  );
}
