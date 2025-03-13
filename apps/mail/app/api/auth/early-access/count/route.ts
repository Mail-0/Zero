import { NextRequest, NextResponse } from "next/server";
import { earlyAccess } from "@zero/db/schema";
import { db } from "@zero/db";
import { count } from "drizzle-orm";
import { Ratelimit } from "@upstash/ratelimit";
import { redis } from "@/lib/redis";

const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(20, "1m"),
  analytics: true,
  prefix: "ratelimit:early-access-count",
});

export async function GET(req: NextRequest) {
  try {
    const ip = req.headers.get("CF-Connecting-IP");
    if (!ip) {
      console.log("No IP detected");
      return NextResponse.json({ error: "No IP detected" }, { status: 400 });
    }
    console.log("Request from IP:", ip, req.headers.get("x-forwarded-for"), req.headers.get('CF-Connecting-IP'));
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