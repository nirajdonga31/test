import { buildCommentBody } from '../scripts/post-pr-comment';

describe('buildCommentBody', () => {
  it('renders a stable PR comment body', () => {
    const body = buildCommentBody({
      generatedFiles: ['tests/generated/example.test.ts'],
      notes: 'Generated from API',
      jestSummary: {
        command: 'npx jest tests/generated/example.test.ts',
        generatedFiles: ['tests/generated/example.test.ts'],
        numTotalTestSuites: 1,
        numPassedTestSuites: 1,
        numFailedTestSuites: 0,
        numTotalTests: 1,
        numPassedTests: 1,
        numFailedTests: 0,
        status: 'passed',
        testResults: [{ name: 'src/example.test.ts', status: 'passed', assertionTitles: ['example works'] }],
      },
    });

    expect(body).toContain('<!-- agent-jest-comment -->');
    expect(body).toContain('tests/generated/example.test.ts');
    expect(body).toContain('Generated from API');
    expect(body).toContain('passed');
    expect(body).toContain('example works');
  });
});
