import { NextRequest, NextResponse } from "next/server";

// ElevenLabs Text-to-Speech API
// Model: eleven_multilingual_v2 – suport nativ pentru limba română
// Voce: Matilda (feminină, călduroasă, ideală pentru povești copii)
// Gratuit: 10.000 caractere/lună, fără card bancar
const VOICE_ID = "XrExE9yKIg1WjnnlVkGX"; // Matilda – feminină, călduroasă
const MODEL_ID = "eleven_multilingual_v2";
const MAX_CHARS = 9500;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text, apiKey } = body;

    const resolvedApiKey = process.env.ELEVENLABS_API_KEY || apiKey;
    if (!resolvedApiKey) {
      return NextResponse.json(
        { error: "Cheia API ElevenLabs este necesară pentru vocea neurală." },
        { status: 400 }
      );
    }

    if (!text || typeof text !== "string") {
      return NextResponse.json(
        { error: "Textul este necesar." },
        { status: 400 }
      );
    }

    const truncated = text.slice(0, MAX_CHARS);

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": resolvedApiKey,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text: truncated,
          model_id: MODEL_ID,
          voice_settings: {
            stability: 0.55,
            similarity_boost: 0.80,
            style: 0.3,
            use_speaker_boost: true,
          },
        }),
      }
    );

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      const msg = errData?.detail?.message || errData?.detail || `Eroare ElevenLabs (${response.status})`;
      return NextResponse.json({ error: msg }, { status: response.status });
    }

    const audioBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(audioBuffer).toString("base64");

    return NextResponse.json({ audioContent: base64 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Eroare necunoscută";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
