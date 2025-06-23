// src/server.js - Updated server with cleaner structure
import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';

// Import routes
import problemRoutes from './routes/problems.js';
import submissionRoutes from './routes/submissions.js';

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
});

// API Routes
app.use('/api/problems', problemRoutes);
app.use('/api/submissions', submissionRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    message: 'Code Judge Server is running!',
    version: '1.0.0'
  });
});

// API info endpoint
app.get('/api', (req, res) => {
  res.json({
    message: 'Code Judge API',
    version: '1.0.0',
    endpoints: {
      problems: '/api/problems',
      submissions: '/api/submissions',
      health: '/health'
    },
    documentation: 'Check the routes for available endpoints'
  });
});

// Global error handling middleware
app.use((err, req, res, next) => {
  console.error('🚨 Server Error:', err);
  
  // Prisma-specific errors
  if (err.code && err.code.startsWith('P')) {
    return res.status(400).json({ 
      error: 'Database error',
      message: 'Invalid request or data constraint violation'
    });
  }
  
  // Default error response
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong!'
  });
});

// 404 handler for unknown routes
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Route not found',
    path: req.path,
    method: req.method,
    availableRoutes: [
      'GET /health',
      'GET /api',
      'GET /api/problems',
      'GET /api/problems/:id',
      'POST /api/submissions',
      'POST /api/submissions/sync',
      'GET /api/submissions/:id'
    ]
  });
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  await prisma.$disconnect();
  console.log('✅ Database disconnected');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 SIGTERM received, shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

// Start server
app.listen(PORT, () => {
  console.log('🚀 ================================');
  console.log(`🚀 Code Judge Server is running!`);
  console.log(`🚀 Port: ${PORT}`);
  console.log(`🚀 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log('🚀 ================================');
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`📝 Problems API: http://localhost:${PORT}/api/problems`);
  console.log(`💻 Submissions API: http://localhost:${PORT}/api/submissions`);
  console.log(`🧪 Test Judge0: http://localhost:${PORT}/api/submissions/test-judge0`);
  console.log('🚀 ================================');
});