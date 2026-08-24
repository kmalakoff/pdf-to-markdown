// page-marker.ts — the single "### pN" convention: every producer/parser of
// the page-marker heading imports from here so the regex can't drift (report.ts once had a `\s+` variant).

/** The marker heading for page N, with no surrounding whitespace/newlines
 * (callers own their own blank-line formatting). */
export function pageMarkerLine(page: number): string {
  return `### p${page}`;
}

// Single space, matching pageMarkerLine's own output exactly.
const MARKER_RE = /^### p(\d+)$/;

/** Is this line (already split, no trailing newline) a page-marker heading? */
export function isPageMarkerLine(line: string): boolean {
  return MARKER_RE.test(line);
}

/** Split markdown into per-marker body slices, in document order — one entry
 * PER OCCURRENCE (a duplicate "### pN" yields two entries; no slice is ever dropped). */
export function splitByPageMarker(md: string): { page: number; body: string }[] {
  const re = /^### p(\d+)$/gm;
  const markers: { page: number; index: number; end: number }[] = [];
  for (let m = re.exec(md); m !== null; m = re.exec(md)) markers.push({ page: Number(m[1]), index: m.index, end: m.index + m[0].length });
  const out: { page: number; body: string }[] = [];
  for (let i = 0; i < markers.length; i++) {
    const end = i + 1 < markers.length ? markers[i + 1].index : md.length;
    out.push({ page: markers[i].page, body: md.slice(markers[i].end, end) });
  }
  return out;
}

/** Per-page body text, duplicate-marker slices CONCATENATED — a word anywhere
 * on page N counts as on page N (the auditor's membership semantics). */
export function bodyByPage(md: string): Map<number, string> {
  const out = new Map<number, string>();
  for (const { page, body } of splitByPageMarker(md)) out.set(page, (out.get(page) ?? '') + body);
  return out;
}

/** Count of "### pN" marker lines in `md`. */
export function countPageMarkers(md: string): number {
  return (md.match(/^### p\d+$/gm) || []).length;
}
