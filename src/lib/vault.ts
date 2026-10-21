import { copyFile, mkdir, readFile, readdir, realpath, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

export type VaultEntry = { name: string; path: string; type: "file" | "directory"; modified: number; children?: VaultEntry[] };

function rootPath() { return path.resolve(process.env.VAULT_ROOT || path.join(process.cwd(), "test-vault")); }

export async function resolveMarkdownPath(relative: string, root = rootPath(), resolveReal: (value: string) => Promise<string> = value => realpath(value)) {
  if (!relative || path.isAbsolute(relative) || relative.split(/[\\/]/).includes("..")) throw new Error("Invalid note path");
  if (path.extname(relative).toLowerCase() !== ".md") throw new Error("Markdown files only");
  const base = path.resolve(root), target = path.resolve(base, relative), actualBase = await resolveReal(base);
  if (!target.startsWith(`${base}${path.sep}`)) throw new Error("Note escapes vault");
  let existing = target;
  while (true) {
    try {
      const actual = await resolveReal(existing);
      if (actual !== actualBase && !actual.startsWith(`${actualBase}${path.sep}`)) throw new Error("Note escapes vault");
      return target;
    } catch (error) {
      if (error instanceof Error && error.message === "Note escapes vault") throw error;
      const parent = path.dirname(existing);
      if (parent === existing) throw error;
      existing = parent;
    }
  }
}

async function walk(directory: string, base: string, depth = 0): Promise<VaultEntry[]> {
  if (depth > 5) return [];
  const entries = await readdir(directory, { withFileTypes: true });
  const result: VaultEntry[] = [];
  for (const entry of entries) {
    if (entry.name.startsWith(".") || entry.name === "node_modules" || entry.name === "second-brain-ui") continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) result.push({ name: entry.name, path: path.relative(base, absolute), type: "directory", modified: 0, children: await walk(absolute, base, depth + 1) });
    else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) result.push({ name: entry.name, path: path.relative(base, absolute), type: "file", modified: (await stat(absolute)).mtimeMs });
  }
  return result.sort((a, b) => a.type === b.type ? a.name.localeCompare(b.name) : a.type === "directory" ? -1 : 1);
}

export async function listVault() { const root = rootPath(); try { return await walk(root, root); } catch { return []; } }
export async function readNote(relative: string) { return readFile(await resolveMarkdownPath(relative), "utf8"); }
export async function writeNote(relative: string, content: string) {
  const target = await resolveMarkdownPath(relative);
  await mkdir(path.dirname(target), { recursive: true });
  const backup = path.join(rootPath(), ".thunder-backups", `${relative}.${new Date().toISOString().replaceAll(":", "-")}.bak`);
  try {
    await mkdir(path.dirname(backup), { recursive: true });
    await copyFile(target, backup);
  } catch (error) {
    if (!error || typeof error !== "object" || !("code" in error) || error.code !== "ENOENT") throw error;
  }
  await writeFile(target, content, { encoding: "utf8", flag: "w" });
}
export async function writeNotes(changes: { path: string; content: string }[], renameFile = rename) {
  const staged = await Promise.all(changes.map(async change => { const target = await resolveMarkdownPath(change.path); await mkdir(path.dirname(target), { recursive: true }); const temp = `${target}.${randomSuffix()}.tmp`; await writeFile(temp, change.content); const existed = await stat(target).then(()=>true, error => { if (error?.code === "ENOENT") return false; throw error; }); if (existed) { const backup = path.join(rootPath(), ".thunder-backups", `${change.path}.${new Date().toISOString().replaceAll(":", "-")}.bak`); await mkdir(path.dirname(backup), { recursive: true }); await copyFile(target, backup); } return { target, temp, old: `${target}.${randomSuffix()}.old`, existed, oldMoved: false, installed: false }; }));
  try { for (const item of staged) { if (item.existed) { await renameFile(item.target, item.old); item.oldMoved = true; } await renameFile(item.temp, item.target); item.installed = true; } }
  catch (error) { for (const item of staged.toReversed()) { if (item.installed) await rm(item.target, { force: true }); if (item.oldMoved) await renameFile(item.old, item.target); } await Promise.all(staged.map(item => rm(item.temp, { force: true }))); throw error; }
  await Promise.all(staged.map(item => rm(item.old, { force: true })));
}
function randomSuffix() { return `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`; }
