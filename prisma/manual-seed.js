
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seed() {
  try {
    console.log('🌱 Starting manual seed...');

    // Create the Two Sum problem
    const problem = await prisma.problem.create({
      data: {
        title: 'Two Sum',
        description: `Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.

You may assume that each input would have exactly one solution, and you may not use the same element twice.

You can return the answer in any order.

**TEST CASE 1:**
Input: nums = [2,7,11,15], target = 9
Output: [0,1]
Explanation: Because nums[0] + nums[1] == 9, we return [0, 1].

**TEST CASE 2:**
Input: nums = [3,2,4], target = 6
Output: [1,2]

**TEST CASE 3:**
Input: nums = [3,3], target = 6
Output: [0,1]`,
        difficulty: 'Easy',
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

    console.log('✅ Created problem:', problem.title);
    console.log('✅ Problem ID:', problem.id);

    // Verify test cases were created
    const testCases = await prisma.testCase.findMany({
      where: { problemId: problem.id }
    });

    const visibleTests = testCases.filter(tc => !tc.isHidden);
    const hiddenTests = testCases.filter(tc => tc.isHidden);

    console.log('✅ Created', testCases.length, 'total test cases');
    console.log('👁️  Visible test cases:', visibleTests.length);
    console.log('🔒 Hidden test cases:', hiddenTests.length);
    console.log('🔍 First visible test case input:', JSON.stringify(visibleTests[0]?.input));

    console.log('🎉 Manual seed completed successfully!');

  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seed();