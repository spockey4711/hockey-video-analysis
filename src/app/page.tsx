import Link from "next/link";

import { Card } from "@/components/core/Card";
import { Button } from "@/components/forms/Button";
import { getCurrentCoach } from "@/features/access";
import { listGames } from "@/features/games";
import {
  homeContent,
  RECENT_GAMES_PEEK_LIMIT,
  RecentGamesPeek,
} from "@/features/home";

const { hero, features, signedOut, signedIn } = homeContent;

/**
 * The coach landing page. Public and auth-aware: signed-out visitors see the
 * value proposition and a sign-in call to action; a signed-in coach is greeted
 * and sent on to their games, with a short peek at the most recent ones.
 */
export default async function HomePage() {
  const coach = await getCurrentCoach();
  const recentGames = coach
    ? (await listGames()).slice(0, RECENT_GAMES_PEEK_LIMIT)
    : [];

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center gap-[var(--space-8)] px-[var(--space-6)] py-[var(--space-16)]">
      <header className="flex flex-col gap-[var(--space-4)]">
        <span className="text-[length:var(--fs-body-sm)] [font-weight:var(--fw-medium)] tracking-widest text-[color:var(--accent)] uppercase">
          {hero.eyebrow}
        </span>
        <h1 className="text-[length:var(--fs-display)] [font-weight:var(--fw-semibold)] text-balance text-[color:var(--text-primary)]">
          {hero.title}
        </h1>
        <p className="max-w-2xl text-[length:var(--fs-title)] text-[color:var(--text-muted)]">
          {hero.subtitle}
        </p>

        <div className="mt-[var(--space-2)]">
          {coach ? (
            <div className="flex flex-col gap-[var(--space-3)]">
              <p className="text-[length:var(--fs-body)] text-[color:var(--text-secondary)]">
                {signedIn.greeting(coach.name)}
              </p>
              <Link href="/games" className="self-start">
                <Button size="lg" iconRight="fast-forward">
                  {signedIn.cta}
                </Button>
              </Link>
            </div>
          ) : (
            <Link href="/login" className="inline-block">
              <Button size="lg" iconRight="chevron-right">
                {signedOut.cta}
              </Button>
            </Link>
          )}
        </div>
      </header>

      {coach ? (
        <RecentGamesPeek games={recentGames} />
      ) : (
        <ul className="grid gap-[var(--space-3)] sm:grid-cols-3">
          {features.map((feature) => (
            <li key={feature.title}>
              <Card className="h-full p-[var(--space-4)]">
                <h2 className="[font-weight:var(--fw-medium)] text-[color:var(--text-primary)]">
                  {feature.title}
                </h2>
                <p className="mt-[var(--space-1)] text-[length:var(--fs-body-sm)] text-[color:var(--text-muted)]">
                  {feature.description}
                </p>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
