import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/settings/devices/actions", () => ({
  signOutDeviceAction: vi.fn(),
  signOutOtherDevicesAction: vi.fn(),
}));

import { settingsContent } from "@/features/settings/content";
import { DeviceList, type DeviceRow } from "@/features/settings/devices";

afterEach(cleanup);

const { devices } = settingsContent;

const HERE: DeviceRow = {
  publicId: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
  name: "Chrome auf macOS",
  kindLabel: "Browser",
  icon: "monitor",
  current: true,
  lastUsed: devices.activeNow,
};
const MAC: DeviceRow = {
  publicId: "3f2504e0-4f89-41d3-9a0c-0305e82c3302",
  name: "MacBook Pro",
  kindLabel: "Mac-App",
  icon: "laptop",
  current: false,
  lastUsed: "Zuletzt verwendet vor 3 Stunden",
};

describe("DeviceList", () => {
  it("marks this browser and gives every row its own sign-out", () => {
    render(<DeviceList rows={[HERE, MAC]} />);

    const items = within(
      screen.getByRole("list", { name: devices.listLabel }),
    ).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(within(items[0]!).getByText(devices.thisDevice)).toBeInTheDocument();
    expect(within(items[1]!).queryByText(devices.thisDevice)).toBeNull();
    expect(
      within(items[1]!).getByText("Mac-App · Zuletzt verwendet vor 3 Stunden"),
    ).toBeInTheDocument();

    const macButton = screen.getByRole("button", {
      name: devices.signOutNamed("MacBook Pro"),
    });
    expect(macButton).toHaveAttribute("type", "submit");
    const hidden = macButton
      .closest("form")
      ?.querySelector('input[name="publicId"]');
    expect(hidden).toHaveValue(MAC.publicId);
  });

  it("confirms before signing out every other device", () => {
    render(<DeviceList rows={[HERE, MAC]} />);

    fireEvent.click(
      screen.getByRole("button", { name: devices.others.action }),
    );

    expect(screen.getByText(devices.others.confirm)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: devices.others.confirmYes }),
    ).toHaveAttribute("type", "submit");
  });

  it("hides the bulk sign-out when this browser is the only one", () => {
    render(<DeviceList rows={[HERE]} />);

    expect(
      screen.queryByRole("button", { name: devices.others.action }),
    ).toBeNull();
  });
});
