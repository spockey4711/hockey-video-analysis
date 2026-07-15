#!/usr/bin/env sh
# check-env.sh - validate the project's environment configuration against a
# declarative schema, so `.env.example` cannot silently drift from the variables
# the app actually reads. Wired into `make check` via the `validate-env` target,
# so the contract is enforced on every PR, not just documented.
#
# It runs three checks:
#   1. Every variable declared in .env.schema is documented in .env.example (as
#      an active or commented `NAME=` line), and every variable in .env.example
#      is declared in the schema - the example and the schema stay in lockstep.
#   2. If a real env file is present (.env, or $ENV_FILE), every `required`
#      variable in the schema is set and non-empty there.
#   3. Any schema variable with a `pattern=` that has a value in the real env
#      file must match that pattern.
#
# Schema format (.env.schema), one variable per line:
#   NAME  required|optional  [pattern=<ERE>]   # free-text description
# Blank lines and `#`-comment lines are ignored. See .env.schema for details.
#
# Exit status: 0 when the environment is valid, 1 when any check fails (all
# problems are reported, not just the first). Depends only on POSIX sh + sed +
# grep, so it runs anywhere the quality gate does.

set -eu

SCHEMA=".env.schema"
EXAMPLE=".env.example"
ENV_FILE="${ENV_FILE:-.env}"

while [ $# -gt 0 ]; do
  case "$1" in
    --schema)  SCHEMA="$2";   shift 2 ;;
    --example) EXAMPLE="$2";  shift 2 ;;
    --env)     ENV_FILE="$2"; shift 2 ;;
    -h|--help) sed -n '2,24p' "$0"; exit 0 ;;
    *) echo "check-env: unknown argument: $1" >&2; exit 2 ;;
  esac
done

# No schema means nothing to enforce - a variant that has not opted in stays green.
if [ ! -f "$SCHEMA" ]; then
  echo "check-env: no $SCHEMA - nothing to validate"
  exit 0
fi

errors=0
err() { echo "check-env: ERROR: $*" >&2; errors=$((errors + 1)); }

work="$(mktemp -d "${TMPDIR:-/tmp}/check-env.XXXXXX")"
trap 'rm -rf "$work"' EXIT
rows="$work/rows"      # parsed schema: NAME<TAB>REQUIRED<TAB>PATTERN
ex_keys="$work/ex"     # variable names mentioned in .env.example

# --- parse the schema into tab-separated rows -------------------------------
# Strip inline `#` descriptions, then read NAME, the required/optional flag, and
# an optional pattern=<ERE> token in any order after the name.
sed 's/#.*$//' "$SCHEMA" | while IFS= read -r line; do
  # shellcheck disable=SC2086  # deliberate word-splitting into positional args
  set -- $line
  [ $# -ge 1 ] || continue
  name="$1"; shift
  req="optional"; pat=""
  if [ $# -ge 1 ]; then req="$1"; shift; fi
  for tok in "$@"; do
    case "$tok" in pattern=*) pat="${tok#pattern=}" ;; esac
  done
  case "$req" in
    required|optional) : ;;
    *) echo "check-env: ERROR: $name: flag must be required|optional, got '$req'" >&2 ;;
  esac
  printf '%s\t%s\t%s\n' "$name" "$req" "$pat"
done > "$rows"

# --- collect the variable names used in .env.example ------------------------
if [ -f "$EXAMPLE" ]; then
  sed -n 's/^[[:space:]]*#\{0,1\}[[:space:]]*\([A-Za-z_][A-Za-z0-9_]*\)=.*/\1/p' \
    "$EXAMPLE" | sort -u > "$ex_keys"
else
  err "no $EXAMPLE alongside the schema - the schema documents variables nothing shows"
  : > "$ex_keys"
fi

# --- check 1: schema and example stay in lockstep ---------------------------
while IFS="$(printf '\t')" read -r name req pat; do
  [ -n "$name" ] || continue
  if ! grep -qxF "$name" "$ex_keys"; then
    err "$name is declared in $SCHEMA but missing from $EXAMPLE"
  fi
done < "$rows"

while IFS= read -r name; do
  [ -n "$name" ] || continue
  if ! cut -f1 "$rows" | grep -qxF "$name"; then
    err "$name appears in $EXAMPLE but is not declared in $SCHEMA"
  fi
done < "$ex_keys"

# --- checks 2 & 3: a real env file must satisfy the schema ------------------
if [ -f "$ENV_FILE" ]; then
  while IFS="$(printf '\t')" read -r name req pat; do
    [ -n "$name" ] || continue
    # The last active (uncommented) assignment of NAME wins, matching shell load order.
    val="$(sed -n "s/^[[:space:]]*$name=\\(.*\\)/\\1/p" "$ENV_FILE" | tail -n1)"
    if [ "$req" = "required" ] && [ -z "$val" ]; then
      err "$name is required but unset or empty in $ENV_FILE"
      continue
    fi
    if [ -n "$pat" ] && [ -n "$val" ]; then
      if ! printf '%s' "$val" | grep -Eq "$pat"; then
        err "$name=$val in $ENV_FILE does not match required pattern $pat"
      fi
    fi
  done < "$rows"
else
  echo "check-env: no $ENV_FILE yet - checked $EXAMPLE against $SCHEMA only"
fi

if [ "$errors" -gt 0 ]; then
  echo "check-env: $errors problem(s) found" >&2
  exit 1
fi
echo "check-env: environment configuration is valid"
