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
# Prefer explicit GITHUB_TOKEN, otherwise fall back to `gh auth token` (if already logged in).
if [[ -z "${GITHUB_TOKEN:-}" ]]; then
  if command -v gh >/dev/null 2>&1; then
    GITHUB_TOKEN="$(gh auth token 2>/dev/null || true)"
  fi
fi
: "${GITHUB_TOKEN:?GITHUB_TOKEN env var required (or run `gh auth login` for this user) }"
OWNER="${repo%%/*}"
REPO_NAME="${repo#*/}"

api="https://api.github.com/repos/$OWNER/$REPO_NAME/pulls/$pr"
pr_json=$(curl -sS -H "Authorization: Bearer $GITHUB_TOKEN" -H "Accept: application/vnd.github+json" "$api")
base_sha=$(node -e 'const j=JSON.parse(process.argv[1]); console.log(j.base.sha)' "$pr_json")
head_sha=$(node -e 'const j=JSON.parse(process.argv[1]); console.log(j.head.sha)' "$pr_json")

# Build context using existing script
cd "$TOOLDIR"
PR_BASE_SHA="$base_sha" PR_HEAD_SHA="$head_sha" PR_NUMBER="$pr" GITHUB_REPOSITORY="$repo" \
  npm run context:build -- --base "$base_sha" --head "$head_sha"

# Generate tests via OpenClaw's configured model provider (no OPENAI_API_KEY needed).
# Calls the local OpenClaw gateway (OpenAI-compatible Responses API) and writes
# a GeneratedFilesManifest JSON to artifacts/generated/generated-files.json.

: "${OPENCLAW_GATEWAY_URL:=http://127.0.0.1:18789}"

context_json=$(cat artifacts/context/initial-context.json)

system_prompt=$(cat <<'SYS'
You generate Jest unit tests for a PR based on provided context JSON.
Hard constraints:
- Output must be STRICT JSON only (no markdown).
- Output must match this schema exactly: {"files":[{"path":"automated-tests/<name>.test.ts","content":"..."}],"notes":"..."}
- You may only generate files under automated-tests/. No other paths.
- Do not propose changes to production code. Only tests.
- Keep tests minimal and focused on changed behavior.
SYS
)

user_prompt=$(cat <<USR
Context JSON follows. Generate Jest tests accordingly.
$context_json
USR
)

# Request generation from OpenClaw gateway using configured primary model.
manifest_json=$(curl -sS "$OPENCLAW_GATEWAY_URL/v1/responses" \
  -H 'Content-Type: application/json' \
  -d "$(node -e 'const system=process.argv[1]; const user=process.argv[2]; const body={input:[{role:"system",content:[{type:"text",text:system}]},{role:"user",content:[{type:"text",text:user}]}],response_format:{type:"json_object"}}; console.log(JSON.stringify(body));' "$system_prompt" "$user_prompt")" \
  | node -e 'let s=""; process.stdin.on("data",d=>s+=d); process.stdin.on("end",()=>{const j=JSON.parse(s); const t=j.output_text||""; if(!t.trim()){console.error("Missing output_text"); process.exit(2);} process.stdout.write(t);});')

# Validate JSON and required schema quickly.
node -e 'const fs=require("fs"); const m=JSON.parse(process.argv[1]); if(!m||!Array.isArray(m.files)) throw new Error("missing files"); for(const f of m.files){ if(!f||typeof f.path!=="string"||typeof f.content!=="string") throw new Error("bad file entry"); if(!f.path.startsWith("automated-tests/")) throw new Error("bad path "+f.path);} ' "$manifest_json"

echo "$manifest_json" > artifacts/generated/generated-files.json

# Persist generated test files under repo root for auditing:
#   tester/autotests/run-<run_id>/files/<file>
OUTDIR="/root/.openclaw/workspace/tester/autotests/run-$run_id/files"
mkdir -p "$OUTDIR"
OUTDIR="$OUTDIR" node -e '
const fs=require("fs");
const path=require("path");
const m=JSON.parse(fs.readFileSync("artifacts/generated/generated-files.json","utf8"));
const outdir=process.env.OUTDIR;
for(const f of m.files){
  const rel=f.path; // e.g. automated-tests/xyz.test.ts
  const target=path.join(outdir, rel);
  fs.mkdirSync(path.dirname(target), {recursive:true});
  fs.writeFileSync(target, f.content, "utf8");
}
'

# Validate
npm run validate:generated

# Create/Update PR comment once per run_id
marker="<!-- openclaw:gen-tests run_id=$run_id -->"
rendered_files=$(node -e '
const fs=require("fs");
const m=JSON.parse(fs.readFileSync("artifacts/generated/generated-files.json","utf8"));
const out=[];
for(const f of m.files){
  out.push(`### ${f.path}`);
  out.push("```ts\n"+f.content+"\n```");
}
if(m.notes) out.push("\nNotes:\n"+m.notes);
process.stdout.write(out.join("\n\n"));
')

comment_body=$(cat <<EOF
OpenClaw gen-tests (run_id=$run_id)
${run_url:-}

$marker

$rendered_files
EOF
)

# Find existing comment
comments=$(curl -sS -H "Authorization: Bearer $GITHUB_TOKEN" -H "Accept: application/vnd.github+json" \
  "https://api.github.com/repos/$OWNER/$REPO_NAME/issues/$pr/comments?per_page=100")
existing_id=$(node -e 'const comments=JSON.parse(process.argv[1]); const marker=process.argv[2]; const c=comments.find(c=>c.body&&c.body.includes(marker)); console.log(c?c.id:"")' "$comments" "$marker")

if [[ -n "$existing_id" ]]; then
  curl -sS -X PATCH -H "Authorization: Bearer $GITHUB_TOKEN" -H "Accept: application/vnd.github+json" \
    "https://api.github.com/repos/$OWNER/$REPO_NAME/issues/comments/$existing_id" \
    -d "$(node -e 'console.log(JSON.stringify({body: process.argv[1]}))' "$comment_body")" >/dev/null
else
  curl -sS -X POST -H "Authorization: Bearer $GITHUB_TOKEN" -H "Accept: application/vnd.github+json" \
    "https://api.github.com/repos/$OWNER/$REPO_NAME/issues/$pr/comments" \
    -d "$(node -e 'console.log(JSON.stringify({body: process.argv[1]}))' "$comment_body")" >/dev/null
fi

echo "ok"
