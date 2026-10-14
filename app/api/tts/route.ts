import { NextRequest, NextResponse } from "next/server";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import { checkLimit, envInt } from "@/app/lib/rateLimit";
import { currentUser } from "@/app/lib/auth";
import { pool } from "@/app/lib/db";
import { splitStory } from "@/app/lib/chunks";

const VOICE = "ro-RO-AlinaNeural";

async function synthesize(text: string): Promise<Buffer> {
  const tts = new MsEdgeTTS();
  await tts.setMetadata(VOICE, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
  const chunks: Buffer[] = [];
  const { audioStream } = tts.toStream(text);
  await new Promise<void>((resolve, reject) => {
    audioStream.on("data", (chunk: Buffer) => chunks.push(chunk));
    audioStream.on("end", resolve);
    audioStream.on("error", reject);
  });
  return Buffer.concat(chunks);
}

/*
 * POST { storyId, index } → audio-ul bucatii `index` din povestea utilizatorului.
 * Textul il luam din baza de date, nu din cerere: asa vocea se poate folosi doar
 * pentru povestile tale, nu ca serviciu gratuit de citit orice text. Fiecare
 * bucata se salveaza, deci reascultarea nu mai cere voce noua (si nu mai costa).
 */
export async function POST(req: NextRequest) {
  try {
    const user = await currentUser(req);
    if (!user) return NextResponse.json({ error: "Neautentificat." }, { status: 401 });

    const { storyId, index } = await req.json();
    if (typeof storyId !== "string" || !Number.isInteger(index) || index < 0) {
      return NextResponse.json({ error: "Cerere invalidă." }, { status: 400 });
    }

    const { rows } = await pool.query(
      "SELECT text FROM story WHERE id = $1 AND user_id = $2", [storyId, user.id]);
    if (!rows[0]) return NextResponse.json({ error: "Povestea nu există." }, { status: 404 });

    const chunks = splitStory(rows[0].text);
    if (index >= chunks.length) {
      return NextResponse.json({ error: "Bucată inexistentă." }, { status: 400 });
    }

    const cached = await pool.query(
      "SELECT mp3 FROM story_audio WHERE story_id = $1 AND idx = $2", [storyId, index]);
    if (cached.rows[0]) {
      return NextResponse.json({ audioContent: cached.rows[0].mp3.toString("base64"), total: chunks.length });
    }

    // Limita se aplica doar audio-ului nou, singurul care ar putea costa
    const limited = checkLimit(req, "tts", {
      perIp: envInt("TTS_LIMIT_PER_HOUR", 300),
      windowMs: 60 * 60 * 1000,
      globalPerDay: envInt("TTS_LIMIT_PER_DAY", 10000),
    });
    if (limited) return NextResponse.json({ error: limited }, { status: 429 });

    const mp3 = await synthesize(chunks[index]);
    await pool.query(
      "INSERT INTO story_audio (story_id, idx, mp3) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
      [storyId, index, mp3]);

    return NextResponse.json({ audioContent: mp3.toString("base64"), total: chunks.length });
  } catch (error: unknown) {
    console.error("tts:", error);
    return NextResponse.json({ error: "Vocea nu este disponibilă acum." }, { status: 500 });
  }
}
