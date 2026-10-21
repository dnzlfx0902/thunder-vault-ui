export function extractWikilinks(text: string) { return [...new Set([...text.matchAll(/\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]/g)].map(m => `${m[1].trim().replace(/\.md$/i, "")}.md`))]; }
export function parseFrontmatter(text: string): Record<string, string | string[]> {
  const block = text.match(/^---\n([\s\S]*?)\n---/)?.[1]; if (!block) return {};
  return Object.fromEntries(block.split("\n").flatMap(line => { const match = line.match(/^([\w-]+):\s*(.*)$/); if (!match) return []; const value = match[2].trim(); return [[match[1], value.startsWith("[") && value.endsWith("]") ? value.slice(1,-1).split(",").map(x => x.trim()).filter(Boolean) : value]]; }));
}
