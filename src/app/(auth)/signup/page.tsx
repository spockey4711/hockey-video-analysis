import { redirect } from "next/navigation";

import { Card } from "@/components/core/Card";
import { Heading } from "@/components/core/Heading";
import { Icon } from "@/components/core/Icon";
import { PanelHeader } from "@/components/core/PanelHeader";
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
        <Heading level={1} size="sub">
          {signup.disabledTitle}
        </Heading>
        <p className="text-[length:var(--fs-body-sm)] text-[color:var(--text-muted)]">
          {signup.disabledBody}
        </p>
      </Card>
    );
  }

  return (
    <Card accent className="p-[var(--space-8)]">
      <PanelHeader
        level={1}
        size="sub"
        title={signup.title}
        hint={signup.subtitle}
        className="mb-[var(--space-6)]"
      />
      <SignupForm next={rawNext ? next : undefined} loginHref="/login" />
    </Card>
  );
}
