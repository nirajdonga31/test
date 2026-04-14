import fs from 'fs';
import path from 'path';
import { ensureDir } from '../src/context/io';

function copyRecursive(source: string, destination: string): void {
  const stat = fs.statSync(source);
  if (stat.isDirectory()) {
    const name = path.basename(source);
    if (['.git', 'node_modules', 'dist', 'artifacts', 'tests', 'docs'].includes(name)) return;
    ensureDir(destination);
    for (const entry of fs.readdirSync(source)) {
      copyRecursive(path.join(source, entry), path.join(destination, entry));
    }
    return;
  }
  ensureDir(path.dirname(destination));
  fs.copyFileSync(source, destination);
}

const repoRoot = process.cwd();
const destination = path.resolve(process.argv[2] || 'artifacts/workspace');
ensureDir(destination);
for (const entry of fs.readdirSync(repoRoot)) {
  if (['.git', 'node_modules', 'dist', 'artifacts'].includes(entry)) continue;
  copyRecursive(path.join(repoRoot, entry), path.join(destination, entry));
}
console.log(JSON.stringify({ ok: true, destination }, null, 2));
