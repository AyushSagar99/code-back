// src/controllers/problemController.ts
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { CreateProblemRequest, ProblemStats } from '../types/index.js';

const prisma = new PrismaClient();

/**
 * Get all problems (without test cases)
 * @route GET /api/problems
 */
export const getAllProblems = async (req: Request, res: Response) => {
  try {
    console.log('📋 Fetching all problems...');
    
    const problems = await prisma.problem.findMany({
      select: {
        id: true,
        title: true,
        description: true,
        difficulty: true,
        timeLimit: true,
        memoryLimit: true,
        createdAt: true,
      }
    });
    
    console.log(`✅ Found ${problems.length} problems`);
    res.json(problems);
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Error fetching problems:', error);
    res.status(500).json({ 
      error: 'Failed to fetch problems',
      message: errorMessage 
    });
  }
};

/**
 * Get single problem with visible test cases
 * @route GET /api/problems/:id
 */
export const getProblemById = async (req: Request<{ id: string }>, res: Response) => {
  try {
    const { id } = req.params;
    console.log(`🔍 Fetching problem: ${id}`);
    
    const problem = await prisma.problem.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        description: true,
        difficulty: true,
        timeLimit: true,
        memoryLimit: true,
        testCases: {
          where: {
            isHidden: false // Only include visible test cases
          },
          select: {
            id: true,
            input: true,
            output: true,
            points: true,
          }
        }
      }
    });
    
    if (!problem) {
      console.log(`❌ Problem not found: ${id}`);
      return res.status(404).json({ 
        error: 'Problem not found',
        problemId: id 
      });
    }
    
    console.log(`✅ Found problem: ${problem.title}`);
    res.json(problem);
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Error fetching problem:', error);
    res.status(500).json({ 
      error: 'Failed to fetch problem',
      message: errorMessage 
    });
  }
};

/**
 * Create a new problem (Admin only - future feature)
 * @route POST /api/problems
 */
export const createProblem = async (req: Request<{}, {}, CreateProblemRequest>, res: Response) => {
  try {
    const { title, description, difficulty, timeLimit, memoryLimit } = req.body;
    
    // Validation
    if (!title || !description || !difficulty) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['title', 'description', 'difficulty']
      });
    }
    
    console.log(`🆕 Creating new problem: ${title}`);
    
    const problem = await prisma.problem.create({
      data: {
        title,
        description,
        difficulty,
        timeLimit: timeLimit || 2000,
        memoryLimit: memoryLimit || 128,
      }
    });
    
    console.log(`✅ Created problem: ${problem.id}`);
    res.status(201).json(problem);
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Error creating problem:', error);
    res.status(500).json({ 
      error: 'Failed to create problem',
      message: errorMessage 
    });
  }
};

/**
 * Update a problem (Admin only - future feature)
 * @route PUT /api/problems/:id
 */
export const updateProblem = async (req: Request<{ id: string }, {}, Partial<CreateProblemRequest>>, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    console.log(`📝 Updating problem: ${id}`);
    
    const problem = await prisma.problem.update({
      where: { id },
      data: updateData
    });
    
    console.log(`✅ Updated problem: ${problem.title}`);
    res.json(problem);
    
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2025') {
      return res.status(404).json({ error: 'Problem not found' });
    }
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Error updating problem:', error);
    res.status(500).json({ 
      error: 'Failed to update problem',
      message: errorMessage 
    });
  }
};

/**
 * Delete a problem (Admin only - future feature)
 * @route DELETE /api/problems/:id
 */
export const deleteProblem = async (req: Request<{ id: string }>, res: Response) => {
  try {
    const { id } = req.params;
    
    console.log(`🗑️ Deleting problem: ${id}`);
    
    await prisma.problem.delete({
      where: { id }
    });
    
    console.log(`✅ Deleted problem: ${id}`);
    res.status(204).send();
    
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2025') {
      return res.status(404).json({ error: 'Problem not found' });
    }
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Error deleting problem:', error);
    res.status(500).json({ 
      error: 'Failed to delete problem',
      message: errorMessage 
    });
  }
};

/**
 * Get problem statistics
 * @route GET /api/problems/:id/stats
 */
export const getProblemStats = async (req: Request<{ id: string }>, res: Response) => {
  try {
    const { id } = req.params;
    
    console.log(`📊 Fetching stats for problem: ${id}`);
    
    // Get submission stats for this problem
    const stats = await prisma.submission.groupBy({
      by: ['status'],
      where: { problemId: id },
      _count: { status: true }
    });
    
    const totalSubmissions = await prisma.submission.count({
      where: { problemId: id }
    });
    
    const successfulSubmissions = await prisma.submission.count({
      where: { 
        problemId: id,
        status: 'COMPLETED',
        score: { gte: 100 }
      }
    });
    
    const avgScore = await prisma.submission.aggregate({
      where: { problemId: id },
      _avg: { score: true }
    });
    
    const result: ProblemStats = {
      problemId: id,
      totalSubmissions,
      successfulSubmissions,
      successRate: totalSubmissions > 0 ? (successfulSubmissions / totalSubmissions * 100).toFixed(2) : '0',
      averageScore: avgScore._avg.score?.toFixed(2) || '0',
      statusBreakdown: stats.reduce((acc, stat) => {
        acc[stat.status] = stat._count.status;
        return acc;
      }, {} as Record<string, number>)
    };
    
    console.log(`✅ Stats calculated for problem: ${id}`);
    res.json(result);
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Error fetching problem stats:', error);
    res.status(500).json({ 
      error: 'Failed to fetch problem statistics',
      message: errorMessage 
    });
  }
};