import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';

describe('run-agent-testgen', () => {
  it('keeps stub mode working', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agentgen-'));
    const contextPath = path.join(root, 'context.json');
    const outPath = path.join(root, 'generated.json');
    fs.writeFileSync(contextPath, JSON.stringify({ changedFiles: [], pr: {}, repo: { testConventions: { patterns: [], framework: 'jest' } }, rules: {} }));
    execFileSync('node', ['dist/scripts/run-agent-testgen.js', '--context', contextPath, '--out', outPath, '--mode', 'stub'], { cwd: process.cwd() });
    const data = JSON.parse(fs.readFileSync(outPath, 'utf8'));
    expect(Array.isArray(data.files)).toBe(true);
  });
});
