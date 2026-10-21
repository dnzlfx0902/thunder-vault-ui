import { isAuthenticated, unauthorized } from "@/lib/http";
import { publish } from "@/lib/events";
import { buildImportedNote, convertDocument, saveOriginalPdf, slugify } from "@/lib/ingestion";
import { listVault, readNote, writeNotes } from "@/lib/vault";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
export const runtime = "nodejs";

function vaultRoot() { return path.resolve(process.env.VAULT_ROOT || path.join(process.cwd(), "test-vault")); }

export async function POST() {
  if (!await isAuthenticated()) return unauthorized();
  try {
    const root = vaultRoot();
    const pdfs: { absPath: string; relPath: string; name: string }[] = [];
    async function scan(dir: string) {
      const entries = await readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
        const abs = path.join(dir, entry.name);
        if (entry.isDirectory()) { await scan(abs); continue; }
        if (entry.isFile() && entry.name.toLowerCase().endsWith(".pdf")) {
          pdfs.push({ absPath: abs, relPath: path.relative(root, abs), name: entry.name });
        }
      }
    }
    await scan(root);

    const results = { processed: 0, skipped: 0, errors: [] as string[] };
    for (const pdf of pdfs) {
      const slug = slugify(pdf.name);
      const mdRelPath = path.join(path.dirname(pdf.relPath), `${slug}.md`).replace(/\\/g, "/");
      try {
        const content = await readNote(mdRelPath);
        if (content.includes("has_pdf: true")) { results.skipped++; continue; }
      } catch {}
      const buffer = await readFile(pdf.absPath);
      const markdown = await convertDocument(pdf.name, buffer);
      await saveOriginalPdf(slug, buffer);
      const note = buildImportedNote({
        title: pdf.name.replace(/\.pdf$/i, ""),
        source: pdf.relPath,
        sourceType: "file" as const,
        markdown,
        hasPdf: true,
      });
      note.path = mdRelPath;
      await writeNotes([note]);
      publish([note.path]);
      results.processed++;
    }
    return Response.json({ ok: true, ...results, total_pdfs: pdfs.length });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Scan failed" }, { status: 500 }); }
}
