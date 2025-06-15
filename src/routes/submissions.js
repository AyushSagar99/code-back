import express from 'express';
import rateLimit from 'express-rate-limit';
import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const router = express.Router();
const prisma = new PrismaClient();

const JUDGE0_URL = process.env.JUDGE0_URL || 'http://localhost:2358';

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

// Submit code for evaluation
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
    
    // Create submission record
    const submission = await prisma.submission.create({
      data: {
        problemId,
        code,
        language,
        status: 'PENDING',
      }
    });
    
    // Process submission asynchronously
    processSubmission(submission.id);
    
    res.json({ submissionId: submission.id, status: 'PENDING' });
  } catch (error) {
    console.error('Error creating submission:', error);
    res.status(500).json({ error: 'Failed to create submission' });
  }
});

// Get submission status
router.get('/:id', async (req, res) => {
  try {
    const submission = await prisma.submission.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        status: true,
        score: true,
        results: true,
        createdAt: true,
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

// Process submission against test cases
async function processSubmission(submissionId) {
  try {
    await prisma.submission.update({
      where: { id: submissionId },
      data: { status: 'RUNNING' }
    });
    
    const submission = await prisma.submission.findUnique({
      where: { id: submissionId },
      include: {
        problem: {
          include: {
            testCases: true
          }
        }
      }
    });
    
    const results = [];
    let totalScore = 0;
    
    // Run code against each test case
    for (const testCase of submission.problem.testCases) {
      const result = await executeCode(
        submission.code,
        submission.language,
        testCase.input,
        testCase.output,
        submission.problem.timeLimit,
        submission.problem.memoryLimit
      );
      
      if (result.passed) {
        totalScore += testCase.points;
      }
      
      results.push({
        testCaseId: testCase.id,
        passed: result.passed,
        executionTime: result.executionTime,
        memoryUsed: result.memoryUsed,
        status: result.status,
      });
    }
    
    await prisma.submission.update({
      where: { id: submissionId },
      data: {
        status: 'COMPLETED',
        score: totalScore,
        results: results,
      }
    });
    
  } catch (error) {
    console.error('Error processing submission:', error);
    await prisma.submission.update({
      where: { id: submissionId },
      data: { status: 'ERROR' }
    });
  }
}

// Execute code using Judge0
async function executeCode(code, language, input, expectedOutput, timeLimit, memoryLimit) {
  try {
    const languageId = LANGUAGE_IDS[language];
    
    // Submit to Judge0
    const submissionResponse = await axios.post(`${JUDGE0_URL}/submissions`, {
      source_code: btoa(code),
      language_id: languageId,
      stdin: btoa(input),
      expected_output: btoa(expectedOutput),
      cpu_time_limit: timeLimit / 1000,
      memory_limit: memoryLimit * 1024,
    });
    
    const token = submissionResponse.data.token;
    
    // Poll for result
    let result;
    do {
      await new Promise(resolve => setTimeout(resolve, 1000));
      const resultResponse = await axios.get(`${JUDGE0_URL}/submissions/${token}`);
      result = resultResponse.data;
    } while (result.status.id <= 2);
    
    return {
      passed: result.status.id === 3, // Accepted
      executionTime: result.time ? parseFloat(result.time) * 1000 : 0,
      memoryUsed: result.memory || 0,
      status: result.status.description,
      output: result.stdout ? atob(result.stdout) : '',
      error: result.stderr ? atob(result.stderr) : '',
    };
    
  } catch (error) {
    console.error('Judge0 execution error:', error);
    return {
      passed: false,
      executionTime: 0,
      memoryUsed: 0,
      status: 'Runtime Error',
      output: '',
      error: error.message,
    };
  }
}

export default router;