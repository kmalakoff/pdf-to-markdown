// The library layer for PDF -> markdown conversion: extractText/extractOcr/
// pdfToMarkdown each take plain args, return plain data, and throw PdfToMdError — no process.exit, no console.*, no file writing.
//
// Warnings are DATA: every notice is returned in `warnings` verbatim and also
// delivered incrementally via `onWarning` — the exact strings are load-bearing (the test suite asserts them).
import { buildOcrAnalysisPages } from './analyze.ts';
import { collect } from './collect.ts';
import { dictAvailable, dictUnavailableWarning } from './dict.ts';
import type { OcrProgressEvent } from './engines/tesseract.ts';
import type { PageWord, Tuning } from './geometry.ts';
import { toLines } from './lines.ts';
import { buildMarkdown } from './markdown.ts';
import { renderPagesToMarkdown } from './render-analysis.ts';
import { AUTO_OCR_CHARS_PER_PAGE, buildOcrReport, buildReport } from './report.ts';
import type { PageLines, Report } from './types.ts';
import { validatePages } from './validate.ts';

export type { OcrProgressEvent } from './engines/tesseract.ts';

// A plain-JS caller (or `.ts` with `as any`) gets no compile-time check on
// `pages`, so it's validated once at runtime — see src/validate.ts's `validatePages`.

/** One recognized word with its page — the OCR replay input contract (same
 * shape as `geometry.ts`'s `PageWord`, re-exported under this module's public name). */
export type OcrWordInput = PageWord;

/** A 1-based, inclusive page range — the shape every entry point's `pages`
 * option takes (the CLI's own `--pages N[-M]` parses into this). */
export interface PageSelection {
  first: number;
  /** inclusive; defaults to `first` */
  last?: number;
}

/** extractText/extractOcr/pdfToMarkdown's common return shape. */
export interface ExtractResult {
  markdown: string;
  /** per-document and per-page QA metrics — see `Report` (`src/types.ts`) */
  report: Report;
  /** every notice also delivered incrementally via `onWarning`, collected
   * here in full (hybrid pages, auto-OCR-fallback, empty OCR pages, sparse-retry) */
  warnings: string[];
}

interface CommonOptions {
  /** convert only this page range (1-based, inclusive); defaults to the
   * whole document */
  pages?: PageSelection;
  /** delivered as each warning happens (also returned, in full, as
   * `warnings` on the resolved result) */
  onWarning?: (message: string) => void;
}

/** Options for {@link extractText}. */
export interface ExtractTextOptions extends CommonOptions {
  /** emit a `### pN` marker before each page's content (output formatting
   * only — `report.pageStats` is always populated regardless) */
  pageMarkers?: boolean;
}

/** Options for {@link extractOcr}. */
export interface ExtractOcrOptions extends CommonOptions {
  /** override any subset of the OCR-path geometry defaults — see
   * DEFAULT_TUNING (`src/geometry.ts`) for each knob's measured default */
  tuning?: Partial<Tuning>;
  /** page-render resolution for engine recognition (default 288, measured;
   * >~400 measured WORSE on ordinary pages — not a "bigger is safer" knob) */
  dpi?: number;
  /** marks report.ocrFallback — set by pdfToMarkdown's auto-fallback */
  fallback?: boolean;
  /** one event per page as recognition finishes (timing/count only — engine
   * chatter and the sparse-retry notice arrive via `onWarning` instead) */
  onProgress?: (e: OcrProgressEvent) => void;
  /** every recognized word entering the geometry, delivered once after
   * recognition — the severity-1 audit instrument (--debug-words) */
  onWords?: (words: OcrWordInput[]) => void;
}

/** Options for {@link pdfToMarkdown}. */
export interface PdfToMarkdownOptions extends ExtractTextOptions, Omit<ExtractOcrOptions, 'fallback'> {
  /** force the OCR path even when a text layer exists */
  ocr?: boolean;
  /** never fall back to OCR, even for image-only pages */
  noOcr?: boolean;
}

/**
 * Text-layer extraction. Returns markdown + QA report + warnings (hybrid
 * pages carrying large images whose baked-in text the text layer can never see). Makes no OCR decision — see pdfToMarkdown for the fallback.
 *
 * @param pdfPath path to the PDF file
 * @param opts see {@link ExtractTextOptions}
 */
// One collector per entry point: collects into `warnings`, streams via
// onWarning, and emits the dictionary-unavailable notice exactly once up front.
function warnCollector(onWarning?: (message: string) => void): { warnings: string[]; warn: (m: string) => void } {
  const warnings: string[] = [];
  const warn = (m: string) => {
    warnings.push(m);
    onWarning?.(m);
  };
  if (!dictAvailable()) warn(dictUnavailableWarning());
  return { warnings, warn };
}

