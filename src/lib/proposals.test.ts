import { describe, expect, it } from "vitest";
import { approveProposal, createProposal } from "@/lib/proposals";

describe("proposals", () => {
  it("rejects stale content and traversal", async () => {
    const files = new Map([["Now.md", "old"]]);
    const proposal = await createProposal([{ path: "Now.md", content: "new" }], async p => files.get(p) ?? "");
    files.set("Now.md", "changed");
    await expect(approveProposal(proposal.id, async p => files.get(p) ?? "", async () => {})).rejects.toThrow("stale");
    await expect(createProposal([{ path: "../escape.md", content: "x" }], async () => "")).rejects.toThrow("Invalid note path");
  });

  it("rolls back all files and invalidates the proposal when the second write fails", async () => {
    const files = new Map([["a.md", "a-old"], ["b.md", "b-old"]]);
    const proposal = await createProposal([{ path: "a.md", content: "a-new" }, { path: "b.md", content: "b-new" }], async p => files.get(p) ?? "");
    let writes = 0;
    const write = async (p: string, content: string) => { if (++writes === 2) throw new Error("disk failure"); files.set(p, content); };
    await expect(approveProposal(proposal.id, async p => files.get(p) ?? "", write)).rejects.toThrow("disk failure");
    expect(files).toEqual(new Map([["a.md", "a-old"], ["b.md", "b-old"]]));
    await expect(approveProposal(proposal.id, async p => files.get(p) ?? "", write)).rejects.toThrow("Invalid proposal");
  });
});
