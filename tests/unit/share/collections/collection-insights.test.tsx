import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { commentsContent } from "@/features/clips/comments/content";
import { CollectionInsights } from "@/features/share/collections/CollectionInsights";
import { collectionsContent } from "@/features/share/collections/content";
import type { CollectionInsights as Insights } from "@/features/share/collections/insights";
import { EMPTY_VIEW_COUNTS } from "@/features/share/views/stats";

afterEach(cleanup);

const { insights: copy } = collectionsContent.coach;

function insights(overrides: Partial<Insights> = {}): Insights {
  return {
    summary: { clicks: 12, fullViews: 7, replays: 3, uniqueViewers: 5 },
    clips: [
      {
        id: "a",
        title: "Tor",
        subtitle: "HTHC - gegen UHC - 12:34",
        counts: { clicks: 9, fullViews: 6, replays: 3, uniqueViewers: 4 },
        comments: [
          {
            id: "c1",
            author: "Alex",
            body: "Stark gespielt.",
            isCoach: false,
            createdAt: "2026-09-22T12:05:00.000Z",
            date: "22.09.2026, 14:05",
          },
        ],
      },
      {
        id: "b",
        title: "Ecke kurz",
        subtitle: "HTHC - 30:00",
        counts: EMPTY_VIEW_COUNTS,
        comments: [],
      },
    ],
    hasActivity: true,
    ...overrides,
  };
}

/** The figure value next to a label inside a `<dl>`. */
function figure(list: HTMLElement, label: string): string | null | undefined {
  return within(list).getByText(label).parentElement?.querySelector("dd")
    ?.textContent;
}

describe("CollectionInsights", () => {
  it("shows the collection totals with an honest per-day viewer label", () => {
    render(<CollectionInsights insights={insights()} />);

    const list = screen.getByLabelText(copy.summaryLabel);
    expect(figure(list, copy.clicks)).toBe("12");
    expect(figure(list, copy.fullViews)).toBe("7");
    expect(figure(list, copy.replays)).toBe("3");
    expect(figure(list, copy.uniqueViewers)).toBe("5");
    expect(copy.uniqueViewers).toMatch(/pro Tag/);
    expect(screen.getByText(copy.uniqueViewersHint)).toBeInTheDocument();
  });

  it("shows each clip's figures and comments, read-only", () => {
    render(<CollectionInsights insights={insights()} />);

    const goal = screen.getByLabelText(copy.clipFiguresLabel("Tor"));
    expect(figure(goal, copy.clicks)).toBe("9");
    expect(figure(goal, copy.uniqueViewers)).toBe("4");
    expect(
      figure(
        screen.getByLabelText(copy.clipFiguresLabel("Ecke kurz")),
        copy.clicks,
      ),
    ).toBe("0");

    expect(screen.getByText(copy.commentsHeading(1))).toBeInTheDocument();
    expect(screen.getByText("Alex")).toBeInTheDocument();
    expect(screen.getByText("Stark gespielt.")).toBeInTheDocument();
    const time = screen.getByText("22.09.2026, 14:05");
    expect(time.tagName).toBe("TIME");
    expect(time).toHaveAttribute("dateTime", "2026-09-22T12:05:00.000Z");
    expect(screen.getByText(copy.noComments)).toBeInTheDocument();

    // Read-only: no form, field or button to post a comment.
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("highlights a coach comment with the coach label", () => {
    const [goal] = insights().clips;
    render(
      <CollectionInsights
        insights={insights({
          clips: [
            {
              ...goal,
              comments: [
                {
                  ...goal.comments[0],
                  id: "c0",
                  author: "Trainerin",
                  body: "Hier früher abspielen.",
                  isCoach: true,
                },
                ...goal.comments,
              ],
            },
          ],
        })}
      />,
    );
    const [coach, viewer] = screen.getAllByRole("listitem").slice(1);
    expect(coach).toHaveTextContent(commentsContent.coachLabel);
    expect(coach).toHaveTextContent("Hier früher abspielen.");
    expect(viewer).not.toHaveTextContent(commentsContent.coachLabel);
  });

  it("shows a friendly empty state while nothing has been recorded", () => {
    render(
      <CollectionInsights
        insights={insights({
          summary: EMPTY_VIEW_COUNTS,
          clips: [{ ...insights().clips[1] }],
          hasActivity: false,
        })}
      />,
    );
    expect(screen.getByText(copy.emptyTitle)).toBeInTheDocument();
    expect(screen.getByText(copy.emptyHint)).toBeInTheDocument();
    expect(screen.queryByLabelText(copy.summaryLabel)).not.toBeInTheDocument();
  });

  it("points to the checklist while the collection holds no clip", () => {
    render(
      <CollectionInsights
        insights={insights({
          summary: EMPTY_VIEW_COUNTS,
          clips: [],
          hasActivity: false,
        })}
      />,
    );
    expect(screen.getByText(copy.noClips.title)).toBeInTheDocument();
    expect(screen.queryByText(copy.emptyTitle)).not.toBeInTheDocument();
  });

  it("is a labelled region", () => {
    render(<CollectionInsights insights={insights()} />);
    expect(
      screen.getByRole("region", { name: copy.heading }),
    ).toBeInTheDocument();
  });
});
