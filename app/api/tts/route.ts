import { NextRequest, NextResponse } from "next/server";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import { checkLimit, envInt } from "@/app/lib/rateLimit";

const VOICE    = "ro-RO-AlinaNeural";
// Pagina trimite bucăți de câte 4 propoziții; o bucată mai lungă nu vine din aplicație
const MAX_CHARS = 3000;

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();

    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "Textul este necesar." }, { status: 400 });
    }
    if (text.length > MAX_CHARS) {
      return NextResponse.json({ error: "Textul este prea lung." }, { status: 413 });
    }

    // O poveste lungă înseamnă ~20 de bucăți, deci limita pe oră lasă loc pentru multe povești
    const limited = checkLimit(req, "tts", {
      perIp: envInt("TTS_LIMIT_PER_HOUR", 300),
      windowMs: 60 * 60 * 1000,
      globalPerDay: envInt("TTS_LIMIT_PER_DAY", 10000),
    });
    if (limited) {
      return NextResponse.json({ error: limited }, { status: 429 });
    }

    const tts = new MsEdgeTTS();
    await tts.setMetadata(VOICE, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);

    const chunks: Buffer[] = [];
    const { audioStream } = tts.toStream(text);

    await new Promise<void>((resolve, reject) => {
      audioStream.on("data", (chunk: Buffer) => chunks.push(chunk));
      audioStream.on("end", resolve);
      audioStream.on("error", reject);
    });

    const base64 = Buffer.concat(chunks).toString("base64");
    return NextResponse.json({ audioContent: base64 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Eroare necunoscută";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
