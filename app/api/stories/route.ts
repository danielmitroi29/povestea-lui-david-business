import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/app/lib/auth";
import { pool } from "@/app/lib/db";

const PAGE_SIZE = 20;

// GET /api/stories?page=0 → poveștile utilizatorului, cele mai noi primele
export async function GET(req: NextRequest) {
  const user = await currentUser(req);
  if (!user) return NextResponse.json({ error: "Neautentificat." }, { status: 401 });

  const page = Math.max(0, parseInt(req.nextUrl.searchParams.get("page") || "0", 10) || 0);
  const [list, count] = await Promise.all([
    pool.query(
      `SELECT id, title, text, names, created_at AS "createdAt" FROM story
        WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [user.id, PAGE_SIZE, page * PAGE_SIZE]),
    pool.query("SELECT count(*)::int AS n FROM story WHERE user_id = $1", [user.id]),
  ]);
  const total = count.rows[0].n as number;
  return NextResponse.json({ stories: list.rows, total, pages: Math.ceil(total / PAGE_SIZE) || 1 });
}

// DELETE /api/stories?id=... → doar o poveste proprie (audio-ul se șterge în cascadă)
export async function DELETE(req: NextRequest) {
  const user = await currentUser(req);
  if (!user) return NextResponse.json({ error: "Neautentificat." }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Lipsește id-ul." }, { status: 400 });
  await pool.query("DELETE FROM story WHERE id = $1 AND user_id = $2", [id, user.id]);
  return NextResponse.json({ ok: true });
}
