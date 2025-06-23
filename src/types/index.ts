// src/types/index.ts
export interface Problem {
    id: string;
    title: string;
    description: string;
    difficulty: string;
    timeLimit: number;
    memoryLimit: number;
    createdAt: Date;
    testCases?: TestCase[];
  }
  
  export interface TestCase {
    id: string;
    input: string;
    output: string;
    points: number;
    isHidden: boolean;
    problemId: string;
  }
  
  export interface Submission {
    id: string;
    problemId: string;
    code: string;
    language: string;
    status: SubmissionStatus;
    score?: number;
    results?: TestCaseResult[];
    createdAt: Date;
    problem?: Problem;
  }
  
  export type SubmissionStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'ERROR';
  
  export interface TestCaseResult {
    input: string;
    expectedOutput: string;
    actualOutput: string;
    passed: boolean;
    executionTime: number;
    memoryUsed: number;
    status: string;
    error?: string;
    isHidden?: boolean;
  }
  
  export interface ExecutionResult {
    passed: boolean;
    output: string;
    expectedOutput: string;
    executionTime: number;
    memoryUsed: number;
    status: string;
    error?: string;
  }
  
  export interface Judge0SubmissionData {
    source_code: string;
    language_id: number;
    stdin: string;
    expected_output: string;
    cpu_time_limit: string;
    memory_limit: number;
    base64_encoded: boolean;
  }
  
  export interface Judge0Result {
    token: string;
    status?: {
      id: number;
      description: string;
    };
    stdout?: string;
    stderr?: string;
    compile_output?: string;
    time?: string;
    memory?: number;
  }
  
  export type SupportedLanguage = 'javascript' | 'python' | 'java' | 'cpp' | 'c';
  
  export interface LanguageMapping {
    [key: string]: number;
  }
  
  export interface ProblemStats {
    problemId: string;
    totalSubmissions: number;
    successfulSubmissions: number;
    successRate: string;
    averageScore: string;
    statusBreakdown: Record<string, number>;
  }
  
  // Request/Response types
  export interface SubmitCodeRequest {
    problemId: string;
    code: string;
    language: SupportedLanguage;
  }
  
  export interface SubmitCodeResponse {
    submissionId: string;
    status: string;
    message?: string;
    passed?: boolean;
    score?: number;
    totalPoints?: number;
    passedTests?: string;
    executionTimeMs?: number;
    testCaseResults?: TestCaseResult[];
  }
  
  export interface CreateProblemRequest {
    title: string;
    description: string;
    difficulty: string;
    timeLimit?: number;
    memoryLimit?: number;
  }