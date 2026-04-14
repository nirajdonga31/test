# Agent Tool Contract

This document defines the minimum tool contract for a PR-triggered Jest test generation system.

## Goal

On each GitHub pull request:
- collect small initial context
- allow the agent to request more repository context on demand
- let the agent generate Jest unit tests for changed code
- validate and run those tests in CI
- return a reviewable patch/artifact

## Design Principles

- Small initial context, not full-repo dump
- Deterministic raw data collection by CI
- Agent decides what additional context matters
- Agent may only propose test-file changes in v1
- CI validates and executes; agent does not silently mutate the branch

## Initial Context Payload

The workflow should send a compact JSON payload to the agent with:

```json
{
  "pr": {
    "repo": "owner/repo",
    "baseSha": "<base_sha>",
    "headSha": "<head_sha>",
    "number": 123
  },
  "changedFiles": [
    {
      "path": "src/foo/bar.ts",
      "status": "modified",
      "diff": "...unified diff or compact hunk view...",
      "language": "typescript",
      "relatedTests": [
        "src/foo/bar.test.ts"
      ]
    }
  ],
  "repo": {
    "packageJson": "...",
    "jestConfig": "...",
    "testConventions": {
      "patterns": ["**/*.test.ts", "**/*.spec.ts"],
      "framework": "jest"
    }
  },
  "rules": {
    "allowedWriteGlobs": ["**/*.test.ts", "**/*.spec.ts"],
    "forbidProductionFileEdits": true,
    "forbidDependencyChanges": true
  }
}
```

## Tool Contract

### 1) `get_file`

Fetch the current contents of a repository file.

**Input**

```json
{
  "path": "src/foo/bar.ts"
}
```

**Output**

```json
{
  "path": "src/foo/bar.ts",
  "content": "file contents here",
  "language": "typescript"
}
```

**Rules**
- Read-only
- Path must stay inside the checked-out repository
- Return current head version of the file unless versioning is added later

---

### 2) `search_related_tests`

Return existing Jest tests likely related to a source file or symbol.

**Input**

```json
{
  "path": "src/foo/bar.ts",
  "symbols": ["createBar", "BarService"]
}
```

**Output**

```json
{
  "matches": [
    {
      "path": "src/foo/bar.test.ts",
      "reason": "same basename"
    },
    {
      "path": "tests/bar-service.test.ts",
      "reason": "mentions BarService"
    }
  ]
}
```

**Matching strategy**
- same-directory sibling tests
- same basename test files
- grep/search for symbol names in test files
- existing imports of the changed module

---

### 3) `get_diff_for_file`

Return the PR diff for a specific file.

**Input**

```json
{
  "path": "src/foo/bar.ts"
}
```

**Output**

```json
{
  "path": "src/foo/bar.ts",
  "baseSha": "<base_sha>",
  "headSha": "<head_sha>",
  "diff": "unified diff here"
}
```

**Rules**
- Diff source is always PR `baseSha...headSha`
- If file is unchanged, return empty diff and a flag

---

### 4) `get_import_graph_neighbors`

Return directly related files around a changed file.

**Input**

```json
{
  "path": "src/foo/bar.ts"
}
```

**Output**

```json
{
  "path": "src/foo/bar.ts",
  "imports": [
    "src/lib/cache.ts",
    "src/types/bar.ts"
  ],
  "importedBy": [
    "src/api/bar-controller.ts",
    "src/services/bar-orchestrator.ts"
  ]
}
```

**Rules**
- v1 may be shallow: direct imports + simple reverse-reference search
- Do not attempt a perfect whole-program graph in v1

---

### 5) `submit_generated_tests`

Submit generated Jest test files or a patch back to CI for validation.

**Input option A: file map**

```json
{
  "files": [
    {
      "path": "src/foo/bar.test.ts",
      "content": "test file contents here"
    }
  ],
  "notes": "Covers empty input and cache reuse"
}
```

**Input option B: patch**

```json
{
  "patch": "git-style patch here",
  "notes": "Adds Jest coverage for changed module"
}
```

**Output**

```json
{
  "accepted": true,
  "validationPending": true
}
```

**Validation rules after submission**
- only allowed test-file paths may be written
- no production code edits
- no package/dependency edits
- files must parse as text and be non-empty

## Recommended Runtime Flow

1. GitHub Action triggers on PR
2. CI builds initial context payload
3. Agent reviews initial context
4. Agent calls retrieval tools as needed:
   - `get_file`
   - `search_related_tests`
   - `get_diff_for_file`
   - `get_import_graph_neighbors`
5. Agent calls `submit_generated_tests`
6. CI validates output
7. CI applies generated tests in isolated workspace
8. CI runs Jest on generated tests and optionally related existing tests
9. CI publishes:
   - pass/fail status
   - exact tests run
   - generated patch artifact
   - Jest JSON results

## v1 Constraints

- Framework: Jest only
- Scope: unit tests only
- Input language: Node/TypeScript repos
- Output: reviewable patch/artifact, not silent branch mutation
- Agent write scope: `*.test.ts` and `*.spec.ts` only

## Example Follow-up Requests by Agent

A typical sequence may look like:

1. initial payload shows `src/foo/bar.ts` changed
2. agent requests `get_file(src/foo/bar.ts)`
3. agent requests `get_import_graph_neighbors(src/foo/bar.ts)`
4. agent requests `search_related_tests(path=src/foo/bar.ts, symbols=[BarService])`
5. agent requests `get_file(src/foo/bar.test.ts)`
6. agent submits `src/foo/bar.test.ts`

This keeps the first payload small while still allowing deeper context when necessary.
