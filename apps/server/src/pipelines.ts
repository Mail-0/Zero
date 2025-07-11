/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { runMainWorkflow, runZeroWorkflow, runThreadWorkflow } from './pipelines.effect';
import { EPrompts } from './types';
import { Effect } from 'effect';

// Helper function for generating prompt names
export const getPromptName = (connectionId: string, prompt: EPrompts) => {
  return `${connectionId}-${prompt}`;
};

export type ZeroWorkflowParams = {
  connectionId: string;
  historyId: string;
  nextHistoryId: string;
};

export type ThreadWorkflowParams = {
  connectionId: string;
  threadId: string;
  providerId: string;
};

export type MainWorkflowParams = {
  providerId: string;
  historyId: string;
  subscriptionName: string;
};

export enum EWorkflowType {
  MAIN = 'main',
  THREAD = 'thread',
  ZERO = 'zero',
}

export type WorkflowParams =
  | { workflowType: 'main'; params: MainWorkflowParams }
  | { workflowType: 'thread'; params: ThreadWorkflowParams }
  | { workflowType: 'zero'; params: ZeroWorkflowParams };

export const runWorkflow = (
  workflowType: EWorkflowType,
  params: MainWorkflowParams | ThreadWorkflowParams | ZeroWorkflowParams,
): Effect.Effect<string, any> => {
  switch (workflowType) {
    case EWorkflowType.MAIN:
      return runMainWorkflow(params as MainWorkflowParams);
    case EWorkflowType.ZERO:
      return runZeroWorkflow(params as ZeroWorkflowParams);
    case EWorkflowType.THREAD:
      return runThreadWorkflow(params as ThreadWorkflowParams);
    default:
      return Effect.fail({ _tag: 'UnsupportedWorkflow', workflowType });
  }
};
