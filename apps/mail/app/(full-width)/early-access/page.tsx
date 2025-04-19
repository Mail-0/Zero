import { db } from "@zero/db";
import { earlyAccess } from "@zero/db/schema";
import { desc, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { EarlyAccessClient } from "./early-access";

async function getEarlyAccessUsers() {
  const users = await db.query.earlyAccess.findMany({
    orderBy: [desc(earlyAccess.createdAt)]
  });
  
  return users.map(user => ({
    ...user,
    isEarlyAccess: user.isEarlyAccess ?? false
  }));
}

async function updateEarlyAccessUsers(userIds: string[]) {
  'use server';
  try {
    if (!userIds || userIds.length === 0) {
      console.error('No user IDs provided');
      return { success: false, error: 'No user IDs provided' };
    }
    
    const usersToUpdate = await db.query.earlyAccess.findMany({
      where: (earlyAccess, { inArray }) => inArray(earlyAccess.id, userIds)
    });
    
    if (usersToUpdate.length === 0) {
      console.error('No users found with the provided IDs');
      return { success: false, error: 'No users found with the provided IDs' };
    }
    
    const emails = usersToUpdate.map(user => user.email);
    
    const now = new Date();
    for (const id of userIds) {
      await db.update(earlyAccess)
        .set({ 
          isEarlyAccess: true,
          updatedAt: now
        })
        .where(sql`${earlyAccess.id} = ${id}`);
    }
  
    revalidatePath('/early-access');
    
    return { 
      success: true, 
      emails: emails
    };
  } catch (error) {
    console.error('Error updating early access users:', error);
    if (error instanceof Error) {
      console.error('Error stack:', error.stack);
    }
    return { success: false, error: String(error) };
  }
}

export default async function EarlyAccess() {
  const earlyAccessUsers = await getEarlyAccessUsers();
  
  return (
    <div className=" py-10 w-full bg-black">
      <EarlyAccessClient 
        initialUsers={earlyAccessUsers} 
        updateEarlyAccessUsers={updateEarlyAccessUsers}
      />
    </div>
  );
}