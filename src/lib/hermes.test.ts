import { describe, expect, it } from "vitest";
import { buildHermesPrompt, parseThunderResponse } from "@/lib/hermes";

describe("Thunder Hermes integration", () => {
  it("parses wikilinks and structured changes", () => {
    const parsed = parseThunderResponse('See [[Now]] and [[Projects/Test|project]].\n```thunder-changes\n[{"path":"Now.md","content":"# Now"}]\n```');
    expect(parsed.links).toEqual(["Now.md", "Projects/Test.md"]);
    expect(parsed.changes).toEqual([{ path: "Now.md", content: "# Now" }]);
  });
  it("builds a fixed Thunder profile prompt with note context", () => {
    const prompt = buildHermesPrompt({ message: "Summarize", scope: "note", notePath: "Now.md", noteContent: "# Now" });
    expect(prompt).toContain("Identity: Thunder");
    expect(prompt).toContain("Active note: Now.md");
  });
  it("includes an attached imported document and preserves proposal-only writes", () => {
    const prompt = buildHermesPrompt({ message: "Summarize", scope: "main", docPath: "00 Inbox/report.md", docContent: "x".repeat(120_001) });
    expect(prompt).toContain("Attached document: 00 Inbox/report.md");
    expect(prompt).toContain("Never write files directly");
    expect(prompt.length).toBeLessThan(250_000);
  });
});
