import { NextResponse, type NextRequest } from "next/server";
import { callGateway, portalEnabled, readJSON } from "@/lib/portal/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public proxy for accepting a seller sub-user invite. The invitee has no portal session yet, so
 * this route takes no bearer/cookie and forwards the one-time token to the gateway. Success mints a
 * scoped SELLER credential (sub_role STAFF/VIEWER) the invitee then signs in with.
 */
export async function POST(req: NextRequest) {
  if (!portalEnabled()) {
    return NextResponse.json({ error: "Portal auth is disabled.", code: "disabled" }, { status: 503 });
  }
  let body: { token?: unknown; password?: unknown };
  try {
    body = (await req.json()) as { token?: unknown; password?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid request body.", code: "bad_request" }, { status: 400 });
  }
  const token = typeof body.token === "string" ? body.token : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!token || !password) {
    return NextResponse.json(
      { error: "Invite token and password are required.", code: "bad_request" },
      { status: 400 },
    );
  }

  let res: Response;
  try {
    res = await callGateway("/seller/sub-users/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ token, password }),
    });
  } catch {
    return NextResponse.json(
      { error: "Invite service is unavailable.", code: "gateway_unavailable" },
      { status: 503 },
    );
  }
  const data = await readJSON(res);
  return NextResponse.json(data, { status: res.status });
}
