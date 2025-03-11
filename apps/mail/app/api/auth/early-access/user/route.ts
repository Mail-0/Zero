import { NextResponse } from "next/server";
import { earlyAccess } from "@zero/db/schema";
import { db } from "@zero/db";
import { eq } from "drizzle-orm";
import { NextApiRequest } from "next";

export async function GET(request: NextApiRequest) {
    try {
        if (!request.url) {
            return NextResponse.json(
                { error: "Request URL is required", success: false },
                { status: 400 }
            );
        }
        const { searchParams } = new URL(request.url);
        const email = searchParams.get('email');

        if (!email) {
            return NextResponse.json(
                { error: "Email parameter is required", success: false },
                { status: 400 }
            );
        }

        const result = await db.select()
            .from(earlyAccess)
            .where(eq(earlyAccess.email, email));

        return NextResponse.json({ result, success: true }, { status: 200 });
    } catch (error) {
        console.error("Error fetching early access data:", error);

        return NextResponse.json(
            { error: "Failed to fetch early access data", success: false },
            { status: 500 }
        );
    }
}