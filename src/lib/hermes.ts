import { spawn } from "node:child_process";

export type HermesInput = { message: string; scope: "main" | "note"; notePath?: string; noteContent?: string; docPath?: string; docContent?: string };
export function buildHermesPrompt(input: HermesInput) {
  const role = input.scope === "main"
    ? `INBOX MODE: The user is writing in the main chat. EVERY message is an idea, thought, link, or command to capture. You MUST respond by proposing thunder-changes that create a new .md file in the correct vault folder (00 Inbox for unsorted ideas, 10 Projects for actionable goals with an end, 20 Areas for ongoing responsibilities, 30 Resources for reference material, 50 Decisions for important choices). Use frontmatter with type, status, created (YYYY-MM-DD), and tags. If the message contains a URL, fetch/import it first. If the message is a question about existing notes, answer it normally instead of creating a file.`
    : `EDIT MODE: The user wants to annotate or modify the currently open document. Add ==highlight== markers around important text and > [!note] blocks with explanations. NEVER delete existing text. Only ADD ==markers== and note blocks. Propose thunder-changes targeting the active note path.`;
  return [`Identity: Thunder`, `Profile: second-brain`, `You are always Thunder. Never write files directly. Return proposed writes only in a fenced thunder-changes JSON array of {path,content}.`, `CRITICAL RULE: You MUST NEVER delete existing text from imported documents (.md with has_pdf). Only ADD ==highlights== and > [!note] blocks.`, role, `Scope: ${input.scope}`, input.notePath ? `Active note: ${input.notePath}` : "", input.noteContent ? `Active note content:\n${input.noteContent.slice(0, 120_000)}` : "", input.docPath ? `Attached document: ${input.docPath}` : "", input.docContent ? `Attached document content:\n${input.docContent.slice(0, 120_000)}` : "", `User: ${input.message}`].filter(Boolean).join("\n\n");
}
export function parseThunderResponse(text: string) {
  const links = [...text.matchAll(/\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]/g)].map(m => `${m[1].trim().replace(/\.md$/i, "")}.md`);
  const block = text.match(/```thunder-changes\s*([\s\S]*?)```/i)?.[1];
  let changes: { path: string; content: string }[] = [];
  if (block) try { const value = JSON.parse(block); if (Array.isArray(value)) changes = value.filter(x => x && typeof x.path === "string" && typeof x.content === "string"); } catch {}
  return { reply: text.replace(/```thunder-changes[\s\S]*?```/gi, "").trim(), links: [...new Set(links)], changes };
}
type Execute = (command: string, args: string[], stdin: string, timeoutMs?: number) => Promise<string>;
export class HermesTimeoutError extends Error {}
const execute: Execute = (command, args, stdin, timeoutMs = Number(process.env.HERMES_TIMEOUT_MS) || 900_000) => new Promise((resolve, reject) => {
  const child = spawn(command, args, { stdio: ["pipe", "pipe", "pipe"], shell: false, detached: true });
  let stdout = "", stderr = "", timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    try { process.kill(-child.pid!, "SIGTERM"); } catch {}
    setTimeout(() => { try { process.kill(-child.pid!, "SIGKILL"); } catch {} }, 5_000).unref();
  }, timeoutMs);
  timer.unref();
  child.stdout.on("data", chunk => { if (stdout.length < 1_000_000) stdout += chunk; });
  child.stderr.on("data", chunk => { if (stderr.length < 16_384) stderr += chunk; });
  child.on("error", error => { clearTimeout(timer); reject(error); });
  child.on("close", code => {
    clearTimeout(timer);
    if (timedOut) reject(new HermesTimeoutError("Thunder tardó demasiado. Intenta de nuevo."));
    else if (code === 0) resolve(stdout.trim());
    else reject(new Error(`Thunder no pudo responder${code === null ? "" : ` (código ${code})`}: ${stderr.slice(0, 300)}`));
  });
  child.stdin.end(stdin);
});
function configuredCommand() {
  if (process.env.HERMES_COMMAND) { const value = JSON.parse(process.env.HERMES_COMMAND); if (!Array.isArray(value) || !value.every(x => typeof x === "string") || !value.length) throw new Error("Invalid HERMES_COMMAND"); return value as string[]; }
  if (!process.env.HERMES_SSH_HOST) throw new Error("HERMES_COMMAND or HERMES_SSH_HOST required");
  return ["ssh", "--", process.env.HERMES_SSH_HOST, "hermes", "-p", "second-brain", "chat", "--query-file", "-"];
}
export async function runHermes(prompt: string, options?: { command?: string[]; execute?: Execute; timeoutMs?: number }) { const [command, ...args] = options?.command || configuredCommand(); return (options?.execute || execute)(command, args, prompt, options?.timeoutMs); }
