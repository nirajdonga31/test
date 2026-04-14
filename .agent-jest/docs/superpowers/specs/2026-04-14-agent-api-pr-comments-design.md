# External Agent API + PR Commenting Extension Design

## Goal

Extend the existing PR-triggered Jest generation system so GitHub Actions can call a real external agent API over HTTP, receive generated test files as JSON, validate and run them, and publish the latest result back to the pull request in a single updated bot comment.

## Design Priorities

- keep the code simple
- keep boundaries clear
- avoid over-engineering
- preserve current validator/apply/test flow
- make local development still work without the real API

## Architecture

The current system already has the right backbone. This extension changes only two areas:

1. **Agent Bridge**
   - replace stub-only generation with a small HTTP client in `run-agent-testgen.ts`
   - keep stub mode as a local fallback
   - read API URL and API key from environment variables

2. **PR Comment Publisher**
   - add one small script that publishes the latest result to GitHub
   - use one persistent marker comment so repeated PR updates overwrite the same comment instead of spamming many comments

Everything else stays the same:
- build context
- validate generated files
- prepare isolated workspace
- apply generated files
- run Jest
- upload artifacts

## API Contract

### Request

The workflow sends the current initial context JSON as the POST body.

Headers:
- `content-type: application/json`
- `x-api-key: <secret>`

Environment variables:
- `AGENT_API_URL`
- `AGENT_API_KEY`

### Response

The API returns file-map JSON:

```json
{
  "files": [
    {
      "path": "src/foo/bar.test.ts",
      "content": "..."
    }
  ],
  "notes": "Generated tests for changed service logic"
}
```

### Rejection Rules

If the API:
- times out
- returns invalid JSON
- returns a malformed shape
- returns forbidden file paths

then the workflow fails before apply/run.

## PR Commenting Behavior

The workflow should post a single persistent comment on the PR.

Comment contents:
- generation status
- generated files list
- API notes if present
- exact Jest command
- suite/test pass-fail counts
- short list of executed tests

Comment update strategy:
- search for an existing comment with a hidden marker like `<!-- agent-jest-comment -->`
- if found, update it
- if not found, create it

This keeps the PR readable and easy to understand.

## Simplicity Decisions

### Keep
- one script for API generation
- one script for PR comment publishing
- JSON files as artifacts between steps

### Avoid in v1
- retries with complex backoff logic
- multi-comment timelines
- patch-based responses
- streaming generation
- advanced schema libraries unless needed later

## Failure Modes and Mitigations

1. **API unavailable**
   - Fail clearly with a short error message
   - Keep the error visible in workflow logs and PR comment if possible

2. **Bad API output**
   - Validate before apply
   - Never write malformed or forbidden files

3. **PR comment spam**
   - Use one updateable marker comment

4. **Secrets confusion**
   - Keep only two external secrets for the API call: URL and key

## Files to Change

- Modify: `scripts/run-agent-testgen.ts`
  - add HTTP POST mode
  - keep stub mode fallback
- Create: `scripts/post-pr-comment.ts`
  - create/update one PR comment with a marker
- Modify: `.github/workflows/agent-jest.yml`
  - pass `AGENT_API_URL` and `AGENT_API_KEY`
  - call PR comment step after Jest run
- Modify: `README.md`
  - document secrets and API response contract

## Acceptance Criteria

A successful extension shows:
1. Workflow sends initial context JSON to external API
2. API returns generated file JSON
3. Validator still guards file writes
4. Jest still runs in isolated workspace
5. PR gets one updated bot comment with latest results
6. Local stub mode still works for development
