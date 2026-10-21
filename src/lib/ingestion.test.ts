import { describe, expect, it } from "vitest";
import { buildImportedNote, conversionCommand, extractFirstUrl, isPublicAddress, slugify } from "@/lib/ingestion";

describe("ingestion", () => {
  it("routes PDF through pdftotext and other documents through MARKITDOWN_COMMAND", () => {
    expect(conversionCommand("paper.pdf", "/tmp/paper.pdf")).toEqual(["pdftotext", "/tmp/paper.pdf", "-"]);
    expect(conversionCommand("paper.docx", "/tmp/paper.docx", '["mock-markitdown","--flag"]')).toEqual(["mock-markitdown", "--flag", "/tmp/paper.docx"]);
    expect(conversionCommand("notes.txt", "/tmp/notes.txt")).toEqual(["cat", "/tmp/notes.txt"]);
    expect(conversionCommand("notes.md", "/tmp/notes.md")).toEqual(["cat", "/tmp/notes.md"]);
  });

  it("creates a safe inbox path and preserves source frontmatter", () => {
    expect(slugify("My Report (Final).PDF")).toBe("my-report-final");
    const imported = buildImportedNote({ title: "My Report", source: "https://example.com/a", sourceType: "url", markdown: "# Body", captured: "2026-08-22" });
    expect(imported.path).toBe("00 Inbox/my-report.md");
    expect(imported.content).toContain('source: "https://example.com/a"');
    expect(imported.content).toContain("source_type: url");
    expect(imported.content).toContain("# Body");
  });

  it("extracts a public link from a chat message", () => {
    expect(extractFirstUrl("Checa https://example.com/docs y haz notas")).toBe("https://example.com/docs");
    expect(extractFirstUrl("Sin enlace")).toBeNull();
  });

  it("denies non-public SSRF targets", () => {
    for (const address of ["127.0.0.1", "10.0.0.1", "169.254.169.254", "100.64.0.1", "::1", "fc00::1", "fe80::1"]) expect(isPublicAddress(address)).toBe(false);
    expect(isPublicAddress("93.184.216.34")).toBe(true);
    expect(isPublicAddress("2606:2800:220:1:248:1893:25c8:1946")).toBe(true);
  });
});
