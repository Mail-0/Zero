'use server';
import { getActiveDriver } from './utils';

export const getDrafts = async ({
  q,
  max,
  pageToken,
}: {
  q?: string;
  max?: number;
  pageToken: string | undefined;
}) => {
  try {
    const driver = await getActiveDriver();
    return await driver.listDrafts(q, max, pageToken);
  } catch (error) {
    console.error('Error getting threads:', error);
    throw error;
  }
};

export const createDraft = async (data: any) => {
  try {
    const driver = await getActiveDriver();
    return await driver.createDraft(data);
  } catch (error) {
    console.error('Error creating draft:', error);
    throw error;
  }
};

export const getDraft = async (id: string) => {
  try {
    const driver = await getActiveDriver();
    return await driver.getDraft(id);
  } catch (error) {
    console.error('Error getting draft:', error);
    throw error;
  }
};
