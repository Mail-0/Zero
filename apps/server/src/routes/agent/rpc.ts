/*
 * Licensed to Zero Email Inc. under one or more contributor license agreements.
 * You may not use this file except in compliance with the Apache License, Version 2.0 (the "License").
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * Reuse or distribution of this file requires a license from Zero Email Inc.
 */
import type { CreateDraftData } from '../../lib/schemas';
import { ZeroDriver, type FolderSyncResult } from '.';
import type { IOutgoingMessage } from '../../types';
import { RpcTarget } from 'cloudflare:workers';

const shouldReSyncThreadsAfterActions = false;

export class DriverRpcDO extends RpcTarget {
  constructor(
    private mainDo: ZeroDriver,
    private connectionId: string,
  ) {
    super();
  }

  async getUserLabels() {
    return await this.mainDo.getUserLabels();
  }

  async getLabel(id: string) {
    return await this.mainDo.getLabel(id);
  }

  async createLabel(label: {
    name: string;
    color?: { backgroundColor: string; textColor: string };
  }) {
    return await this.mainDo.createLabel(label);
  }

  async getUserTopics() {
    return await this.mainDo.getUserTopics();
  }

  async updateLabel(
    id: string,
    label: { name: string; color?: { backgroundColor: string; textColor: string } },
  ) {
    return await this.mainDo.updateLabel(id, label);
  }

  async deleteLabel(id: string) {
    return await this.mainDo.deleteLabel(id);
  }

  async bulkDelete(threadIds: string[]) {
    return await this.mainDo.bulkDelete(threadIds);
  }

  async bulkArchive(threadIds: string[]) {
    return await this.mainDo.bulkArchive(threadIds);
  }

  async rawListThreads(params: {
    folder: string;
    query?: string;
    maxResults?: number;
    labelIds?: string[];
    pageToken?: string;
  }) {
    return await this.mainDo.rawListThreads(params);
  }

  async listThreads(params: {
    folder: string;
    query?: string;
    maxResults?: number;
    labelIds?: string[];
    pageToken?: string;
  }) {
    return await this.mainDo.list(params);
  }

  async getThread(threadId: string, includeDrafts: boolean = false) {
    return await this.mainDo.getThread(threadId, includeDrafts);
  }

  async markThreadsRead(threadIds: string[]) {
    const result = await Promise.all(
      threadIds.map((id) => this.mainDo.modifyThreadLabelsInDB(id, [], ['UNREAD'])),
    );
    if (shouldReSyncThreadsAfterActions)
      await Promise.all(threadIds.map((id) => this.mainDo.syncThread({ threadId: id })));
    return result;
  }

  async syncThread({ threadId }: { threadId: string }) {
    return await this.mainDo.syncThread({ threadId });
  }

  async markThreadsUnread(threadIds: string[]) {
    const result = await Promise.all(
      threadIds.map((id) => this.mainDo.modifyThreadLabelsInDB(id, ['UNREAD'], [])),
    );
    if (shouldReSyncThreadsAfterActions)
      await Promise.all(threadIds.map((id) => this.mainDo.syncThread({ threadId: id })));
    return result;
  }

  async modifyLabels(threadIds: string[], addLabelIds: string[], removeLabelIds: string[]) {
    const result = await Promise.all(
      threadIds.map((id) => this.mainDo.modifyThreadLabelsInDB(id, addLabelIds, removeLabelIds)),
    );
    if (shouldReSyncThreadsAfterActions)
      await Promise.all(threadIds.map((id) => this.mainDo.syncThread({ threadId: id })));
    return result;
  }

  async createDraft(draftData: CreateDraftData) {
    return await this.mainDo.createDraft(draftData);
  }

  async getDraft(id: string) {
    return await this.mainDo.getDraft(id);
  }

  async listDrafts(params: { q?: string; maxResults?: number; pageToken?: string }) {
    return await this.mainDo.listDrafts(params);
  }

