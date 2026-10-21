import { describe, expect, it } from "vitest";
import { parseFrontmatter, extractWikilinks } from "@/lib/knowledge";

describe("knowledge metadata", () => {
  it("extracts frontmatter and unique wikilinks", () => {
    const text = "---\nstatus: active\ntags: [work, now]\n---\n[[Now]] [[Now|today]] [[Projects/Test]]";
    expect(parseFrontmatter(text)).toEqual({ status: "active", tags: ["work", "now"] });
    expect(extractWikilinks(text)).toEqual(["Now.md", "Projects/Test.md"]);
  });
});
