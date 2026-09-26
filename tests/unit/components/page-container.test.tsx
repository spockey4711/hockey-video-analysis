import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { PageContainer } from "@/components/core/PageContainer";

afterEach(cleanup);

describe("PageContainer", () => {
  it("renders the main landmark at the shared page width by default", () => {
    render(<PageContainer>Inhalt</PageContainer>);
    const main = screen.getByRole("main");
    expect(main).toHaveTextContent("Inhalt");
    expect(main).toHaveClass("max-w-[var(--page-max)]");
  });

  it("renders the narrower form column when asked", () => {
    render(<PageContainer width="form">Formular</PageContainer>);
    const main = screen.getByRole("main");
    expect(main).toHaveClass("max-w-[var(--page-max-form)]");
    expect(main).not.toHaveClass("max-w-[var(--page-max)]");
  });

  it("merges a caller's classes and forwards arbitrary props", () => {
    render(
      <PageContainer id="content" className="gap-[var(--space-4)]">
        Inhalt
      </PageContainer>,
    );
    const main = screen.getByRole("main");
    expect(main).toHaveAttribute("id", "content");
    expect(main).toHaveClass("gap-[var(--space-4)]");
    expect(main).not.toHaveClass("gap-[var(--space-6)]");
  });
});
