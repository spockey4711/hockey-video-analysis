import { redirect } from "next/navigation";

import { Card } from "@/components/core/Card";
import {
  accessContent,
  getCurrentCoach,
  isSignupEnabled,
  LoginForm,
} from "@/features/access";
import { sanitizeNext } from "@/features/access/validation";
import { DEFAULT_REDIRECT, NEXT_PARAM } from "@/lib/auth";

const { login } = accessContent;

/** Coach sign-in page. Redirects a signed-in coach straight to their destination. */
export default async function LoginPage({
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

  const signupHref = isSignupEnabled() ? "/signup" : undefined;

  return (
    <Card accent className="p-[var(--space-8)]">
      <header className="mb-[var(--space-6)] flex flex-col gap-[var(--space-2)]">
        <h1 className="text-[length:var(--fs-title)] [font-weight:var(--fw-semibold)] text-[color:var(--text-primary)]">
          {login.title}
        </h1>
        <p className="text-[length:var(--fs-body-sm)] text-[color:var(--text-muted)]">
          {login.subtitle}
        </p>
      </header>
      <LoginForm next={rawNext ? next : undefined} signupHref={signupHref} />
    </Card>
  );
}
