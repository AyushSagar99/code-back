// src/routes/submissions.ts
import express from 'express';
import {
  submitCodeAsync,
  submitCodeSync,
  getSubmissionById,
  getSubmissionsByProblem,
  testJudge0
} from '../controllers/submissionController.js';

const router = express.Router();

// Submission routes
router.post('/', submitCodeAsync);           // Background processing
router.post('/sync', submitCodeSync);        // Wait for results
router.get('/:id', getSubmissionById);       // Get single submission
router.get('/problem/:problemId', getSubmissionsByProblem); // Get submissions by problem

// Test routes
router.get('/test-judge0', testJudge0);      // Test Judge0 connection

export default router;