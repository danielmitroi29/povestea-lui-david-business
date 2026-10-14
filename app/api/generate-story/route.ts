import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { STORY_SYSTEM_PROMPT } from "@/app/lib/storyPrompt";
import { checkLimit, envInt } from "@/app/lib/rateLimit";
import { currentUser } from "@/app/lib/auth";
import { getQuota, releaseStory, reserveStory, type Quota } from "@/app/lib/quota";
import { pool } from "@/app/lib/db";

// Durate permise (minute de lectură audio); ~130 de cuvinte pe minut
const DURATIONS = [3, 5, 7, 10];
const WORDS_PER_MINUTE = 130;

const MAX_NAMES = 6;          // cât permite și interfața
const MAX_NAME_LENGTH = 40;
const MAX_PROMPT_LENGTH = 500;

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
  // Povestea rezervată din cotă; dacă generarea eșuează, o dăm înapoi
  let reserved: { userId: string; quota: Quota } | null = null;
  try {
    const user = await currentUser(req);
    if (!user) {
      return NextResponse.json({ error: "Intră în cont ca să creezi povești.", code: "AUTH" }, { status: 401 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Cheia API OpenAI nu este configurată pe server." }, { status: 500 });
    }

    const body = await req.json();
    const { age, duration } = body;
    const names: string[] = Array.isArray(body.names)
      ? body.names.filter((n: unknown): n is string => typeof n === "string" && n.trim() !== "")
          .map((n: string) => n.trim())
      : [];
    const customPrompt = typeof body.customPrompt === "string" ? body.customPrompt.trim() : "";
    const childAge = Number.isInteger(age) && age >= 0 && age <= 8 ? age : null;
    const minutes = DURATIONS.includes(duration) ? duration : null;

    if (names.length === 0) {
      return NextResponse.json({ error: "Te rog introdu cel puțin un nume." }, { status: 400 });
    }
    if (names.length > MAX_NAMES || names.some((n) => n.length > MAX_NAME_LENGTH)) {
      return NextResponse.json({ error: `Maxim ${MAX_NAMES} nume, de cel mult ${MAX_NAME_LENGTH} de caractere.` }, { status: 400 });
    }
    if (customPrompt.length > MAX_PROMPT_LENGTH) {
      return NextResponse.json({ error: `Detaliile pot avea cel mult ${MAX_PROMPT_LENGTH} de caractere.` }, { status: 400 });
    }

    const limited = checkLimit(req, "story", {
      perIp: envInt("STORY_LIMIT_PER_HOUR", 10),
      windowMs: 60 * 60 * 1000,
      globalPerDay: envInt("STORY_LIMIT_PER_DAY", 300),
    });
    if (limited) {
      return NextResponse.json({ error: limited, code: "RATE_LIMIT" }, { status: 429 });
    }

    const quota = await getQuota(user.id);
    if (!(await reserveStory(user.id, quota))) {
      const error = quota.subscribed
        ? `Ai folosit ${quota.limit} din ${quota.limit} povești luna aceasta. Poveștile noi revin la reînnoirea abonamentului.`
        : quota.limit > 0
          ? `Ai folosit cele ${quota.limit} povești gratuite. Abonează-te ca să primești povești noi în fiecare lună.`
          : "Abonează-te ca să creezi povești.";
      return NextResponse.json({ error, code: "QUOTA", usage: { used: quota.used, limit: quota.limit } }, { status: 402 });
    }
    reserved = { userId: user.id, quota };

    const client = new OpenAI({ apiKey });
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
      await releaseStory(user.id, quota);
      reserved = null;
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
    if (!story) throw new Error("Răspuns gol de la OpenAI");

    const id = crypto.randomUUID();
    await pool.query(
      `INSERT INTO story (id, user_id, title, text, names, age, duration, custom_prompt)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [id, user.id, title, story, JSON.stringify(names), childAge, minutes, customPrompt || null],
    );

    return NextResponse.json({
      id, story, title,
      usage: { used: quota.used + 1, limit: quota.limit },
    });
  } catch (error: unknown) {
    if (reserved) await releaseStory(reserved.userId, reserved.quota).catch(() => {});
    // Detaliile (cheie invalidă, credite OpenAI epuizate) sunt pentru tine, nu pentru părinți
    console.error("generate-story:", error);
    return NextResponse.json(
      { error: "Nu am putut crea povestea acum. Încearcă din nou în câteva minute.", code: "UNKNOWN" },
      { status: 500 },
    );
  }
}
