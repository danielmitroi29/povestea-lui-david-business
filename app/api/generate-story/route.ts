import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Stiluri de deschidere — fiecare impune o structură narativă diferită
const OPENING_STYLES = [
  "Începe IN MEDIAS RES: prima propoziție aruncă personajul direct în acțiune. Nu descrie cine este, ci ce face sau ce i se întâmplă chiar acum.",
  "Începe cu un DIALOG: prima linie este exact ce spune sau strigă personajul principal, între ghilimele.",
  "Începe cu o ONOMATOPEE sau un sunet neașteptat care îl surprinde pe personaj și declanșează aventura.",
  "Începe cu O SURPRIZĂ sau ceva ciudat pe care personajul îl descoperă dimineața (un obiect, un animal, un bilet misterios).",
  "Începe cu O SENZAȚIE fizică sau emoție puternică trăită de personaj: foame, frică ușoară, bucurie explozivă, curiozitate.",
  "Începe cu o DESCRIERE de un singur rând a unui loc neobișnuit, apoi plasează imediat personajul în el.",
  "Începe cu O ÎNTREBARE pe care și-o pune personajul în gând, urmată imediat de o acțiune.",
];

// Teme și conflicte diverse — FĂRĂ mingea pierdută
const STORY_THEMES = [
  "Personajul găsește un pui de pasăre căzut din cuib și încearcă să îl ajute să se întoarcă acasă.",
  "Personajul vrea să construiască cea mai mare casă din perne și pături din lume, dar tot se dărâmă.",
  "Personajul descoperă că planta din ghiveci a înflorit peste noapte și crede că e magică.",
  "Personajul face o greșeală mică (varsă sucul, rupe ceva) și încearcă să repare totul înainte să afle mama.",
  "Personajul ajută un prieten care plânge pentru că nu știe să facă ceva și îl învață pas cu pas.",
  "Personajul se teme de un tunet puternic și mama îl ajută să înțeleagă că nu e periculos.",
  "Personajul pregătește în secret o surpriză pentru ziua de naștere a mamei sau tatei.",
  "Personajul descoperă un melc în grădină și îl urmărește toată dimineața, curioasă/curios unde merge.",
  "Personajul vrea să zboare ca o pasăre și încearcă tot felul de metode amuzante care eșuează comic.",
  "Personajul primește un pachet misterios de la bunica și trebuie să ghicească ce e înăuntru.",
  "Personajul încearcă să adoarmă dar nu poate, și îi povestește jucăriei preferate tot felul de gânduri.",
  "Personajul ajută la cumpărături și pierde lista, trebuie să își amintească tot ce era pe ea.",
  "Personajul descoperă că o jucărie veche uitată are o poveste specială și o repară cu grijă.",
  "Personajul încearcă să facă o prăjitură surpriză și bucătăria devine haos amuzant.",
  "Personajul găsește o omidă pe o frunză și o îngrijește zilnic până devine fluture.",
  "Personajul se plictisește o zi ploioasă și inventează un joc nou din obiecte de prin casă.",
  "Personajul încearcă să cânte un cântec pentru bunica și îl tot uită, dar nu se lasă.",
  "Personajul se pierde scurt în parc și găsește curajul să ceară ajutor unui adult.",
];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { names, customPrompt, apiKey } = body;

    const resolvedApiKey = process.env.OPENAI_API_KEY || apiKey;
    if (!resolvedApiKey) {
      return NextResponse.json({ error: "Cheia API OpenAI este necesară." }, { status: 400 });
    }
    if (!names || names.length === 0) {
      return NextResponse.json({ error: "Te rog introdu cel puțin un nume." }, { status: 400 });
    }

    const client = new OpenAI({ apiKey: resolvedApiKey });
    const namesList = names.join(", ");

    // Selectăm aleator la fiecare cerere — garantează diversitate
    const openingStyle = pick(OPENING_STYLES);
    const storyTheme   = customPrompt ? null : pick(STORY_THEMES);

    const systemPrompt = `Ești un povestitor creativ pentru copii de 3 ani care scrie povești în limba română.

Prima linie a răspunsului tău trebuie să fie exact în formatul:
TITLU: <titlu scurt și poetic, maxim 7 cuvinte>

Apoi scrie povestea.

━━━ REGULI DE LIMBAJ (vârsta 3 ani) ━━━
• Propoziții SCURTE: 5-7 cuvinte fiecare, pe rând nou
• Vocabular SIMPLU: doar cuvinte cunoscute de un copil de 3 ani
• Onomatopee vii: Bum! Poc! Trosc! Miau! Cuac! Hap! Zzz! Pleosc!
• REPETIȚIE intenționată: repetă o frază cheie de 2-3 ori
• Dialog: include cel puțin 2-3 replici scurte între personaje
• Final cald: personajul ajunge acasă, e îmbrățișat, e fericit
• Morală concretă: o singură propoziție simplă
• Lungime: 220-280 cuvinte

━━━ INTERZIS ━━━
• NU începe cu „[Nume] este un băiat/o fată vesel/ă" sau orice variantă
• NU scrie „[Nume] este un copil..." la început
• NU folosi mingea pierdută ca temă sau problemă
• NU folosi cuvinte abstracte, lungi sau filozofice
• NU repeta aceeași structură de poveste ca data trecută

━━━ STIL DE DESCHIDERE OBLIGATORIU PENTRU ACEASTĂ POVESTE ━━━
${openingStyle}`;

    const userPrompt = customPrompt
      ? `Scrie o poveste pentru: ${namesList}.

TEMA DATĂ DE UTILIZATOR: ${customPrompt}

Integrează tema natural în toată povestea — la început ca context, la mijloc ca instrument de rezolvare, la final ca victorie clară. Povestea trebuie să fie vie, cu dialog și momente amuzante.`
      : `Scrie o poveste pentru: ${namesList}.

TEMA ACESTEI POVEȘTI (nu o schimba, construiește totul în jurul ei):
${storyTheme}

Fă personajele să trăiască această situație cu emoții reale, dialog viu și un final cald. Surprinde-ne cu detalii neașteptate și amuzante.`;

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.95,
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
    const message = error instanceof Error ? error.message : "Eroare necunoscută";
    return NextResponse.json({ error: message, code: "UNKNOWN" }, { status: 500 });
  }
}
