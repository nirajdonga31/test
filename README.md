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

## Current limits

- local repo uses a stub generator instead of a real external agent
- v1 only supports Jest unit tests
- generated output is artifact-oriented, not auto-pushed
- GitHub push from this environment still depends on working repo credentials
