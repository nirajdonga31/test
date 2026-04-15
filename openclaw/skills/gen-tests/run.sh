#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   run.sh "gen-tests repo=owner/repo pr=123 run_id=999 run_url=https://..."

MSG="${1:-}"
if [[ -z "$MSG" ]]; then
  echo "Missing message text" >&2
  exit 2
fi

# Parse key=value pairs
repo=""; pr=""; run_id=""; run_url=""
for kv in $MSG; do
  case "$kv" in
    repo=*) repo="${kv#repo=}" ;;
    pr=*) pr="${kv#pr=}" ;;
    run_id=*) run_id="${kv#run_id=}" ;;
    run_url=*) run_url="${kv#run_url=}" ;;
  esac
done

if [[ -z "$repo" || -z "$pr" || -z "$run_id" ]]; then
  echo "Missing required fields. Need: repo, pr, run_id" >&2
  exit 2
fi

WORKDIR="/root/.openclaw/workspace/tester"
TOOLDIR="$WORKDIR/.agent-jest"
ARTIFACTS="$TOOLDIR/artifacts"

# Ensure deps built
cd "$TOOLDIR"
npm ci
npm run build

# Fetch PR base/head via GitHub API.
# Always use `gh auth token`.
if ! command -v gh >/dev/null 2>&1; then
  echo "Missing gh CLI. Install gh and run: gh auth login" >&2
  exit 2
fi
GITHUB_TOKEN="$(gh auth token 2>/dev/null || true)"
if [[ -z "$GITHUB_TOKEN" ]]; then
  echo "Missing gh auth token. Run: gh auth login" >&2
  exit 2
fi
OWNER="${repo%%/*}"
REPO_NAME="${repo#*/}"

api="https://api.github.com/repos/$OWNER/$REPO_NAME/pulls/$pr"
pr_resp=$(curl -sS -w "\n%{http_code}" -H "Authorization: Bearer $GITHUB_TOKEN" -H "Accept: application/vnd.github+json" "$api")
pr_body=$(echo "$pr_resp" | sed '$d')
pr_code=$(echo "$pr_resp" | tail -n 1)
if [[ "$pr_code" != "200" ]]; then
  echo "GitHub API error fetching PR: HTTP $pr_code" >&2
  echo "$pr_body" >&2
  exit 2
fi
base_sha=$(node -e 'const j=JSON.parse(process.argv[1]); console.log(j.base.sha)' "$pr_body")
head_sha=$(node -e 'const j=JSON.parse(process.argv[1]); console.log(j.head.sha)' "$pr_body")

# Ensure we have the exact SHAs locally for diff/context build
cd "$WORKDIR"
git remote get-url origin >/dev/null 2>&1 || git remote add origin "https://github.com/$repo.git"
# Fetch base/head SHAs explicitly (works even if they are not in current refs)
git fetch --no-tags --prune origin "$base_sha" "$head_sha"

# Build context using existing script
cd "$TOOLDIR"
PR_BASE_SHA="$base_sha" PR_HEAD_SHA="$head_sha" PR_NUMBER="$pr" GITHUB_REPOSITORY="$repo" \
  npm run context:build -- --base "$base_sha" --head "$head_sha"

# Context build complete.
# LLM generation + writing files + PR comment should be handled by the OpenClaw agent.
echo "context_built ok base_sha=$base_sha head_sha=$head_sha pr=$pr run_id=$run_id"
