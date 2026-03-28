import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const hasCronSecret = !!process.env.CRON_SECRET;
  const secretMatch = authHeader === `Bearer ${process.env.CRON_SECRET}`;

  console.log("[CRON TEST]", {
    time: new Date().toISOString(),
    hasCronSecret,
    secretMatch,
    authHeader: authHeader ? `${authHeader.slice(0, 15)}...` : null,
  });

  return NextResponse.json({
    ok: true,
    time: new Date().toISOString(),
    hasCronSecret,
    secretMatch,
  });
}
