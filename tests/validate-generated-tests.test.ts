import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { writeJsonFile, readJsonFile } from '../src/context/io';

describe('generated test validation', () => {
  it('accepts allowed test file paths', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'validate-'));
    const input = path.join(root, 'generated.json');
    const config = path.join(root, 'config.json');
    const output = path.join(root, 'result.json');
    writeJsonFile(input, { files: [{ path: 'src/foo/bar.test.ts', content: 'test' }] });
    writeJsonFile(config, { allowedWriteGlobs: ['**/*.test.ts', '**/*.spec.ts'] });
    execFileSync('node', ['dist/scripts/validate-generated-tests.js', '--input', input, '--config', config, '--out', output], { cwd: process.cwd() });
    expect(readJsonFile<{ accepted: boolean }>(output).accepted).toBe(true);
  });

  it('rejects production file paths', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'validate-'));
    const input = path.join(root, 'generated.json');
    const config = path.join(root, 'config.json');
    const output = path.join(root, 'result.json');
    writeJsonFile(input, { files: [{ path: 'src/foo/bar.ts', content: 'export const x = 1;' }] });
    writeJsonFile(config, { allowedWriteGlobs: ['**/*.test.ts', '**/*.spec.ts'] });
    try {
      execFileSync('node', ['dist/scripts/validate-generated-tests.js', '--input', input, '--config', config, '--out', output], { cwd: process.cwd(), stdio: 'pipe' });
    } catch {}
    expect(readJsonFile<{ accepted: boolean }>(output).accepted).toBe(false);
  });
});
