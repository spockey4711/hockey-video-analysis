import "@testing-library/jest-dom/vitest";

// jsdom does not implement HTMLMediaElement playback methods and logs a noisy
// "Not implemented" warning when the player exercises them (e.g. the unmount
// cleanup that calls `load()` to release the decoder). Stub them as no-ops so
// component tests that mount the player stay quiet; behaviour is asserted
// through the pure playback helpers, not the DOM media API.
Object.defineProperties(window.HTMLMediaElement.prototype, {
  load: { configurable: true, value: () => {} },
  play: { configurable: true, value: () => Promise.resolve() },
  pause: { configurable: true, value: () => {} },
});
