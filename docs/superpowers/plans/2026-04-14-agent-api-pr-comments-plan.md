# External Agent API + PR Commenting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the local stub-only generator with a real external API call and add a single persistent PR result comment while keeping the existing code simple and maintainable.

**Architecture:** Keep the current pipeline intact. Extend `run-agent-testgen.ts` so it supports either stub mode or HTTP POST mode, then add one separate PR comment publisher script that reads existing artifacts and updates a single marker comment on the PR.

**Tech Stack:** Node.js, TypeScript, GitHub Actions, GitHub REST API, JSON artifact files

---

## Planned File Structure

- Modify: `scripts/run-agent-testgen.ts`
- Create: `scripts/post-pr-comment.ts`
- Modify: `.github/workflows/agent-jest.yml`
- Modify: `README.md`
- Modify: `package.json`
- Create: `tests/post-pr-comment.test.ts`
- Modify: `tests/validate-generated-tests.test.ts`
- Keep: `docs/superpowers/specs/2026-04-14-agent-api-pr-comments-design.md`

### Task 1: Add API generation mode to the agent bridge

**Files:**
- Modify: `scripts/run-agent-testgen.ts`
- Modify: `package.json`
- Test: `tests/validate-generated-tests.test.ts`

- [ ] **Step 1: Write the failing test for API response handling**

Cover:
- valid file-map JSON accepted
- malformed JSON rejected
- missing `files` array rejected

- [ ] **Step 2: Extend `run-agent-testgen.ts` with two simple modes**

Modes:
- `stub`
- `api`

API mode should:
- read `AGENT_API_URL`
- read `AGENT_API_KEY`
- POST the context JSON
- save returned file-map JSON to the existing output path

- [ ] **Step 3: Keep the stub mode unchanged for local development**

- [ ] **Step 4: Run focused tests**

Run:
```bash
npm test -- --runTestsByPath tests/validate-generated-tests.test.ts
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/run-agent-testgen.ts package.json tests/validate-generated-tests.test.ts
git commit -m "feat: add external api mode for test generation"
```

### Task 2: Add a minimal PR comment publisher

**Files:**
- Create: `scripts/post-pr-comment.ts`
- Create: `tests/post-pr-comment.test.ts`

- [ ] **Step 1: Write the failing test for comment body rendering**

Verify body includes:
- marker comment
- generated files
- Jest status
- Jest counts
- notes when present

- [ ] **Step 2: Implement comment body builder as a small pure function**

Make it easy to test without real GitHub calls.

- [ ] **Step 3: Implement GitHub REST API create/update logic**

Inputs:
- `GITHUB_TOKEN`
- `GITHUB_REPOSITORY`
- `PR_NUMBER`

Behavior:
- list existing comments
- find marker comment
- update if found
- create if not found

- [ ] **Step 4: Run focused tests**

Run:
```bash
npm test -- --runTestsByPath tests/post-pr-comment.test.ts
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/post-pr-comment.ts tests/post-pr-comment.test.ts
git commit -m "feat: add persistent pr result comment"
```

### Task 3: Wire the workflow to API mode and PR comments

**Files:**
- Modify: `.github/workflows/agent-jest.yml`
- Modify: `README.md`
- Modify: `package.json`

- [ ] **Step 1: Add workflow env for API secrets**

Use:
- `AGENT_API_URL`
- `AGENT_API_KEY`

- [ ] **Step 2: Switch generation step to API mode in GitHub Actions**

Keep local stub usage documented in README.

- [ ] **Step 3: Add PR comment step after Jest run**

The step should read:
- generated files manifest
- validation result
- Jest summary JSON

- [ ] **Step 4: Add workflow permission for PR comments**

Ensure the job can write PR comments.

- [ ] **Step 5: Document required GitHub secrets and API response shape in README**

- [ ] **Step 6: Run build/tests locally**

Run:
```bash
npm run build
npm test
```
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add .github/workflows/agent-jest.yml README.md package.json
git commit -m "feat: wire api generation and pr comments into workflow"
```

### Task 4: Smoke-test the new behavior in the simplest possible way

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Verify local stub mode still works**

Run:
```bash
npm run build
npm run agent:generate
```
Expected: PASS in stub mode locally

- [ ] **Step 2: Verify PR comment script can render without network calls**

Run a local dry path or unit tests.

- [ ] **Step 3: Document the exact GitHub secret names and expected API payload in README**

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: document api mode and pr comment flow"
```
