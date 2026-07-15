import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emit a self-contained server bundle for the self-hosting Dockerfile.
  output: "standalone",
  reactStrictMode: true,
  // Type checking runs as its own quality-gate step (`pnpm typecheck`), so
  // `next build` does not repeat it. This is also currently required: the
  // pinned typescript@7 native port drops the classic compiler API, which
  // crashes Next's in-build TS checker. Revisit when the TS toolchain is fixed.
  typescript: { ignoreBuildErrors: true },
};

export default nextConfig;
