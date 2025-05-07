import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { theme } from '@zero/db/schema';

// GET /api/themes/public - List all public themes
export async function GET(req: NextRequest) {
  const publicThemes = await db.select().from(theme).where(theme.isPublic.eq(true));
  return NextResponse.json(publicThemes);
}
