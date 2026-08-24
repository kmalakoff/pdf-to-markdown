// Pass 1: load the PDF and collect positioned glyphs per page, plus the
// document-wide char-weighted font-height histogram. Heights round to 0.1pt for stable histogram keys; y is flipped so sorting ascending reads top-down.
import type { PDFPageProxy } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { OPS } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { openDocument } from './pdf-open.ts';
import type { CollectedPage, CollectResult, Glyph } from './types.ts';

// HYBRID-PAGE DETECTION (README's "Design contract"): a page can carry a
// real text layer AND a separately-painted large image with its OWN baked-in text that `page.getTextContent()` never sees.
//
// Signal: scan the operator list for `OPS.paintImageXObject`, whose args are
// `[objId, width, height]` — available synchronously, `large` is >=200x200px. Masks/nested Form XObjects aren't walked (accepted gap); missing dims fall back to "op present" as the signal.
const LARGE_IMAGE_MIN_PX = 200;
async function hasLargeImage(page: PDFPageProxy): Promise<boolean> {
  const { fnArray, argsArray } = await page.getOperatorList();
  for (let i = 0; i < fnArray.length; i++) {
    if (fnArray[i] !== OPS.paintImageXObject) continue;
    const [, w, h] = argsArray[i];
    if (typeof w === 'number' && typeof h === 'number') {
      if (w >= LARGE_IMAGE_MIN_PX && h >= LARGE_IMAGE_MIN_PX) return true;
    } else return true; // dims unavailable: coarser "op present" signal
  }
  return false;
}

// { first, last }: 1-based, inclusive page range (the CLI's --pages).
// Out-of-range values CLAMP to the document's bounds; `page` on each returned entry is always the SOURCE page number, so markers/splicing stay correct.
//
// CAVEAT: `heightChars` is built ONLY from the pages actually collected, so
// a `--pages` subset's heading levels can differ from a full run's — accepted since re-extracted pages get spliced back in for their prose, not diffed.

// Cheap page-count-only load (no per-page text extraction) — the OCR path
// needs it to resolve its own [first, last] clamping and print a "### pN" marker for every page in range, including ones with no recognized words.
export async function pageCount(src: string): Promise<number> {
  const doc = await openDocument(src);
  return doc.numPages;
}

export async function collect(src: string, { first, last }: { first?: number; last?: number } = {}): Promise<CollectResult> {
  const doc = await openDocument(src);
  const from = Math.min(Math.max(1, first ?? 1), Math.max(1, doc.numPages));
  const to = Math.min(Math.max(from, last ?? doc.numPages), doc.numPages);
  const pages: CollectedPage[] = [];
  const heightChars = new Map<number, number>();
  for (let p = from; p <= to; p++) {
    const page = await doc.getPage(p);
    const { items } = await page.getTextContent();
    const vp = page.getViewport({ scale: 1 });
    const glyphs: Glyph[] = [];
    let textChars = 0;
    for (const it of items) {
      if (!('str' in it) || typeof it.str !== 'string') continue;
      textChars += it.str.length;
      if (!it.str.trim()) continue;
      const h = Math.round(Math.abs(it.transform[3]) * 10) / 10;
      glyphs.push({
        s: it.str,
        x: it.transform[4],
        y: vp.height - it.transform[5],
        w: it.width,
        h,
      });
      heightChars.set(h, (heightChars.get(h) || 0) + it.str.length);
    }
    // "text layer used" for hybrid-page purposes (page text > 80 chars) — a
    // page with only a couple of stray scraps isn't "using" the text layer even if it also carries a large image.
    const largeImage = textChars > 80 && (await hasLargeImage(page));
    pages.push({
      page: p,
      glyphs,
      width: vp.width,
      height: vp.height,
      textChars,
      largeImage,
    });
  }
  // `numPages` is the SELECTED count, not doc.numPages: the auto-OCR
  // chars/page floor must judge a `--pages` subset against its own page count, or a genuinely image-only page reads as merely "sparse".
  return { numPages: pages.length, pages, heightChars };
}
