import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Create first problem
  const problem1 = await prisma.problem.create({
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
Output: [0,1]`,
      difficulty: 'Easy',
      timeLimit: 2000,
      memoryLimit: 256,
      testCases: {
        create: [
          {
            // ✅ FIXED: Remove brackets, use plain CSV format
            input: '2,7,11,15\n9',
            output: '0,1',
            points: 25,
          },
          {
            input: '3,2,4\n6',
            output: '1,2',
            points: 25,
          },
          {
            input: '3,3\n6',
            output: '0,1',
            points: 25,
          },
          {
            input: '-1,-2,-3,-4,-5\n-8',
            output: '2,4',
            points: 25,
          },
        ],
      },
    },
  });

  // Create second problem
  const problem2 = await prisma.problem.create({
    data: {
      title: 'Reverse String',
      description: `Write a function that reverses a string. The input string is given as an array of characters s.

You must do this by modifying the input array in-place with O(1) extra memory.

**Example 1:**
Input: s = ["h","e","l","l","o"]
Output: ["o","l","l","e","h"]

**Example 2:**
Input: s = ["H","a","n","n","a","h"]
Output: ["h","a","n","n","a","H"]`,
      difficulty: 'Easy',
      timeLimit: 1000,
      memoryLimit: 128,
      testCases: {
        create: [
          {
            input: 'h,e,l,l,o',
            output: 'o,l,l,e,h',
            points: 50,
          },
          {
            input: 'H,a,n,n,a,h',
            output: 'h,a,n,n,a,H',
            points: 50,
          },
        ],
      },
    },
  });

  // Create third problem
  const problem3 = await prisma.problem.create({
    data: {
      title: 'Palindrome Number',
      description: `Given an integer x, return true if x is a palindrome, and false otherwise.

**Example 1:**
Input: x = 121
Output: true
Explanation: 121 reads as 121 from left to right and from right to left.

**Example 2:**
Input: x = -121
Output: false
Explanation: From left to right, it reads -121. From right to left, it becomes 121-. Therefore it is not a palindrome.

**Example 3:**
Input: x = 10
Output: false
Explanation: Reads 01 from right to left. Therefore it is not a palindrome.`,
      difficulty: 'Easy',
      timeLimit: 1500,
      memoryLimit: 128,
      testCases: {
        create: [
          {
            input: '121',
            output: 'true',
            points: 25,
          },
          {
            input: '-121',
            output: 'false',
            points: 25,
          },
          {
            input: '10',
            output: 'false',
            points: 25,
          },
          {
            input: '12321',
            output: 'true',
            points: 25,
          },
        ],
      },
    },
  });

  console.log('✅ Created problems:');
  console.log(`  - ${problem1.title} (${problem1.id})`);
  console.log(`  - ${problem2.title} (${problem2.id})`);
  console.log(`  - ${problem3.title} (${problem3.id})`);
  console.log('🌱 Database seeded successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:');
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });