const hits = new Map<string, { count: number; reset: number }>();
let activeChats = 0;
export function allowed(key: string, limit = 8, windowMs = 60_000) {
  const now = Date.now();
  const current = hits.get(key);
  if (!current || current.reset < now) { hits.set(key, { count: 1, reset: now + windowMs }); return true; }
  if (current.count >= limit) return false;
  current.count += 1;
  return true;
}
export function enterChat(limit = 2) { if (activeChats >= limit) return null; activeChats++; return () => { activeChats--; }; }
