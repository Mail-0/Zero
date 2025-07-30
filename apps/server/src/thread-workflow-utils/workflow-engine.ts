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
    existingResults?: Map<string, any>,
  ): Promise<{ results: Map<string, any>; errors: Map<string, Error> }> {
    const workflow = this.workflows.get(workflowName);
    if (!workflow) {
      throw new Error(`Workflow "${workflowName}" not found`);
    }

    const results = new Map<string, any>(existingResults || []);
    const errors = new Map<string, Error>();

    for (const step of workflow.steps) {
      if (!step.enabled) {
        console.log(`[WORKFLOW_ENGINE] Skipping disabled step: ${step.name}`);
        continue;
      }

      try {
        const shouldExecute = step.condition ? await step.condition({ ...context, results }) : true;
        if (!shouldExecute) {
          console.log(`[WORKFLOW_ENGINE] Condition not met for step: ${step.name}`);
          break;
        }

        console.log(`[WORKFLOW_ENGINE] Executing step: ${step.name}`);
        const result = await step.action({ ...context, results });
        results.set(step.id, result);
        console.log(`[WORKFLOW_ENGINE] Completed step: ${step.name}`, result);
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

  async executeWorkflowChain(
    workflowNames: string[],
    context: WorkflowContext,
  ): Promise<{ results: Map<string, any>; errors: Map<string, Error> }> {
    let sharedResults = new Map<string, any>();
    let allErrors = new Map<string, Error>();

    for (const workflowName of workflowNames) {
      console.log(`[WORKFLOW_ENGINE] Executing workflow in chain: ${workflowName}`);
      try {
        const { results, errors } = await this.executeWorkflow(
          workflowName,
          context,
          sharedResults,
        );

        // Merge results
        for (const [key, value] of results) {
          sharedResults.set(key, value);
        }

        // Merge errors
        for (const [key, error] of errors) {
          allErrors.set(key, error);
        }

        console.log(
          `[WORKFLOW_ENGINE] Completed workflow: ${workflowName}, total results: ${sharedResults.size}`,
        );
      } catch (error) {
        const errorObj = error instanceof Error ? error : new Error(String(error));
        console.error(`[WORKFLOW_ENGINE] Failed to execute workflow ${workflowName}:`, errorObj);
        allErrors.set(workflowName, errorObj);
      }
    }

    return { results: sharedResults, errors: allErrors };
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
        id: 'check-draft-eligibility',
        name: 'Check Draft Eligibility',
        description: 'Determines if a draft should be generated for this thread',
        enabled: true,
        errorHandling: 'fail',
        condition: async (context) => {
          const shouldGenerate = await shouldGenerateDraft(context.thread, context.foundConnection);
          console.log('[WORKFLOW_ENGINE] Draft eligibility check', {
            threadId: context.threadId,
            connectionId: context.connectionId,
            shouldGenerate,
          });
          return shouldGenerate;
        },
        action: async (context) => {
          return context;
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
        id: 'find-messages-to-vectorize',
        name: 'Find Messages to Vectorize',
        description: 'Identifies messages that need vectorization',
        enabled: true,
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
        id: 'check-existing-summary',
        name: 'Check Existing Summary',
        description: 'Checks if a thread summary already exists',
        enabled: true,
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
      //   {
      //     id: 'cleanup-workflow-execution',
      //     name: 'Cleanup Workflow Execution',
      //     description: 'Removes workflow execution tracking',
      //     enabled: true,
      //     action: workflowFunctions.cleanupWorkflowExecution,
      //     errorHandling: 'continue',
      //   },
    ],
  };

  const labelGenerationWorkflow: WorkflowDefinition = {
    name: 'label-generation',
    description: 'Generates and applies labels to threads',
    steps: [
      {
        id: 'get-user-labels',
        name: 'Get User Labels',
        description: 'Retrieves user-defined labels',
        enabled: true,
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
