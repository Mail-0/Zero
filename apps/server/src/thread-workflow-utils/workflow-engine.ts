import type { IGetThreadResponse } from '../lib/driver/types';
import { workflowFunctions } from './workflow-functions';
import { shouldGenerateDraft } from './index';
import { connection } from '../db/schema';

export type WorkflowContext = {
  connectionId: string;
  threadId: string;
  thread: IGetThreadResponse;
  foundConnection: typeof connection.$inferSelect;
  results?: Map<string, any>;
};

export type WorkflowStep = {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  condition?: (context: WorkflowContext) => boolean | Promise<boolean>;
  action: (context: WorkflowContext) => Promise<any>;
  errorHandling?: 'continue' | 'fail';
  maxRetries?: number;
};

export type WorkflowDefinition = {
  name: string;
  description: string;
  steps: WorkflowStep[];
};

export class WorkflowEngine {
  private workflows: Map<string, WorkflowDefinition> = new Map();

  registerWorkflow(workflow: WorkflowDefinition) {
    this.workflows.set(workflow.name, workflow);
  }

  getWorkflowNames(): string[] {
    return Array.from(this.workflows.keys());
  }

  async executeWorkflow(
    workflowName: string,
    context: WorkflowContext,
  ): Promise<{ results: Map<string, any>; errors: Map<string, Error> }> {
    const workflow = this.workflows.get(workflowName);
    if (!workflow) {
      throw new Error(`Workflow "${workflowName}" not found`);
    }

    const results = new Map<string, any>();
    const errors = new Map<string, Error>();

    for (const step of workflow.steps) {
      if (!step.enabled) {
        console.log(`[WORKFLOW_ENGINE] Skipping disabled step: ${step.name}`);
        continue;
      }

      try {
        const shouldExecute = step.condition ? await step.condition(context) : true;
        if (!shouldExecute) {
          console.log(`[WORKFLOW_ENGINE] Condition not met for step: ${step.name}`);
          continue;
        }

        console.log(`[WORKFLOW_ENGINE] Executing step: ${step.name}`);
        const result = await step.action({ ...context, results });
        results.set(step.id, result);
        console.log(`[WORKFLOW_ENGINE] Completed step: ${step.name}`);
      } catch (error) {
        const errorObj = error instanceof Error ? error : new Error(String(error));
        console.error(`[WORKFLOW_ENGINE] Error in step ${step.name}:`, errorObj);

        if (step.errorHandling === 'fail') {
          throw errorObj;
        } else {
          errors.set(step.id, errorObj);
        }
      }
    }

    return { results, errors };
  }

  clearContext(context: WorkflowContext): void {
    if (context.results) {
      context.results.clear();
    }
    console.log('[WORKFLOW_ENGINE] Context cleared');
  }
}

