export const runtime = 'nodejs';
import { getAuthenticatedUserId } from '../../../../../lib/utils';
import { NextRequest, NextResponse } from 'next/server';
import { 
  connection as connectionTable, 
  theme as themeTable 
} from '../../../../../db/schema';
import { eq, and, or } from 'drizzle-orm';
import { createDb } from '../../../../../db/index';

const connectionString = process.env.DATABASE_URL || '';
const db = createDb(connectionString);

interface SetConnectionThemeRequest {
  themeId?: string | null;
}

// PATCH /api/v1/connections/[id]/theme - Set theme for connection
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: connectionId } = params;
  const body = await req.json() as SetConnectionThemeRequest;
  const { themeId } = body;

  if (themeId) {
    const [theme] = await db
      .select()
      .from(themeTable)
      .where(and(
        eq(themeTable.id, themeId),
        or(
          eq(themeTable.userId, userId),
          eq(themeTable.isPublic, true)
        )
      ));

    if (!theme) {
      return NextResponse.json({ error: 'Theme not found or not accessible' }, { status: 404 });
    }
  }

  const [updatedConnection] = await db
    .update(connectionTable)
    .set({ themeId })
    .where(and(
      eq(connectionTable.id, connectionId),
      eq(connectionTable.userId, userId)
    ))
    .returning();

  if (!updatedConnection) {
    return NextResponse.json({ error: 'Connection not found or not owned by user' }, { status: 404 });
  }

  return NextResponse.json(updatedConnection);
}