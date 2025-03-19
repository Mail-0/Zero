import { env } from "@/env";
import { Redis } from "@upstash/redis";

export const redis = new Redis({ url: env.REDIS_URL, token: env.REDIS_TOKEN });
