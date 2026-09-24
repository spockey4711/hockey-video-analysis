import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { middleware } from "@/middleware";

function statusFor(pathname: string): number {
  return middleware(new NextRequest(new URL(pathname, "http://localhost")))
    .status;
}

describe("middleware legal pages", () => {
  it.each(["/impressum", "/datenschutz"])(
    "lets %s through without a session",
    (pathname) => {
      // A legal page behind the login would defeat its purpose.
      expect(statusFor(pathname)).toBe(200);
    },
  );

  it("still redirects a coach-only page to login without a session", () => {
    expect(statusFor("/games")).toBe(307);
  });
});
