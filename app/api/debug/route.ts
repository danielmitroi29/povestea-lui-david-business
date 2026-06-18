import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    hasOpenAi: !!process.env.OPENAI_API_KEY,
    hasElevenLabs: !!process.env.ELEVENLABS_API_KEY,
    hasEncryption: !!process.env.ENCRYPTION_SECRET,
    openAiPrefix: process.env.OPENAI_API_KEY?.slice(0, 8) || "lipsă",
    elevenLabsPrefix: process.env.ELEVENLABS_API_KEY?.slice(0, 6) || "lipsă",
  });
}
