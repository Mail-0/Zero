import { Ratelimit, Algorithm, RatelimitConfig } from '@upstash/ratelimit';
import { redis } from '@/lib/redis';
import { NextRequest } from 'next/server';

export const getRatelimitModule = (config: {
    limiter: RatelimitConfig['limiter'];
    prefix: RatelimitConfig['prefix']
}) => {
    const ratelimit = new Ratelimit({
        redis,
        limiter: config.limiter,
        analytics: true,
        prefix: config.prefix,
    });

    return ratelimit
}

export const checkRateLimit = async (ratelimit: Ratelimit, finalIp: string) => {
    const { success, limit, reset, remaining } = await ratelimit.limit(finalIp);
    const headers = {
        'X-RateLimit-Limit': limit.toString(),
        'X-RateLimit-Remaining': remaining.toString(),
        'X-RateLimit-Reset': reset.toString(),
    };
    if (!success)
        console.log(`Rate limit exceeded for IP ${finalIp}.`);
    return { success, headers };
}

export const processIP = (req: NextRequest) => {
    const cfIP = req.headers.get('CF-Connecting-IP');
    const ip = req.headers.get('x-forwarded-for');
    if (!ip && !cfIP && process.env.NODE_ENV === 'production') {
        console.log('No IP detected');
        throw new Error('No IP detected');
    }
    return cfIP ?? ip!;
}
