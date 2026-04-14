# Agent-Driven Jest Test Generation for PRs

## Goal

Build a GitHub PR-triggered system that prepares compact repository context, lets an agent request more context on demand, generates Jest unit tests for changed Node/TypeScript code, validates those generated tests in an isolated CI workspace, and publishes reviewable results without silently mutating the PR branch.

## Scope

This v1 system supports:
- GitHub `pull_request` events only
- Node/TypeScript repositories
- Jest unit test generation only
- reviewable generated test output as files/patch/artifacts
- CI-side validation and execution

This v1 system does not support:
- direct production code edits
- dependency changes
- e2e/integration test generation
- automatic commits or automatic PR mutation
- perfect whole-repo semantic dependency analysis

## Architecture

The system is split into five focused units:

1. **Workflow Orchestrator**
   - GitHub Actions job triggered on PR events
   - checks out code, installs dependencies, invokes local scripts in order, and publishes results

2. **Context Builder**
   - deterministically gathers raw repository facts from the PR (`base.sha...head.sha`)
   - creates a small initial JSON context packet for the agent

3. **Agent Bridge**
   - sends the initial context to an agent endpoint/CLI
   - supports follow-up tool-style retrieval calls for deeper context
   - receives generated test files or patch output

4. **Validation + Apply Layer**
   - enforces v1 safety rules
   - applies generated tests only inside an isolated working directory

5. **Jest Runner + Reporter**
   - runs generated and related existing tests
   - emits machine-readable and human-readable output for GitHub

## Context Strategy

The initial context must stay compact. It should include:
- PR metadata (`repo`, PR number, `baseSha`, `headSha`)
- changed TS/JS source files
- compact diffs for those files
- package.json
- Jest config if present
- likely related existing Jest tests
- write/validation rules

The agent may request more context via narrow retrieval operations:
- `get_file`
- `search_related_tests`
- `get_diff_for_file`
- `get_import_graph_neighbors`

This balances determinism with flexibility. CI gathers facts. The agent decides what matters.

## Validation Rules

Generated output must be rejected if it:
- edits non-test files
- edits dependency manifests or lockfiles
- writes outside allowed test globs
- is empty or malformed

Allowed writes in v1:
- `**/*.test.ts`
- `**/*.spec.ts`

## Test Execution Model

CI applies generated output in an isolated workspace, not on the checked-out PR branch. The runner then:
- executes generated Jest tests first
- may execute related existing tests next
- stores Jest JSON output and console logs
- publishes summary results to GitHub checks / step summary / artifacts

## Reporting

The workflow must make it easy to answer:
- what files changed?
- what tests were generated?
- what exact Jest command ran?
- which suites/tests ran?
- did they pass or fail?

Artifacts should include:
- generated files or patch
- raw Jest output
- `jest-results.json`
- context snapshot used for generation

## Key Trade-Offs

### Recommended approach: small initial context + on-demand retrieval
Pros:
- lower prompt size
- better agent focus
- easier debugging

Cons:
- requires a small retrieval protocol
- slightly more orchestration code

### Rejected for v1: full repo dump
Reason:
- too noisy
- expensive
- more likely to reduce generation quality

### Rejected for v1: direct branch mutation
Reason:
- weaker auditability
- harder rollback
- less safe for early versions

## Failure Modes and Mitigations

1. **Diff-only blindness**
   - A non-changed file/test may be the real break detector
   - Mitigation: include related tests and import-graph neighbors

2. **Noisy context**
   - Too much irrelevant code hurts output quality
   - Mitigation: compact initial payload and narrow retrieval tools

3. **Unsafe agent writes**
   - Agent may attempt production edits
   - Mitigation: hard validator + isolated workspace apply step

4. **Unclear test reporting**
   - Hard to tell what actually ran
   - Mitigation: explicit generated-file list, exact Jest command, parsed suite/test summary

## File Responsibilities

- `.github/workflows/agent-jest.yml`
  - workflow entrypoint for PR automation
- `scripts/build-agent-context.ts`
  - creates initial context JSON
- `scripts/agent-tool-server.ts`
  - exposes retrieval functions for the agent bridge or local protocol
- `scripts/run-agent-testgen.ts`
  - sends context to the agent and stores generated output
- `scripts/validate-generated-tests.ts`
  - validates file paths and output rules
- `scripts/apply-generated-tests.ts`
  - applies generated files/patch to isolated workspace
- `scripts/run-generated-jest.ts`
  - runs Jest and writes machine/human summaries
- `src/context/*.ts`
  - shared helper modules for diffing, test lookup, import-neighbor lookup, and JSON schema helpers
- `agent-testgen.config.json`
  - repo-local rules and defaults

## Acceptance Criteria

A successful v1 demo shows:
1. A PR triggers the workflow
2. Context JSON is generated from `baseSha...headSha`
3. The agent can retrieve additional context on demand
4. The agent generates one or more Jest test files
5. Validation blocks forbidden writes
6. Jest runs in isolated workspace
7. GitHub summary clearly shows tests run and pass/fail status
8. Generated tests are available as reviewable artifacts
