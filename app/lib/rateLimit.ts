import { NextRequest } from "next/server";

/*
 * Limitare de cereri tinuta in memorie. Merge pentru o singura instanta de
 * server (cum ruleaza acum pe Railway); la mai multe instante, fiecare are
 * contorii ei si limitele se inmultesc — atunci trebuie mutat in Redis.
 * La un restart contorii se golesc, ceea ce e acceptabil pentru o plasa de siguranta.
 */

const buckets = new Map<string, number[]>();

function hit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const recent = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    buckets.set(key, recent);
    return false;
  }
  recent.push(now);
  buckets.set(key, recent);
  return true;
}

// Curatam periodic cheile vechi, ca harta sa nu creasca la nesfarsit
const DAY = 24 * 60 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const [key, times] of buckets) {
    if (times.every((t) => now - t > DAY)) buckets.delete(key);
  }
}, 60 * 60 * 1000).unref?.();

export function clientIp(req: NextRequest): string {
  // Railway pune IP-ul real al clientului primul in x-forwarded-for
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim()
    || req.headers.get("x-real-ip")
    || "necunoscut";
}

export interface Limit {
  perIp: number;     // cereri permise de la un IP...
  windowMs: number;  // ...in aceasta fereastra
  globalPerDay: number; // plafon total pe zi, pentru toti utilizatorii
}

/** Intoarce null daca cererea e permisa, altfel mesajul de eroare. */
export function checkLimit(req: NextRequest, name: string, limit: Limit): string | null {
  if (!hit(`${name}:ip:${clientIp(req)}`, limit.perIp, limit.windowMs)) {
    return "Ai făcut prea multe cereri într-un timp scurt. Mai încearcă puțin mai târziu.";
  }
  if (!hit(`${name}:global`, limit.globalPerDay, DAY)) {
    return "Aplicația a atins limita zilnică. Încearcă din nou mâine.";
  }
  return null;
}

/** Citeste o limita numerica din variabilele de mediu, cu valoare implicita. */
export function envInt(name: string, fallback: number): number {
  const v = parseInt(process.env[name] || "", 10);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}
