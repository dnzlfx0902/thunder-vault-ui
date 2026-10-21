import { randomUUID } from "node:crypto";
import { isAuthenticated, readLimited, unauthorized } from "@/lib/http";
import { appendChat, recentChats } from "@/lib/chats";
import { buildHermesPrompt, HermesTimeoutError, parseThunderResponse, runHermes } from "@/lib/hermes";
import { createProposal } from "@/lib/proposals";
import { buildImportedNote, convertUrl, extractFirstUrl } from "@/lib/ingestion";
import { publish } from "@/lib/events";
import { readNote, writeNotes } from "@/lib/vault";
import { allowed, enterChat } from "@/lib/rate-limit";
export const runtime = "nodejs";
export async function GET() { return await isAuthenticated() ? Response.json({ chats: await recentChats() }) : unauthorized(); }
export async function POST(request: Request) {
  if (!await isAuthenticated()) return unauthorized();
  if (!allowed("chat", 30)) return Response.json({ error: "Try again later" }, { status: 429 });
  const leave = enterChat();
  if (!leave) return Response.json({ error: "Thunder is busy" }, { status: 429 });
  try {
    const body = await readLimited(request, 32_768) as { chatId?: string; message?: string; scope?: "main"|"note"; notePath?: string; docPath?: string; mode?: "thunder"|"rain" };
    if (!body.message?.trim() || !["main","note"].includes(body.scope || "")) return Response.json({ error: "Invalid chat" }, { status: 400 });
    const id = body.chatId || randomUUID(), scope = body.scope!;
    let noteContent = ""; if (body.notePath) { noteContent = (await readNote(body.notePath)).slice(0, 120_000); }
    let attachedPath = body.docPath || "";
    if (scope === "main" && !attachedPath) {
      const url = extractFirstUrl(body.message);
      if (url) {
        const converted = await convertUrl(url), parsedUrl = new URL(converted.finalUrl);
        const imported = buildImportedNote({ title: parsedUrl.pathname.split("/").filter(Boolean).at(-1) || parsedUrl.hostname, source: converted.finalUrl, sourceType: "url", markdown: converted.markdown });
        await writeNotes([imported]); publish([imported.path]); attachedPath = imported.path;
      }
    }
    const docContent = attachedPath ? (await readNote(attachedPath)).slice(0, 120_000) : "";
    await appendChat(id, scope, { role: "user", text: body.message }, body.message.slice(0,32));
    const isTest = process.env.HERMES_COMMAND?.includes("mock");
    const raw = await runHermes(buildHermesPrompt({ message: body.message, scope, notePath: body.notePath, noteContent, docPath: attachedPath, docContent }), { command: !isTest && body.mode === "rain" ? ["/usr/local/bin/hermes-second-brain-rain"] : undefined });
    const parsed = parseThunderResponse(raw);
    const proposal = parsed.changes.length ? await createProposal(parsed.changes, readNote) : null;
    const links = [...new Set([...parsed.links, ...(attachedPath && attachedPath !== body.docPath ? [attachedPath] : [])])];
    const chat = await appendChat(id, scope, { role: "assistant", text: parsed.reply, links });
    return Response.json({ chat, proposal });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Thunder unavailable" }, { status: error instanceof HermesTimeoutError ? 504 : 502 }); }
  finally { leave(); }
}