export async function extractText(pdfPath: string, opts: ExtractTextOptions = {}): Promise<ExtractResult> {
  validatePages(opts.pages);
  const { warnings, warn } = warnCollector(opts.onWarning);

  const range = opts.pages ? { first: opts.pages.first, last: opts.pages.last ?? opts.pages.first } : {};
  const { numPages, pages, heightChars } = await collect(pdfPath, range);
  const pageLines: PageLines[] = pages.map((p) => ({
    page: p.page,
    lines: toLines(p),
  }));
  const pageMarkers = opts.pageMarkers ?? false;
  const { md, stats, bodyH, headingSizes } = buildMarkdown(pageLines, heightChars, { pageMarkers });
  // pageStats needs "### pN" markers to segment content; when the caller
  // didn't request them, build a throwaway marked variant (same heightChars) purely to measure stats from, so pageStats is always populated.
  const statsMd = pageMarkers ? md : buildMarkdown(pageLines, heightChars, { pageMarkers: true }).md;

  // Advisory, not prescriptive: `hasLargeImage` fires on any large image,
  // even one with no baked-in text, where `--ocr` recovers nothing and can
  // actively degrade a correct result (measured: "I" -> "|", stray em-dashes) — so this tells the caller to COMPARE the OCR rerun, never blindly replace.
  const hybridPages = pages.filter((p) => p.largeImage).map((p) => p.page);
  for (const n of hybridPages) {
    warn(`p${n}: text layer used but page carries large image(s); if it has baked-in text this output won't have it — compare (don't blindly replace) against --pages ${n} --ocr, which can itself introduce errors`);
  }

  const report = buildReport({
    numPages,
    md,
    statsMd,
    stats,
    bodyH,
    headingSizes,
    hybridPages,
  });
  return { markdown: md, report, warnings };
}

/**
 * OCR extraction. Input is either a PDF (pages render at `dpi` and the
 * engine recognizes them, imported lazily) or an already-recognized word dump (the offline replay input — see `--words-json`).
 *
 * @param input `{ pdfPath }` to recognize, or `{ words }` to replay a dump
 * @param opts see {@link ExtractOcrOptions}
 */
export async function extractOcr(input: { pdfPath: string } | { words: OcrWordInput[] }, opts: ExtractOcrOptions = {}): Promise<ExtractResult> {
  validatePages(opts.pages);
  const { warnings, warn } = warnCollector(opts.onWarning);

  // Shared with analyze(pdf, {path:'ocr'}) — see that module's header for
  // why this makes the two byte-identical by construction, not by hand.
  const { pages, words } = await buildOcrAnalysisPages(input, opts, warn);
  const md = renderPagesToMarkdown(pages, { forcePageMarkers: true, pageMarkers: true });

  const report = buildOcrReport({
    md,
    fallback: opts.fallback,
    // Confidence is on `words` — see report.ts's low-confidence detector for
    // how it handles a confidence-less replay honestly.
    words,
  });
  return { markdown: md, report, warnings };
}

/** pdfToMarkdown's auto-OCR fallback predicate, shared with the CLI's
 * --format=raw|txt path so the two call sites can never drift apart. Module-internal: not re-exported by `src/index.ts`. */
export function needsOcrFallback(charsPerPage: number): boolean {
  return charsPerPage < AUTO_OCR_CHARS_PER_PAGE;
}

/** The exact stderr/warnings notice printed when needsOcrFallback fires —
 * one copy of the string for both call sites (asserted verbatim by the suite). */
export function ocrFallbackNotice(charsPerPage: number): string {
  return `text layer yields ~${charsPerPage} chars/page (< ${AUTO_OCR_CHARS_PER_PAGE}) — pages are images of text; falling back to OCR (suppress with --no-ocr)`;
}

/**
 * The headline API: extract a PDF to markdown, text layer first, falling
 * back to OCR when the text layer is empty enough the pages are certainly images of text (< `AUTO_OCR_CHARS_PER_PAGE` chars/page) — the same decision the CLI makes.
 *
 * @param pdfPath path to the PDF file
 * @param opts see {@link PdfToMarkdownOptions}
 */
export async function pdfToMarkdown(pdfPath: string, opts: PdfToMarkdownOptions = {}): Promise<ExtractResult> {
  if (opts.ocr) return extractOcr({ pdfPath }, opts);

  // Warning DELIVERY is deferred on the text pass: if the fallback fires,
  // those hybrid warnings describe output being discarded, so only a kept text result replays them.
  const text = await extractText(pdfPath, { ...opts, onWarning: undefined });
  if (needsOcrFallback(text.report.charsPerPage) && !opts.noOcr) {
    const notice = ocrFallbackNotice(text.report.charsPerPage);
    opts.onWarning?.(notice);
    const ocr = await extractOcr({ pdfPath }, { ...opts, fallback: true });
    ocr.warnings.unshift(notice);
    return ocr;
  }
  for (const w of text.warnings) opts.onWarning?.(w);
  return text;
}
