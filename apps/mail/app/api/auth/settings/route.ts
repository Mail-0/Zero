import { getConnections } from "@/actions/connections";
import { Ratelimit } from "@upstash/ratelimit";
import { NextRequest, NextResponse } from "next/server";
import { processIP, getRatelimitModule, checkRateLimit } from "../../utils";
import { getUserSettings } from "@/actions/settings";

export const GET = async (req: NextRequest) => {
    const finalIp = processIP(req)
    const ratelimit = getRatelimitModule({
        prefix: `ratelimit:get-settings`,
        limiter: Ratelimit.slidingWindow(60, '1m'),
    })
    const { success, headers } = await checkRateLimit(ratelimit, finalIp);
    if (!success) {
        return NextResponse.json(
            { error: 'Too many requests. Please try again later.' },
            { status: 429, headers },
        );
    }

    const settings = await getUserSettings();

    return NextResponse.json(settings);
}