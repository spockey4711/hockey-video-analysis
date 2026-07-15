import { describe, expect, it } from "vitest";

import {
  collectionSharePath,
  collectionShareUrl,
} from "@/features/share/collections/share-link";

const TOKEN = "s3cr3t-collection-token-abcdef";

describe("collectionSharePath", () => {
  it("appends the token to the collection share route", () => {
    expect(collectionSharePath(TOKEN)).toBe(`/share/collection/${TOKEN}`);
  });
});

describe("collectionShareUrl", () => {
  it("returns the app-relative path when no base URL is known", () => {
    expect(collectionShareUrl(TOKEN)).toBe(`/share/collection/${TOKEN}`);
    expect(collectionShareUrl(TOKEN, undefined)).toBe(
      `/share/collection/${TOKEN}`,
    );
    expect(collectionShareUrl(TOKEN, null)).toBe(`/share/collection/${TOKEN}`);
  });

  it("joins an absolute base URL onto the path", () => {
    expect(collectionShareUrl(TOKEN, "https://app.example.com")).toBe(
      `https://app.example.com/share/collection/${TOKEN}`,
    );
  });

  it("trims a trailing slash on the base so the result never doubles up", () => {
    expect(collectionShareUrl(TOKEN, "https://app.example.com/")).toBe(
      `https://app.example.com/share/collection/${TOKEN}`,
    );
  });
});
