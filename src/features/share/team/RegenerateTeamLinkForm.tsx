"use client";

import { useActionState, useState } from "react";

import { regenerateTeamShareLinkAction } from "./actions";
import { teamShareContent } from "./content";
import { teamShareLinkInitialState } from "./state";

import { Button } from "@/components/forms/Button";

const { create, regenerate } = teamShareContent.settings;

/**
 * Creates the team link, or replaces it with a new one. Replacing revokes the
 * old link at once, so it is confirm-gated: the first click only reveals the
 * warning and the real submit. Creating the first link revokes nothing and
 * submits directly. The action revalidates the page, which then renders the
 * new link above this form.
 */
export function RegenerateTeamLinkForm({ hasLink }: { hasLink: boolean }) {
  const [state, formAction, pending] = useActionState(
    regenerateTeamShareLinkAction,
    teamShareLinkInitialState,
  );
  const [confirming, setConfirming] = useState(false);
  const [settled, setSettled] = useState(state);
  // Remember which step the result belongs to, so the success note fits it
  // even after the page re-renders with a link.
  const [created, setCreated] = useState(false);

  // Close the confirm step once a new result arrives, so the coach sees the
  // outcome rather than the warning. Adjusting state during render is React's
  // recommended alternative to a state-setting effect.
  if (state !== settled) {
    setSettled(state);
    if (state.status === "success") setConfirming(false);
  }

  return (
    <form
      action={formAction}
      onSubmit={() => setCreated(!hasLink)}
      className="flex flex-col gap-[var(--space-2)]"
    >
      {state.status === "error" && (
        <p
          role="alert"
          className="text-[length:var(--fs-body-sm)] text-[color:var(--danger)]"
        >
          {state.error}
        </p>
      )}
      {state.status === "success" && (
        <p
          role="status"
          className="text-[length:var(--fs-body-sm)] text-[color:var(--text-secondary)]"
        >
          {created ? create.success : regenerate.success}
        </p>
      )}

      {!hasLink ? (
        <div>
          <Button type="submit" iconLeft="link" disabled={pending}>
            {pending ? create.running : create.submit}
          </Button>
        </div>
      ) : confirming ? (
        <div className="flex flex-col gap-[var(--space-2)]">
          <p className="text-[length:var(--fs-body-sm)] text-[color:var(--text-secondary)]">
            {regenerate.confirm}
          </p>
          <div className="flex flex-wrap gap-[var(--space-2)]">
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? regenerate.running : regenerate.confirmYes}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setConfirming(false)}
              disabled={pending}
            >
              {regenerate.cancel}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-start gap-[var(--space-2)]">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            iconLeft="rewind"
            onClick={() => setConfirming(true)}
          >
            {regenerate.submit}
          </Button>
          <p className="text-[length:var(--fs-body-sm)] text-[color:var(--text-muted)]">
            {regenerate.hint}
          </p>
        </div>
      )}
    </form>
  );
}
