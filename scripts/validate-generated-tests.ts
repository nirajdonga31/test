import path from 'path';
import { readJsonFile, writeJsonFile } from '../src/context/io';
import { GeneratedFilesManifest, ValidationResult } from '../src/context/types';

function argValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const inputPath = argValue('--input') || 'artifacts/generated/generated-files.json';
const configPath = argValue('--config') || 'agent-testgen.config.json';
const outPath = argValue('--out') || 'artifacts/generated/validation-result.json';

const manifest = readJsonFile<GeneratedFilesManifest>(path.resolve(inputPath));
const config = readJsonFile<{ allowedWriteGlobs: string[] }>(path.resolve(configPath));
const allowedSuffixes = config.allowedWriteGlobs.map((pattern) => pattern.replace('**/*', ''));
const errors: string[] = [];

for (const file of manifest.files) {
  if (!file.content.trim()) errors.push(`Empty generated file: ${file.path}`);
  if (!allowedSuffixes.some((suffix) => file.path.endsWith(suffix))) {
    errors.push(`Disallowed generated path: ${file.path}`);
  }
  if (/package\.json$|package-lock\.json$|pnpm-lock\.yaml$|yarn.lock$/.test(file.path)) {
    errors.push(`Dependency file edit is forbidden: ${file.path}`);
  }
}

const result: ValidationResult = { accepted: errors.length === 0, errors };
writeJsonFile(path.resolve(outPath), result);
console.log(JSON.stringify(result, null, 2));
if (!result.accepted) process.exit(1);
