import { isAuthenticated, unauthorized } from "@/lib/http";
import { readNote } from "@/lib/vault";

export const runtime = "nodejs";
export async function GET(request: Request) {
  if (!await isAuthenticated()) return unauthorized();
  const note = new URL(request.url).searchParams.get("path") || "";
  try { return Response.json({ path: note, content: await readNote(note) }); } catch { return Response.json({ error: "Note not found" }, { status: 404 }); }
}
