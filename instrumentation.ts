// Ruleaza o data, la pornirea serverului Next
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || !process.env.DATABASE_URL) return;
  const { ensureSchema } = await import("@/app/lib/schema");
  await ensureSchema();
}
