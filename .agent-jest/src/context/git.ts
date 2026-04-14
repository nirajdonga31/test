import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';

function git(args: string[], repoRoot: string): string {
  return execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' }).trim();
}

export function getChangedFiles(baseSha: string, headSha: string, repoRoot: string): Array<{ path: string; status: string }> {
  const output = git(['diff', '--name-status', `${baseSha}...${headSha}`], repoRoot);
  if (!output) return [];
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [status, ...rest] = line.split(/\s+/);
      return { status, path: rest.join(' ') };
    })
    .filter((item) => /\.(ts|tsx|js|jsx)$/.test(item.path))
    .filter((item) => !/(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn.lock)$/i.test(item.path));
}

export function getDiffForFile(baseSha: string, headSha: string, filePath: string, repoRoot: string): string {
  return git(['diff', `${baseSha}...${headSha}`, '--', filePath], repoRoot);
}

export function readFileAtHead(filePath: string, repoRoot: string): string {
  const absolute = path.join(repoRoot, filePath);
  return fs.existsSync(absolute) ? fs.readFileSync(absolute, 'utf8') : '';
}
