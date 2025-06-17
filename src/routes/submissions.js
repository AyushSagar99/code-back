// Update your submissions.js file with AWS Judge0 endpoints

import express from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

// ✅ AWS Judge0 Configuration
const JUDGE0_BASE_URL = 'http://13.61.195.9:2358';

// Language ID mapping for Judge0
const LANGUAGE_IDS = {
  'javascript': 63,  // JavaScript (Node.js 12.14.0)
  'python': 71,      // Python (3.8.1)
  'java': 62,        // Java (OpenJDK 13.0.1)
  'cpp': 54,         // C++ (GCC 9.2.0)
  'c': 50           // C (GCC 9.2.0)
};

// ✅ Updated executeCode function for AWS Judge0
async function executeCode(code, language, input, expectedOutput, timeLimit, memoryLimit) {
  const languageId = LANGUAGE_IDS[language];
  if (!languageId) {
    throw new Error(`Unsupported language: ${language}`);
  }

  // Format input and expected output
  const formattedInput = input.trim();
  const formattedExpectedOutput = expectedOutput.trim();
  
  console.log('📝 Input sent to AWS Judge0:', JSON.stringify(formattedInput));
  console.log('📝 Expected output:', JSON.stringify(formattedExpectedOutput));

  const submissionData = {
    source_code: code,
    language_id: languageId,
    stdin: formattedInput,
    expected_output: formattedExpectedOutput,
    cpu_time_limit: (timeLimit / 1000).toFixed(1), // Convert ms to seconds
    memory_limit: memoryLimit * 1024, // Convert MB to KB
    base64_encoded: false
  };

  try {
    // ✅ Create submission on AWS Judge0
    console.log('🚀 Submitting to AWS Judge0...');
    const submissionResponse = await fetch(`${JUDGE0_BASE_URL}/submissions?base64_encoded=false&wait=false`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
        // ✅ No API key needed for AWS instance!
      },
      body: JSON.stringify(submissionData)
    });

    if (!submissionResponse.ok) {
      const errorText = await submissionResponse.text();
      console.error('❌ AWS Judge0 submission failed:', submissionResponse.status, errorText);
      throw new Error(`AWS Judge0 submission failed: ${submissionResponse.status} ${errorText}`);
    }

    const { token } = await submissionResponse.json();
    console.log(`✅ Submission created with token: ${token}`);

    // ✅ Poll for results on AWS Judge0
    let attempts = 0;
    const maxAttempts = 15; // Increased for AWS instance
    
    while (attempts < maxAttempts) {
      attempts++;
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
      
      console.log(`🔄 Polling attempt ${attempts}/${maxAttempts}...`);
      
      const resultResponse = await fetch(`${JUDGE0_BASE_URL}/submissions/${token}?base64_encoded=false`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!resultResponse.ok) {
        console.error('❌ Failed to get result:', resultResponse.status);
        throw new Error(`Failed to get submission result: ${resultResponse.status}`);
      }

      const result = await resultResponse.json();
      console.log(`📊 Status: ${result.status?.description || 'Unknown'}`);

      // Check if execution is complete
      if (result.status && result.status.id >= 3) { // 3+ means completed (success or error)
        const actualOutput = (result.stdout || '').trim();
        const passed = actualOutput === formattedExpectedOutput && result.status.id === 3;
        
        console.log('✅ Execution completed:', {
          token,
          status: result.status,
          actualOutput: JSON.stringify(actualOutput),
          expectedOutput: JSON.stringify(formattedExpectedOutput),
          outputMatches: actualOutput === formattedExpectedOutput,
          passed,
          rawStdout: result.stdout,
          stderr: result.stderr
        });

        return {
          passed,
          output: actualOutput,
          expectedOutput: formattedExpectedOutput,
          executionTime: parseFloat(result.time || '0') * 1000, // Convert to ms
          memoryUsed: Math.round((result.memory || 0) / 1024), // Convert to MB
          status: result.status?.description || 'Unknown',
          error: result.stderr || (result.compile_output ? `Compilation Error: ${result.compile_output}` : null)
        };
      }
    }

    throw new Error('Execution timeout - submission took too long');

  } catch (error) {
    console.error('❌ AWS Judge0 execution error:', error);
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

// ✅ Test endpoint to verify AWS Judge0 connection
router.get('/test-judge0', async (req, res) => {
  try {
    console.log('🧪 Testing AWS Judge0 connection...');
    
    // Simple test code
    const testCode = 'console.log("Hello World");';
    const result = await executeCode(testCode, 'javascript', '', 'Hello World', 2000, 256);
    
    res.json({
      message: 'AWS Judge0 test completed',
      result,
      judge0Url: JUDGE0_BASE_URL
    });
  } catch (error) {
    console.error('❌ Judge0 test failed:', error);
    res.status(500).json({
      error: 'AWS Judge0 test failed',
      message: error.message,
      judge0Url: JUDGE0_BASE_URL
    });
  }
});

// ✅ Main submission endpoint (same as before, but uses AWS Judge0)
router.post('/', async (req, res) => {
  try {
    const { problemId, code, language } = req.body;
    
    // Validate input
    if (!problemId || !code || !language) {
      return res.status(400).json({ 
        error: 'Missing required fields: problemId, code, and language are required' 
      });
    }

    // Get problem with test cases
    const problem = await prisma.problem.findUnique({
      where: { id: problemId },
      include: { testCases: true }
    });
    
    if (!problem) {
      return res.status(404).json({ error: 'Problem not found' });
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
    console.log('🔧 Language:', language);
    console.log('📝 Code length:', code.length, 'characters');
    console.log('🧪 Test cases:', problem.testCases.length);

    let testCaseResults = [];
    let allTestsPassed = true;
    let overallStatus = 'Accepted';
    
    try {
      // ✅ Execute against all test cases using AWS Judge0
      for (const [index, testCase] of problem.testCases.entries()) {
        console.log(`\n🔄 Executing test case ${index + 1}/${problem.testCases.length}`);
        console.log('📥 Input:', JSON.stringify(testCase.input));
        console.log('🎯 Expected:', JSON.stringify(testCase.output));
        
        const result = await executeCode(
          code,
          language,
          testCase.input,
          testCase.output,
          problem.timeLimit,
          problem.memoryLimit
        );
        
        console.log('📤 Result:', {
          passed: result.passed,
          output: JSON.stringify(result.output),
          status: result.status,
          time: result.executionTime + 'ms'
        });
        
        testCaseResults.push({
          input: testCase.input,
          expectedOutput: testCase.output,
          actualOutput: result.output,
          passed: result.passed,
          executionTime: result.executionTime,
          memoryUsed: result.memoryUsed,
          status: result.status,
          error: result.error,
          isHidden: testCase.isHidden
        });
        
        if (!result.passed) {
          allTestsPassed = false;
          overallStatus = result.status;
          console.log('❌ Test case failed, continuing with remaining tests...');
        }
      }
      
      // Calculate score
      const passedTests = testCaseResults.filter(result => result.passed).length;
      const totalPoints = problem.testCases.reduce((sum, tc) => sum + tc.points, 0);
      const score = Math.round((passedTests / problem.testCases.length) * totalPoints);
      
      // Update submission with results
      await prisma.submission.update({
        where: { id: submission.id },
        data: {
          status: overallStatus,
          score,
          results: testCaseResults,
        },
      });
      
      console.log('\n✅ Submission completed:', {
        submissionId: submission.id,
        status: overallStatus,
        passed: allTestsPassed,
        score: `${score}/${totalPoints}`,
        passedTests: `${passedTests}/${problem.testCases.length}`
      });
      
      // Return response (hide hidden test case details)
      res.json({
        submissionId: submission.id,
        status: overallStatus,
        passed: allTestsPassed,
        score,
        testCaseResults: testCaseResults.map(result => ({
          ...result,
          // Hide details for hidden test cases
          input: result.isHidden ? '[Hidden]' : result.input,
          expectedOutput: result.isHidden ? '[Hidden]' : result.expectedOutput,
          actualOutput: result.isHidden ? (result.passed ? '[Hidden - Passed]' : '[Hidden - Failed]') : result.actualOutput
        }))
      });
      
    } catch (error) {
      console.error('❌ Execution error:', error);
      
      // Update submission with error
      await prisma.submission.update({
        where: { id: submission.id },
        data: {
          status: 'ERROR',
          results: [{
            passed: false,
            status: 'System Error',
            error: error.message
          }]
        },
      });
      
      res.status(500).json({
        submissionId: submission.id,
        status: 'Error',
        passed: false,
        error: error.message,
        testCaseResults: []
      });
    }
    
  } catch (error) {
    console.error('❌ Submission failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// ✅ Get submission endpoint (same as before)
router.get('/:id', async (req, res) => {
  try {
    const submission = await prisma.submission.findUnique({
      where: { id: req.params.id },
      include: { 
        problem: {
          include: { testCases: true }
        }
      }
    });
    
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }
    
    res.json(submission);
  } catch (error) {
    console.error('Failed to get submission:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;