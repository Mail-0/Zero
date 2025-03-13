/**
 * Rate limiting helper functions to enforce API request limits.
 * @module rateLimit
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Duration } from "@upstash/ratelimit";
import { redis } from "@/lib/redis";

const WAITLIST_LIMIT = {
  requests: 5,
  duration: "24 h" as Duration,
  timeoutMs: 24 * 60 * 60 * 1000, // 24 hours
};

const OPENAI_API_LIMIT = {
  requests: 100,
  duration: "1 h" as Duration,
  timeoutMs: 60 * 60 * 1000, // 1 hour
};

const GLOBAL_LIMIT_DEFAULT = {
  requests: 50,
  duration: "10 m" as Duration,
  timeoutMs: 10 * 60 * 1000, // 10 minutes
};

/**
 * Creates a waitlist rate limiter with a sliding window limit of 5 requests per 24 hours.
 * @returns A promise that resolves to the rate limiter instance.
 */
export async function waitlistRateLimiter(): Promise<Ratelimit> {
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(WAITLIST_LIMIT.requests, WAITLIST_LIMIT.duration),
    timeout: WAITLIST_LIMIT.timeoutMs,
  });
}

/**
 * Creates a rate limiter for OpenAI API calls with a sliding window limit of 100 requests per hour.
 * @returns A promise that resolves to the rate limiter instance.
 */
export async function openaiRateLimiter(): Promise<Ratelimit> {
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(OPENAI_API_LIMIT.requests, OPENAI_API_LIMIT.duration),
    timeout: OPENAI_API_LIMIT.timeoutMs,
  });
}

/**
 * Creates a configurable global rate limiter with default settings of 50 requests per 10 minutes.
 * @param config Optional configuration to override default values
 * @returns A promise that resolves to the rate limiter instance.
 */
export async function globalRateLimiter(config?: {
  requests?: number;
  duration?: Duration;
  timeoutMs?: number;
}): Promise<Ratelimit> {
  const settings = {
    requests: config?.requests || GLOBAL_LIMIT_DEFAULT.requests,
    duration: config?.duration || GLOBAL_LIMIT_DEFAULT.duration,
    timeoutMs: config?.timeoutMs || GLOBAL_LIMIT_DEFAULT.timeoutMs,
  };

  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(settings.requests, settings.duration),
    timeout: settings.timeoutMs,
  });
}
