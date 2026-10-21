import { cookies } from "next/headers";
import { createSession } from "@/lib/auth";
import { allowed } from "@/lib/rate-limit";
import { readLimited } from "@/lib/http";

export async function POST(request: Request) {
  if (!allowed("login", 20)) return Response.json({ error: "Try again later" }, { status: 429 });
  try {
    const body = await readLimited(request, 2048) as { password?: string };
    const configured = process.env.APP_PASSWORD;
    if (!configured || body.password !== configured) return Response.json({ error: "Invalid credentials" }, { status: 401 });
    (await cookies()).set("thunder_session", await createSession(configured), { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 86400 });
    return Response.json({ ok: true });
  } catch { return Response.json({ error: "Invalid request" }, { status: 400 }); }
}
