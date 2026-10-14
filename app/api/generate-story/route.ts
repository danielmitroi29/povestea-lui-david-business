import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { STORY_SYSTEM_PROMPT } from "@/app/lib/storyPrompt";

// Durate permise (minute de lectură audio); ~130 de cuvinte pe minut
const DURATIONS = [3, 5, 7, 10];
const WORDS_PER_MINUTE = 130;

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Stiluri de deschidere — fiecare impune o structură narativă diferită
const OPENING_STYLES = [
  "Începe IN MEDIAS RES: prima propoziție aruncă personajul direct în acțiune. Nu descrie cine este, ci ce face sau ce i se întâmplă chiar acum.",
  "Începe cu un DIALOG: prima propoziție a poveștii (după titlu) este exact ce spune sau strigă personajul principal, între ghilimele.",
  "Începe cu o ONOMATOPEE sau un sunet neașteptat care îl surprinde pe personaj și declanșează aventura.",
  "Începe cu O SURPRIZĂ sau ceva ciudat pe care personajul îl descoperă dimineața (un obiect, un animal, un bilet misterios).",
  "Începe cu O SENZAȚIE fizică sau emoție puternică trăită de personaj: foame, frică ușoară, bucurie explozivă, curiozitate.",
  "Începe cu o DESCRIERE de un singur rând a unui loc neobișnuit, apoi plasează imediat personajul în el.",
  "Începe cu O ÎNTREBARE pe care și-o pune personajul în gând, urmată imediat de o acțiune.",
];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { names, customPrompt, age, duration, apiKey } = body;
    const childAge = Number.isInteger(age) && age >= 0 && age <= 8 ? age : null;
    const minutes = DURATIONS.includes(duration) ? duration : null;

    const resolvedApiKey = process.env.OPENAI_API_KEY || apiKey;
    if (!resolvedApiKey) {
      return NextResponse.json({ error: "Cheia API OpenAI este necesară." }, { status: 400 });
    }
    if (!names || names.length === 0) {
      return NextResponse.json({ error: "Te rog introdu cel puțin un nume." }, { status: 400 });
    }

    const client = new OpenAI({ apiKey: resolvedApiKey });
    const namesList = names.join(", ");

    // Un stil de deschidere ales aleator, ca poveștile să nu înceapă la fel
    const openingStyle = pick(OPENING_STYLES);

    const userPrompt = `Personajele principale ale poveștii: ${namesList}.
${childAge !== null ? `Vârsta copilului: ${childAge} ${childAge === 1 ? "an" : "ani"}.\n` : ""}${minutes !== null ? `Durata dorită: aproximativ ${minutes} minute de ascultare (în jur de ${minutes * WORDS_PER_MINUTE} de cuvinte).\n` : ""}${customPrompt ? `\nTema dorită de utilizator: ${customPrompt}\n` : ""}
Sugestie pentru deschidere: ${openingStyle}

Prima linie a răspunsului trebuie să fie doar titlul poveștii, fără ghilimele sau alte marcaje.`;

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: STORY_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.9,
      // Cu rezervă: 10 minute (~1.300 de cuvinte) în română înseamnă ~3.000 de tokenuri
      max_tokens: 4000,
    });

    const choice = completion.choices[0];
    // Povestea a fost tăiată de limita de tokenuri: mai bine eroare decât o poveste fără final
    if (choice?.finish_reason === "length") {
      return NextResponse.json(
        { error: "Povestea a ieșit prea lungă și s-a întrerupt. Încearcă din nou sau alege o durată mai scurtă.", code: "TRUNCATED" },
        { status: 502 },
      );
    }
    const raw = choice?.message?.content || "";
    // Prima linie nevidă e titlul; curățăm eventualele marcaje (#, **, ghilimele, „TITLU:")
    const lines = raw.trim().split("\n");
    const title = (lines[0] || "")
      .replace(/^#+\s*/, "")
      .replace(/^(titlu|title)\s*:\s*/i, "")
      .replace(/^[*_"„“]+|[*_"”“]+$/g, "")
      .trim() || `Povestea lui ${names[0]}`;
    const story = lines.slice(1).join("\n").trim();

    return NextResponse.json({ story, title });
  } catch (error: unknown) {
    if (error && typeof error === "object" && "status" in error) {
      const apiErr = error as { status: number; message?: string };
      if (apiErr.status === 401)
        return NextResponse.json({ error: "Cheia API OpenAI este invalidă.", code: "INVALID_KEY" }, { status: 401 });
      if (apiErr.status === 429) {
        const msg = apiErr.message || "";
        const code = msg.includes("insufficient_quota") ? "NO_CREDITS" : "RATE_LIMIT";
        return NextResponse.json({ error: msg, code }, { status: 429 });
      }
    }
    const message = error instanceof Error ? error.message : "Eroare necunoscută";
    return NextResponse.json({ error: message, code: "UNKNOWN" }, { status: 500 });
  }
}
