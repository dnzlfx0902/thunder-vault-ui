"use client";
import { useEffect, useRef, useState, useCallback } from "react";

type Annotation = { id: string; page: number; rects: { x: number; y: number; w: number; h: number }[]; text: string; color: string; note?: string; created?: string; source?: "user" | "agent" };
type TextItem = { str?: string; transform?: number[] };
const COLORS = ["#fef08a", "#bbf7d0", "#bfdbfe", "#fecaca", "#e9d5ff"];
const AGENT_COLOR = "#a5f3fc";

function transformToPosition(viewport: { height: number }, item: TextItem) {
  const tx = item.transform || [1, 0, 0, 1, 0, 0];
  const fontSize = Math.sqrt(tx[2] * tx[2] + tx[3] * tx[3]);
  return { x: tx[4], y: viewport.height - tx[5] - fontSize, fontSize };
}

export function extractMdHighlights(md: string): { text: string; note?: string }[] {
  const results: { text: string; note?: string }[] = [];
  const clean = md.replace(/^---[\s\S]*?---\n?/, "");
  const re = /==([^=]+)==(?:\s*\n>\s*\[!note\]\s*\n?\s*>?\s*([^\n]+))?/g;
  let m;
  while ((m = re.exec(clean))) {
    results.push({ text: m[1].trim(), note: m[2]?.trim() });
  }
  return results;
}

