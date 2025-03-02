import { NextResponse } from "next/server";
import { earlyAccess } from "@zero/db/schema";
import { db } from "@zero/db";
import { count } from "drizzle-orm";

export async function GET() {
  try {
    const result = await db.select({ count: count() }).from(earlyAccess);
    const signupCount = result[0]?.count || 0;
    
    return NextResponse.json({ count: signupCount }, { status: 200 });
  } catch (error) {
    console.error("Error fetching early access count:", error);
    
    return NextResponse.json(
      { error: "Failed to fetch signup count" },
      { status: 500 }
    );
  }
} 