import { NextResponse } from "next/server";

export function GET() {
  return new NextResponse(
    JSON.stringify({
      associatedApplications: [
        {
          applicationId: "80b11343-e52c-4969-81e8-faebfed78a67",
        },
      ],
    }),
  );
}
