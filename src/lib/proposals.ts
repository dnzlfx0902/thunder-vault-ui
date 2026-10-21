import { createHash, randomUUID } from "node:crypto";
import { createTwoFilesPatch } from "diff";
import { resolveMarkdownPath } from "@/lib/vault";
export type Change = { path: string; content: string };
type Proposal = { id: string; created: number; changes: (Change & { hash: string; diff: string })[] };
const proposals = new Map<string, Proposal>();
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
export async function createProposal(changes: Change[], read: (path: string) => Promise<string>) {
  if (!changes.length || changes.length > 20) throw new Error("Invalid changes");
  const prepared = [];
  for (const change of changes) { await resolveMarkdownPath(change.path); if (Buffer.byteLength(change.content) > 1_000_000) throw new Error("Content too large"); let current = ""; try { current = await read(change.path); } catch {} if (current.includes("has_pdf: true")) { const origLines = current.split("\n").filter(l => l.trim().length > 20); const newSet = new Set(change.content.split("\n")); const deleted = origLines.filter(l => !newSet.has(l)); if (deleted.length > 0) throw new Error(`Cannot delete ${deleted.length} lines from imported document "${change.path}". You can only ADD content.`); } prepared.push({ ...change, hash: hash(current), diff: createTwoFilesPatch(change.path, change.path, current, change.content) }); }
  const proposal = { id: randomUUID(), created: Date.now(), changes: prepared }; proposals.set(proposal.id, proposal); return proposal;
}
export async function approveProposal(id: string, read: (path: string) => Promise<string>, write: (path: string, content: string) => Promise<void>, writeAll?: (changes: Change[]) => Promise<void>) {
  const proposal = proposals.get(id); proposals.delete(id);
  if (!proposal || Date.now() - proposal.created > 900_000) throw new Error("Invalid proposal");
  const originals = new Map<string, string>();
  for (const change of proposal.changes) { await resolveMarkdownPath(change.path); let current = ""; try { current = await read(change.path); } catch {} if (hash(current) !== change.hash) throw new Error("Proposal is stale"); originals.set(change.path, current); }
  if (writeAll) await writeAll(proposal.changes);
  else { const written: string[] = []; try { for (const change of proposal.changes) { await write(change.path, change.content); written.push(change.path); } } catch (error) { for (const path of written.reverse()) await write(path, originals.get(path)!); throw error; } }
  return proposal.changes.map(x => x.path);
}
