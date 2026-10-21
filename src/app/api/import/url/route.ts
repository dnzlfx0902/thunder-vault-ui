import { isAuthenticated, readLimited, unauthorized } from "@/lib/http";
import { publish } from "@/lib/events";
import { buildImportedNote, convertUrl } from "@/lib/ingestion";
import { writeNotes } from "@/lib/vault";
export const runtime = "nodejs";
export async function POST(request: Request) { if (!await isAuthenticated()) return unauthorized(); try { const { url } = await readLimited(request, 4096) as { url?: string }; if (!url) throw new Error("URL required"); const converted = await convertUrl(url), parsed = new URL(converted.finalUrl); const note = buildImportedNote({ title: parsed.pathname.split("/").filter(Boolean).at(-1) || parsed.hostname, source: converted.finalUrl, sourceType: "url", markdown: converted.markdown }); await writeNotes([note]); publish([note.path]); return Response.json(note); } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Import failed" }, { status: 400 }); } }
