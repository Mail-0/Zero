/**
 * Test script to validate account reordering functionality
 * This script simulates the reordering functionality without running the full app
 */

const assert = require('assert/strict');

// Mock connection data
const mockConnections = [
  { id: '1', email: 'user1@example.com', name: 'User One', orderIndex: 0 },
  { id: '2', email: 'user2@example.com', name: 'User Two', orderIndex: 1 },
  { id: '3', email: 'user3@example.com', name: 'User Three', orderIndex: 2 },
];

// Mock the reorder function
function reorderConnections(connectionIds) {
  // Simulate updating orderIndex in database
  const reorderedConnections = connectionIds.map((id, index) => {
    const connection = mockConnections.find(c => c.id === id);
    if (!connection) {
      throw new Error(`Connection with id ${id} not found`);
    }
    return {
      ...connection,
      orderIndex: index
    };
  });
  
  return reorderedConnections;
}

// Test case 1: Reorder connections
console.log('=== Test Case 1: Reorder Connections ===');

const newOrder = ['2', '1', '3']; // Move User Two to first position
const result = reorderConnections(newOrder);

assert.deepStrictEqual(
  result.map((c) => ({ id: c.id, orderIndex: c.orderIndex })),
  [
    { id: '2', orderIndex: 0 },
    { id: '1', orderIndex: 1 },
    { id: '3', orderIndex: 2 },
  ],
  'Reorder did not produce expected orderIndex values',
);

console.log('✓ reorderConnections passes');

// Test case 2: Verify array move logic (simulating @dnd-kit/sortable arrayMove)
console.log('\n=== Test Case 2: Array Move Logic ===');
function arrayMove(array, from, to) {
  if (!Array.isArray(array)) {
    throw new Error('First argument must be an array');
  }
  if (from < 0 || from >= array.length || to < 0 || to >= array.length) {
    throw new Error('Invalid from or to index');
  }
  
  const newArray = [...array];
  const item = newArray.splice(from, 1)[0];
  newArray.splice(to, 0, item);
  return newArray;
}

const originalArray = ['A', 'B', 'C', 'D'];
const moved = arrayMove(originalArray, 1, 3); // Move 'B' to position 3

assert.deepStrictEqual(moved, ['A', 'C', 'D', 'B'], 'Array move did not produce expected result');

console.log('✓ arrayMove passes');

console.log('\n=== All tests completed successfully ✓ ===');
