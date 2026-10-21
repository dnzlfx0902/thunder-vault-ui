import { isAuthenticated, readLimited, unauthorized } from "@/lib/http";
import { approveProposal } from "@/lib/proposals";
import { readNote, writeNote, writeNotes } from "@/lib/vault";
import { publish } from "@/lib/events";
export async function POST(request: Request) { if (!await isAuthenticated()) return unauthorized(); try { const { id } = await readLimited(request, 2048) as { id?: string }; if (!id) throw new Error("Proposal ID required"); const paths = await approveProposal(id, readNote, writeNote, writeNotes); publish(paths); return Response.json({ ok: true, paths }); } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Approval failed" }, { status: 409 }); } }
