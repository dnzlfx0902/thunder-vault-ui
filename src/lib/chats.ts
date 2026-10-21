import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
export type ChatMessage = { role: "user" | "assistant"; text: string; links?: string[] };
export type Chat = { id: string; title: string; scope: "main" | "note"; updated: number; messages: ChatMessage[] };
const file = () => path.resolve(process.env.APP_DATA_DIR || path.join(process.cwd(), ".data"), "chats.json");
async function read(): Promise<Chat[]> { try { return JSON.parse(await readFile(file(), "utf8")); } catch { return []; } }
async function save(chats: Chat[]) { await mkdir(path.dirname(file()), { recursive: true }); const temp = `${file()}.tmp`; await writeFile(temp, JSON.stringify(chats)); await rename(temp, file()); }
export async function recentChats() { return (await read()).filter(chat => chat.scope === "main").sort((a,b) => b.updated-a.updated).slice(0,5); }
export async function appendChat(id: string, scope: "main"|"note", message: ChatMessage, title?: string) { const chats = await read(); let chat = chats.find(x => x.id === id); if (chat && chat.scope !== scope) throw new Error("Chat scope mismatch"); if (!chat) { chat = { id, scope, title: title || "New chat", updated: Date.now(), messages: [] }; chats.push(chat); } chat.messages.push(message); chat.updated = Date.now(); const main = chats.filter(x=>x.scope==="main").sort((a,b)=>b.updated-a.updated).slice(0,5), notes = chats.filter(x=>x.scope==="note"); await save([...main,...notes]); return chat; }
