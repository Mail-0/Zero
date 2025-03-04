// import { type NextRequest, NextResponse } from "next/server";
// import { createAuthClient } from "better-auth/client";

// const client = createAuthClient();

// // Public routes that don't require authentication
// const publicRoutes = [
//   "/login",
//   "/signup",
//   "/signup/verify",
//   "/",
//   "/privacy",
//   "/terms",
//   "/api/auth/early-access",
// ];

// export async function middleware(request: NextRequest) {
//   const { pathname } = request.nextUrl;

//   // Check if the current path is a public route
//   const isPublicRoute = publicRoutes.includes(pathname);

//   // For non-public routes, check authentication
//   if (!isPublicRoute) {
//     const { data: session } = await client.getSession({
//       fetchOptions: {
//         headers: {
//           cookie: request.headers.get("cookie") || "",
//         },
//       },
//     });

//     if (!session) {
//       return NextResponse.redirect(new URL("/login", request.url));
//     }
//   }

//   // Handle existing rate limiting for early access
//   if (pathname === "/api/auth/early-access") {
//     const ip = request.headers.get("x-forwarded-for");
//     if (!ip) {
//       return NextResponse.json(
//         {
//           success: false,
//           error: "Could not determine your IP address, please try again later!",
//         },
//         { status: 400 },
//       );
//     }
//   }

//   return NextResponse.next();
// }

// export const config = {
//   matcher: [
//     /*
//      * Match all request paths except for the ones starting with:
//      * - _next/static (static files)
//      * - _next/image (image optimization files)
//      * - favicon.ico (favicon file)
//      * - public files (public folder)
//      * - api routes (except /api/auth/early-access)
//      */
//     "/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
//   ],
// };
