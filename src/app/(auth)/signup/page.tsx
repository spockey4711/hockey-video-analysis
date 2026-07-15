import { redirect } from "next/navigation";

import { Card } from "@/components/core/Card";
import { Icon } from "@/components/core/Icon";
import {
  accessContent,
  getCurrentCoach,
  isSignupEnabled,
  SignupForm,
} from "@/features/access";
import { sanitizeNext } from "@/features/access/validation";
import { DEFAULT_REDIRECT, NEXT_PARAM } from "@/lib/auth";

const { signup } = accessContent;

/** Invite-gated coach registration page. Shows a notice when signup is disabled. */
export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const rawNext =
    typeof params[NEXT_PARAM] === "string" ? params[NEXT_PARAM] : undefined;
  const next = sanitizeNext(rawNext, DEFAULT_REDIRECT);

  if (await getCurrentCoach()) {
    redirect(next);
  }

  if (!isSignupEnabled()) {
    return (
      <Card className="flex flex-col items-center gap-[var(--space-3)] p-[var(--space-8)] text-center">
        <span
          aria-hidden
          className="flex size-[var(--space-12)] items-center justify-center rounded-[var(--radius-pill)] bg-[var(--surface-inset)] text-[color:var(--text-muted)]"
        >
          <Icon name="alert-triangle" size={20} />
        </span>
        <h1 className="text-[length:var(--fs-title)] [font-weight:var(--fw-semibold)] text-[color:var(--text-primary)]">
          {signup.disabledTitle}
        </h1>
        <p className="text-[length:var(--fs-body-sm)] text-[color:var(--text-muted)]">
          {signup.disabledBody}
        </p>
      </Card>
    );
  }

  return (
    <Card accent className="p-[var(--space-8)]">
      <header className="mb-[var(--space-6)] flex flex-col gap-[var(--space-2)]">
        <h1 className="text-[length:var(--fs-title)] [font-weight:var(--fw-semibold)] text-[color:var(--text-primary)]">
          {signup.title}
        </h1>
        <p className="text-[length:var(--fs-body-sm)] text-[color:var(--text-muted)]">
          {signup.subtitle}
        </p>
      </header>
      <SignupForm next={rawNext ? next : undefined} loginHref="/login" />
    </Card>
  );
}
