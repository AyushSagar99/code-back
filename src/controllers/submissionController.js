// src/controllers/submissionController.js
import { PrismaClient } from '@prisma/client';


const prisma = new PrismaClient();

// ✅ AWS Judge0 Configuration
const JUDGE0_BASE_URL = process.env.JUDGE0_BASE_URL;


// Language ID mapping for Judge0
const LANGUAGE_IDS = {
  'javascript': 63,  // JavaScript (Node.js 12.14.0)
  'python': 71,      // Python (3.8.1)
  'java': 62,        // Java (OpenJDK 13.0.1)
  'cpp': 54,         // C++ (GCC 9.2.0)
  'c': 50           // C (GCC 9.2.0)
};

// ✅ FAST executeCode function with optimized polling
async function executeCode(code, language, input, expectedOutput, timeLimit, memoryLimit) {
  const languageId = LANGUAGE_IDS[language];
  if (!languageId) {
    throw new Error(`Unsupported language: ${language}`);
  }

  const formattedInput = input.trim();
  const formattedExpectedOutput = expectedOutput.trim();

  const submissionData = {
    source_code: code,
    language_id: languageId,
    stdin: formattedInput,
    expected_output: formattedExpectedOutput,
    cpu_time_limit: (timeLimit / 1000).toFixed(1),
    memory_limit: memoryLimit * 1024,
    base64_encoded: false
  };

  try {
    // ✅ Create submission
    const submissionResponse = await fetch(`${JUDGE0_BASE_URL}/submissions?base64_encoded=false&wait=false`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(submissionData)
    });

    if (!submissionResponse.ok) {
      const errorText = await submissionResponse.text();
      throw new Error(`Judge0 submission failed: ${submissionResponse.status} ${errorText}`);
    }

    const { token } = await submissionResponse.json();

    // ✅ OPTIMIZED POLLING with exponential backoff
    let attempts = 0;
    const maxAttempts = 20;
    let delay = 100; // Start with 100ms
    
    while (attempts < maxAttempts) {
      attempts++;
      
      // ✅ Shorter delays for faster results
      await new Promise(resolve => setTimeout(resolve, delay));
      
      const resultResponse = await fetch(`${JUDGE0_BASE_URL}/submissions/${token}?base64_encoded=false`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!resultResponse.ok) {
        throw new Error(`Failed to get submission result: ${resultResponse.status}`);
      }

      const result = await resultResponse.json();

      // Check if execution is complete
      if (result.status && result.status.id >= 3) {
        const actualOutput = (result.stdout || '').trim();
        const passed = actualOutput === formattedExpectedOutput && result.status.id === 3;
        
        return {
          passed,
          output: actualOutput,
          expectedOutput: formattedExpectedOutput,
          executionTime: parseFloat(result.time || '0') * 1000,
          memoryUsed: Math.round((result.memory || 0) / 1024),
          status: result.status?.description || 'Unknown',
          error: result.stderr || (result.compile_output ? `Compilation Error: ${result.compile_output}` : null)
        };
      }

      // ✅ Exponential backoff: 100ms -> 200ms -> 400ms -> 800ms -> 1000ms (cap)
      delay = Math.min(delay * 1.5, 1000);
    }

    throw new Error('Execution timeout');

  } catch (error) {
    return {
      passed: false,
      output: '',
      expectedOutput: formattedExpectedOutput,
      executionTime: 0,
      memoryUsed: 0,
      status: 'Error',
      error: error.message
    };
  }
}

// ✅ PARALLEL execution function for multiple test cases
async function executeTestCasesInParallel(code, language, testCases, timeLimit, memoryLimit) {
  console.log(`🚀 Executing ${testCases.length} test cases in PARALLEL...`);
  
  // Execute all test cases simultaneously
  const promises = testCases.map(async (testCase, index) => {
    console.log(`📤 Starting test case ${index + 1}...`);
    
    const result = await executeCode(
      code,
      language,
      testCase.input,
      testCase.output,
      timeLimit,
      memoryLimit
    );
    
    console.log(`✅ Test case ${index + 1} completed:`, result.passed ? 'PASS' : 'FAIL');
    
    return {
      input: testCase.input,
      expectedOutput: testCase.output,
      actualOutput: result.output,
      passed: result.passed,
      executionTime: result.executionTime,
      memoryUsed: result.memoryUsed,
      status: result.status,
      error: result.error,
      isHidden: testCase.isHidden
    };
  });

  // Wait for all test cases to complete
  const results = await Promise.all(promises);
  console.log(`🎉 All ${testCases.length} test cases completed in parallel!`);
  
  return results;
}

