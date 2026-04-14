import fs from 'fs';
import os from 'os';
import path from 'path';
import { ensureDir, readJsonFile, writeJsonFile } from '../src/context/io';
import { searchRelatedTests } from '../src/context/test-search';

describe('context helpers', () => {
  it('writes and reads json files', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ctx-'));
    const target = path.join(root, 'nested', 'data.json');
    writeJsonFile(target, { ok: true });
    expect(readJsonFile<{ ok: boolean }>(target)).toEqual({ ok: true });
  });

  it('finds related sibling tests and symbol mentions', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'search-'));
    ensureDir(path.join(root, 'src/foo'));
    fs.writeFileSync(path.join(root, 'src/foo/bar.ts'), 'export const BarService = 1;');
    fs.writeFileSync(path.join(root, 'src/foo/bar.test.ts'), 'describe("BarService", () => {});');
    const matches = searchRelatedTests(root, 'src/foo/bar.ts', ['BarService']);
    expect(matches.some((match) => match.path === 'src/foo/bar.test.ts')).toBe(true);
  });
});
