// validate.ts — input-shape validation shared by analyze.ts and extract.ts,
// kept out of both to dodge their value-level import cycle (extract.ts imports analyze.ts's buildOcrAnalysisPages; both need this).
import { PdfToMdError } from './errors.ts';
import type { OcrWordInput } from './extract.ts';

/** Validates the one option every entry point accepts before touching the
 * PDF. Type-only import from `extract.ts` keeps this cycle-free. */
export function validatePages(pages: unknown): void {
  if (pages === undefined) return;
  const isRecord = typeof pages === 'object' && pages !== null;
  const first = isRecord ? (pages as Record<string, unknown>).first : undefined;
  const last = isRecord ? (pages as Record<string, unknown>).last : undefined;
  const firstOk = typeof first === 'number' && Number.isFinite(first) && first >= 1;
  const lastOk = last === undefined || (typeof last === 'number' && Number.isFinite(last) && last >= (first as number));
  if (!isRecord || !firstOk || !lastOk) {
    throw new PdfToMdError('PAGE_RANGE', `pages option must be { first: number, last?: number } with first >= 1 and last >= first (got ${JSON.stringify(pages)})`);
  }
}

/** Validates analyze()'s non-string `input` branch (`{ words }`) before
 * `.words` is read, so a plain-JS mistake like `analyze(null)` throws PdfToMdError/WORDS_INPUT instead of a raw TypeError. */
export function validateWordsInput(input: unknown): OcrWordInput[] {
  const isRecord = typeof input === 'object' && input !== null;
  const words = isRecord ? (input as Record<string, unknown>).words : undefined;
  if (!Array.isArray(words)) {
    throw new PdfToMdError('WORDS_INPUT', `analyze() input must be a pdf path (string) or { words: OcrWordInput[] } (got ${isRecord ? JSON.stringify(input) : String(input)})`);
  }
  return words as OcrWordInput[];
}

/** Runtime shape guard for `buildOcrAnalysisPages`'s input: a plain-JS
 * caller bypasses the TS union, so this turns a raw TypeError into PdfToMdError before any property is read off it. */
export function validateOcrAnalysisInput(input: unknown): { pdfPath: string } | { words: OcrWordInput[] } {
  if (typeof input === 'string') {
    throw new PdfToMdError('PDF_OPEN', `extractOcr/analyze input must be { pdfPath: string } or { words: OcrWordInput[] }, not a bare path string (got ${JSON.stringify(input)}) — did you mean { pdfPath: ${JSON.stringify(input)} }?`);
  }
  const isRecord = typeof input === 'object' && input !== null;
  const rawPdfPath = isRecord ? (input as Record<string, unknown>).pdfPath : undefined;
  const rawWords = isRecord ? (input as Record<string, unknown>).words : undefined;
  if (!isRecord || (rawPdfPath === undefined && rawWords === undefined)) {
    throw new PdfToMdError('WORDS_INPUT', `extractOcr/analyze input must be { pdfPath: string } or { words: OcrWordInput[] } (got ${isRecord ? JSON.stringify(input) : String(input)})`);
  }
  if (rawWords !== undefined && !Array.isArray(rawWords)) {
    throw new PdfToMdError('WORDS_INPUT', `extractOcr/analyze { words } input must be an array (got ${JSON.stringify(rawWords)})`);
  }
  if (rawPdfPath !== undefined && typeof rawPdfPath !== 'string') {
    throw new PdfToMdError('PDF_OPEN', `extractOcr/analyze { pdfPath } input must be a string (got ${JSON.stringify(rawPdfPath)})`);
  }
  if (rawWords !== undefined) {
    for (const w of rawWords as unknown[]) {
      const rec = w as Record<string, unknown>;
      if (typeof rec.page !== 'number' || typeof rec.text !== 'string' || typeof rec.x !== 'number' || typeof rec.y !== 'number' || typeof rec.w !== 'number' || typeof rec.h !== 'number') {
        throw new PdfToMdError('WORDS_INPUT', `malformed word entry (need {page, text, x, y, w, h}): ${JSON.stringify(w)}`);
      }
    }
    return { words: rawWords as OcrWordInput[] };
  }
  return { pdfPath: rawPdfPath as string };
}
