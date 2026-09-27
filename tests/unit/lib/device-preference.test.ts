import { afterEach, describe, expect, it, vi } from "vitest";

import { createDevicePreference } from "@/lib/device-preference";

const KEY = "test-preference";

function makePreference() {
  return createDevicePreference({
    key: KEY,
    values: ["a", "b", "c"] as const,
    fallback: "a",
  });
}

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("createDevicePreference", () => {
  it("reads the fallback with nothing or an unknown value stored", () => {
    const preference = makePreference();
    expect(preference.read()).toBe("a");
    localStorage.setItem(KEY, "z");
    expect(preference.read()).toBe("a");
  });

  it("stores a choice and removes the key for the fallback", () => {
    const preference = makePreference();
    preference.write("b");
    expect(localStorage.getItem(KEY)).toBe("b");
    expect(preference.read()).toBe("b");

    preference.write("a");
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it("tells subscribers about a write in this tab until they unsubscribe", () => {
    const preference = makePreference();
    const listener = vi.fn();
    const unsubscribe = preference.subscribe(listener);

    preference.write("c");
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    preference.write("b");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("tells subscribers about its own key changing in another tab", () => {
    const preference = makePreference();
    const listener = vi.fn();
    preference.subscribe(listener);

    window.dispatchEvent(new StorageEvent("storage", { key: "other" }));
    expect(listener).not.toHaveBeenCalled();

    window.dispatchEvent(new StorageEvent("storage", { key: KEY }));
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("holds a choice for the page when storage is blocked", () => {
    const preference = makePreference();
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    preference.write("c");
    expect(preference.read()).toBe("c");
  });
});
