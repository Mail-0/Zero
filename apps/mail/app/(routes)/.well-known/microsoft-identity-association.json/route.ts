import { NextResponse } from "next/server";

export function GET() {
  return new NextResponse(
    JSON.stringify({
      associatedApplications: [
        {
          applicationId: "ecf043a0-41bb-4c89-bd31-7e3f272f8e3c",
        },
      ],
    }),
    {
      headers: {
        "Content-Type": "application/json",
      },
    },
  );
}
