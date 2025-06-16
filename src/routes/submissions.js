// backend/routes/submissions.js - Fixed for ES6 and Frontend Compatibility
import express from 'express';
import rateLimit from 'express-rate-limit';
import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const router = express.Router();
const prisma = new PrismaClient();

const JUDGE0_URL = process.env.JUDGE0_URL;
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;

// Language mappings for Judge0
const LANGUAGE_IDS = {
  'javascript': 63,
  'python': 71,
  'java': 62,
  'cpp': 54,
  'c': 50,
};

// Submission rate limiting
const submissionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 submissions per windowMs
  message: 'Too many submissions, please try again later.',
});

// Submit code for evaluation - SYNCHRONOUS processing
router.post('/', submissionLimiter, async (req, res) => {
  try {
    const { problemId, code, language } = req.body;
    
    // Validate inputs
    if (!problemId || !code || !language) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    if (!LANGUAGE_IDS[language]) {
      return res.status(400).json({ error: 'Unsupported language' });
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
        status: 'Processing',
      }
    });

    console.log(`Created submission ${submission.id} for problem ${problemId}`);

    // 🔥 PROCESS SYNCHRONOUSLY - Frontend expects immediate results
    const testCaseResults = [];
    let allTestsPassed = true;
    let overallStatus = 'Accepted';

    for (const testCase of problem.testCases) {
      try {
        const result = await executeCode(
          code,
          language,
          testCase.input,
          testCase.output, // ✅ Using 'output' field from your schema
          problem.timeLimit,
          problem.memoryLimit
        );

        testCaseResults.push({
          input: testCase.input,
          expectedOutput: testCase.output, // ✅ Map to expected name for frontend
          actualOutput: result.output,
          passed: result.passed,
          executionTime: result.executionTime,
          memoryUsed: result.memoryUsed,
          status: result.status,
          error: result.error
        });

        if (!result.passed) {
          allTestsPassed = false;
          overallStatus = result.status;
        }

        // Update submission with first test case results  
        await prisma.submission.update({
          where: { id: submission.id },
          data: {
            status: result.status,
            results: testCaseResults, // Store all test results in JSON field
          },
        });

      } catch (error) {
        console.error(`Test case execution failed:`, error);
        testCaseResults.push({
          input: testCase.input,
          expectedOutput: testCase.output,
          actualOutput: '',
          passed: false,
          executionTime: 0,
          memoryUsed: 0,
          status: 'Runtime Error',
          error: error.message
        });
        allTestsPassed = false;
        overallStatus = 'Runtime Error';
      }
    }

    // Final update with overall results
    const totalScore = testCaseResults.reduce((sum, result) => 
      sum + (result.passed ? 25 : 0), 0); // Assuming 25 points per test case
    
    await prisma.submission.update({
      where: { id: submission.id },
      data: {
        status: overallStatus,
        score: totalScore,
        results: testCaseResults, // Store all results in JSON field
      },
    });

    // ✅ Return format that frontend expects
    res.json({
      submissionId: submission.id,
      status: overallStatus,
      passed: allTestsPassed,
      testCaseResults // ← Frontend needs this immediately
    });

  } catch (error) {
    console.error('Submission error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get submission status
router.get('/:id', async (req, res) => {
  try {
    const submission = await prisma.submission.findUnique({
      where: { id: req.params.id },
      include: {
        problem: {
          include: {
            testCases: true
          }
        }
      }
    });
    
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }
    
    res.json(submission);
  } catch (error) {
    console.error('Error fetching submission:', error);
    res.status(500).json({ error: 'Failed to fetch submission' });
  }
});

// Execute code using Judge0 
async function executeCode(code, language, input, expectedOutput, timeLimit, memoryLimit) {
  try {
    const languageId = LANGUAGE_IDS[language];
    
    // Detect if using local or RapidAPI Judge0
    const isLocal = JUDGE0_URL.includes('localhost') || JUDGE0_URL.includes('127.0.0.1');
    const headers = isLocal ? {
      'Content-Type': 'application/json'
    } : {
      'Content-Type': 'application/json',
      'X-RapidAPI-Key': RAPIDAPI_KEY,
      'X-RapidAPI-Host': 'judge0-ce.p.rapidapi.com'
    };
    
    console.log(`Executing code with ${isLocal ? 'Local' : 'RapidAPI'} Judge0...`);
    
    // Submit to Judge0 - USE CONSISTENT ENCODING
    const submissionResponse = await axios.post(`${JUDGE0_URL}/submissions?base64_encoded=false`, {
      source_code: code,           // ✅ Plain text
      language_id: languageId,
      stdin: input,                // ✅ Plain text  
      expected_output: expectedOutput.trim(), // ✅ Plain text
      cpu_time_limit: timeLimit / 1000,
      memory_limit: memoryLimit * 1024,
    }, {
      headers: headers
    });

    console.log(`📝 Input sent to Judge0 (plain text):`, JSON.stringify(input));
    console.log(`📝 Expected output (plain text):`, JSON.stringify(expectedOutput));
    console.log(`📝 Using base64_encoded=false for consistent encoding`);

    const { token } = submissionResponse.data;
    console.log(`Submission created with token: ${token}`);

    // Poll for result
    let result;
    let attempts = 0;
    const maxAttempts = 30;

    do {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const statusResponse = await axios.get(`${JUDGE0_URL}/submissions/${token}`, {
        headers: headers
      });
      
      result = statusResponse.data;
      attempts++;
      console.log(`Polling attempt ${attempts}, status: ${result.status.description}`);
    } while (result.status.id <= 2 && attempts < maxAttempts);

    if (attempts >= maxAttempts) {
      throw new Error('Execution timeout - maximum polling attempts reached');
    }

    const executionTime = result.time ? parseFloat(result.time) * 1000 : 0;
    const memoryUsed = result.memory || 0;
    const status = result.status.description;
    
    // Clean output and error strings - NO BASE64 DECODING NEEDED
    let output = '';
    let error = '';
    
    if (result.stdout) {
      // With base64_encoded=false, stdout should be plain text
      output = result.stdout.toString()
        .replace(/\0/g, '') 
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
        .trim();
    }
    
    if (result.stderr) {
      // With base64_encoded=false, stderr should be plain text  
      error = result.stderr.toString()
        .replace(/\0/g, '')
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    }

    // Check if output matches expected output
    const actualOutput = output.trim();
    const expectedOutputTrimmed = expectedOutput.trim();
    const outputMatches = actualOutput === expectedOutputTrimmed;
    
    // More lenient pass/fail logic
    const actuallyPassed = result.status.id === 3 || (result.status.id === 4 && outputMatches);

    // 🚨 DEBUG: Log detailed comparison
    console.log(`Execution result for token ${token}:`, {
      status: result.status,
      actualOutput: JSON.stringify(actualOutput),
      expectedOutput: JSON.stringify(expectedOutputTrimmed), 
      outputMatches: outputMatches,
      passed: actuallyPassed,
      rawStdout: result.stdout
    });

    return {
      status: result.status.description,
      passed: actuallyPassed,
      executionTime: executionTime,
      memoryUsed: memoryUsed,
      output: output,
      error: error || null
    };

  } catch (error) {
    console.error('Judge0 execution error:', error.response?.data || error.message);
    
    // Handle specific errors
    if (error.response?.status === 429) {
      return {
        passed: false,
        executionTime: 0,
        memoryUsed: 0,
        status: 'Rate Limited',
        output: '',
        error: 'Too many requests. Please try again later.',
      };
    }
    
    if (error.response?.status === 401) {
      return {
        passed: false,
        executionTime: 0,
        memoryUsed: 0,
        status: 'Authentication Error',
        output: '',
        error: 'Invalid API key configuration.',
      };
    }
    
    return {
      passed: false,
      executionTime: 0,
      memoryUsed: 0,
      status: 'Runtime Error',
      output: '',
      error: error.response?.data?.error || error.message,
    };
  }
}

export default router;