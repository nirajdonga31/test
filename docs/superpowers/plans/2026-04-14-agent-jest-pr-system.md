# Agent Jest PR System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a PR-triggered GitHub Actions system that gathers compact repo context, lets an agent request more context, generates Jest tests for changed Node/TypeScript code, validates them, runs them in isolated CI, and publishes reviewable results.

**Architecture:** A GitHub Actions workflow coordinates a set of small TypeScript scripts. One script builds initial PR context, one exposes retrieval helpers, one bridges to the agent, one validates generated output, one applies generated files into an isolated workspace, and one runs Jest and writes GitHub summaries.

**Tech Stack:** GitHub Actions, Node.js, TypeScript, Jest, git CLI, file-system JSON artifacts

---

## Planned File Structure

- Create: `.github/workflows/agent-jest.yml`
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `jest.config.cjs`
- Create: `agent-testgen.config.json`
- Create: `scripts/build-agent-context.ts`
- Create: `scripts/agent-tool-server.ts`
- Create: `scripts/run-agent-testgen.ts`
- Create: `scripts/validate-generated-tests.ts`
- Create: `scripts/apply-generated-tests.ts`
- Create: `scripts/run-generated-jest.ts`
- Create: `src/context/git.ts`
- Create: `src/context/test-search.ts`
- Create: `src/context/import-neighbors.ts`
- Create: `src/context/io.ts`
- Create: `src/context/types.ts`
- Create: `tests/validate-generated-tests.test.ts`
- Create: `tests/test-search.test.ts`
- Modify: `README.md`
- Keep: `agent-tool-contract.md`
- Keep: `docs/superpowers/specs/2026-04-14-agent-jest-pr-design.md`

### Task 1: Bootstrap the Node/TypeScript project

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `jest.config.cjs`
- Modify: `README.md`

- [ ] **Step 1: Write the failing package/test scaffold expectation**

Document the required npm scripts in `README.md`:
- `build`
- `test`
- `test:run`
- `context:build`
- `agent:generate`
- `validate:generated`
- `apply:generated`
- `jest:generated`

- [ ] **Step 2: Create `package.json` with minimal scripts and dev dependencies**

Include:
- `typescript`
- `jest`
- `ts-jest`
- `@types/jest`
- `@types/node`

- [ ] **Step 3: Create `tsconfig.json`**

Configure CommonJS or NodeNext consistently and include:
- `scripts/**/*.ts`
- `src/**/*.ts`
- `tests/**/*.ts`

- [ ] **Step 4: Create `jest.config.cjs`**

Set test roots to `tests/` and enable TypeScript tests through `ts-jest`.

- [ ] **Step 5: Update `README.md` with local setup and script overview**

- [ ] **Step 6: Run install/build/test bootstrap checks**

Run:
```bash
npm install
npm test
```
Expected:
- install succeeds
- tests may fail until test files exist

- [ ] **Step 7: Commit**

```bash
git add package.json tsconfig.json jest.config.cjs README.md package-lock.json
git commit -m "chore: bootstrap agent jest project"
```

### Task 2: Define shared context types and I/O helpers

**Files:**
- Create: `src/context/types.ts`
- Create: `src/context/io.ts`
- Test: `tests/test-search.test.ts`

- [ ] **Step 1: Write a failing test for context JSON read/write helpers**

Test that a helper can:
- write JSON to disk
- read it back
- create parent directories as needed

- [ ] **Step 2: Implement shared TypeScript types**

Define interfaces for:
- PR metadata
- changed files
- related tests
- tool requests/responses
- generated file submissions
- validation results
- Jest summary output

- [ ] **Step 3: Implement I/O helpers**

Add helpers for:
- `readJsonFile`
- `writeJsonFile`
- `writeTextFile`
- `ensureDir`

- [ ] **Step 4: Run focused tests**

Run:
```bash
npm test -- --runTestsByPath tests/test-search.test.ts
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/context/types.ts src/context/io.ts tests/test-search.test.ts
git commit -m "feat: add shared context types and io helpers"
```

### Task 3: Implement git diff and changed-file collection

**Files:**
- Create: `src/context/git.ts`
- Create: `scripts/build-agent-context.ts`
- Test: `tests/test-search.test.ts`

- [ ] **Step 1: Write failing tests for changed-file filtering logic**

