import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { readJsonFile, writeJsonFile, writeTextFile, ensureDir } from '../src/context/io';
import { GeneratedFilesManifest, JestSummary } from '../src/context/types';

function argValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const inputPath = path.resolve(argValue('--input') || 'artifacts/generated/generated-files.json');
const workspace = path.resolve(argValue('--workspace') || 'artifacts/workspace');
const outDir = path.resolve(argValue('--outDir') || 'artifacts/jest');
ensureDir(outDir);

const manifest = readJsonFile<GeneratedFilesManifest>(inputPath);
const generatedRelativePaths = manifest.files.map((file) => file.path);
const jestResultsPath = path.join(outDir, 'jest-results.json');
const command = ['npx', 'jest', '--config', JSON.stringify({ preset: 'ts-jest', testEnvironment: 'node' }), '--runInBand', '--runTestsByPath', '--json', `--outputFile=${jestResultsPath}`, ...generatedRelativePaths];

let status: 'passed' | 'failed' = 'passed';
try {
  execFileSync(command[0], command.slice(1), { cwd: workspace, stdio: 'inherit' });
} catch {
  status = 'failed';
}

const rawResults = fs.existsSync(jestResultsPath)
  ? JSON.parse(fs.readFileSync(jestResultsPath, 'utf8'))
  : {
      numTotalTestSuites: 0,
      numPassedTestSuites: 0,
      numFailedTestSuites: 0,
      numTotalTests: 0,
      numPassedTests: 0,
      numFailedTests: 0,
      testResults: [],
    };

const summary: JestSummary = {
  command: command.join(' '),
  generatedFiles: generatedRelativePaths,
  numTotalTestSuites: rawResults.numTotalTestSuites || 0,
  numPassedTestSuites: rawResults.numPassedTestSuites || 0,
  numFailedTestSuites: rawResults.numFailedTestSuites || 0,
  numTotalTests: rawResults.numTotalTests || 0,
  numPassedTests: rawResults.numPassedTests || 0,
  numFailedTests: rawResults.numFailedTests || 0,
  status,
  testResults: (rawResults.testResults || []).map((result: any) => ({
    name: result.name,
    status: result.status,
    assertionTitles: (result.assertionResults || []).map((assertion: any) => assertion.fullName),
  })),
};

const markdown = [
  '# Generated Jest Summary',
  '',
  `- Status: ${summary.status}`,
  `- Command: \`${summary.command}\``,
  `- Generated files: ${summary.generatedFiles.join(', ') || '(none)'}`,
  `- Suites: ${summary.numPassedTestSuites}/${summary.numTotalTestSuites} passed`,
  `- Tests: ${summary.numPassedTests}/${summary.numTotalTests} passed`,
  '',
  '## Test results',
  ...summary.testResults.flatMap((result) => [
    `- ${result.name} (${result.status})`,
    ...result.assertionTitles.map((title) => `  - ${title}`),
  ]),
  '',
].join('\n');

writeJsonFile(path.join(outDir, 'summary.json'), summary);
writeTextFile(path.join(outDir, 'summary.md'), markdown);
if (process.env.GITHUB_STEP_SUMMARY) {
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${markdown}\n`, 'utf8');
}
console.log(JSON.stringify({ ok: true, status }, null, 2));
if (status === 'failed') process.exit(1);
