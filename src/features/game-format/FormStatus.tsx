import type { GameFormatFormState } from "./actions";

/**
 * A format form's outcome above its fields: the form-level error, or the
 * success note after a save. Field errors show at their fields instead.
 */
export function FormStatus({
  state,
  success,
}: {
  state: GameFormatFormState;
  success: string;
}) {
  if (state.error) {
    return (
      <p
        role="alert"
        className="rounded-[var(--radius-md)] border border-[color:var(--danger)] bg-[var(--surface-inset)] px-[var(--space-3)] py-[var(--space-2)] text-[length:var(--fs-body-sm)] text-[color:var(--danger)]"
      >
        {state.error}
      </p>
    );
  }
  if (state.success) {
    return (
      <p
        role="status"
        className="rounded-[var(--radius-md)] border border-[color:var(--accent)] bg-[var(--surface-inset)] px-[var(--space-3)] py-[var(--space-2)] text-[length:var(--fs-body-sm)] text-[color:var(--text-secondary)]"
      >
        {success}
      </p>
    );
  }
  return null;
}
