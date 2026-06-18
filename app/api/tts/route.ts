import { NextRequest, NextResponse } from "next/server";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";

const VOICE    = "ro-RO-AlinaNeural";
const MAX_CHARS = 9500;

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();

    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "Textul este necesar." }, { status: 400 });
    }

    const truncated = text.slice(0, MAX_CHARS);
    const tts = new MsEdgeTTS();
    await tts.setMetadata(VOICE, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);

    const chunks: Buffer[] = [];
    const { audioStream } = tts.toStream(truncated);

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
