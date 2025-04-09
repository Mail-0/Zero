import { type NextRequest, NextResponse } from "next/server";
import { createDriver } from "@/app/api/driver";
import { connection } from "@zero/db/schema";
import { db } from "@zero/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ providerId: string }> },
) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  if (!code || !state) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/settings/email?error=missing_params`,
    );
  }

  const { providerId } = await params;

  const driver = await createDriver(providerId, {});

  try {
    // We'll log the scope parameter later when we use it

    // Exchange the authorization code for tokens
    const { tokens } = await driver.getTokens(code);

    if (!tokens.access_token || !tokens.refresh_token) {
      console.error("Missing tokens:", tokens);
      return new NextResponse(JSON.stringify({ error: "Could not get token" }), { status: 400 });
    }

    // Get user info using the access token
    const userInfo = await driver.getUserInfo({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
    });

    if (!userInfo.data?.emailAddresses?.[0]?.value) {
      console.error("Missing email in user info:", userInfo);
      return new NextResponse(JSON.stringify({ error: 'Missing "email" in user info' }), {
        status: 400,
      });
    }

    // Get the actual scope from the callback URL
    const receivedScope = searchParams.get("scope");
    const driverScope = driver.getScope();
    console.log("Auth callback - URL scope:", receivedScope);
    console.log("Auth callback - Driver scope:", driverScope);
    
    // Combine scopes to ensure we have both
    const combinedScopes = new Set<string>();
    
    // Add driver scopes
    driverScope.split(' ').forEach(s => combinedScopes.add(s));
    
    // Add URL scopes
    if (receivedScope) {
      receivedScope.split(' ').forEach(s => combinedScopes.add(s));
    }
    
    // Ensure contacts scope is included
    combinedScopes.add("https://www.googleapis.com/auth/contacts.readonly");
    
    // Create final scope string
    const scope = Array.from(combinedScopes).join(' ');
    
    console.log("Combined scope for DB storage:", scope);
    
    // Store the connection in the database
    await db.insert(connection).values({
      providerId,
      id: crypto.randomUUID(),
      userId: state,
      email: userInfo.data.emailAddresses[0].value,
      name: userInfo.data.names?.[0]?.displayName || "Unknown",
      picture: userInfo.data.photos?.[0]?.url || "",
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      scope: scope, // Use the scope from the callback
      expiresAt: new Date(Date.now() + (tokens.expiry_date || 3600000)),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return NextResponse.redirect(new URL("/mail", request.url));
  } catch (error) {
    return new NextResponse(JSON.stringify({ error }));
  }
}