export function PdfViewer({ src, notePath, content }: { src: string; notePath: string; content?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [numPages, setNumPages] = useState(0);
  const [selectedText, setSelectedText] = useState("");
  const [showColorPicker, setShowColorPicker] = useState<{ x: number; y: number } | null>(null);
  const [pendingSelection, setPendingSelection] = useState<{ page: number; rects: Annotation["rects"] } | null>(null);
  const pdfDocRef = useRef<{ getPage: (n: number) => Promise<{ getViewport: (o: { scale: number }) => { width: number; height: number }; render: (o: { canvasContext: CanvasRenderingContext2D; viewport: unknown }) => Promise<void>; getTextContent: () => Promise<{ items: TextItem[] }> }>; destroy?: () => void } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const pdfjsLib = await import("pdfjs-dist");
      pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      const doc = await pdfjsLib.getDocument({ url: src }).promise;
      if (cancelled) return;
      pdfDocRef.current = doc as unknown as typeof pdfDocRef.current;
      setNumPages(doc.numPages);
    })();
    return () => { cancelled = true; };
  }, [src]);

  useEffect(() => {
    fetch(`/api/annotations?path=${encodeURIComponent(notePath)}`).then(r => r.ok ? r.json() : { annotations: [] }).then(d => setAnnotations(d.annotations || [])).catch(() => {});
  }, [notePath]);

  const drawHighlights = useCallback((pageNum: number, anns: Annotation[]) => {
    const pageEl = document.getElementById(`pdf-page-${pageNum}`);
    if (!pageEl) return;
    pageEl.querySelectorAll(".pdf-highlight,.pdf-inline-note").forEach(e => e.remove());
    for (const ann of anns.filter(a => a.page === pageNum)) {
      const color = ann.source === "agent" ? AGENT_COLOR : ann.color;
      for (const rect of ann.rects) {
        const div = document.createElement("div");
        div.className = "pdf-highlight";
        Object.assign(div.style, { left: `${rect.x}px`, top: `${rect.y}px`, width: `${rect.w}px`, height: `${rect.h}px`, backgroundColor: color, opacity: ann.source === "agent" ? "0.35" : "0.4", pointerEvents: "none", position: "absolute", borderRadius: "2px" });
        pageEl.appendChild(div);
      }
      if (ann.note && ann.rects.length) {
        const lastRect = ann.rects[ann.rects.length - 1];
        const noteDiv = document.createElement("div");
        noteDiv.className = "pdf-inline-note";
        Object.assign(noteDiv.style, { left: `${lastRect.x + lastRect.w + 8}px`, top: `${lastRect.y}px`, maxWidth: "220px", position: "absolute", zIndex: 5 });
        noteDiv.innerHTML = `<strong>Nota:</strong> ${ann.note}`;
        pageEl.appendChild(noteDiv);
      }
    }
  }, []);

  const findTextInPage = useCallback(async (pageNum: number, searchText: string): Promise<Annotation["rects"] | null> => {
    if (!pdfDocRef.current) return null;
    try {
      const page = await pdfDocRef.current.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1 });
      const textContent = await page.getTextContent();
      const items = textContent.items as TextItem[];
      const fullText = items.map(i => i.str || "").join(" ");
      const normalizedSearch = searchText.replace(/\s+/g, " ").trim();
      const normalizedFull = fullText.replace(/\s+/g, " ").trim();
      if (!normalizedFull.toLowerCase().includes(normalizedSearch.toLowerCase())) return null;
      let bestStartIdx = -1;
      const lowerFull = normalizedFull.toLowerCase();
      const lowerSearch = normalizedSearch.toLowerCase();
      bestStartIdx = lowerFull.indexOf(lowerSearch);
      if (bestStartIdx === -1) return null;
      let charCount = 0;
      const rects: Annotation["rects"] = [];
      const viewportScaled = page.getViewport({ scale: 1 });
      for (const item of items) {
        if (!item.str || !item.transform) continue;
        const itemStart = charCount;
        charCount += item.str.length + 1;
        if (charCount < bestStartIdx || itemStart > bestStartIdx + normalizedSearch.length) continue;
        const pos = transformToPosition(viewportScaled, item);
        rects.push({ x: pos.x, y: pos.y - 2, w: item.str.length * pos.fontSize * 0.55, h: pos.fontSize * 1.4 });
        if (charCount >= bestStartIdx + normalizedSearch.length) break;
      }
      return rects.length ? rects : null;
    } catch { return null; }
  }, []);

  const renderPage = useCallback(async (pageNum: number, anns: Annotation[]) => {
    const pageEl = document.getElementById(`pdf-page-${pageNum}`);
    if (!pageEl || !pdfDocRef.current) return;
    try {
      const page = await pdfDocRef.current.getPage(pageNum);
      const containerWidth = containerRef.current?.clientWidth ?? 800;
      const pdfWidth = page.getViewport({ scale: 1 }).width;
      const scale = Math.max(0.5, Math.min(3, (containerWidth - 32) / pdfWidth));
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      canvas.className = "pdf-canvas";
      pageEl.innerHTML = "";
      pageEl.appendChild(canvas);
      await page.render({ canvasContext: canvas.getContext("2d")!, viewport });
      const textLayer = document.createElement("div");
      textLayer.className = "pdf-text-layer";
      Object.assign(textLayer.style, { width: `${viewport.width}px`, height: `${viewport.height}px`, position: "absolute", top: "0", left: "0" });
      pageEl.appendChild(textLayer);
      const textContent = await page.getTextContent();
      for (const item of textContent.items as TextItem[]) {
        if (!item.str || !item.transform) continue;
        const pos = transformToPosition(viewport, item);
        const span = document.createElement("span");
        span.textContent = item.str;
        Object.assign(span.style, { left: `${pos.x}px`, top: `${pos.y}px`, fontSize: `${pos.fontSize}px`, position: "absolute", whiteSpace: "pre", transformOrigin: "0% 0%", fontFamily: "sans-serif" });
        textLayer.appendChild(span);
      }
      drawHighlights(pageNum, anns);
    } catch {}
  }, [drawHighlights]);

  useEffect(() => {
    if (!numPages) return;
    async function syncAgentHighlights() {
      if (!content) return;
      const mdHighlights = extractMdHighlights(content);
      const existingAgentTexts = new Set(annotations.filter(a => a.source === "agent").map(a => a.text.toLowerCase()));
      const newAnnotations: Annotation[] = [...annotations];
      let added = false;
      for (const mh of mdHighlights) {
        if (existingAgentTexts.has(mh.text.toLowerCase())) continue;
        for (let pg = 1; pg <= numPages; pg++) {
          const rects = await findTextInPage(pg, mh.text);
          if (rects) {
            newAnnotations.push({ id: crypto.randomUUID(), page: pg, rects, text: mh.text, color: AGENT_COLOR, note: mh.note, source: "agent", created: new Date().toISOString() });
            added = true;
            break;
          }
        }
      }
      if (added) { setAnnotations(newAnnotations); fetch("/api/annotations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path: notePath, annotations: newAnnotations }) }).catch(() => {}); }
    }
    requestAnimationFrame(() => setTimeout(() => { for (let i = 1; i <= numPages; i++) void renderPage(i, annotations); void syncAgentHighlights(); }, 100));
  }, [numPages, annotations, renderPage, content, notePath, findTextInPage]);

  useEffect(() => {
    function handleMouseUp() {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !containerRef.current) return;
      const range = sel.getRangeAt(0);
      const startEl = range.startContainer instanceof Element ? range.startContainer : range.startContainer.parentElement;
      const pageEl = startEl?.closest?.("[id^='pdf-page-']");
      if (!pageEl) return;
      const pageNum = parseInt(pageEl.id.replace("pdf-page-", ""));
      const pageRect = pageEl.getBoundingClientRect();
      const rects: Annotation["rects"] = [];
      for (let i = 0; i < range.getClientRects().length; i++) {
        const r = range.getClientRects()[i];
        rects.push({ x: r.left - pageRect.left, y: r.top - pageRect.top, w: r.width, h: r.height });
      }
      if (!rects.length) return;
      setSelectedText(sel.toString());
      setPendingSelection({ page: pageNum, rects });
      setShowColorPicker({ x: range.getClientRects()[0].left, y: range.getClientRects()[0].top - 40 });
    }
    document.addEventListener("mouseup", handleMouseUp);
    return () => document.removeEventListener("mouseup", handleMouseUp);
  }, []);

  async function saveAnnotations(next: Annotation[]) {
    setAnnotations(next);
    await fetch("/api/annotations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path: notePath, annotations: next }) }).catch(() => {});
  }

  async function addHighlight(color: string) {
    if (!pendingSelection) return;
    await saveAnnotations([...annotations, { id: crypto.randomUUID(), ...pendingSelection, text: selectedText, color, source: "user" as const, created: new Date().toISOString() }]);
    setShowColorPicker(null); setSelectedText(""); setPendingSelection(null);
    window.getSelection()?.removeAllRanges();
  }

  async function removeHighlight(id: string) { await saveAnnotations(annotations.filter(a => a.id !== id)); }
  async function updateNote(id: string, note: string) { await saveAnnotations(annotations.map(a => a.id === id ? { ...a, note } : a)); }

  return (
    <div className="pdf-viewer-root">
      {showColorPicker && (
        <div className="color-picker" style={{ position: "fixed", left: showColorPicker.x, top: showColorPicker.y, zIndex: 100 }}>
          {COLORS.map(c => <button key={c} style={{ backgroundColor: c }} onClick={() => void addHighlight(c)} aria-label={`Highlight ${c}`} className="color-swatch" type="button" />)}
          <button onClick={() => { setShowColorPicker(null); window.getSelection()?.removeAllRanges(); }} aria-label="Cancel" type="button">✕</button>
        </div>
      )}
      <div ref={containerRef} className="pdf-container">
        {Array.from({ length: numPages }, (_, i) => (
          <div key={i + 1} id={`pdf-page-${i + 1}`} className="pdf-page-wrapper">
            <span className="pdf-page-num">{i + 1}</span>
          </div>
        ))}
        {!numPages && <p className="pdf-loading">Cargando PDF…</p>}
      </div>
      {annotations.length > 0 && (
        <aside className="pdf-annotations">
          <h3>Resaltados ({annotations.length})</h3>
          {annotations.map(a => (
            <div key={a.id} className="annotation-item" style={{ borderLeft: `4px solid ${a.source === "agent" ? AGENT_COLOR : a.color}` }}>
              {a.source === "agent" && <span className="annotation-source">Thunder</span>}
              <button className="annotation-delete" onClick={() => void removeHighlight(a.id)} aria-label={`Eliminar resaltado ${a.text.slice(0, 20)}`} type="button">✕</button>
              <p className="annotation-text">{a.text.slice(0, 120)}{a.text.length > 120 ? "…" : ""}</p>
              <textarea placeholder="Nota…" value={a.note || ""} onChange={e => void updateNote(a.id, e.target.value)} rows={2} />
              <span className="annotation-page">Página {a.page}</span>
            </div>
          ))}
        </aside>
      )}
    </div>
  );
}
