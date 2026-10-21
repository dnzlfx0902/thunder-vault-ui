import { isAuthenticated, unauthorized } from "@/lib/http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { slugify } from "@/lib/ingestion";
export const runtime = "nodejs";
export async function GET(request: Request) {
  if (!await isAuthenticated()) return unauthorized();
  const notePath = new URL(request.url).searchParams.get("path") || "";
  if (!notePath.endsWith(".md")) return Response.json({ error: "Invalid path" }, { status: 400 });
  const slug = slugify(notePath.split("/").pop() || "");
  try {
    const pdfDir = path.resolve(process.env.APP_DATA_DIR || ".data", "pdfs");
    const pdf = await readFile(path.join(pdfDir, `${slug}.pdf`));
    return new Response(pdf, { headers: { "Content-Type": "application/pdf", "Cache-Control": "private, max-age=3600" } });
  } catch { return Response.json({ error: "PDF not found" }, { status: 404 }); }
}
