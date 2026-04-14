export interface RelatedTestMatch {
  path: string;
  reason: string;
}

export interface ChangedFileContext {
  path: string;
  status: string;
  diff: string;
  language: string;
  relatedTests: RelatedTestMatch[];
}

export interface InitialContext {
  pr: {
    repo: string;
    baseSha: string;
    headSha: string;
    number?: number;
  };
  changedFiles: ChangedFileContext[];
  repo: {
    packageJson?: string;
    jestConfig?: string;
    testConventions: {
      patterns: string[];
      framework: string;
    };
  };
  rules: {
    allowedWriteGlobs: string[];
    forbidProductionFileEdits: boolean;
    forbidDependencyChanges: boolean;
  };
}

export interface GeneratedFile {
  path: string;
  content: string;
}

export interface GeneratedFilesManifest {
  files: GeneratedFile[];
  notes?: string;
}

export interface ValidationResult {
  accepted: boolean;
  errors: string[];
}

export interface JestSummary {
  command: string;
  generatedFiles: string[];
  numTotalTestSuites: number;
  numPassedTestSuites: number;
  numFailedTestSuites: number;
  numTotalTests: number;
  numPassedTests: number;
  numFailedTests: number;
  status: 'passed' | 'failed';
  testResults: Array<{
    name: string;
    status: string;
    assertionTitles: string[];
  }>;
}
