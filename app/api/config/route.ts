import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const DATA_DIR    = path.join(process.cwd(), "data");
const CONFIG_FILE = path.join(DATA_DIR, "config.json");
const SECRET      = process.env.ENCRYPTION_SECRET || "";
const ALGO        = "aes-256-cbc";

interface AppConfig {
  elevenLabsKey?: string;
  openAiKey?: string;
}

function deriveKey(secret: string): Buffer {
  return crypto.createHash("sha256").update(secret).digest();
}

function encryptJson(json: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGO, deriveKey(SECRET), iv);
  const encrypted = Buffer.concat([cipher.update(json, "utf8"), cipher.final()]);
  return iv.toString("hex") + ":" + encrypted.toString("hex");
}

function decryptJson(data: string): string {
  const [ivHex, cipherHex] = data.split(":");
  const decipher = crypto.createDecipheriv(
    ALGO,
    deriveKey(SECRET),
    Buffer.from(ivHex, "hex")
  );
  return Buffer.concat([
    decipher.update(Buffer.from(cipherHex, "hex")),
    decipher.final(),
  ]).toString("utf8");
}

function readConfig(): AppConfig {
  try {
    if (!fs.existsSync(CONFIG_FILE)) return {};
    const raw = fs.readFileSync(CONFIG_FILE, "utf-8").trim();
    if (SECRET && !raw.startsWith("{")) {
      // fișier criptat
      return JSON.parse(decryptJson(raw));
    }
    // fișier plaintext (vechiul format sau fără ENCRYPTION_SECRET)
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function writeConfig(config: AppConfig): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const json = JSON.stringify(config, null, 2);
  fs.writeFileSync(CONFIG_FILE, SECRET ? encryptJson(json) : json, "utf-8");
}

// GET /api/config → returnează configurația salvată + flag-uri env vars
export async function GET() {
  const config = readConfig();
  return NextResponse.json({
    ...config,
    hasEnvOpenAi:     !!process.env.OPENAI_API_KEY,
    hasEnvElevenLabs: !!process.env.ELEVENLABS_API_KEY,
  });
}

// POST /api/config → salvează configurația (criptată dacă ENCRYPTION_SECRET e setat)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const current = readConfig();
    const updated: AppConfig = { ...current };

    if (typeof body.elevenLabsKey === "string") updated.elevenLabsKey = body.elevenLabsKey;
    if (typeof body.openAiKey === "string") updated.openAiKey = body.openAiKey;

    writeConfig(updated);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
