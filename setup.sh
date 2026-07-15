#!/usr/bin/env bash
# setup.sh - wire the Next.js/pnpm toolchain after `devblueprint init`.
#
# Idempotent and safe: it only creates files that are missing and adds the
# package.json scripts/fields that are absent, so it can be re-run and will not
# clobber your edits. Run it from the project root:
#
#   ./setup.sh              # wire config + install the dev toolchain
#   ./setup.sh --no-install # wire config only, skip `pnpm add`
#
# It does NOT scaffold the Next.js app itself - run `pnpm create next-app .`
# first (or point this at an existing app).
set -euo pipefail

DO_INSTALL=1
[ "${1:-}" = "--no-install" ] && DO_INSTALL=0

say() { printf '  %s\n' "$*"; }

# write_if_absent <path> : create the file from stdin unless it already exists.
write_if_absent() {
  if [ -e "$1" ]; then say "skip $1 (exists)"; return 0; fi
  mkdir -p "$(dirname "$1")"
  cat > "$1"
  say "wrote $1"
}

echo "Wiring the Next.js toolchain..."

# --- package.json: create if missing, then add scripts + fields idempotently --
if [ ! -f package.json ]; then
  printf '{\n  "name": "%s",\n  "private": true,\n  "version": "0.1.0"\n}\n' \
    "$(basename "$PWD")" > package.json
  say "wrote package.json (minimal)"
fi

PM_VERSION="$(pnpm --version 2>/dev/null || echo 9)"
NODE_MAJOR="$(node -v 2>/dev/null | sed 's/^v//; s/\..*//')"
[ -n "$NODE_MAJOR" ] || NODE_MAJOR=22

# Patch package.json with node (available in a Node project). Only fills gaps.
PM_VERSION="$PM_VERSION" node <<'NODE'
const fs = require('fs');
const p = JSON.parse(fs.readFileSync('package.json', 'utf8'));
p.scripts ||= {};
const scripts = {
  wt: 'bash scripts/wt.sh',
  dev: 'next dev',
  build: 'next build',
  start: 'next start',
  lint: 'eslint .',
  typecheck: 'tsc --noEmit',
  test: 'vitest run',
  'test:watch': 'vitest',
  'test:e2e': 'playwright test',
  format: 'prettier --write .',
  'format:check': 'prettier --check .',
  prepare: 'husky',
};
for (const [k, v] of Object.entries(scripts)) if (!p.scripts[k]) p.scripts[k] = v;
if (!p.packageManager) p.packageManager = `pnpm@${process.env.PM_VERSION}`;
fs.writeFileSync('package.json', JSON.stringify(p, null, 2) + '\n');
NODE
say "patched package.json (scripts + packageManager)"

# --- version pin for CI (.nvmrc) --------------------------------------------
[ -f .nvmrc ] || { printf '%s\n' "$NODE_MAJOR" > .nvmrc; say "wrote .nvmrc ($NODE_MAJOR)"; }

# --- ESLint (flat config, Next presets + prettier last) ----------------------
write_if_absent eslint.config.mjs <<'EOF'
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const compat = new FlatCompat({ baseDirectory: __dirname });

export default [
  ...compat.extends('next/core-web-vitals', 'next/typescript', 'prettier'),
  {
    rules: {
      'import/order': [
        'warn',
        { 'newlines-between': 'always', alphabetize: { order: 'asc' } },
      ],
    },
  },
];
EOF

# --- Prettier ----------------------------------------------------------------
write_if_absent prettier.config.mjs <<'EOF'
/** @type {import('prettier').Config} */
export default {
  plugins: ['prettier-plugin-tailwindcss'],
};
EOF
write_if_absent .prettierignore <<'EOF'
pnpm-lock.yaml
.next/
coverage/
playwright-report/
EOF

# --- TypeScript (strict) - only if the app has none yet ----------------------
write_if_absent tsconfig.json <<'EOF'
{
  "compilerOptions": {
    "strict": true,
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "module": "esnext",
    "moduleResolution": "bundler",
    "jsx": "preserve",
    "noEmit": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "incremental": true,
    "paths": { "@/*": ["./src/*"] },
    "plugins": [{ "name": "next" }]
  },
  "include": ["**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
EOF

# --- Vitest + Testing Library ------------------------------------------------
write_if_absent vitest.config.ts <<'EOF'
import { fileURLToPath } from 'url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['tests/unit/**/*.test.{ts,tsx}'],
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
});
EOF
write_if_absent vitest.setup.ts <<'EOF'
import '@testing-library/jest-dom/vitest';
EOF

# --- Playwright --------------------------------------------------------------
write_if_absent playwright.config.ts <<'EOF'
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  use: { baseURL: 'http://localhost:3000' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
EOF

# --- pre-commit: husky + lint-staged ----------------------------------------
write_if_absent .lintstagedrc.json <<'EOF'
{
  "*.{ts,tsx,js,jsx,css,md,json}": ["prettier --write"],
  "*.{ts,tsx}": ["eslint --fix"]
}
EOF
write_if_absent .husky/pre-commit <<'EOF'
pnpm exec lint-staged
EOF
chmod +x .husky/pre-commit 2>/dev/null || true

# --- install the dev toolchain ----------------------------------------------
DEV_DEPS="eslint eslint-config-next @eslint/eslintrc eslint-config-prettier \
prettier prettier-plugin-tailwindcss typescript @types/node @types/react \
@types/react-dom vitest @vitejs/plugin-react jsdom @testing-library/react \
@testing-library/jest-dom @playwright/test husky lint-staged"

if [ "$DO_INSTALL" -eq 1 ] && command -v pnpm >/dev/null 2>&1; then
  echo "Installing dev dependencies (pnpm add -D)..."
  # shellcheck disable=SC2086
  if pnpm add -D $DEV_DEPS && pnpm exec playwright install chromium; then
    :
  else
    say "install failed - run it manually (see below)"; DO_INSTALL=0
  fi
else
  DO_INSTALL=0
fi

echo
echo "Toolchain wired."
[ "$DO_INSTALL" -eq 0 ] && {
  echo "Still to run yourself:"
  echo "  pnpm add -D $DEV_DEPS"
  echo "  pnpm exec playwright install chromium"
}
echo "Then: pnpm install && git init && git switch -c develop"
echo "Verify the gate: pnpm lint && pnpm typecheck && pnpm test && pnpm build"
