import { cookies } from "next/headers";
import { verifySession } from "@/lib/auth";

export async function isAuthenticated() {
  return verifySession((await cookies()).get("thunder_session")?.value, process.env.APP_PASSWORD);
}
export function unauthorized() { return Response.json({ error: "Authentication required" }, { status: 401 }); }
export async function readLimited(request: Request, limit = 65_536) {
  const length = Number(request.headers.get("content-length") || 0);
  if (length > limit) throw new Error("Request too large");
  const text = await request.text();
  if (Buffer.byteLength(text) > limit) throw new Error("Request too large");
  return JSON.parse(text) as unknown;
}
