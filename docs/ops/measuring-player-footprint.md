# Measuring the watch player's RAM and CPU footprint

The tagging player can serve a downscaled proxy rendition instead of the full-resolution chapter
files ([ADR 0006](../decisions/0006-proxy-rendition-for-in-browser-tagging.md)), to cut the RAM and
CPU a full game costs in the browser (P2-6). This is the repeatable before/after check for that
win. It needs a **real game** - multi-chapter, full-length - because the cost is dominated by video
decode and buffering, which small sample clips do not exercise.

## What you need

- A game loaded in the app whose chapters resolve to real full-resolution files via
  `MEDIA_BASE_URL`.
- The same game's proxy renditions available under `MEDIA_PROXY_BASE_URL`, mirroring each chapter's
  relative path with the same duration (the pipeline contract in ADR 0006).
- Chrome (the per-tab **Task Manager** is the clearest read on video memory, since decode buffers
  live outside the JS heap and do not show up in the DevTools memory panel).

## Procedure

Measure the two configurations identically and compare. The only variable is whether
`MEDIA_PROXY_BASE_URL` is set.

1. **Full-resolution baseline.** Start the app with `MEDIA_PROXY_BASE_URL` unset (the player falls
   back to `MEDIA_BASE_URL`). Open the game's watch page in a fresh tab.
2. Open Chrome's Task Manager (`Window > Task Manager`, or `Shift+Esc`). Right-click the column
   header and enable **Memory footprint**, **GPU memory**, and **CPU**. Find the row for the watch
   page tab.
3. Let the video play for ~2 minutes of continuous playback (so the browser settles into its
   steady-state forward buffer), including at least one chapter boundary crossing. Record Memory
   footprint, GPU memory, and CPU.
4. Close the tab. **Proxy run:** restart the app with `MEDIA_PROXY_BASE_URL` set to the proxy root,
   reopen the same game's watch page in a fresh tab, and repeat steps 2-3 with the same playback and
   the same elapsed time.
5. Compare the two sets of numbers. The proxy run should show materially lower Memory footprint, GPU
   memory, and CPU, since the browser decodes and buffers far fewer bytes.

## Notes

- Confirm which rendition is actually playing before trusting a run: in DevTools the `<video>`
  element's `src` (or the Network panel's video request) points at `MEDIA_PROXY_BASE_URL` on the
  proxy run and `MEDIA_BASE_URL` on the baseline.
- Keep everything else constant between runs - same machine, same browser profile, no other heavy
  tabs, same starting game time and playback rate - or the comparison is noise.
- The forward buffer is browser-managed and not capped (ADR 0006); expect memory to plateau rather
than stay flat once playback settles. Compare the plateaus, not the first few seconds.
</content>
