'use server';
import { getAuthenticatedUserId } from '@/app/api/utils';
import { connection, summary } from '@zero/db/schema';
import { headers } from 'next/headers';
import { and, eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db } from '@zero/db';
import axios from 'axios';

export const GetSummary = async (threadId: string) => {
  try {
    await getAuthenticatedUserId();
    if (!process.env.BRAIN_URL) {
      return null;
    }

    const response = await axios.get(process.env.BRAIN_URL + `/brain/thread/summary/${threadId}`, {
      headers: {
        // 'Authorization': `Bearer ${}`
      },
    });

    return response.data ?? null;
  } catch (error) {
    console.error('Error getting summary:', error);
    return null;
  }
};