Cover:
- include `.ts/.tsx/.js/.jsx`
- exclude docs and lockfiles
- preserve file status metadata

- [ ] **Step 2: Implement git helpers**

Add functions for:
- `getChangedFiles(baseSha, headSha)`
- `getDiffForFile(baseSha, headSha, path)`
- `readFileAtHead(path)`

- [ ] **Step 3: Implement `scripts/build-agent-context.ts`**

The script should:
- read base/head sha from env or CLI args
- build initial payload
- include package.json and jest config when present
- write JSON artifact to `artifacts/context/initial-context.json`

- [ ] **Step 4: Run focused tests**

Run:
```bash
npm test -- --runTestsByPath tests/test-search.test.ts
```
Expected: PASS

- [ ] **Step 5: Smoke-test the script locally**

Run:
```bash
node dist/scripts/build-agent-context.js --base HEAD~1 --head HEAD
```
Expected:
- JSON artifact created

- [ ] **Step 6: Commit**

```bash
git add src/context/git.ts scripts/build-agent-context.ts tests/test-search.test.ts
git commit -m "feat: build initial agent context from git diff"
```

### Task 4: Implement related-test lookup and import neighbors

**Files:**
- Create: `src/context/test-search.ts`
- Create: `src/context/import-neighbors.ts`
- Test: `tests/test-search.test.ts`

- [ ] **Step 1: Write failing tests for related-test matching**

Cover:
- sibling `foo.test.ts`
- sibling `foo.spec.ts`
- symbol-name match in existing tests
- no duplicate result paths

- [ ] **Step 2: Implement `searchRelatedTests`**

Use:
- basename matching
- simple recursive test file scan
- optional symbol text search

- [ ] **Step 3: Implement `getImportGraphNeighbors`**

Use shallow heuristics:
- parse local import paths in the target file
- simple reverse-reference text search for imports/usages

- [ ] **Step 4: Run focused tests**

Run:
```bash
npm test -- --runTestsByPath tests/test-search.test.ts
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/context/test-search.ts src/context/import-neighbors.ts tests/test-search.test.ts
git commit -m "feat: add related test and import neighbor lookup"
```

### Task 5: Implement the local retrieval tool server contract

**Files:**
- Create: `scripts/agent-tool-server.ts`
- Test: `tests/test-search.test.ts`

- [ ] **Step 1: Write failing tests for tool request routing**

Cover handlers for:
- `get_file`
- `search_related_tests`
- `get_diff_for_file`
- `get_import_graph_neighbors`

- [ ] **Step 2: Implement request dispatcher**

Input: JSON request on stdin or file
Output: JSON response to stdout or file

- [ ] **Step 3: Wire the dispatcher to shared context helpers**

- [ ] **Step 4: Run focused tests**

Run:
```bash
npm test -- --runTestsByPath tests/test-search.test.ts
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/agent-tool-server.ts tests/test-search.test.ts
git commit -m "feat: add agent retrieval tool server"
```

### Task 6: Implement generated-output validation

**Files:**
- Create: `scripts/validate-generated-tests.ts`
- Create: `agent-testgen.config.json`
- Test: `tests/validate-generated-tests.test.ts`

- [ ] **Step 1: Write failing validator tests**

Cover:
- allow `src/foo/bar.test.ts`
- reject `src/foo/bar.ts`
- reject `package.json`
- reject empty generated files

- [ ] **Step 2: Implement config loading**

Defaults:
- allowed globs `**/*.test.ts`, `**/*.spec.ts`
- forbid production edits
- forbid dependency edits

- [ ] **Step 3: Implement validator script**

Input: generated file map or patch manifest
Output: JSON validation result with errors

- [ ] **Step 4: Run focused tests**

Run:
```bash
npm test -- --runTestsByPath tests/validate-generated-tests.test.ts
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/validate-generated-tests.ts agent-testgen.config.json tests/validate-generated-tests.test.ts
git commit -m "feat: validate generated jest test output"
```

### Task 7: Implement apply step for isolated workspace

**Files:**
- Create: `scripts/apply-generated-tests.ts`
- Test: `tests/validate-generated-tests.test.ts`

- [ ] **Step 1: Write a failing test for applying generated file maps**

Verify:
- destination directories are created
- generated files are written under isolated workspace root
- existing non-target files remain unchanged

- [ ] **Step 2: Implement isolated apply logic**

