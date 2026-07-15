#!/usr/bin/env bash
# protect-branches.sh - turn the documented git workflow into an enforced one by
# applying GitHub branch protection to the long-lived branches via `gh api`.
#
# The workflow in docs/engineering/git-workflow.md is a convention until the host
# enforces it. This script closes that gap: it requires pull requests, approving
# reviews, and (when a CODEOWNERS file is present) code-owner review on
# $MAIN_BRANCH and $BASE_BRANCH, and blocks direct pushes, force-pushes and
# branch deletion. It is opt-in - nothing runs it for you - and idempotent, so
# re-running it just reconciles the current rules.
#
# Requires the GitHub CLI (https://cli.github.com) authenticated as a user with
# admin rights on the repository. Reads the branch names from scripts/wt.conf
# (the same source wt.sh uses), so a single-branch trunk project protects only
# its one branch.
#
# Usage:
#   scripts/protect-branches.sh [options]
#
# Options:
#   --reviews <n>     required approving reviews (default: 1)
#   --admins          also enforce the rules for administrators
#   --no-codeowners   do not require code-owner review even if CODEOWNERS exists
#   --repo <o/r>      target repository (default: the current checkout's remote)
#   --dry-run         print what would change without calling the API
#   -h, --help        show this help
#
# See docs/engineering/git-workflow.md for the workflow these rules enforce.
set -euo pipefail

# ---- Defaults (override in scripts/wt.conf) --------------------------------
MAIN_BRANCH="master"
BASE_BRANCH="develop"

# Source project config if present (next to this script), sharing wt.sh's file so
# the branch names never drift between the two tools.
_pb_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
[ -f "$_pb_dir/wt.conf" ] && . "$_pb_dir/wt.conf"
# ----------------------------------------------------------------------------

REVIEWS=1
ENFORCE_ADMINS=false
REQUIRE_CODEOWNERS=1
REPO=""
DRY_RUN=0

die() { printf 'protect-branches: %s\n' "$*" >&2; exit 1; }
info() { printf '  %s\n' "$*"; }

usage() {
  # Print the leading comment block (minus the shebang) as help text.
  sed -n '2,29p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --reviews)       REVIEWS="$2"; shift 2 ;;
    --admins)        ENFORCE_ADMINS=true; shift ;;
    --no-codeowners) REQUIRE_CODEOWNERS=0; shift ;;
    --repo)          REPO="$2"; shift 2 ;;
    --dry-run)       DRY_RUN=1; shift ;;
    -h|--help)       usage; exit 0 ;;
    *)               die "unknown option: $1 (try --help)" ;;
  esac
done

case "$REVIEWS" in
  ''|*[!0-9]*) die "--reviews expects a non-negative integer, got '$REVIEWS'" ;;
esac

command -v gh >/dev/null 2>&1 || die "the GitHub CLI (gh) is required: https://cli.github.com"
gh auth status >/dev/null 2>&1 || die "gh is not authenticated - run 'gh auth login' first"

# Resolve the target repository. Default to the current checkout's remote so the
# script "just works" from inside a scaffolded project.
if [ -z "$REPO" ]; then
  REPO="$(gh repo view --json nameWithOwner --jq .nameWithOwner 2>/dev/null)" \
    || die "could not detect the repository - pass --repo <owner>/<name>"
fi

# Require code-owner review only when a CODEOWNERS file is actually present;
# GitHub rejects the rule otherwise. Look in the three locations it honors.
require_codeowners=false
if [ "$REQUIRE_CODEOWNERS" -eq 1 ]; then
  for loc in CODEOWNERS .github/CODEOWNERS docs/CODEOWNERS; do
    if [ -f "$loc" ]; then require_codeowners=true; break; fi
  done
fi

# The list of branches to protect, de-duplicated so a single-branch trunk project
# (BASE_BRANCH == MAIN_BRANCH) is not configured twice.
branches="$MAIN_BRANCH"
[ "$BASE_BRANCH" != "$MAIN_BRANCH" ] && branches="$branches $BASE_BRANCH"

# Build the protection payload once - it is the same for every branch. No jq: the
# values are all literals, so a heredoc is enough.
protection_body() {
  cat <<EOF
{
  "required_status_checks": null,
  "enforce_admins": $ENFORCE_ADMINS,
  "required_pull_request_reviews": {
    "required_approving_review_count": $REVIEWS,
    "require_code_owner_reviews": $require_codeowners,
    "dismiss_stale_reviews": true
  },
  "restrictions": null,
  "required_conversation_resolution": true,
  "allow_force_pushes": false,
  "allow_deletions": false
}
EOF
}

echo "Protecting branches on $REPO"
info "reviews: $REVIEWS   code-owner review: $require_codeowners   enforce for admins: $ENFORCE_ADMINS"
[ "$DRY_RUN" -eq 1 ] && info "(dry run - no changes will be made)"
echo

failed=0
for branch in $branches; do
  # Skip a branch that does not exist on the remote rather than fail the whole run.
  if ! gh api "repos/$REPO/branches/$branch" >/dev/null 2>&1; then
    info "skip $branch (no such branch on $REPO)"
    continue
  fi

  if [ "$DRY_RUN" -eq 1 ]; then
    info "would protect $branch"
    continue
  fi

  if protection_body | gh api --method PUT \
      "repos/$REPO/branches/$branch/protection" --input - >/dev/null 2>&1; then
    info "protected $branch"
  else
    info "FAILED to protect $branch (need admin rights on $REPO?)"
    failed=1
  fi
done

echo
if [ "$failed" -ne 0 ]; then
  die "one or more branches could not be protected"
fi
[ "$DRY_RUN" -eq 1 ] && echo "Dry run complete." || echo "Done."
