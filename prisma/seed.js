// src/seeds/seed.ts
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config(); // ✅ Fixed: Remove '../' since .env is in root

const prisma = new PrismaClient();

async function seed() {
  try {
    console.log('🌱 Starting manual seed...');

    // Check if problems already exist
    const existingProblems = await prisma.problem.count();
    if (existingProblems > 0) {
      console.log(`⚠️  Found ${existingProblems} existing problems. Skipping seed to avoid duplicates.`);
      console.log('💡 To re-seed, delete existing problems first or use --force flag');
      return;
    }

    // Create the Two Sum problem
    const twoSumProblem = await prisma.problem.create({
      data: {
        title: 'Two Sum',
        description: `Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.

You may assume that each input would have exactly one solution, and you may not use the same element twice.

You can return the answer in any order.

**Example 1:**
Input: nums = [2,7,11,15], target = 9
Output: [0,1]
Explanation: Because nums[0] + nums[1] == 9, we return [0, 1].

**Example 2:**
Input: nums = [3,2,4], target = 6
Output: [1,2]

**Example 3:**
Input: nums = [3,3], target = 6
Output: [0,1]

**Constraints:**
• 2 ≤ nums.length ≤ 10⁴
• -10⁹ ≤ nums[i] ≤ 10⁹
• -10⁹ ≤ target ≤ 10⁹
• Only one valid answer exists.`,
        difficulty: 'EASY', // ✅ Fixed: Changed from 'Easy' to 'EASY' to match enum
        timeLimit: 2000,
        memoryLimit: 256,
        testCases: {
          create: [
            {
              input: '2,7,11,15\n9',
              output: '0,1',
              points: 25,
              isHidden: false, // ✅ Visible test case 1
            },
            {
              input: '3,2,4\n6',
              output: '1,2',
              points: 25,
              isHidden: false, // ✅ Visible test case 2
            },
            {
              input: '3,3\n6',
              output: '0,1',
              points: 25,
              isHidden: false, // ✅ Visible test case 3
            },
            {
              input: '-1,-2,-3,-4,-5\n-8',
              output: '2,4',
              points: 25,
              isHidden: true, // 🔒 Hidden test case 4
            },
          ],
        },
      },
    });

    console.log('✅ Created problem:', twoSumProblem.title);
    console.log('✅ Problem ID:', twoSumProblem.id);

    // Create the Valid Parentheses problem
    const validParenthesesProblem = await prisma.problem.create({
      data: {
        title: 'Valid Parentheses',
        description: `Given a string s containing just the characters '(', ')', '{', '}', '[' and ']', determine if the input string is valid.

An input string is valid if:
1. Open brackets must be closed by the same type of brackets.
2. Open brackets must be closed in the correct order.
3. Every close bracket has a corresponding open bracket of the same type.

**Example 1:**
Input: s = "()"
Output: true

**Example 2:**
Input: s = "()[]{}"
Output: true

**Example 3:**
Input: s = "(]"
Output: false

**Example 4:**
Input: s = "([)]"
Output: false

**Example 5:**
Input: s = "{[]}"
Output: true

**Constraints:**
• 1 ≤ s.length ≤ 10⁴
• s consists of parentheses only '()[]{}'.`,
        difficulty: 'EASY', // ✅ Fixed: Changed from 'Easy' to 'EASY'
        timeLimit: 1000,
        memoryLimit: 128,
        testCases: {
          create: [
            {
              input: '()',
              output: 'true',
              points: 20,
              isHidden: false, // ✅ Visible test case 1
            },
            {
              input: '()[]{}',
              output: 'true',
              points: 20,
              isHidden: false, // ✅ Visible test case 2
            },
            {
              input: '(]',
              output: 'false',
              points: 20,
              isHidden: false, // ✅ Visible test case 3
            },
            {
              input: '([)]',
              output: 'false',
              points: 20,
              isHidden: false, // ✅ Visible test case 4
            },
            {
              input: '{[]}',
              output: 'true',
              points: 20,
              isHidden: false, // ✅ Visible test case 5
            },
            {
              input: '',
              output: 'true',
              points: 10,
              isHidden: true, // 🔒 Hidden test case 1 - empty string
            },
            {
              input: '(((',
              output: 'false',
              points: 10,
              isHidden: true, // 🔒 Hidden test case 2 - only opening brackets
            },
            {
              input: ')))',
              output: 'false',
              points: 10,
              isHidden: true, // 🔒 Hidden test case 3 - only closing brackets
            },
            {
              input: '(){}[]',
              output: 'true',
              points: 10,
              isHidden: true, // 🔒 Hidden test case 4 - all types valid
            },
            {
              input: '([{}])',
              output: 'true',
              points: 10,
              isHidden: true, // 🔒 Hidden test case 5 - nested valid
            },
          ],
        },
      },
    });

    console.log('✅ Created problem:', validParenthesesProblem.title);
    console.log('✅ Problem ID:', validParenthesesProblem.id);

    // Create a Hello World problem for testing
    const helloWorldProblem = await prisma.problem.create({
      data: {
        title: 'Hello World',
        description: `Write a program that prints "Hello World" to the console.

This is a simple introductory problem to test your setup.

**Example:**
Output: Hello World

**Note:** Make sure there are no extra spaces or characters.`,
        difficulty: 'EASY',
        timeLimit: 1000,
        memoryLimit: 64,
        testCases: {
          create: [
            {
              input: '',
              output: 'Hello World',
              points: 100,
              isHidden: false,
            },
          ],
        },
      },
    });

    console.log('✅ Created problem:', helloWorldProblem.title);
    console.log('✅ Problem ID:', helloWorldProblem.id);

    // Verify test cases for all problems
    const allProblems = await prisma.problem.findMany({
      include: {
        testCases: true
      }
    });

    console.log('\n📊 SEED SUMMARY:');
    console.log('================');
    
    for (const problem of allProblems) {
      const visibleTests = problem.testCases.filter(tc => !tc.isHidden);
      const hiddenTests = problem.testCases.filter(tc => tc.isHidden);
      
      console.log(`\n📝 ${problem.title}:`);
      console.log(`   ├─ Difficulty: ${problem.difficulty}`);
      console.log(`   ├─ Time Limit: ${problem.timeLimit}ms`);
      console.log(`   ├─ Memory Limit: ${problem.memoryLimit}MB`);
      console.log(`   ├─ Total Test Cases: ${problem.testCases.length}`);
      console.log(`   ├─ 👁️  Visible: ${visibleTests.length}`);
      console.log(`   └─ 🔒 Hidden: ${hiddenTests.length}`);
    }

    console.log('\n🎉 Manual seed completed successfully!');
    console.log(`✅ Created ${allProblems.length} problems total`);

  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Handle command line arguments
const args = process.argv.slice(2);
const force = args.includes('--force');

if (force) {
  console.log('🔄 Force mode enabled - clearing existing data...');
  prisma.testCase.deleteMany({})
    .then(() => prisma.problem.deleteMany({}))
    .then(() => seed())
    .catch(console.error);
} else {
  seed();
}