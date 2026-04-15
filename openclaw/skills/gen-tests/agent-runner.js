#!/usr/bin/env node
/*
  agent-runner.js

  Purpose:
    - Read PR context produced by openclaw/skills/gen-tests/run.sh
    - Call the local OpenClaw gateway (/v1/responses)
    - Produce a strict GeneratedFilesManifest JSON
    - Write generated test files to tester/autotests/run-<run_id>/files/
    - Post/update a PR comment keyed by run_id
    - Print a short summary (paths + counts)

  Usage:
    node openclaw/skills/gen-tests/agent-runner.js \
      --repo nirajdonga31/test --pr 12 --run_id 244... --run_url https://...

  Notes:
    - Requires: `gh auth login` on this machine (used for GitHub API calls)
    - Does NOT commit anything.
*/

const fs = require('fs');
const path = require('path');

function arg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function required(name) {
  const v = arg(name);
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

async function sh(cmd, opts = {}) {
  const { execSync } = require('child_process');
  return execSync(cmd, { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8', ...opts });
}

async function main() {
  const repo = required('--repo');
  const pr = required('--pr');
  const runId = required('--run_id');
  const runUrl = required('--run_url');

  const workdir = process.env.WORKDIR || '/root/.openclaw/workspace/tester';
  const gatewayUrl = process.env.OPENCLAW_GATEWAY_URL || 'http://127.0.0.1:18789';

  const stepFail = (step, msg) => {
    const out = { ok: false, step, message: msg, repo, pr: Number(pr), run_id: runId };
    process.stdout.write(JSON.stringify(out, null, 2) + '\n');
    process.exit(2);
  };

  // STEP auth
  let ghToken = (process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '').trim();
  if (!ghToken) {
    try { ghToken = sh('HOME=/root gh auth token').trim(); } catch {}
  }
  if (!ghToken) {
    try { ghToken = sh('gh auth token').trim(); } catch {}
  }
  if (!ghToken) {
    stepFail('auth', 'missing GitHub auth (set GITHUB_TOKEN/GH_TOKEN or gh auth login)');
  }

  // STEP context_check
  const contextPath = path.join(workdir, '.agent-jest', 'artifacts', 'context', 'initial-context.json');
  if (!fs.existsSync(contextPath)) {
    stepFail('context_build', `missing context file: ${contextPath}`);
  }

  const contextJson = fs.readFileSync(contextPath, 'utf8');
  let parsedContext;
  try { parsedContext = JSON.parse(contextJson); } catch { stepFail('context_check', 'context JSON is invalid'); }
  const changedCount = Array.isArray(parsedContext.changedFiles) ? parsedContext.changedFiles.length : 0;
  if (changedCount === 0) {
    stepFail('context_check', 'changedFiles=0 (nothing to test / bad diff)');
  }

  const system = [
    'You generate Jest unit tests for a PR based on provided context JSON.',
    'Hard constraints:',
    '- Output must be STRICT JSON only (no markdown).',
    '- Output must match this schema exactly: {"files":[{"path":"automated-tests/<name>.test.ts","content":"..."}],"notes":"..."}',
    '- You may only generate files under automated-tests/. No other paths.',
    '- Do not propose changes to production code. Only tests.',
    '- Keep tests minimal and focused on changed behavior.',
  ].join('\n');

  const user = ['Context JSON follows. Generate Jest tests accordingly.', contextJson].join('\n');

  const body = {
    input: [
      { role: 'system', content: [{ type: 'text', text: system }] },
      { role: 'user', content: [{ type: 'text', text: user }] },
    ],
    response_format: { type: 'json_object' },
  };

  // STEP generate
  let resText;
  try {
    resText = await fetch(`${gatewayUrl}/v1/responses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(async (r) => {
      const t = await r.text();
      if (!r.ok) throw new Error(`HTTP ${r.status}: ${t}`);
      return t;
    });
  } catch (e) {
    stepFail('generate', `model call failed (${String(e.message || e)})`);
  }

  const resJson = JSON.parse(resText);
  const outputText = (resJson.output_text || '').trim();
  if (!outputText) throw new Error('Gateway response missing output_text');

  let manifest;
  try {
    manifest = JSON.parse(outputText);
  } catch {
    stepFail('generate', 'model output was not valid JSON');
  }
  if (!manifest || !Array.isArray(manifest.files)) stepFail('generate', 'manifest missing files[]');
  for (const f of manifest.files) {
    if (!f || typeof f.path !== 'string' || typeof f.content !== 'string') stepFail('generate', 'bad file entry');
    if (!f.path.startsWith('automated-tests/')) stepFail('generate', `bad path: ${f.path}`);
  }
  if (manifest.files.length === 0) {
    stepFail('generate', 'files.length=0 (no tests generated)');
  }

  // STEP write_files
  const outRoot = path.join(workdir, 'autotests', `run-${runId}`, 'files');
  try {
    fs.mkdirSync(outRoot, { recursive: true });
    const manifestPath = path.join(workdir, 'autotests', `run-${runId}`, 'generated-files.json');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');

    for (const f of manifest.files) {
      const target = path.join(outRoot, f.path);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, f.content, 'utf8');
    }
  } catch (e) {
    stepFail('write_files', `failed to write files (${String(e.message || e)})`);
  }

  // Build PR comment (file blocks)
  const marker = `<!-- openclaw:gen-tests run_id=${runId} -->`;
  const blocks = manifest.files
    .map((f) => `### ${f.path}\n\n\`\`\`ts\n${f.content}\n\`\`\``)
    .join('\n\n');

  const commentBody = [
    `OpenClaw gen-tests (run_id=${runId})`,
    runUrl,
    '',
    marker,
    '',
    blocks,
    manifest.notes ? `\n\nNotes:\n${manifest.notes}` : '',
  ].join('\n');

  const [owner, repoName] = repo.split('/');
  const listUrl = `https://api.github.com/repos/${owner}/${repoName}/issues/${pr}/comments?per_page=100`;
  const commentsResp = await fetch(listUrl, {
    headers: {
      Authorization: `Bearer ${ghToken}`,
      Accept: 'application/vnd.github+json',
    },
  }).then(async (r) => ({ status: r.status, text: await r.text() }));

  if (commentsResp.status !== 200) {
    stepFail('pr_comment', `GitHub list comments failed HTTP ${commentsResp.status}`);
  }

  const comments = JSON.parse(commentsResp.text);
  const existing = Array.isArray(comments) ? comments.find((c) => c.body && c.body.includes(marker)) : null;

  if (existing && existing.id) {
    const patchUrl = `https://api.github.com/repos/${owner}/${repoName}/issues/comments/${existing.id}`;
    const patchResp = await fetch(patchUrl, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${ghToken}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ body: commentBody }),
    }).then(async (r) => ({ status: r.status, text: await r.text() }));

    if (patchResp.status < 200 || patchResp.status >= 300) {
      stepFail('pr_comment', `GitHub update comment failed HTTP ${patchResp.status}`);
    }
  } else {
    const postUrl = `https://api.github.com/repos/${owner}/${repoName}/issues/${pr}/comments`;
    const postResp = await fetch(postUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ghToken}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ body: commentBody }),
    }).then(async (r) => ({ status: r.status, text: await r.text() }));

    if (postResp.status !== 201) {
      stepFail('pr_comment', `GitHub create comment failed HTTP ${postResp.status}`);
    }
  }

  // Short summary for Discord (stdout)
  const fileList = manifest.files.map((f) => f.path);
  const summary = {
    ok: true,
    repo,
    pr: Number(pr),
    run_id: runId,
    stored_at: path.join(workdir, 'autotests', `run-${runId}`, 'files'),
    files: fileList,
    file_count: fileList.length,
  };
  process.stdout.write(JSON.stringify(summary, null, 2) + '\n');
}

main().catch((e) => {
  console.error(String(e && e.stack ? e.stack : e));
  process.exit(1);
});
