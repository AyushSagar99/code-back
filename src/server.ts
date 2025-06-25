// server.ts - Fixed to load environment variables FIRST
import dotenv from 'dotenv';
// NOW import everything else (after environment variables are loaded)
import express, { Request, Response, NextFunction, Express, json } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { PrismaClient } from '@prisma/client';

// Import routes (these will now see the environment variables)
import problemRoutes from './routes/problem.routes.js';
import submissionRoutes from './routes/submission.routes.js';
import authRouter from './routes/auth.routes.js';


dotenv.config({
  path: "./.env",
});



const app: Express = express();
export const prisma = new PrismaClient();
const PORT = process.env.PORT || 3001;

// Main server function
async function main() {
  try {
    app.use(cors({
      origin: "http://localhost:5173", // React dev server
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    }));
    app.use(json());
    app.use(cookieParser());


    // API Routes
    app.use('/api/v1/auth', authRouter);           
    app.use('/api/problems', problemRoutes);
    app.use('/api/submissions', submissionRoutes); 

    



    

    // Start server
    app.listen(PORT, () => {
      console.log(`🚀 Code Judge Server is running!`);
     
      console.log('🚀 ================================');
      console.log(`📊 Health check: http://localhost:${PORT}/health`);
      console.log('🚀 ================================');
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}




main().catch(async (error) => {
  console.error('❌ Application failed to start:', error);
  await prisma.$disconnect();
  process.exit(1);
});