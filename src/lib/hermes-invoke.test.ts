import { describe, expect, it } from "vitest";
import { HermesTimeoutError, runHermes } from "@/lib/hermes";

describe("runHermes", () => {
  it("passes the prompt only through stdin", async () => {
    let received = "";
    const output = await runHermes("danger; rm -rf /", { command: ["mock"], execute: async (_cmd, _args, stdin) => { received = stdin; return "Thunder reply"; } });
    expect(received).toBe("danger; rm -rf /");
    expect(output).toBe("Thunder reply");
  });

  it("returns a clean timeout error instead of a null exit traceback", async () => {
    await expect(runHermes("prompt", { command: [process.execPath, "-e", "setTimeout(()=>{},10000)"], timeoutMs: 30 })).rejects.toBeInstanceOf(HermesTimeoutError);
  });

  it("uses the remote profile before chat and reads the query from stdin", async () => {
    process.env.HERMES_SSH_HOST = "hermes.example";
    delete process.env.HERMES_COMMAND;
    let args: string[] = [];
    await runHermes("prompt", { execute: async (_command, received) => { args = received; return "ok"; } });
    expect(args).toEqual(["--", "hermes.example", "hermes", "-p", "second-brain", "chat", "--query-file", "-"]);
  });
});
