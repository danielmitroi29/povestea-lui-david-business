import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const FAIRY_TALES: Record<string, string> = {
  original: "",
  "cei-3-purcelusi":
    "Cei Trei Purcelusi (Three Little Pigs) - povestea celor trei purcelusi care isi construiesc case din paie, lemn si caramida, urmariti de lupul cel rau care suflain casele lor",
  "alba-ca-zapada":
    "Alba ca Zapada (Snow White) - povestea fetitei cu pielea alba ca zapada, parul negru ca pana corbului, care este urmarita de mama vitrega razbatatoare si se refugiaza la cei 7 pitici",
  "scufita-rosie":
    "Scufita Rosie (Little Red Riding Hood) - povestea fetitei cu scufita rosie care merge la bunicuta prin padure si intalneste lupul cel rau",
  cenusareasa:
    "Cenusareasa (Cinderella) - povestea fetei asuprite de mama vitrega si surorile rele, care merge la bal cu ajutorul zanei si pierde pantofioarul de cristal",
  "frumoasa-adormita":
    "Frumoasa Adormita (Sleeping Beauty) - povestea printessei blestemata sa adoarma la varsta de 16 ani dupa ce se impunge cu o furca de tors, si este trezita de sarutul printului",
  "hansel-si-gretel":
    "Hansel si Gretel - povestea celor doi fratei pierduti in padure care gasesc o casa din turta dulce locuita de o vrajitoare rea",
  "motanul-incaltat":
    "Motanul Incaltat (Puss in Boots) - povestea motanului destept care ajuta stapanul sau sarac sa devina bogat si sa castige inima printessei",
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { names, storyType, customPrompt, apiKey } = body;

    const resolvedApiKey = process.env.OPENAI_API_KEY || apiKey;
    if (!resolvedApiKey) {
      return NextResponse.json(
        { error: "Cheia API OpenAI este necesară pentru modul OpenAI GPT." },
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
    const isOriginal = storyType === "original";
    const fairyTaleContext = FAIRY_TALES[storyType] || "";

    const systemPrompt = `Esti un povestitor pentru copii MICI de 3 ani care scrie povesti in limba romana.

Prima linie a raspunsului tau trebuie sa fie exact in formatul:
TITLU: <un titlu scurt, poetic, maxim 7 cuvinte, in romana>

Dupa titlu, scrie povestea pe randuri noi.

REGULI STRICTE de limbaj pentru 3 ani:
- Propozitii SCURTE: maxim 6-8 cuvinte fiecare
- Fiecare propozitie pe rand nou (ca versuri)
- Vocabular SIMPLU: cuvinte pe care le stie un copil de 3 ani
- Onomatopee: Bum! Hap! Poc! Cip! Miau! Cuac! Zzz! etc.
- REPETITIE: repeta aceeasi fraza de 2-3 ori (copiii de 3 ani adora repetitia)
- Probleme CONCRETE: minge pierduta, prieten trist, drum gresit — NU probleme abstracte
- Finalul: copilul se intoarce acasa, mama il imbratiseaza
- Moral SIMPLU si concret: o propozitie, cuvinte simple
- 200-280 de cuvinte total (la narare lenta ~4-5 minute)

INTERZIS: cuvinte lungi sau abstracte, fraze compuse cu 3+ propozitii, concepte filozofice, scene violente sau infricosatoare

Foloseste OBLIGATORIU numele copiilor din cerere ca personaje PRINCIPALE.`;

    let userPrompt = "";

    if (isOriginal) {
      if (customPrompt) {
        userPrompt = `Scrie o poveste originala pentru copii cu urmatoarele personaje principale: ${namesList}.

TEMA CENTRALA — construieste TOATA povestea in jurul acesteia: ${customPrompt}
Tema trebuie sa apara:
1. In introducere, ca trasatura sau context special al eroului
2. In miezul povestii, ca instrument sau abilitate care ajuta in aventura
3. La climax, ca solutia decisiva a problemei

Fa din ${namesList} eroii care traiesc o aventura captivanta legata de aceasta tema. Povestea trebuie sa fie de 650-700 cuvinte.`;
      } else {
        userPrompt = `Scrie o poveste originala pentru copii cu urmatoarele personaje principale: ${namesList}.
Fa din ${namesList} eroii unei aventuri captivante, cu obstacole, dialog amuzant si o morala clara.
Povestea trebuie sa fie de 650-700 cuvinte.`;
      }
    } else {
      if (customPrompt) {
        userPrompt = `Rescrie povestea "${fairyTaleContext}" cu copiii ${namesList} ca eroi principali.

DETALIU SPECIAL — integreaza-l natural in toata povestea: ${customPrompt}
Acest detaliu trebuie sa influenteze cum eroii rezolva conflictul principal al povestii.

Pastreaza structura si morala originala, dar adapteaza-le in jurul acestui detaliu special.
Povestea trebuie sa fie de 650-700 cuvinte, cu dialog viu si momente emotionante.`;
      } else {
        userPrompt = `Rescrie povestea "${fairyTaleContext}" inlocuind personajele principale cu copiii: ${namesList}.
Pastreaza structura si morala povestii originale, dar integreaza natural numele ${namesList} ca eroi principali.
Adauga dialog amuzant, descrieri vii si momente emotionante. Povestea trebuie sa fie de 650-700 cuvinte.`;
      }
    }

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
      const apiErr = error as { status: number; message?: string; code?: string };
      if (apiErr.status === 401) {
        return NextResponse.json({ error: "Cheia API OpenAI este invalidă.", code: "INVALID_KEY" }, { status: 401 });
      }
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
