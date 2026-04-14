import fs from 'fs';
import path from 'path';
import { RelatedTestMatch } from './types';

function walk(dir: string, found: string[] = []): string[] {
  if (!fs.existsSync(dir)) return found;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', '.git', 'dist'].includes(entry.name)) continue;
      walk(full, found);
    } else {
      found.push(full);
    }
  }
  return found;
}

export function listTestFiles(repoRoot: string): string[] {
  return walk(repoRoot)
    .filter((file) => /\.(test|spec)\.ts$/.test(file))
    .map((file) => path.relative(repoRoot, file));
}

export function searchRelatedTests(repoRoot: string, targetPath: string, symbols: string[] = []): RelatedTestMatch[] {
  const relTarget = targetPath.replace(/\\/g, '/');
  const dir = path.posix.dirname(relTarget);
  const base = path.posix.basename(relTarget).replace(/\.(ts|tsx|js|jsx)$/, '');
  const tests = listTestFiles(repoRoot);
  const matches: RelatedTestMatch[] = [];
  const seen = new Set<string>();

  for (const testPath of tests) {
    const normalized = testPath.replace(/\\/g, '/');
    const reasons: string[] = [];
    if (normalized.startsWith(`${dir}/`) && normalized.includes(`${base}.`)) {
      reasons.push('same basename');
    }
    const full = path.join(repoRoot, testPath);
    const content = fs.readFileSync(full, 'utf8');
    for (const symbol of symbols) {
      if (symbol && content.includes(symbol)) {
        reasons.push(`mentions ${symbol}`);
      }
    }
    if (reasons.length && !seen.has(testPath)) {
      seen.add(testPath);
      matches.push({ path: testPath, reason: reasons.join(', ') });
    }
  }

  return matches;
}
