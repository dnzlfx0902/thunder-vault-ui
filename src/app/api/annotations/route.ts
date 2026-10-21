import { isAuthenticated, readLimited, unauthorized } from "@/lib/http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { slugify } from "@/lib/ingestion";

export type Annotation = { id: string; page: number; rects: { x: number; y: number; w: number; h: number }[]; text: string; color: string; note?: string; created: string };

function annotationsDir() { return path.resolve(process.env.APP_DATA_DIR || path.join(process.cwd(), ".data"), "annotations"); }
function annotationsFile(notePath: string) { const slug = slugify(path.basename(notePath, ".md")); return path.join(annotationsDir(), `${slug}.json`); }

export async function GET(request: Request) {
  if (!await isAuthenticated()) return unauthorized();
  const notePath = new URL(request.url).searchParams.get("path") || "";
  try { return Response.json({ annotations: JSON.parse(await readFile(annotationsFile(notePath), "utf8")) }); }
  catch { return Response.json({ annotations: [] }); }
}
export async function POST(request: Request) {
  if (!await isAuthenticated()) return unauthorized();
  try {
    const body = await readLimited(request, 65_536) as { path?: string; annotations?: Annotation[] };
    if (!body.path || !Array.isArray(body.annotations)) throw new Error("Invalid request");
    await mkdir(annotationsDir(), { recursive: true });
    await writeFile(annotationsFile(body.path), JSON.stringify(body.annotations));
    return Response.json({ ok: true });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Save failed" }, { status: 400 }); }
}
