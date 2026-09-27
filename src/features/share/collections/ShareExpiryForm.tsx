"use client";

import {
  startTransition,
  useActionState,
  useState,
  type FormEvent,
} from "react";

import { setShareExpiryAction } from "./actions";
import { collectionsContent } from "./content";
import { formatShareEndDate } from "./expiry";
import { collectionMutationInitialState } from "./state";

import { Icon } from "@/components/core/Icon";
import { Button } from "@/components/forms/Button";
import { Input } from "@/components/forms/Input";

const { expiry } = collectionsContent.coach.detail;

export interface ShareExpiryFormProps {
  readonly collectionId: string;
  /** The last day the link works (`YYYY-MM-DD`), `null` when it has no end date. */
  readonly endDate: string | null;
  /** Whether that day has passed, so the link already shows it is no longer valid. */
  readonly expired: boolean;
  /** Today in the team's time zone, the earliest day the picker offers. */
  readonly today: string;
}

/**
 * The optional end date of a collection's share link: a day picker with save,
 * and a remove button while a date is set. A line under it says what the link
 * does now. The page re-renders with the stored date after a save; the form
 * keeps what the coach typed when the action refuses it.
 */
export function ShareExpiryForm({
  collectionId,
  endDate,
  expired,
  today,
}: ShareExpiryFormProps) {
  const [state, formAction, pending] = useActionState(
    setShareExpiryAction,
    collectionMutationInitialState,
  );
  const [removed, setRemoved] = useState(false);

  // Submit without React's automatic form reset, carrying the button that was
  // pressed so the action can tell save from remove.
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const formData = new FormData(event.currentTarget, submitter);
    setRemoved(formData.get("intent") === "remove");
    startTransition(() => formAction(formData));
  }

  const status =
    endDate === null
      ? expiry.none
      : expired
        ? expiry.expired(formatShareEndDate(endDate))
        : expiry.until(formatShareEndDate(endDate));

  return (
    <form
      action={formAction}
      onSubmit={onSubmit}
      className="flex flex-col gap-[var(--space-2)]"
      noValidate
    >
      <input type="hidden" name="collectionId" value={collectionId} />
      <div className="w-[11rem]">
        <Input
          // Remount on a stored change so a removed date clears the field.
          key={endDate ?? "none"}
          type="date"
          name="endDate"
          label={expiry.label}
          defaultValue={endDate ?? ""}
          min={today}
          aria-invalid={state.status === "error" ? true : undefined}
        />
      </div>
      <div className="flex flex-wrap gap-[var(--space-2)]">
        <Button
          type="submit"
          name="intent"
          value="save"
          size="sm"
          variant="secondary"
          disabled={pending}
        >
          {pending && !removed ? expiry.saving : expiry.save}
        </Button>
        {endDate !== null && (
          <Button
            type="submit"
            name="intent"
            value="remove"
            size="sm"
            variant="ghost"
            disabled={pending}
          >
            {expiry.remove}
          </Button>
        )}
      </div>
      {state.status === "error" && (
        <p
          role="alert"
          className="text-[length:var(--fs-body-sm)] text-[color:var(--danger)]"
        >
          {state.error}
        </p>
      )}
      {expired ? (
        <p className="flex items-start gap-[var(--space-2)] text-[length:var(--fs-body-sm)] text-[color:var(--text-secondary)]">
          <Icon
            name="alert-triangle"
            size={16}
            aria-hidden
            className="mt-[0.15em] shrink-0 text-[color:var(--warning)]"
          />
          {status}
        </p>
      ) : (
        <p className="text-[length:var(--fs-body-sm)] text-[color:var(--text-muted)]">
          {status}
        </p>
      )}
      {state.status === "success" && !pending && (
        <p
          role="status"
          className="text-[length:var(--fs-body-sm)] text-[color:var(--text-secondary)]"
        >
          {removed ? expiry.removed : expiry.saved}
        </p>
      )}
    </form>
  );
}