Input:
- generated files manifest
- destination root path

Output:
- written file list JSON artifact

- [ ] **Step 3: Run focused tests**

Run:
```bash
npm test -- --runTestsByPath tests/validate-generated-tests.test.ts
```
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add scripts/apply-generated-tests.ts tests/validate-generated-tests.test.ts
git commit -m "feat: apply generated tests in isolated workspace"
```

### Task 8: Implement Jest execution and summary reporting

**Files:**
- Create: `scripts/run-generated-jest.ts`
- Test: `tests/validate-generated-tests.test.ts`

- [ ] **Step 1: Write a failing test for summary formatting**

Verify output includes:
- generated files
- exact Jest command
- suite counts
- test counts
- pass/fail status

- [ ] **Step 2: Implement Jest runner script**

The script should:
- receive generated file paths
- run Jest with JSON output
- write `artifacts/jest/jest-results.json`
- write `artifacts/jest/summary.md`

- [ ] **Step 3: Add GitHub step summary compatibility**

If `GITHUB_STEP_SUMMARY` exists, append markdown summary there.

- [ ] **Step 4: Run focused tests**

Run:
```bash
npm test -- --runTestsByPath tests/validate-generated-tests.test.ts
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/run-generated-jest.ts tests/validate-generated-tests.test.ts
git commit -m "feat: add generated jest execution and reporting"
```

### Task 9: Implement agent bridge stub for local/demo use

**Files:**
- Create: `scripts/run-agent-testgen.ts`
- Modify: `README.md`

- [ ] **Step 1: Write a failing test or fixture expectation for stub agent output**

Define a local demo mode that:
- reads initial context
- emits deterministic sample Jest tests for a changed file

- [ ] **Step 2: Implement the agent bridge script**

Modes:
- stub mode for local testing
- external command/API mode placeholder for later integration

- [ ] **Step 3: Document integration boundary in `README.md`**

Explain where to replace stub generation with real agent/API calls.

- [ ] **Step 4: Run local smoke test**

Run:
```bash
node dist/scripts/run-agent-testgen.js --context artifacts/context/initial-context.json --out artifacts/generated/generated-files.json --mode stub
```
Expected:
- generated file manifest exists

- [ ] **Step 5: Commit**

```bash
git add scripts/run-agent-testgen.ts README.md
git commit -m "feat: add agent bridge stub for test generation"
```

### Task 10: Wire GitHub Actions workflow end-to-end

**Files:**
- Create: `.github/workflows/agent-jest.yml`
- Modify: `README.md`

- [ ] **Step 1: Write the workflow skeleton**

Trigger on:
- `pull_request`
- types: `opened`, `synchronize`, `reopened`

- [ ] **Step 2: Add checkout/install/build steps**

Use:
- `actions/checkout`
- `actions/setup-node`
- `npm ci` or `npm install`
- `npm run build`

- [ ] **Step 3: Add context/generation/validation/apply/test steps**

Sequence:
- build context
- run agent generator
- validate generated tests
- prepare isolated workspace
- apply generated files
- run generated Jest

- [ ] **Step 4: Add artifact upload steps**

Upload:
- initial context JSON
- generated files JSON
- validation result JSON
- written files JSON
- Jest results JSON
- summary markdown

- [ ] **Step 5: Update `README.md` with workflow usage**

- [ ] **Step 6: Commit**

```bash
git add .github/workflows/agent-jest.yml README.md
git commit -m "feat: add pr workflow for agent-generated jest tests"
```

### Task 11: End-to-end local verification

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Build the project**

Run:
```bash
npm run build
```
Expected: PASS

- [ ] **Step 2: Run the test suite**

Run:
```bash
npm test
```
Expected: PASS

- [ ] **Step 3: Run the local demo pipeline manually**

Run:
```bash
npm run context:build -- --base HEAD~1 --head HEAD || true
npm run agent:generate
npm run validate:generated
npm run apply:generated
npm run jest:generated
```
Expected:
- artifacts are written
- generated test files are created under isolated workspace
- Jest summary markdown is produced

- [ ] **Step 4: Document known limits in `README.md`**

Include:
- stub agent only in local repo
- real GitHub push still pending repo credentials
- v1 limited to Jest unit tests and artifact review

- [ ] **Step 5: Commit**

```bash
git add README.md artifacts || true
git commit -m "docs: verify local demo pipeline"
```
