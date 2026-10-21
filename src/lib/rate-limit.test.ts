import { describe, expect, it } from "vitest";
import { enterChat } from "@/lib/rate-limit";

describe("chat concurrency", () => {
  it("caps concurrent chats globally", () => {
    const first = enterChat(2), second = enterChat(2);
    expect(first).toBeTypeOf("function");
    expect(second).toBeTypeOf("function");
    expect(enterChat(2)).toBeNull();
    first!(); second!();
  });
});
