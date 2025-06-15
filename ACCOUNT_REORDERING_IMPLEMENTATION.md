# Account Reordering Implementation

## Overview
Implemented a comprehensive account reordering feature for Zero that allows users to drag and drop their connected email accounts to customize the display order.

## Changes Made

### 1. Database Schema Update
**File**: `apps/server/src/db/schema.ts`
- Added `order: integer('order').notNull().default(0)` field to the `connection` table
- This field stores the display order for each user's connections

### 2. Backend API Enhancement
**File**: `apps/server/src/trpc/routes/connections.ts`
- Updated `list` query to:
  - Include the `order` field in the response
  - Order results by the `order` field using `.orderBy(connection.order)`
- Added new `reorder` mutation that:
  - Accepts an array of connection IDs in the desired order
  - Validates that all connection IDs belong to the authenticated user
  - Updates the `order` field for each connection atomically
  - Uses proper error handling for invalid connection IDs

### 3. Frontend Drag-and-Drop Component
**File**: `apps/mail/components/ui/reorderable-connections.tsx`
- Created a new reusable component using `@dnd-kit` for drag-and-drop functionality
- Implements `SortableContext` with vertical list strategy
- Individual connection items use `useSortable` hook
- Handles drag end events to trigger the reorder API call
- Maintains loading states during reordering operations
- Provides visual feedback during drag operations

### 4. Integration with Navigation
**File**: `apps/mail/components/ui/nav-user.tsx`
- Updated connections list to use the new `ReorderableConnections` component
- Maintains existing functionality while adding reordering capability
- Preserves all existing click handlers and UI states

### 5. Hook Enhancement
**File**: `apps/mail/hooks/use-connections.ts`
- Added `useReorderConnections` hook that:
  - Uses the new `reorder` TRPC mutation
  - Provides proper error handling and success feedback
  - Integrates with React Query for cache invalidation

## Technical Implementation Details

### Drag-and-Drop Logic
- Uses `@dnd-kit` library for robust drag-and-drop functionality
- Implements `arrayMove` utility for reordering arrays
- Handles both keyboard and mouse interactions
- Provides accessibility support out of the box

### Data Persistence
- Backend validates ownership of all connections before reordering
- Atomic updates ensure data consistency
- Order values are sequential integers starting from 0
- Proper error handling for edge cases

### User Experience
- Visual feedback during drag operations
- Loading states during API calls
- Toast notifications for success/error states
- Maintains all existing functionality

## Testing
Created comprehensive test cases that validate:
- Connection reordering logic
- Array manipulation utilities
- Expected vs actual order outcomes
- Edge cases and error conditions

## Files Modified
1. `apps/server/src/db/schema.ts` - Database schema
2. `apps/server/src/trpc/routes/connections.ts` - Backend API
3. `apps/mail/components/ui/reorderable-connections.tsx` - New drag-drop component
4. `apps/mail/components/ui/nav-user.tsx` - Navigation integration
5. `apps/mail/hooks/use-connections.ts` - Frontend hooks

## Next Steps
1. Run database migrations to add the `order` field
2. Test the feature end-to-end in development environment
3. Ensure proper error handling and edge cases
4. Consider adding keyboard shortcuts for reordering
5. Add user documentation for the new feature

## Benefits
- Improved user experience with customizable account order
- Consistent with modern UI patterns
- Maintains all existing functionality
- Scalable implementation that works with any number of connections
- Proper accessibility support
