# test

Initial repo bootstrap.

## Agent Jest PR System

This repository contains a starter implementation for a PR-triggered workflow that:
- builds compact context from a pull request diff
- lets an agent generate Jest unit tests for changed code
- validates generated test paths
- applies them in an isolated workspace
- runs Jest and publishes reviewable artifacts

## Local setup

```bash
npm install
npm run build
npm test
```

## Scripts

- `npm run build` - compile TypeScript to `dist/`
- `npm test` - run local tests
- `npm run context:build -- --base <sha> --head <sha>` - build initial context JSON
- `npm run agent:generate` - run stub agent generator
- `npm run validate:generated` - validate generated test files
- `npm run prepare:workspace` - copy repo into isolated `artifacts/workspace`
- `npm run apply:generated` - apply generated files to `artifacts/workspace`
- `npm run jest:generated` - run Jest against generated tests in isolated workspace

## Workflow

The GitHub Actions workflow lives at `.github/workflows/agent-jest.yml` and runs on pull requests.

### Required GitHub secrets

- `AGENT_API_URL`
- `AGENT_API_KEY`

The workflow sends the initial context JSON to `AGENT_API_URL` with:
- `content-type: application/json`
- `x-api-key: <AGENT_API_KEY>`

Expected API response:

```json
{
  "files": [
    {
      "path": "tests/generated/foo__bar.test.ts",
      "content": "..."
    }
  ],
  "notes": "optional summary"
}
```

Generated files are allowed only under `tests/generated/`.

The workflow also updates one persistent PR comment with the latest generated-test result.

## Current limits

- local repo still supports stub mode for development
- v1 only supports Jest unit tests
- generated output is artifact-oriented, not auto-pushed back to the branch
- external API must return generated test files JSON
- generated test files must be placed only under `tests/generated/`
