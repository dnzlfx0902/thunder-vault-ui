import { describe, expect, it } from "vitest";
import { createSession, verifySession } from "@/lib/auth";

describe("session", () => {
  it("round-trips a signed session", async () => {
    const token = await createSession("password", 1_700_000_000_000);
    await expect(verifySession(token, "password", 1_700_000_000_001)).resolves.toBe(true);
  });

  it("rejects tampering and expiry", async () => {
    const token = await createSession("password", 1_700_000_000_000);
    await expect(verifySession(`${token}x`, "password", 1_700_000_000_001)).resolves.toBe(false);
    await expect(verifySession(token, "password", 1_700_000_000_000 + 86_400_001)).resolves.toBe(false);
  });
});
