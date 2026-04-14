import path from 'path';
import { getChangedFiles, getDiffForFile, readFileAtHead } from '../src/context/git';
import { writeJsonFile } from '../src/context/io';
import { searchRelatedTests } from '../src/context/test-search';
import { InitialContext } from '../src/context/types';

function argValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const repoRoot = process.cwd();
const baseSha = argValue('--base') || process.env.PR_BASE_SHA || 'HEAD~1';
const headSha = argValue('--head') || process.env.PR_HEAD_SHA || 'HEAD';
const repo = process.env.GITHUB_REPOSITORY || 'local/tester';
const prNumber = process.env.PR_NUMBER ? Number(process.env.PR_NUMBER) : undefined;

const changedFiles = getChangedFiles(baseSha, headSha, repoRoot).map((file) => ({
  path: file.path,
  status: file.status,
  diff: getDiffForFile(baseSha, headSha, file.path, repoRoot),
  language: 'typescript',
  relatedTests: searchRelatedTests(repoRoot, file.path),
}));

const packageJsonPath = path.join(repoRoot, 'package.json');
const jestConfigPath = path.join(repoRoot, 'jest.config.cjs');

const context: InitialContext = {
  pr: { repo, baseSha, headSha, number: prNumber },
  changedFiles,
  repo: {
    packageJson: readFileAtHead('package.json', repoRoot),
    jestConfig: readFileAtHead('jest.config.cjs', repoRoot),
    testConventions: {
      patterns: ['**/*.test.ts', '**/*.spec.ts'],
      framework: 'jest',
    },
  },
  rules: {
    allowedWriteGlobs: ['**/*.test.ts', '**/*.spec.ts'],
    forbidProductionFileEdits: true,
    forbidDependencyChanges: true,
  },
};

void packageJsonPath;
void jestConfigPath;
writeJsonFile(path.join(repoRoot, 'artifacts/context/initial-context.json'), context);
console.log(JSON.stringify({ ok: true, changedFiles: changedFiles.length }, null, 2));
