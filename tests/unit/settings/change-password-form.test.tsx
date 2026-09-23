import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// Stub the server action so importing the form does not pull in the auth/db
// chain; each test decides what the action answers.
const { mockAction } = vi.hoisted(() => ({ mockAction: vi.fn() }));
vi.mock("@/features/settings/actions", () => ({
  changePasswordAction: mockAction,
}));

import { ChangePasswordForm } from "@/features/settings/ChangePasswordForm";
import { settingsContent } from "@/features/settings/content";

const { password, errors } = settingsContent;

afterEach(() => {
  cleanup();
  mockAction.mockReset();
});

function submit() {
  fireEvent.click(screen.getByRole("button", { name: password.submit }));
}

describe("ChangePasswordForm", () => {
  it("renders the three password fields and leaves validation to the server", () => {
    const { container } = render(
      <ChangePasswordForm email="coach@example.test" />,
    );

    expect(screen.getByLabelText(password.currentLabel)).toHaveAttribute(
      "autocomplete",
      "current-password",
    );
    expect(screen.getByLabelText(password.newLabel)).toHaveAttribute(
      "autocomplete",
      "new-password",
    );
    expect(screen.getByLabelText(password.confirmLabel)).toHaveAttribute(
      "autocomplete",
      "new-password",
    );
    expect(container.querySelector("form")).toHaveAttribute("novalidate");
  });

  it("carries the coach's email as a hidden username for password managers", () => {
    const { container } = render(
      <ChangePasswordForm email="coach@example.test" />,
    );

    const username = container.querySelector('input[name="username"]');
    expect(username).toHaveAttribute("autocomplete", "username");
    expect(username).toHaveValue("coach@example.test");
    expect(username).not.toBeVisible();
  });

  it("shows a field error from the action next to its field", async () => {
    mockAction.mockResolvedValue({
      fieldErrors: { current: errors.currentWrong },
    });
    render(<ChangePasswordForm email="coach@example.test" />);

    submit();

    await waitFor(() =>
      expect(screen.getByLabelText(password.currentLabel)).toHaveAttribute(
        "aria-invalid",
        "true",
      ),
    );
    expect(screen.getByText(errors.currentWrong)).toBeInTheDocument();
  });

  it("announces a successful change", async () => {
    mockAction.mockResolvedValue({ success: true });
    render(<ChangePasswordForm email="coach@example.test" />);

    submit();

    expect(await screen.findByRole("status")).toHaveTextContent(
      password.success,
    );
  });

  it("surfaces a form-level error as an alert", async () => {
    mockAction.mockResolvedValue({ error: errors.tooManyAttempts });
    render(<ChangePasswordForm email="coach@example.test" />);

    submit();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      errors.tooManyAttempts,
    );
  });
});
