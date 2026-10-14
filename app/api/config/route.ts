import { NextResponse } from "next/server";

// GET /api/config → doar daca serverul are cheia OpenAI; cheile nu ajung niciodata in browser
export async function GET() {
  return NextResponse.json({ hasEnvOpenAi: !!process.env.OPENAI_API_KEY });
}
