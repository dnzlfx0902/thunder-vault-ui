import { mkdtemp, readFile, readdir, rename, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveMarkdownPath, writeNote, writeNotes } from "@/lib/vault";

describe("vault paths and writes", () => {
  it("accepts markdown inside the vault", async () => {
    await expect(resolveMarkdownPath("notes/test.md", "/vault", async value => value)).resolves.toBe("/vault/notes/test.md");
  });

  it("rejects traversal and non-markdown files", async () => {
    await expect(resolveMarkdownPath("../secret.md", "/vault")).rejects.toThrow("Invalid note path");
    await expect(resolveMarkdownPath("notes/data.json", "/vault")).rejects.toThrow("Markdown files only");
  });

  it("rejects new files below a symlink escaping the vault", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "vault-"));
    const outside = await mkdtemp(path.join(os.tmpdir(), "outside-"));
    await symlink(outside, path.join(root, "linked"));
    await expect(resolveMarkdownPath("linked/new.md", root)).rejects.toThrow("Note escapes vault");
  });

  it("aborts when an existing file cannot be backed up", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "vault-"));
    process.env.VAULT_ROOT = root;
    await writeFile(path.join(root, "note.md"), "old");
    await writeFile(path.join(root, ".thunder-backups"), "blocks backup directory");
    await expect(writeNote("note.md", "new")).rejects.toThrow();
    await expect(readFile(path.join(root, "note.md"), "utf8")).resolves.toBe("old");
  });

  it("restores the current original when installing its temp file fails", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "vault-"));
    process.env.VAULT_ROOT = root;
    await writeFile(path.join(root, "note.md"), "old");
    await expect(writeNotes([{ path: "note.md", content: "new" }], async (from, to) => {
      if (String(from).endsWith(".tmp") && String(to).endsWith("note.md")) throw new Error("install failed");
      await rename(from, to);
    })).rejects.toThrow("install failed");
    await expect(readFile(path.join(root, "note.md"), "utf8")).resolves.toBe("old");
    expect((await readdir(root)).some(name => name.endsWith(".old"))).toBe(false);
  });
});
