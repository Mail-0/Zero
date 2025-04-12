import { Ratelimit } from "@upstash/ratelimit";
import { NextRequest, NextResponse } from "next/server";
import { processIP, getRatelimitModule, checkRateLimit } from "../../utils";
import { fetchThreadNotes } from "@/actions/notes";

export const GET = async (req: NextRequest) => {
    const finalIp = processIP(req)
    const ratelimit = getRatelimitModule({
        prefix: `ratelimit:get-thread-notes`,
        limiter: Ratelimit.slidingWindow(60, '1m'),
    })
    const { success, headers } = await checkRateLimit(ratelimit, finalIp);
    if (!success) {
        return NextResponse.json(
            { error: 'Too many requests. Please try again later.' },
            { status: 429, headers },
        );
    }
    const searchParams = req.nextUrl.searchParams;

    if (!searchParams.get('threadId')) {
        return NextResponse.json({ error: 'Missing threadId' }, { status: 400 });
    }

    const notes = await fetchThreadNotes(searchParams.get('threadId')!);

    return NextResponse.json(notes, {
        status: 200,
        headers,
    });
}