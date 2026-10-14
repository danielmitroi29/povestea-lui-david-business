import { NextResponse } from "next/server";

// GET /api/config → ce e configurat pe server; cheile nu ajung niciodata in browser
export async function GET() {
  return NextResponse.json({
    hasEnvOpenAi: !!process.env.OPENAI_API_KEY,
    google: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
  });
}
