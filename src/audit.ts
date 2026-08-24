// audit.ts — the severity-1 audit instrument (README's "Design contract"),
// shipped as part of the product, not just a path into the source tree.
//
// Every recognized word (a --debug-words dump, or an Analysis page's
// `words`) must appear in its page's markdown — normalized, compared as a per-page multiset, with substring repair for hyphen joins.
//
// NOTE: no producer guarantees JSON key order in a --debug-words dump —
// parse, never grep.
import { readFileSync } from 'node:fs';
import { bodyByPage } from './page-marker.ts';

function norm(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function counter(items: Iterable<string>): Map<string, number> {
  const m = new Map<string, number>();
  for (const item of items) m.set(item, (m.get(item) ?? 0) + 1);
  return m;
}

/** auditWords()'s result — the severity-1 no-silent-loss check. */
export interface AuditResult {
  /** JSON lines successfully parsed from the word dump */
  parsed: number;
  /** lines in the dump that were not parseable JSON, skipped rather than
   * failing the whole audit (same policy `--words-json` itself uses) */
  nonJsonSkipped: number;
  /** distinct page numbers present in the dump */
  pages: number;
  /** total recognized words across all pages in the dump */
  words: number;
  /** words present in the dump but not found verbatim on their page, BEFORE
   * hyphen-join/split repair is applied; always `>= missing` */
  strictDeficits: number;
  /** words genuinely absent from the markdown after repair-checking; `0` is
   * the only passing value (`pdf-to-md audit` exits 1 otherwise) */
  missing: number;
  /** per-page detail for every page with at least one missing word (capped
   * sample of the missing tokens per page) */
  perPage: { page: number; missing: string[] }[];
  /** the one-line `parsed=… pages=… words=… strict_deficits=… MISSING=…`
   * summary, also the last entry of `lines` */
  summaryLine: string;
  /** every line `pdf-to-md audit` prints, in order: one per page with
   * missing words, then `summaryLine` */
  lines: string[];
}

/**
 * Audit a --debug-words dump against a markdown file: every recognized word
 * must land somewhere in its page's markdown. `result.missing === 0` is the pass/fail signal.
 *
 * @param wordsPath path to a --debug-words JSON-lines dump (`{page, text, ...}` per line)
 * @param mdPath path to the markdown file to check the dump against
 */
export function auditWords(wordsPath: string, mdPath: string): AuditResult {
  const rec = new Map<number, string[]>();
  let parsed = 0;
  let skipped = 0;

  const wordsRaw = readFileSync(wordsPath, 'utf8');
  // A trailing "\n" at EOF must not yield a spurious final empty line; a
  // genuine blank line mid-file does count, as skipped.
  const rawLines = wordsRaw.split('\n');
  if (rawLines.length > 0 && rawLines[rawLines.length - 1] === '') rawLines.pop();
  for (let line of rawLines) {
    line = line.trim();
    if (!line.startsWith('{')) {
      skipped++;
      continue;
    }
    let o: { page: number; text: string };
    try {
      o = JSON.parse(line);
    } catch {
      skipped++;
      continue;
    }
    parsed++;
    const t = norm(o.text);
    if (t) {
      const arr = rec.get(o.page);
      if (arr) arr.push(t);
      else rec.set(o.page, [t]);
    }
  }

  const md = readFileSync(mdPath, 'utf8');
  const out = bodyByPage(md);

  const lines: string[] = [];
  let total = 0;
  let strict = 0;
  const perPage: { page: number; missing: string[] }[] = [];
  const pages = [...rec.keys()].sort((a, b) => a - b);

  for (const page of pages) {
    const toks = (out.get(page)?.match(/\S+/g) ?? []).map(norm).filter((t) => t.length > 0);
    const ms = counter(toks);
    const joined = toks.join('');
    const missing: string[] = [];
    for (const [tok, n] of counter(rec.get(page) ?? [])) {
      const d = n - (ms.get(tok) ?? 0);
      if (d <= 0) continue;
      strict += d;
      if (joined.includes(tok)) continue; // hyphen-join / split repair
      for (let i = 0; i < d; i++) missing.push(tok);
    }
    if (missing.length > 0) {
      total += missing.length;
      perPage.push({ page, missing });
      lines.push(`p${page}: MISSING ${missing.length}: ${pyRepr(missing.slice(0, 12))}`);
    }
  }

  const words = pages.reduce((sum, p) => sum + (rec.get(p)?.length ?? 0), 0);
  const summaryLine = `parsed=${parsed} non-json-skipped=${skipped} pages=${rec.size} words=${words} strict_deficits=${strict} MISSING=${total}`;
  lines.push(summaryLine);

  return {
    parsed,
    nonJsonSkipped: skipped,
    pages: rec.size,
    words,
    strictDeficits: strict,
    missing: total,
    perPage,
    summaryLine,
    lines,
  };
}

// Renders a string list as ['a', 'b'] (single-quoted) to match frozen baseline comparisons byte-for-byte.
function pyRepr(items: string[]): string {
  return `[${items.map((s) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`).join(', ')}]`;
}
