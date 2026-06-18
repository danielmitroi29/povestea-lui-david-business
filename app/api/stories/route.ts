import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const DATA_DIR    = path.join(process.cwd(), "data");
const STORIES_FILE = path.join(DATA_DIR, "stories.json");
const MAX_STORIES = 200;
const PAGE_SIZE   = 20;

export interface SavedStory {
  id: string;
  title: string;
  text: string;
  names: string[];
  storyType: string;
  isAI: boolean;
  createdAt: string;
  customPrompt?: string;
}

function readStories(): SavedStory[] {
  try {
    if (!fs.existsSync(STORIES_FILE)) return [];
    return JSON.parse(fs.readFileSync(STORIES_FILE, "utf-8"));
  } catch {
    return [];
  }
}

function writeStories(stories: SavedStory[]): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(STORIES_FILE, JSON.stringify(stories, null, 2), "utf-8");
}

// GET /api/stories?page=0
export async function GET(req: NextRequest) {
  const page = parseInt(req.nextUrl.searchParams.get("page") || "0", 10);
  const stories = readStories();
  const total = stories.length;
  const slice = stories.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  return NextResponse.json({ stories: slice, total, pages: Math.ceil(total / PAGE_SIZE) });
}

// POST /api/stories
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text, title, names, storyType, isAI, customPrompt } = body;
    if (!text || !names) return NextResponse.json({ ok: false }, { status: 400 });

    const story: SavedStory = {
      id: crypto.randomUUID(),
      title: title || `Povestea lui ${names[0]}`,
      text,
      names,
      storyType,
      isAI: !!isAI,
      createdAt: new Date().toISOString(),
      customPrompt,
    };

    const existing = readStories();
    const updated = [story, ...existing].slice(0, MAX_STORIES);
    writeStories(updated);

    return NextResponse.json({ ok: true, id: story.id });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

// DELETE /api/stories?id=...
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false }, { status: 400 });
  const stories = readStories().filter((s) => s.id !== id);
  writeStories(stories);
  return NextResponse.json({ ok: true });
}