// ✅ Background processing function
async function processSubmissionInBackground(submissionId, problem, code, language) {
  try {
    console.log(`🔄 Background processing submission: ${submissionId}`);
    
    // Update status to RUNNING
    await prisma.submission.update({
      where: { id: submissionId },
      data: { status: 'RUNNING' }
    });

    // ✅ PARALLEL EXECUTION for speed
    const testCaseResults = await executeTestCasesInParallel(
      code,
      language,
      problem.testCases,
      problem.timeLimit,
      problem.memoryLimit
    );
    
    // Calculate results
    const allTestsPassed = testCaseResults.every(result => result.passed);
    const passedTests = testCaseResults.filter(result => result.passed).length;
    const totalPoints = problem.testCases.reduce((sum, tc) => sum + tc.points, 0);
    const score = Math.round((passedTests / problem.testCases.length) * totalPoints);
    const overallStatus = allTestsPassed ? 'Accepted' : 'Wrong Answer';
    
    // Update submission with results
    await prisma.submission.update({
      where: { id: submissionId },
      data: {
        status: 'COMPLETED',
        score,
        results: testCaseResults,
      },
    });
    
    console.log(`✅ Background processing completed for ${submissionId}:`, {
      status: overallStatus,
      passed: allTestsPassed,
      score: `${score}/${totalPoints}`,
      passedTests: `${passedTests}/${problem.testCases.length}`
    });
    
  } catch (error) {
    console.error(`❌ Background processing failed for ${submissionId}:`, error);
    
    await prisma.submission.update({
      where: { id: submissionId },
      data: {
        status: 'ERROR',
        results: [{
          passed: false,
          status: 'System Error',
          error: error.message
        }]
      },
    });
  }
}

/**
 * Submit code for async processing (immediate response)
 * @route POST /api/submissions
 */
export const submitCodeAsync = async (req, res) => {
  try {
    const { problemId, code, language } = req.body;
    
    // Validation
    if (!problemId || !code || !language) {
      return res.status(400).json({ 
        error: 'Missing required fields: problemId, code, and language are required' 
      });
    }

    // Validate language
    if (!LANGUAGE_IDS[language]) {
      return res.status(400).json({
        error: 'Unsupported language',
        supportedLanguages: Object.keys(LANGUAGE_IDS)
      });
    }

    console.log(`🎯 Processing async submission for problem: ${problemId}`);

    // Get problem with test cases
    const problem = await prisma.problem.findUnique({
      where: { id: problemId },
      include: { testCases: true }
    });
    
    if (!problem) {
      return res.status(404).json({ error: 'Problem not found' });
    }

    if (problem.testCases.length === 0) {
      return res.status(400).json({ error: 'Problem has no test cases' });
    }

    // Create submission record
    const submission = await prisma.submission.create({
      data: {
        problemId,
        code,
        language,
        status: 'PENDING'
      }
    });
    
    console.log('🎯 Processing submission:', submission.id);

    // ✅ IMMEDIATE RESPONSE - don't wait for execution
    res.json({
      submissionId: submission.id,
      status: 'PENDING',
      message: 'Submission received, processing in background...'
    });

    // ✅ BACKGROUND PROCESSING - execute asynchronously
    processSubmissionInBackground(submission.id, problem, code, language);
    
  } catch (error) {
    console.error('❌ Async submission failed:', error);
    res.status(500).json({ 
      error: 'Submission failed',
      message: error.message 
    });
  }
};

/**
 * Submit code and wait for results (synchronous)
 * @route POST /api/submissions/sync
 */
