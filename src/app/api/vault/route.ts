import { isAuthenticated, unauthorized } from "@/lib/http";
import { listVault } from "@/lib/vault";

export const runtime = "nodejs";
export async function GET() { return await isAuthenticated() ? Response.json({ entries: await listVault() }) : unauthorized(); }