  async count() {
    return await this.mainDo.count();
  }

  //   async list(params: {
  //     folder: string;
  //     query?: string;
  //     maxResults?: number;
  //     labelIds?: string[];
  //     pageToken?: string;
  //   }) {
  //     return await this.mainDo.list(params);
  //   }

  async markAsRead(threadIds: string[]) {
    const result = await Promise.all(
      threadIds.map((id) => this.mainDo.modifyThreadLabelsInDB(id, [], ['UNREAD'])),
    );
    if (shouldReSyncThreadsAfterActions)
      await Promise.all(threadIds.map((id) => this.mainDo.syncThread({ threadId: id })));
    return result;
  }

  async markAsUnread(threadIds: string[]) {
    const result = await Promise.all(
      threadIds.map((id) => this.mainDo.modifyThreadLabelsInDB(id, ['UNREAD'], [])),
    );
    if (shouldReSyncThreadsAfterActions)
      await Promise.all(threadIds.map((id) => this.mainDo.syncThread({ threadId: id })));
    return result;
  }

  async normalizeIds(ids: string[]) {
    return await this.mainDo.normalizeIds(ids);
  }

  //   async get(id: string) {
  //     return await this.mainDo.get(id);
  //   }

  async sendDraft(id: string, data: IOutgoingMessage) {
    return await this.mainDo.sendDraft(id, data);
  }

  async create(data: IOutgoingMessage) {
    return await this.mainDo.create(data);
  }

  async modifyThreadLabelsByName(
    threadId: string,
    addLabelNames: string[],
    removeLabelNames: string[],
  ) {
    return await this.mainDo.modifyThreadLabelsByName(threadId, addLabelNames, removeLabelNames);
  }

  async modifyThreadLabelsInDB(
    threadId: string,
    addLabelNames: string[],
    removeLabelNames: string[],
  ) {
    return await this.mainDo.modifyThreadLabelsInDB(threadId, addLabelNames, removeLabelNames);
  }

  async delete(id: string) {
    const result = await this.mainDo.delete(id);
    await this.mainDo.deleteThread(id);
    return result;
  }

  async deleteAllSpam() {
    return await this.mainDo.deleteAllSpam();
  }

  async getEmailAliases() {
    return await this.mainDo.getEmailAliases();
  }

  async getMessageAttachments(messageId: string) {
    return await this.mainDo.getMessageAttachments(messageId);
  }

  async setupAuth() {
    return await this.mainDo.setupAuth();
  }

  async broadcast(message: string) {
    return this.mainDo.broadcast(message);
  }

  async reloadFolder(folder: string) {
    this.mainDo.reloadFolder(folder);
  }

  //   async getThreadsFromDB(params: {
  //     labelIds?: string[];
  //     folder?: string;
  //     q?: string;
  //     max?: number;
  //     cursor?: string;
  //   }) {
  //     return await this.mainDo.getThreadsFromDB(params);
  //   }

  //   async getThreadFromDB(id: string) {
  //     return await this.mainDo.getThreadFromDB(id);
  //   }

  async listHistory<T>(historyId: string) {
    return await this.mainDo.listHistory<T>(historyId);
  }

  async syncThreads(folder: string): Promise<FolderSyncResult> {
    return await this.mainDo.syncThreads(folder);
  }

  async inboxRag(query: string) {
    return await this.mainDo.inboxRag(query);
  }

  async searchThreads(params: {
    query: string;
    folder?: string;
    maxResults?: number;
    labelIds?: string[];
    pageToken?: string;
  }) {
    return await this.mainDo.searchThreads(params);
  }

  async queue(callbackName: keyof ZeroDriver, payload: unknown): Promise<unknown> {
    const queueFn = this.mainDo.queue;
    if (typeof queueFn !== 'function') {
      throw new Error('queue method not implemented on mainDo');
    }
    return queueFn(callbackName, payload);
  }
}
