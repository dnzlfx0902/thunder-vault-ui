import { isAuthenticated, readLimited, unauthorized } from "@/lib/http";
import { createProposal } from "@/lib/proposals";
import { readNote } from "@/lib/vault";
export async function POST(request: Request) { if (!await isAuthenticated()) return unauthorized(); try { const body = await readLimited(request) as { changes?: {path:string;content:string}[] }; return Response.json({ proposal: await createProposal(body.changes || [], readNote) }); } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Invalid proposal" }, { status: 400 }); } }
