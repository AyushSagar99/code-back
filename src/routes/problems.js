// src/routes/problems.js - Clean routes using controllers
import express from 'express';
import {
  getAllProblems,
  getProblemById,
  createProblem,
  updateProblem,
  deleteProblem,
  getProblemStats
} from '../controllers/problemController.js';

const router = express.Router();

// Public routes
router.get('/', getAllProblems);
router.get('/:id', getProblemById);
router.get('/:id/stats', getProblemStats);

// Admin routes (you can add auth middleware later)
router.post('/', createProblem);
router.put('/:id', updateProblem);
router.delete('/:id', deleteProblem);

export default router;
