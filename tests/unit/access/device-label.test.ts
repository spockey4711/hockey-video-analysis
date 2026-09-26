import { describe, expect, it } from "vitest";

import {
  cleanDeviceName,
  DEVICE_NAME_MAX_LENGTH,
  deviceLabelFromUserAgent,
} from "@/features/access/device-label";

// Real user agents of the browsers coaches use, trimmed of nothing: the labels
// must survive every token these strings carry.
const AGENTS: readonly [string, string][] = [
  [
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
    "Chrome auf macOS",
  ],
  [
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15",
    "Safari auf macOS",
  ],
  [
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1",
    "Safari auf iPhone",
  ],
  [
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/140.0.0.0 Mobile/15E148 Safari/604.1",
    "Chrome auf iPhone",
  ],
  [
    "Mozilla/5.0 (iPad; CPU OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/142.0 Mobile/15E148 Safari/605.1.15",
    "Firefox auf iPad",
  ],
  [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0",
    "Edge auf Windows",
  ],
  [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0",
    "Firefox auf Windows",
  ],
  [
    "Mozilla/5.0 (Linux; Android 15; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/28.0 Chrome/130.0.0.0 Mobile Safari/537.36",
    "Samsung Internet auf Android",
  ],
  [
    "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36",
    "Chrome auf Android",
  ],
  [
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 OPR/122.0.0.0",
    "Opera auf Linux",
  ],
  [
    "Mozilla/5.0 (X11; CrOS x86_64 16328.55.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
    "Chrome auf ChromeOS",
  ],
];

describe("deviceLabelFromUserAgent", () => {
  it.each(AGENTS)("labels %s", (agent, label) => {
    expect(deviceLabelFromUserAgent(agent)).toBe(label);
  });

  it("keeps only the browser family and system, no versions", () => {
    for (const [agent] of AGENTS) {
      expect(deviceLabelFromUserAgent(agent)).not.toMatch(/\d/);
    }
  });

  it("falls back for unknown or missing agents", () => {
    expect(deviceLabelFromUserAgent(null)).toBe("Unbekannter Browser");
    expect(deviceLabelFromUserAgent("curl/8.7.1")).toBe("Unbekannter Browser");
    expect(deviceLabelFromUserAgent("SomeBot (Windows)")).toBe(
      "Browser auf Windows",
    );
  });
});

describe("cleanDeviceName", () => {
  it("keeps a plain name", () => {
    expect(cleanDeviceName("MacBook Pro von Alex")).toBe(
      "MacBook Pro von Alex",
    );
  });

  it("drops control and format characters and collapses whitespace", () => {
    expect(cleanDeviceName("  Mac\u0000Book\n\t Pro‮  ")).toBe("Mac Book Pro");
  });

  it("cuts long names", () => {
    const cleaned = cleanDeviceName("x".repeat(200));
    expect(cleaned).toHaveLength(DEVICE_NAME_MAX_LENGTH);
  });

  it("refuses a name with nothing printable", () => {
    expect(cleanDeviceName(" ​\n ")).toBeNull();
  });
});