export const createDefaultWorkflows = (): WorkflowEngine => {
  const engine = new WorkflowEngine();

  const autoDraftWorkflow: WorkflowDefinition = {
    name: 'auto-draft-generation',
    description: 'Automatically generates drafts for threads that require responses',
    steps: [
      {
        id: 'check-workflow-execution',
        name: 'Check Workflow Execution',
        description: 'Checks if this workflow has already been executed for this thread',
        enabled: true,
        action: workflowFunctions.checkWorkflowExecution,
      },
      {
        id: 'check-draft-eligibility',
        name: 'Check Draft Eligibility',
        description: 'Determines if a draft should be generated for this thread',
        enabled: true,
        condition: async (context) => {
          const executionCheck = context.results?.get('check-workflow-execution');
          if (executionCheck?.alreadyExecuted) {
            return false;
          }
          return await shouldGenerateDraft(context.thread, context.foundConnection);
        },
        action: async (context) => {
          console.log('[WORKFLOW_ENGINE] Thread eligible for draft generation', {
            threadId: context.threadId,
            connectionId: context.connectionId,
          });
          return { eligible: true };
        },
      },
      {
        id: 'analyze-email-intent',
        name: 'Analyze Email Intent',
        description: 'Analyzes the intent of the latest email in the thread',
        enabled: true,
        action: workflowFunctions.analyzeEmailIntent,
      },
      {
        id: 'validate-response-needed',
        name: 'Validate Response Needed',
        description: 'Checks if the email requires a response based on intent analysis',
        enabled: true,
        action: workflowFunctions.validateResponseNeeded,
      },
      {
        id: 'generate-draft-content',
        name: 'Generate Draft Content',
        description: 'Generates the draft email content using AI',
        enabled: true,
        action: workflowFunctions.generateAutomaticDraft,
        errorHandling: 'continue',
      },
      {
        id: 'create-draft',
        name: 'Create Draft',
        description: 'Creates the draft in the email system',
        enabled: true,
        action: workflowFunctions.createDraft,
        errorHandling: 'continue',
      },
      {
        id: 'cleanup-workflow-execution',
        name: 'Cleanup Workflow Execution',
        description: 'Removes workflow execution tracking',
        enabled: true,
        action: workflowFunctions.cleanupWorkflowExecution,
        errorHandling: 'continue',
      },
    ],
  };

  const vectorizationWorkflow: WorkflowDefinition = {
    name: 'message-vectorization',
    description: 'Vectorizes thread messages for search and analysis',
    steps: [
      {
        id: 'check-workflow-execution',
        name: 'Check Workflow Execution',
        description: 'Checks if this workflow has already been executed for this thread',
        enabled: true,
        action: workflowFunctions.checkWorkflowExecution,
      },
      {
        id: 'find-messages-to-vectorize',
        name: 'Find Messages to Vectorize',
        description: 'Identifies messages that need vectorization',
        enabled: true,
        condition: async (context) => {
          const executionCheck = context.results?.get('check-workflow-execution');
          return !executionCheck?.alreadyExecuted;
        },
        action: workflowFunctions.findMessagesToVectorize,
      },
      {
        id: 'vectorize-messages',
        name: 'Vectorize Messages',
        description: 'Converts messages to vector embeddings',
        enabled: true,
        action: workflowFunctions.vectorizeMessages,
      },
      {
        id: 'upsert-embeddings',
        name: 'Upsert Embeddings',
        description: 'Saves vector embeddings to the database',
        enabled: true,
        action: workflowFunctions.upsertEmbeddings,
        errorHandling: 'continue',
      },
      {
        id: 'cleanup-workflow-execution',
        name: 'Cleanup Workflow Execution',
        description: 'Removes workflow execution tracking',
        enabled: true,
        action: workflowFunctions.cleanupWorkflowExecution,
        errorHandling: 'continue',
      },
    ],
  };

  const threadSummaryWorkflow: WorkflowDefinition = {
    name: 'thread-summary',
    description: 'Generates and stores thread summaries',
    steps: [
      {
        id: 'check-workflow-execution',
        name: 'Check Workflow Execution',
        description: 'Checks if this workflow has already been executed for this thread',
        enabled: true,
        action: workflowFunctions.checkWorkflowExecution,
      },
      {
        id: 'check-existing-summary',
        name: 'Check Existing Summary',
        description: 'Checks if a thread summary already exists',
        enabled: true,
        condition: async (context) => {
          const executionCheck = context.results?.get('check-workflow-execution');
          return !executionCheck?.alreadyExecuted;
        },
        action: workflowFunctions.checkExistingSummary,
      },
      {
        id: 'generate-thread-summary',
        name: 'Generate Thread Summary',
        description: 'Generates a summary of the thread',
        enabled: true,
        action: workflowFunctions.generateThreadSummary,
        errorHandling: 'continue',
      },
      {
        id: 'upsert-thread-summary',
        name: 'Upsert Thread Summary',
        description: 'Saves thread summary to the database',
        enabled: true,
        action: workflowFunctions.upsertThreadSummary,
        errorHandling: 'continue',
      },
      {
        id: 'cleanup-workflow-execution',
        name: 'Cleanup Workflow Execution',
        description: 'Removes workflow execution tracking',
        enabled: true,
        action: workflowFunctions.cleanupWorkflowExecution,
        errorHandling: 'continue',
      },
    ],
  };

  const labelGenerationWorkflow: WorkflowDefinition = {
    name: 'label-generation',
    description: 'Generates and applies labels to threads',
    steps: [
      {
        id: 'check-workflow-execution',
        name: 'Check Workflow Execution',
        description: 'Checks if this workflow has already been executed for this thread',
        enabled: true,
        action: workflowFunctions.checkWorkflowExecution,
      },
      {
        id: 'get-user-labels',
        name: 'Get User Labels',
        description: 'Retrieves user-defined labels',
        enabled: true,
        condition: async (context) => {
          const executionCheck = context.results?.get('check-workflow-execution');
          return !executionCheck?.alreadyExecuted;
        },
        action: workflowFunctions.getUserLabels,
      },
      {
        id: 'generate-labels',
        name: 'Generate Labels',
        description: 'Generates appropriate labels for the thread',
        enabled: true,
        action: workflowFunctions.generateLabels,
        errorHandling: 'continue',
      },
      {
        id: 'apply-labels',
        name: 'Apply Labels',
        description: 'Applies generated labels to the thread',
        enabled: true,
        action: workflowFunctions.applyLabels,
        errorHandling: 'continue',
      },
      {
        id: 'cleanup-workflow-execution',
        name: 'Cleanup Workflow Execution',
        description: 'Removes workflow execution tracking',
        enabled: true,
        action: workflowFunctions.cleanupWorkflowExecution,
        errorHandling: 'continue',
      },
    ],
  };

  engine.registerWorkflow(autoDraftWorkflow);
  engine.registerWorkflow(vectorizationWorkflow);
  engine.registerWorkflow(threadSummaryWorkflow);
  engine.registerWorkflow(labelGenerationWorkflow);

  return engine;
};
