import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const MAX_CHARS = 4096; // limita OpenAI TTS per cerere

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();

    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "Textul este necesar." }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Cheia OpenAI nu este configurată." }, { status: 400 });
    }

    const client = new OpenAI({ apiKey });
    const truncated = text.slice(0, MAX_CHARS);

    const response = await client.audio.speech.create({
      model: "tts-1",
      voice: "nova",       // feminină, caldă – ideală pentru povești
      input: truncated,
      response_format: "mp3",
    });

    const buffer = Buffer.from(await response.arrayBuffer());
    const base64 = buffer.toString("base64");

    return NextResponse.json({ audioContent: base64 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Eroare necunoscută";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
