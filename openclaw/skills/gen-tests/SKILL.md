# gen-tests

Trigger: Discord message containing `gen-tests repo=<owner/repo> pr=<number> run_id=<id> run_url=<url>`.

Purpose: Orchestrate the existing `tester/.agent-jest` pipeline from OpenClaw:
- fetch PR base/head
- build context
- run model test generation
- validate
- comment on PR once per `run_id`

## Inputs
- repo: `owner/repo`
- pr: PR number
- run_id: GitHub Actions run id
- run_url: URL to the run

## Outputs
- A single PR comment (create or update) containing generated test suggestions, keyed by marker:
  `<!-- openclaw:gen-tests run_id=... -->`

## Notes
- Discord payload is intentionally minimal; OpenClaw fetches PR diff/context directly from GitHub.
- No sensitive logs are posted to Discord.
