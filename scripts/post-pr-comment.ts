import fs from 'fs';
import path from 'path';
import { readJsonFile } from '../src/context/io';
import { GeneratedFilesManifest, JestSummary } from '../src/context/types';

const MARKER = '<!-- agent-jest-comment -->';

export function buildCommentBody(input: {
  generatedFiles: string[];
  notes?: string;
  jestSummary?: JestSummary;
}): string {
  const summary = input.jestSummary;
  const lines = [
    MARKER,
    '# Agent Jest Result',
    '',
    `- Status: ${summary?.status || 'unknown'}`,
    `- Generated files: ${input.generatedFiles.join(', ') || '(none)'}`,
    `- Command: \`${summary?.command || '(not run)'}\``,
  ];

  if (input.notes) {
    lines.push(`- Notes: ${input.notes}`);
  }

  if (summary) {
    lines.push(`- Suites: ${summary.numPassedTestSuites}/${summary.numTotalTestSuites} passed`);
    lines.push(`- Tests: ${summary.numPassedTests}/${summary.numTotalTests} passed`);
    lines.push('');
    lines.push('## Executed tests');
    for (const result of summary.testResults.slice(0, 10)) {
      lines.push(`- ${result.name} (${result.status})`);
      for (const title of result.assertionTitles.slice(0, 5)) {
        lines.push(`  - ${title}`);
      }
    }
  }

  lines.push('');
  return lines.join('\n');
}

async function githubRequest(url: string, token: string, init?: RequestInit): Promise<any> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });
  if (!response.ok) {
    throw new Error(`GitHub API error ${response.status}: ${await response.text()}`);
  }
  return response.status === 204 ? null : response.json();
}

async function main(): Promise<void> {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY;
  const prNumber = process.env.PR_NUMBER;
  if (!token || !repo || !prNumber) {
    console.log(JSON.stringify({ skipped: true, reason: 'missing github env' }, null, 2));
    return;
  }

  const [owner, repoName] = repo.split('/');
  const generated = readJsonFile<GeneratedFilesManifest>(path.resolve('artifacts/generated/generated-files.json'));
  const jestSummaryPath = path.resolve('artifacts/jest/summary.json');
  const jestSummary = fs.existsSync(jestSummaryPath) ? readJsonFile<JestSummary>(jestSummaryPath) : undefined;
  const body = buildCommentBody({
    generatedFiles: generated.files.map((file) => file.path),
    notes: generated.notes,
    jestSummary,
  });

  const baseUrl = `https://api.github.com/repos/${owner}/${repoName}/issues/${prNumber}/comments`;
  const comments = await githubRequest(baseUrl, token);
  const existing = Array.isArray(comments)
    ? comments.find((comment: any) => typeof comment.body === 'string' && comment.body.includes(MARKER))
    : undefined;

  if (existing) {
    await githubRequest(`${baseUrl}/${existing.id}`, token, { method: 'PATCH', body: JSON.stringify({ body }) });
    console.log(JSON.stringify({ ok: true, action: 'updated', commentId: existing.id }, null, 2));
    return;
  }

  const created = await githubRequest(baseUrl, token, { method: 'POST', body: JSON.stringify({ body }) });
  console.log(JSON.stringify({ ok: true, action: 'created', commentId: created.id }, null, 2));
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
