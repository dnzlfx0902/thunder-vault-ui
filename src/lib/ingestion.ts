import { execFile } from "node:child_process";
import { lookup } from "node:dns/promises";
import { existsSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { isIP } from "node:net";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const exec = promisify(execFile);
export const MAX_UPLOAD = 25 * 1024 * 1024;
const MAX_URL = 5 * 1024 * 1024;
const DEFAULT_MARKITDOWN = '["/mnt/datos/apps/headroom/venv/bin/markitdown"]';
const ALLOWED = new Set([".pdf", ".docx", ".md", ".markdown", ".txt", ".html", ".htm"]);

function pdfDir() { return path.resolve(process.env.APP_DATA_DIR || path.join(process.cwd(), ".data"), "pdfs"); }
export async function saveOriginalPdf(slug: string, data: Buffer) { await mkdir(pdfDir(), { recursive: true }); const dest = path.join(pdfDir(), `${slug}.pdf`); await writeFile(dest, data); return dest; }
export function pdfPathForSlug(slug: string) { return path.join(pdfDir(), `${slug}.pdf`); }
export function hasOriginalPdf(slug: string) { try { return existsSync(pdfPathForSlug(slug)); } catch { return false; } }

export function extractFirstUrl(message: string) { const match = message.match(/https?:\/\/[^\s<>"']+/i); return match ? match[0].replace(/[),.;!?\]}]+$/, "") : null; }
export function slugify(value: string) { return path.basename(value, path.extname(value)).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "imported-document"; }
function quoted(value: string) { return JSON.stringify(value.replaceAll("\r", " ").replaceAll("\n", " ")); }
export function buildImportedNote(input: { title: string; source: string; sourceType: "file" | "url"; markdown: string; captured?: string; hasPdf?: boolean }) { const captured = input.captured || new Date().toISOString().slice(0, 10); const pdfLine = input.hasPdf ? "\nhas_pdf: true" : ""; return { path: `00 Inbox/${slugify(input.title)}.md`, content: `---\ntype: capture\nstatus: inbox\ncreated: ${captured}\nsource: ${quoted(input.source)}\nsource_type: ${input.sourceType}${pdfLine}\n---\n\n${input.markdown.trim()}\n` }; }
function parseCommand(raw = process.env.MARKITDOWN_COMMAND || DEFAULT_MARKITDOWN) { const value = JSON.parse(raw); if (!Array.isArray(value) || !value.length || !value.every(x => typeof x === "string")) throw new Error("Invalid MARKITDOWN_COMMAND"); return value as string[]; }
export function conversionCommand(name: string, input: string, configured?: string) { const extension = path.extname(name).toLowerCase(); if (!ALLOWED.has(extension)) throw new Error("Unsupported document type"); if (extension === ".pdf") return ["pdftotext", input, "-"]; if ([".md", ".markdown", ".txt"].includes(extension)) return ["cat", input]; return [...parseCommand(configured), input]; }
export async function convertDocument(name: string, data: Buffer, execute = exec) { if (data.byteLength > MAX_UPLOAD) throw new Error("Document exceeds 25MB"); const directory = path.join(os.tmpdir(), `thunder-import-${Date.now()}`); await mkdir(directory, { recursive: true }); const input = path.join(directory, path.basename(name)); try { await writeFile(input, data); const [command, ...args] = conversionCommand(name, input); const { stdout } = await execute(command, args, { maxBuffer: MAX_UPLOAD, timeout: 120_000 }); return String(stdout); } finally { await rm(directory, { recursive: true, force: true }); } }

function ipv4Number(address: string) { return address.split(".").reduce((value, part) => value * 256 + Number(part), 0) >>> 0; }
function in4(address: string, network: string, bits: number) { const mask = bits ? (0xffffffff << (32 - bits)) >>> 0 : 0; return (ipv4Number(address) & mask) === (ipv4Number(network) & mask); }
export function isPublicAddress(address: string) { if (isIP(address) === 4) return ![["0.0.0.0",8],["10.0.0.0",8],["100.64.0.0",10],["127.0.0.0",8],["169.254.0.0",16],["172.16.0.0",12],["192.0.0.0",24],["192.0.2.0",24],["192.168.0.0",16],["198.18.0.0",15],["198.51.100.0",24],["203.0.113.0",24],["224.0.0.0",4],["240.0.0.0",4]].some(([network,bits])=>in4(address, String(network), Number(bits))); const normalized = address.toLowerCase(); return isIP(address) === 6 && normalized !== "::" && normalized !== "::1" && !normalized.startsWith("fc") && !normalized.startsWith("fd") && !normalized.startsWith("fe8") && !normalized.startsWith("fe9") && !normalized.startsWith("fea") && !normalized.startsWith("feb") && !normalized.startsWith("ff") && !normalized.startsWith("2001:db8:") && !normalized.startsWith("::ffff:"); }
async function validateUrl(url: URL, resolve = lookup) { if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw new Error("Only public HTTP(S) URLs are allowed"); const addresses = await resolve(url.hostname, { all: true, verbatim: true }); if (!addresses.length || addresses.some(item => !isPublicAddress(item.address))) throw new Error("URL resolves to a blocked address"); }
async function readCapped(response: Response) { const reader = response.body?.getReader(); if (!reader) return Buffer.alloc(0); const parts: Uint8Array[] = []; let size = 0; while (true) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > MAX_URL) { await reader.cancel(); throw new Error("URL response exceeds 5MB"); } parts.push(value); } return Buffer.concat(parts); }
export async function fetchPublicUrl(raw: string, options: { fetcher?: typeof fetch; resolve?: typeof lookup } = {}) { let url = new URL(raw); const fetcher = options.fetcher || fetch; for (let redirects = 0; redirects <= 3; redirects++) { await validateUrl(url, options.resolve); const response = await fetcher(url, { redirect: "manual", signal: AbortSignal.timeout(15_000), headers: { accept: "text/html,text/plain;q=0.9" } }); if ([301,302,303,307,308].includes(response.status)) { const location = response.headers.get("location"); if (!location || redirects === 3) throw new Error("Too many redirects"); url = new URL(location, url); continue; } if (!response.ok) throw new Error(`URL returned ${response.status}`); const length = Number(response.headers.get("content-length") || 0); if (length > MAX_URL) throw new Error("URL response exceeds 5MB"); return { finalUrl: url.toString(), contentType: response.headers.get("content-type") || "", data: await readCapped(response) }; } throw new Error("Too many redirects"); }
export async function convertUrl(raw: string) { const result = await fetchPublicUrl(raw); const extension = result.contentType.includes("html") ? ".html" : ".txt"; const markdown = await convertDocument(`import${extension}`, result.data); return { ...result, markdown }; }
