'use server';
import { throwUnauthorizedGracefully } from '@/app/api/utils';
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
    return throwUnauthorizedGracefully();
  }
};

export const createDraft = async (data: any) => {
  try {
    const driver = await getActiveDriver();

    const res = await driver.createDraft(data);

    return { success: true, id: res.id };
  } catch (error) {
    console.error('Error creating draft:', error);
    return { success: false, error: String(error) };
  }
};

export const getDraft = async (id: string) => {
  if (!id) {
    throw new Error('Missing draft ID');
  }

  console.log('getting email:', id);

  try {
    const driver = await getActiveDriver();
    return await driver.getDraft(id);
  } catch (error) {
    console.error('Error getting draft:', error);
    throw error;
  }
};