export const submitCodeSync = async (req, res) => {
  try {
    const { problemId, code, language } = req.body;
    
    // Validation
    if (!problemId || !code || !language) {
      return res.status(400).json({ 
        error: 'Missing required fields: problemId, code, and language are required' 
      });
    }

    // Validate language
    if (!LANGUAGE_IDS[language]) {
      return res.status(400).json({
        error: 'Unsupported language',
        supportedLanguages: Object.keys(LANGUAGE_IDS)
      });
    }

    console.log(`🚀 Processing sync submission for problem: ${problemId}`);

    const problem = await prisma.problem.findUnique({
      where: { id: problemId },
      include: { testCases: true }
    });
    
    if (!problem) {
      return res.status(404).json({ error: 'Problem not found' });
    }

    if (problem.testCases.length === 0) {
      return res.status(400).json({ error: 'Problem has no test cases' });
    }

    const submission = await prisma.submission.create({
      data: {
        problemId,
        code,
        language,
        status: 'RUNNING'
      }
    });
    
    console.log('🚀 FAST execution starting...');
    const startTime = Date.now();

    // ✅ PARALLEL EXECUTION for maximum speed
    const testCaseResults = await executeTestCasesInParallel(
      code,
      language,
      problem.testCases,
      problem.timeLimit,
      problem.memoryLimit
    );
    
    const executionTime = Date.now() - startTime;
    console.log(`⚡ Total execution time: ${executionTime}ms`);
    
    const allTestsPassed = testCaseResults.every(result => result.passed);
    const passedTests = testCaseResults.filter(result => result.passed).length;
    const totalPoints = problem.testCases.reduce((sum, tc) => sum + tc.points, 0);
    const score = Math.round((passedTests / problem.testCases.length) * totalPoints);
    const overallStatus = allTestsPassed ? 'Accepted' : 'Wrong Answer';
    
    await prisma.submission.update({
      where: { id: submission.id },
      data: {
        status: 'COMPLETED',
        score,
        results: testCaseResults,
      },
    });
    
    // Return complete results immediately
    res.json({
      submissionId: submission.id,
      status: overallStatus,
      passed: allTestsPassed,
      score,
      totalPoints,
      passedTests: `${passedTests}/${problem.testCases.length}`,
      executionTimeMs: executionTime,
      testCaseResults: testCaseResults.map(result => ({
        ...result,
        // Hide details for hidden test cases
        input: result.isHidden ? '[Hidden]' : result.input,
        expectedOutput: result.isHidden ? '[Hidden]' : result.expectedOutput,
        actualOutput: result.isHidden ? (result.passed ? '[Hidden - Passed]' : '[Hidden - Failed]') : result.actualOutput
      }))
    });
    
  } catch (error) {
    console.error('❌ Sync submission failed:', error);
    res.status(500).json({ 
      error: 'Submission failed',
      message: error.message 
    });
  }
};

/**
 * Get submission by ID
 * @route GET /api/submissions/:id
 */
export const getSubmissionById = async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log(`🔍 Fetching submission: ${id}`);
    
    const submission = await prisma.submission.findUnique({
      where: { id },
      include: { 
        problem: {
          include: { testCases: true }
        }
      }
    });
    
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }
    
    // Format response based on status
    const response = {
      ...submission,
      testCaseResults: submission.results ? submission.results.map(result => ({
        ...result,
        // Hide details for hidden test cases in the response
        input: result.isHidden ? '[Hidden]' : result.input,
        expectedOutput: result.isHidden ? '[Hidden]' : result.expectedOutput,
        actualOutput: result.isHidden ? (result.passed ? '[Hidden - Passed]' : '[Hidden - Failed]') : result.actualOutput
      })) : []
    };
    
    console.log(`✅ Found submission: ${submission.id} (${submission.status})`);
    res.json(response);
    
  } catch (error) {
    console.error('❌ Failed to get submission:', error);
    res.status(500).json({ 
      error: 'Failed to fetch submission',
      message: error.message 
    });
  }
};

/**
 * Get all submissions for a problem
 * @route GET /api/submissions/problem/:problemId
 */
export const getSubmissionsByProblem = async (req, res) => {
  try {
    const { problemId } = req.params;
    const { limit = 50, offset = 0 } = req.query;
    
    console.log(`📋 Fetching submissions for problem: ${problemId}`);
    
    const submissions = await prisma.submission.findMany({
      where: { problemId },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit),
      skip: parseInt(offset),
      select: {
        id: true,
        code: true,
        language: true,
        status: true,
        score: true,
        createdAt: true,
        // Don't include full results to keep response lightweight
      }
    });
    
    console.log(`✅ Found ${submissions.length} submissions`);
    res.json(submissions);
    
  } catch (error) {
    console.error('❌ Failed to get submissions:', error);
    res.status(500).json({ 
      error: 'Failed to fetch submissions',
      message: error.message 
    });
  }
};

/**
 * Test Judge0 connection
 * @route GET /api/submissions/test-judge0
 */
export const testJudge0 = async (req, res) => {
  try {
    console.log('🧪 Testing AWS Judge0 with timing...');
    const startTime = Date.now();
    
    const testCode = 'console.log("Hello World");';
    const result = await executeCode(testCode, 'javascript', '', 'Hello World', 2000, 256);
    
    const totalTime = Date.now() - startTime;
    
    res.json({
      message: 'AWS Judge0 test completed',
      result,
      executionTimeMs: totalTime,
      judge0Url: JUDGE0_BASE_URL,
      status: result.passed ? 'SUCCESS' : 'FAILED'
    });
  } catch (error) {
    console.error('❌ Judge0 test failed:', error);
    res.status(500).json({
      error: 'AWS Judge0 test failed',
      message: error.message,
      judge0Url: JUDGE0_BASE_URL
    });
  }
};