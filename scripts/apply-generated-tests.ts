import path from 'path';
import { ensureDir, readJsonFile, writeJsonFile } from '../src/context/io';
import { GeneratedFilesManifest } from '../src/context/types';
import fs from 'fs';

function argValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const inputPath = argValue('--input') || 'artifacts/generated/generated-files.json';
const destRoot = path.resolve(argValue('--dest') || 'artifacts/workspace');
const outPath = argValue('--out') || 'artifacts/generated/written-files.json';

const manifest = readJsonFile<GeneratedFilesManifest>(path.resolve(inputPath));
const writtenFiles: string[] = [];

for (const file of manifest.files) {
  const outputPath = path.join(destRoot, file.path);
  ensureDir(path.dirname(outputPath));
  fs.writeFileSync(outputPath, file.content, 'utf8');
  writtenFiles.push(outputPath);
}

writeJsonFile(path.resolve(outPath), { writtenFiles });
console.log(JSON.stringify({ ok: true, writtenFiles: writtenFiles.length }, null, 2));
