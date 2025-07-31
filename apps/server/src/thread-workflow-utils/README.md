# Thread Workflow Engine

This module provides a flexible workflow abstraction system for processing email threads. Workflows are defined in code using the WorkflowEngine class and executed through a modular function registry.

## Architecture

### Components

1. **WorkflowEngine** (`workflow-engine.ts`) - Core engine that executes workflows
2. **Workflow Functions** (`workflow-functions.ts`) - Registry of individual workflow functions
3. **Default Workflows** - Pre-configured workflows in `createDefaultWorkflows()`
4. **Workflow Context** - Shared context passed between workflow steps

### Key Benefits

- **Type-Safe Configuration**: Workflows are defined in TypeScript, providing better type safety and IDE support
- **Modular Functions**: Each workflow step is a separate function that can be tested independently
- **Error Handling**: Configurable error handling per step (continue, fail, retry)
- **Reusability**: Functions can be shared between different workflows
- **Clean Separation**: The main pipeline is now much cleaner and focused on orchestration

## Usage

### Defining a Workflow

Workflows are defined in the `createDefaultWorkflows()` function in `workflow-engine.ts`:

```typescript
const autoDraftWorkflow: WorkflowDefinition = {
  name: 'auto-draft-generation',
  description: 'Automatically generates drafts for threads that require responses',
  steps: [
    {
      id: 'check-draft-eligibility',
      name: 'Check Draft Eligibility',
      description: 'Determines if a draft should be generated for this thread',
      enabled: true,
      condition: async (context) => {
        return shouldGenerateDraft(context.thread, context.foundConnection);
      },
      action: async (context) => {
        console.log('[WORKFLOW_ENGINE] Thread eligible for draft generation', context);
        return { eligible: true };
      },
    },
    // ... more steps
  ],
};

engine.registerWorkflow(autoDraftWorkflow);
```

### Adding a New Workflow Function

1. Add the function to `workflow-functions.ts`:

```typescript
export const workflowFunctions: Record<string, WorkflowFunction> = {
  // ... existing functions ...

  myNewFunction: async (context) => {
    // Your logic here
    console.log('[WORKFLOW_FUNCTIONS] Executing my new function');

    // Access previous step results
    const previousResult = context.results?.get('previous-step-id');

    // Return result for next steps
    return { success: true, data: 'some data' };
  },
};
```

2. Add the step to your workflow definition in `createDefaultWorkflows()`:

```typescript
{
  id: 'my-new-step',
  name: 'My New Step',
  description: 'Description of what this step does',
  enabled: true,
  action: async (context) => {
    // Your logic here
    return { success: true };
  },
  errorHandling: 'continue',
}
```

### Workflow Context

Each workflow function receives a context object with:

```typescript
type WorkflowContext = {
  connectionId: string;
  threadId: string;
  thread: IGetThreadResponse;
  foundConnection: typeof connection.$inferSelect;
  results?: Map<string, any>; // Results from previous steps
};
```

### Error Handling

Each step can have different error handling strategies:

- `"continue"` - Skip failed steps and continue with the workflow
- `"fail"` - Stop the entire workflow on error
- `"retry"` - Retry the step up to `maxRetries` times

### Example: Adding a New Workflow

1. **Define the workflow in `createDefaultWorkflows()`**:

```typescript
const customWorkflow: WorkflowDefinition = {
  name: 'custom-processing',
  description: 'Custom thread processing workflow',
  steps: [
    {
      id: 'custom-step-1',
      name: 'Custom Step 1',
      description: 'First custom processing step',
      enabled: true,
      action: async (context) => {
        console.log('[WORKFLOW_ENGINE] Executing custom step 1');
        // Your custom logic here
        return { processed: true };
      },
      errorHandling: 'continue',
    },
  ],
};

engine.registerWorkflow(customWorkflow);
```

2. **The workflow will be automatically executed** - no need to update any other configuration!

### Dynamic Workflow Discovery

The workflow engine automatically discovers and executes all registered workflows:

```typescript
// Get all available workflow names from the engine
const workflowNames = workflowEngine.getWorkflowNames();

// Execute all workflows dynamically
for (const workflowName of workflowNames) {
  const { results, errors } = await workflowEngine.executeWorkflow(workflowName, context);
}
```

This means:

- **No hardcoded workflow lists**: Workflows are discovered automatically
- **Easy to add new workflows**: Just register them in `createDefaultWorkflows()`
- **Conditional workflows**: Can be enabled/disabled at runtime
- **Future-proof**: New workflows are automatically included

## Migration from Hardcoded Logic

The original hardcoded logic in `runThreadWorkflow` has been replaced with:

1. **Workflow Engine**: Orchestrates the execution of workflows
2. **Function Registry**: Contains all the individual processing functions
3. **JSON Configuration**: Defines which workflows and steps to execute
4. **Context Sharing**: Allows steps to share data and results

This makes the system much more maintainable and allows for easy addition of new processing steps without modifying the core pipeline logic.

## Benefits

- **Cleaner Code**: The main pipeline is now focused on orchestration rather than business logic
- **Easier Testing**: Each workflow function can be tested independently
- **Flexible Configuration**: Workflows can be enabled/disabled and modified via JSON
- **Better Error Handling**: Granular error handling per step
- **Reusability**: Functions can be shared between different workflows
- **Maintainability**: Adding new processing steps doesn't require modifying the main pipeline
