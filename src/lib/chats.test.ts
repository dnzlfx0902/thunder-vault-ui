import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { appendChat, recentChats } from "@/lib/chats";

describe("chats", () => {
  it("keeps the five recent tabs main-only and rejects scope changes", async () => {
    process.env.APP_DATA_DIR = await mkdtemp(path.join(os.tmpdir(), "chats-"));
    await appendChat("note", "note", { role: "user", text: "context" });
    for (let i = 0; i < 6; i++) await appendChat(`main-${i}`, "main", { role: "user", text: `${i}` });
    const recent = await recentChats();
    expect(recent).toHaveLength(5);
    expect(recent.every(chat => chat.scope === "main")).toBe(true);
    await expect(appendChat("note", "main", { role: "user", text: "escape" })).rejects.toThrow("scope");
  });
});
