import { NextRequest, NextResponse } from "next/server";
import { earlyAccess } from "@zero/db/schema";
import { env } from "@/lib/env";
import { db } from "@zero/db";

type PostgresError = {
  code: string;
  message: string;
};

// Rate limiting map: IP -> timestamps of requests
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT = 3; // requests per hour
const HOUR_IN_MS = 60 * 60 * 1000;

export async function POST(req: NextRequest) {
  try {
    // Get IP address from request
    const ip = req.headers.get("x-forwarded-for") || "unknown";
    console.log("Request from IP:", ip);

    // Check rate limit
    const now = Date.now();
    const ipRequests = rateLimitMap.get(ip) || [];

    // Clean up old requests (older than 1 hour)
    const recentRequests = ipRequests.filter((timestamp) => now - timestamp < HOUR_IN_MS);

    if (recentRequests.length >= RATE_LIMIT) {
      console.log(`Rate limit exceeded for IP ${ip}. Recent requests: ${recentRequests.length}`);
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 },
      );
    }

    recentRequests.push(now);
    rateLimitMap.set(ip, recentRequests);

    const body = await req.json();
    console.log("Request body:", body);

    const { email } = body;

    if (!email) {
      console.log("Email missing from request");
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const nowDate = new Date();

    try {
      // Log the attempted insert
      console.log("Attempting to insert email:", email);

      const result = await db.insert(earlyAccess).values({
        id: crypto.randomUUID(),
        email,
        createdAt: nowDate,
        updatedAt: nowDate,
      });

      console.log("Insert successful:", result);
    } catch (err) {
      const pgError = err as PostgresError;
      console.error("Database error:", {
        code: pgError.code,
        message: pgError.message,
        fullError: err,
      });

      // Handle duplicate emails more explicitly
      if (pgError.code === "23505") {
        return NextResponse.json(
          { message: "Email already registered for early access" },
          { status: 200 },
        );
      }

      throw err;
    }

    return NextResponse.json({ message: "Successfully joined early access" }, { status: 201 });
  } catch (error) {
    console.error("Early access registration error:", {
      error,
      stack: error instanceof Error ? error.stack : undefined,
    });

    // Return more detailed error in development
    if (env.NODE_ENV === "development") {
      return NextResponse.json(
        {
          error: "Internal server error",
          details: error instanceof Error ? error.message : String(error),
        },
        { status: 500 },
      );
    }

    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
