import Link from "next/link";

import { Heading } from "@/components/core/Heading";
import { Button } from "@/components/forms/Button";
import { getCurrentCoach } from "@/features/access";
import { listGames } from "@/features/games";
import {
  AudiencePaths,
  GameTimeline,
  homeContent,
  HowItWorks,
  QuickActions,
  RECENT_GAMES_PEEK_LIMIT,
  RecentGamesPeek,
} from "@/features/home";

const { hero, signedOut, signedIn } = homeContent;

/**
 * The coach landing page. Public and auth-aware: signed-out visitors get the
 * value proposition, a live demo timeline, the end-to-end flow and the two ways
 * in (coach vs. player); a signed-in coach is greeted and sent on to their work,
 * with quick actions and a peek at recent games.
 */
export default async function HomePage() {
  const coach = await getCurrentCoach();
  const recentGames = coach
    ? (await listGames()).slice(0, RECENT_GAMES_PEEK_LIMIT)
    : [];

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-[var(--space-16)] px-[var(--space-6)] py-[var(--space-16)]">
      <section className="grid items-center gap-[var(--space-8)] lg:grid-cols-2">
        <header className="flex flex-col gap-[var(--space-4)]">
          <span className="text-[length:var(--fs-body-sm)] [font-weight:var(--fw-medium)] tracking-[var(--ls-caps)] text-[color:var(--accent)] uppercase">
            {hero.eyebrow}
          </span>
          <Heading level={1} size="display" className="text-balance">
            {hero.title}
          </Heading>
          <p className="max-w-2xl text-[length:var(--fs-title)] [line-height:var(--lh-snug)] text-[color:var(--text-muted)]">
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

        <GameTimeline />
      </section>

      {coach ? (
        <>
          <QuickActions />
          <RecentGamesPeek games={recentGames} />
        </>
      ) : (
        <>
          <HowItWorks />
          <AudiencePaths />
        </>
      )}
    </main>
  );
}
