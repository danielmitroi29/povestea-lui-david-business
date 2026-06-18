import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { names, customPrompt, apiKey } = body;

    const resolvedApiKey = process.env.OPENAI_API_KEY || apiKey;
    if (!resolvedApiKey) {
      return NextResponse.json(
        { error: "Cheia API OpenAI este necesară." },
        { status: 400 }
      );
    }

    if (!names || names.length === 0) {
      return NextResponse.json(
        { error: "Te rog introdu cel putin un nume." },
        { status: 400 }
      );
    }

    const client = new OpenAI({ apiKey: resolvedApiKey });
    const namesList = names.join(", ");

    const systemPrompt = `Ești un povestitor pentru copii MICI de 3 ani care scrie povești în limba română.

Prima linie a răspunsului tău trebuie să fie exact în formatul:
TITLU: <un titlu scurt, poetic, maxim 7 cuvinte, în română>

După titlu, scrie povestea pe rânduri noi.

REGULI STRICTE de limbaj pentru 3 ani:
- Propoziții SCURTE: maxim 6-8 cuvinte fiecare
- Fiecare propoziție pe rând nou (ca versuri)
- Vocabular SIMPLU: cuvinte pe care le știe un copil de 3 ani
- Onomatopee: Bum! Hap! Poc! Cip! Miau! Cuac! Zzz! etc.
- REPETIȚIE: repetă aceeași frază de 2-3 ori (copiii de 3 ani adoră repetiția)
- Probleme CONCRETE: minge pierdută, prieten trist, drum greșit — NU probleme abstracte
- Finalul: copilul se întoarce acasă, mama îl îmbrățișează
- Moral SIMPLU și concret: o propoziție, cuvinte simple
- 200-280 de cuvinte total (la narare lentă ~4-5 minute)

INTERZIS: cuvinte lungi sau abstracte, fraze compuse cu 3+ propoziții, concepte filozofice, scene violente sau înfricoșătoare

Folosește OBLIGATORIU numele copiilor din cerere ca personaje PRINCIPALE.`;

    const userPrompt = customPrompt
      ? `Scrie o poveste originală pentru copii cu personajele principale: ${namesList}.

TEMA CENTRALĂ — construiește TOATĂ povestea în jurul acesteia: ${customPrompt}
Tema trebuie să apară:
1. În introducere, ca trăsătură sau context special al eroului
2. În miezul poveștii, ca instrument sau abilitate care ajută în aventură
3. La climax, ca soluția decisivă a problemei

Fă din ${namesList} eroii care trăiesc o aventură captivantă legată de această temă. Povestea trebuie să fie de 650-700 cuvinte.`
      : `Scrie o poveste originală pentru copii cu personajele principale: ${namesList}.
Fă din ${namesList} eroii unei aventuri captivante, cu obstacole, dialog amuzant și o morală clară.
Povestea trebuie să fie de 650-700 cuvinte.`;

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.85,
      max_tokens: 1800,
    });

    const raw = completion.choices[0]?.message?.content || "";
    const titleMatch = raw.match(/^TITLU:\s*(.+)/m);
    const title = titleMatch ? titleMatch[1].trim() : `Povestea lui ${names[0]}`;
    const story = raw.replace(/^TITLU:\s*.+\n*/m, "").trim();

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
    const message = error instanceof Error ? error.message : "Eroare necunoscuta";
    return NextResponse.json({ error: message, code: "UNKNOWN" }, { status: 500 });
  }
}
