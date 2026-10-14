import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/app/lib/auth";
import { getQuota } from "@/app/lib/quota";
import { billingEnabled } from "@/app/lib/plans";

// GET /api/me → cota de povești a utilizatorului și dacă plățile sunt active
export async function GET(req: NextRequest) {
  const user = await currentUser(req);
  if (!user) return NextResponse.json({ user: null });
  const q = await getQuota(user.id);
  return NextResponse.json({
    user: { email: user.email, name: user.name },
    usage: { used: q.used, limit: q.limit, subscribed: q.subscribed, periodEnd: q.periodEnd },
    billing: billingEnabled(),
  });
}
