import { NextRequest, NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { earlyAccess } from "@zero/db/schema";
import { redis } from "@/lib/redis";
import { db } from "@zero/db";

type PostgresError = {
  code: string;
  message: string;
};

const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(2, "30m"),
  analytics: true,
  prefix: "ratelimit:early-access",
});
const verifyEndpoint = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'
const secret = process.env.TURNSTILE_SECRET_KEY!

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for") || "unknown";
    console.log("Request from IP:", ip);
    const { success, limit, reset, remaining } = await ratelimit.limit(ip);

    const headers = {
      "X-RateLimit-Limit": limit.toString(),
      "X-RateLimit-Remaining": remaining.toString(),
      "X-RateLimit-Reset": reset.toString(),
    };

    if (!success) {
      console.log(`Rate limit exceeded for IP ${ip}. Remaining: ${remaining}`);
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers },
      );
    }

    const body = await req.json();
    console.log("Request body:", body);

    const { email, token } = body;

    if (!email) {
      console.log("Email missing from request");
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const verifyRequest = await fetch(verifyEndpoint, {
      method: 'POST',
      body: `secret=${encodeURIComponent(secret)}&response=${encodeURIComponent(token)}`,
      headers: {
        'content-type': 'application/x-www-form-urlencoded'
      }
    })

    const verifyResponse = await verifyRequest.json()

    if (!verifyResponse.success) {
      console.log("Turnstile verification failed:", verifyResponse.error)
      return NextResponse.json({ error: "Invalid turnstile verification" }, { status: 400 });
    }

    const nowDate = new Date();

    try {
      console.log("Attempting to insert email:", email);

      const result = await db.insert(earlyAccess).values({
        id: crypto.randomUUID(),
        email,
        createdAt: nowDate,
        updatedAt: nowDate,
      });

      console.log("Insert successful:", result);

      return NextResponse.json(
        { message: "Successfully joined early access" },
        {
          status: 201,
          headers: {
            "X-RateLimit-Limit": limit.toString(),
            "X-RateLimit-Remaining": remaining.toString(),
            "X-RateLimit-Reset": reset.toString(),
          },
        },
      );
    } catch (err) {
      const pgError = err as PostgresError;
      console.error("Database error:", {
        code: pgError.code,
        message: pgError.message,
        fullError: err,
      });

      if (pgError.code === "23505") {
        // Return 200 for existing emails
        return NextResponse.json(
          { message: "Email already registered for early access" },
          {
            status: 200,
            headers: {
              "X-RateLimit-Limit": limit.toString(),
              "X-RateLimit-Remaining": remaining.toString(),
              "X-RateLimit-Reset": reset.toString(),
            },
          },
        );
      }

      throw err;
    }

    // This line is now unreachable due to the returns in the try/catch above
  } catch (error) {
    console.error("Early access registration error:", {
      error,
      stack: error instanceof Error ? error.stack : undefined,
    });

    if (process.env.NODE_ENV === "development") {
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
