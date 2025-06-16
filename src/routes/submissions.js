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
  max: 20, // Limit each IP to 10 submissions per windowMs
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
            testCase.output,
            problem.timeLimit,
            problem.memoryLimit
          );
      
          testCaseResults.push({
            input: testCase.input,
            expectedOutput: testCase.output,
            actualOutput: result.output,
            passed: result.passed,
            executionTime: result.executionTime,
            memoryUsed: result.memoryUsed,
            status: result.status,
            error: result.error,
            isHidden: testCase.isHidden // ✅ Include hidden flag in results
          });
      
          if (!result.passed) {
            allTestsPassed = false;
            overallStatus = result.status;
          }
      
          // Update submission with current test case results  
          await prisma.submission.update({
            where: { id: submission.id },
            data: {
              status: result.status,
              results: testCaseResults,
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
            error: error.message,
            isHidden: testCase.isHidden // ✅ Include hidden flag even for errors
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
// Update your executeCode function in submissions.js

async function executeCode(code, language, input, expectedOutput, timeLimit, memoryLimit) {
    const languageMap = {
      'javascript': { id: 63, name: 'JavaScript (Node.js 12.14.0)' },
      'python': { id: 71, name: 'Python (3.8.1)' },
      'java': { id: 62, name: 'Java (OpenJDK 13.0.1)' },
      'cpp': { id: 54, name: 'C++ (GCC 9.2.0)' },
      'c': { id: 50, name: 'C (GCC 9.2.0)' }
    };
  
    const languageConfig = languageMap[language];
    if (!languageConfig) {
      throw new Error(`Unsupported language: ${language}`);
    }
  
    // ✅ FIX: Ensure proper input format for Judge0
    const formattedInput = input.trim(); // Remove any extra whitespace
    
    console.log('📝 Input sent to Judge0 (plain text):', JSON.stringify(formattedInput));
    console.log('📝 Expected output (plain text):', JSON.stringify(expectedOutput));
    console.log('📝 Using base64_encoded=false for consistent encoding');
  
    const submissionData = {
      source_code: code,
      language_id: languageConfig.id,
      stdin: formattedInput,  // ✅ Raw input, not base64
      expected_output: expectedOutput.trim(), // ✅ Raw expected output
      cpu_time_limit: (timeLimit / 1000).toFixed(1), // Convert ms to seconds
      memory_limit: memoryLimit * 1024, // Convert MB to KB
      base64_encoded: false, // ✅ Use plain text, not base64
    };
  
    try {
      // Create submission
      const submissionResponse = await fetch(`${JUDGE0_URL}/submissions?base64_encoded=false&wait=false`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-RapidAPI-Key': RAPIDAPI_KEY,
          'X-RapidAPI-Host': 'judge0-ce.p.rapidapi.com'
        },
        body: JSON.stringify(submissionData)
      });
  
      if (!submissionResponse.ok) {
        const errorText = await submissionResponse.text();
        throw new Error(`Judge0 submission failed: ${submissionResponse.status} ${errorText}`);
      }
  
      const { token } = await submissionResponse.json();
      console.log(`Submission created with token: ${token}`);
  
      // Poll for results
      let attempts = 0;
      const maxAttempts = 10;
      
      while (attempts < maxAttempts) {
        attempts++;
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
        
        const resultResponse = await fetch(`${JUDGE0_URL}/submissions/${token}?base64_encoded=false`, {
          headers: {
            'X-RapidAPI-Key': RAPIDAPI_KEY,
            'X-RapidAPI-Host': 'judge0-ce.p.rapidapi.com'
          }
        });
  
        if (!resultResponse.ok) {
          throw new Error(`Failed to get submission result: ${resultResponse.status}`);
        }
  
        const result = await resultResponse.json();
        console.log(`Polling attempt ${attempts}, status: ${result.status?.description || 'Unknown'}`);
  
        // Check if execution is complete
        if (result.status && result.status.id >= 3) { // 3+ means completed (success or error)
          console.log('Execution result for token', token + ':', {
            status: result.status,
            actualOutput: JSON.stringify(result.stdout || ''),
            expectedOutput: JSON.stringify(expectedOutput),
            outputMatches: (result.stdout || '').trim() === expectedOutput.trim(),
            passed: (result.stdout || '').trim() === expectedOutput.trim() && result.status.id === 3,
            rawStdout: result.stdout
          });
  
          // ✅ FIX: Proper output comparison
          const actualOutput = (result.stdout || '').trim();
          const expectedOutputTrimmed = expectedOutput.trim();
          const passed = actualOutput === expectedOutputTrimmed && result.status.id === 3;
  
          return {
            passed,
            output: actualOutput,
            expectedOutput: expectedOutputTrimmed,
            executionTime: parseFloat(result.time || '0') * 1000, // Convert to ms
            memoryUsed: Math.round((result.memory || 0) / 1024), // Convert to MB
            status: result.status?.description || 'Unknown',
            error: result.stderr || (result.compile_output ? `Compilation Error: ${result.compile_output}` : null)
          };
        }
      }
  
      throw new Error('Execution timeout - submission took too long');
  
    } catch (error) {
      console.error('Judge0 execution error:', error);
      return {
        passed: false,
        output: '',
        expectedOutput,
        executionTime: 0,
        memoryUsed: 0,
        status: 'Error',
        error: error.message
      };
    }
  }

export default router;