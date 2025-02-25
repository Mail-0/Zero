/**
 * Rate limiting helper functions to enforce API request limits.
 * @module rateLimit
 */

import { Ratelimit } from "@upstash/ratelimit";
import { redis } from "@/lib/redis";

const RATE_LIMIT_TIME_FRAME = 24 * 60 * 60 * 1000; // 24 hours
const RATE_LIMIT_MAX_REQUESTS = 5; // Max 5 requests per IP per time frame

/**
 * Creates a waitlist rate limiter with a sliding window limit of 5 requests per 24 hours.
 * @returns {Promise<Ratelimit>} A promise that resolves to the rate limiter instance.
 */
export async function waitlistRateLimiter() {
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(RATE_LIMIT_MAX_REQUESTS, "24 h"),
    timeout: RATE_LIMIT_TIME_FRAME, // 24 hours
  });
}
