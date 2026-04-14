import fs from 'fs';
import path from 'path';

const IMPORT_RE = /import\s+(?:[^'";]+from\s+)?['"]([^'"]+)['"]/g;

function resolveLocalImport(fromFile: string, specifier: string): string | null {
  if (!specifier.startsWith('.')) return null;
  const base = path.resolve(path.dirname(fromFile), specifier);
  const candidates = [base, `${base}.ts`, `${base}.tsx`, `${base}.js`, `${base}.jsx`, path.join(base, 'index.ts')];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  return null;
}

function walk(dir: string, found: string[] = []): string[] {
  if (!fs.existsSync(dir)) return found;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', '.git', 'dist'].includes(entry.name)) continue;
      walk(full, found);
    } else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
      found.push(full);
    }
  }
  return found;
}

export function getImportGraphNeighbors(repoRoot: string, targetPath: string): { path: string; imports: string[]; importedBy: string[] } {
  const absoluteTarget = path.join(repoRoot, targetPath);
  const imports: string[] = [];
  if (fs.existsSync(absoluteTarget)) {
    const content = fs.readFileSync(absoluteTarget, 'utf8');
    for (const match of content.matchAll(IMPORT_RE)) {
      const resolved = resolveLocalImport(absoluteTarget, match[1]);
      if (resolved) imports.push(path.relative(repoRoot, resolved));
    }
  }

  const importedBy: string[] = [];
  const allCodeFiles = walk(repoRoot);
  const importNeedle = path.posix.basename(targetPath).replace(/\.(ts|tsx|js|jsx)$/, '');
  for (const codeFile of allCodeFiles) {
    const rel = path.relative(repoRoot, codeFile);
    if (rel === targetPath) continue;
    const content = fs.readFileSync(codeFile, 'utf8');
    if (content.includes(importNeedle)) {
      importedBy.push(rel);
    }
  }

  return {
    path: targetPath,
    imports: Array.from(new Set(imports)),
    importedBy: Array.from(new Set(importedBy)),
  };
}
