import { Ratelimit } from "@upstash/ratelimit";
import { NextRequest, NextResponse } from "next/server";
import { processIP, getRatelimitModule, checkRateLimit } from "../../utils";
import { getConnections } from "@/actions/connections";

export const GET = async (req: NextRequest) => {
    const finalIp = processIP(req)
    const ratelimit = getRatelimitModule({
        prefix: `ratelimit:get-mail`,
        limiter: Ratelimit.slidingWindow(60, '1m'),
    })
    const { success, headers } = await checkRateLimit(ratelimit, finalIp);
    if (!success) {
        return NextResponse.json(
            { error: 'Too many requests. Please try again later.' },
            { status: 429, headers },
        );
    }

    const connections = await getConnections();

    return NextResponse.json(connections, {
        status: 200,
        headers,
    });
}