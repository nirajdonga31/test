import { getDiffForFile, readFileAtHead } from '../src/context/git';
import { getImportGraphNeighbors } from '../src/context/import-neighbors';
import { searchRelatedTests } from '../src/context/test-search';

async function main(): Promise<void> {
  const input = JSON.parse(process.argv[2] || '{}') as { tool?: string; args?: Record<string, unknown> };
  const repoRoot = process.cwd();
  const baseSha = String(process.env.PR_BASE_SHA || 'HEAD~1');
  const headSha = String(process.env.PR_HEAD_SHA || 'HEAD');

  switch (input.tool) {
    case 'get_file':
      process.stdout.write(JSON.stringify({ path: input.args?.path, content: readFileAtHead(String(input.args?.path || ''), repoRoot) }, null, 2));
      return;
    case 'search_related_tests':
      process.stdout.write(JSON.stringify({ matches: searchRelatedTests(repoRoot, String(input.args?.path || ''), (input.args?.symbols as string[] | undefined) || []) }, null, 2));
      return;
    case 'get_diff_for_file':
      process.stdout.write(JSON.stringify({ path: input.args?.path, baseSha, headSha, diff: getDiffForFile(baseSha, headSha, String(input.args?.path || ''), repoRoot) }, null, 2));
      return;
    case 'get_import_graph_neighbors':
      process.stdout.write(JSON.stringify(getImportGraphNeighbors(repoRoot, String(input.args?.path || '')), null, 2));
      return;
    default:
      process.stdout.write(JSON.stringify({ error: 'unknown tool' }, null, 2));
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
