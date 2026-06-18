import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

// Bază de date simplă: un fișier JSON stocat în data/ai-templates.json
// Funcționează pe orice server persistent (Railway, Render, VPS, local).
// ⚠️  Pe Vercel (serverless) fișierul nu persistă – pentru Vercel folosește Upstash.

const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "ai-templates.json");

function readTemplates(): Record<string, string> {
  try {
    if (!fs.existsSync(DB_FILE)) return {};
    return JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
  } catch {
    return {};
  }
}

function writeTemplates(templates: Record<string, string>): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(DB_FILE, JSON.stringify(templates, null, 2), "utf-8");
}

// GET /api/templates → { [storyType]: templateString }
export async function GET() {
  const templates = readTemplates();
  return NextResponse.json(templates);
}

// POST /api/templates → salvează { storyType, template }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { storyType, template } = body;

    if (!storyType || !template) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const templates = readTemplates();
    templates[storyType] = template;
    writeTemplates(templates);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

