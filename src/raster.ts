// Renders PDF pages to PNG with pdfjs-dist + @napi-rs/canvas. Shared by the
// `render` CLI command (human/vision-model page verification) and src/engines/tesseract.ts (OCR page images).

import { createCanvas } from '@napi-rs/canvas';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { PdfToMdError } from './errors.ts';
import { awaitPdfOpen, openPdfForRender } from './pdf-open.ts';

// pdfjs-dist doesn't export RenderParameters from the package root; derive
// it from PDFPageProxy['render'] rather than hand-declaring a shape that could drift.
type RenderParams = Parameters<PDFPageProxy['render']>[0];

// No CanvasFactory shim needed: pdfjs-dist detects `@napi-rs/canvas` itself
// and uses it internally (patterns, SMasks, Type3 glyphs); we only hand it a `canvasContext` for the page itself, created directly below.

export { openPdfForRender } from './pdf-open.ts';

/** One rendered page, from renderPageToPNG (or the `pdf-to-md render` CLI
 * command it backs). */
export interface RenderPageResult {
  /** the rendered page, PNG-encoded */
  png: Buffer;
  /** pixel width at the requested dpi */
  width: number;
  /** pixel height at the requested dpi */
  height: number;
  /** the page's own /Rotate entry, baked into `png`/`width`/`height` already
   * — informational, not something a caller needs to apply again */
  rotation: number;
}

/** Render one already-open document's page to a PNG buffer at the given DPI. */
export async function renderLoadedPage(doc: PDFDocumentProxy, pageNum: number, dpi: number): Promise<RenderPageResult> {
  if (!(pageNum >= 1) || pageNum > doc.numPages) {
    throw new PdfToMdError('PAGE_RANGE', `page ${pageNum} is outside this document (1-${doc.numPages})`);
  }
  const page = await doc.getPage(pageNum);

  // getViewport({scale}) bakes in the page's own /Rotate entry AND its
  // mediaBox origin automatically — no manual origin translate needed on top of it.
  const scale = dpi / 72;
  const viewport = page.getViewport({ scale });
  const width = Math.round(viewport.width);
  const height = Math.round(viewport.height);
  if (width <= 0 || height <= 0) throw new PdfToMdError('PAGE_RENDER', `page ${pageNum} has non-positive dimensions ${width}x${height}`);

  const canvas = createCanvas(width, height);
  const context = canvas.getContext('2d');

  // Paint white first: an unpainted @napi-rs/canvas context is transparent,
  // which would encode as black/checkered rather than a white page.
  context.fillStyle = 'white';
  context.fillRect(0, 0, width, height);

  // pdfjs's RenderParameters types canvas/context against DOM types;
  // @napi-rs/canvas's are API-compatible at runtime but not that DOM type — the interop boundary the "no any" rule allows a cast for.
  const renderTask = page.render({
    canvas: canvas as unknown as RenderParams['canvas'],
    canvasContext: context as unknown as RenderParams['canvasContext'],
    viewport,
  });
  await renderTask.promise;

  const png = await canvas.encode('png');
  return { png, width, height, rotation: viewport.rotation };
}

/**
 * Render one page of a PDF to a PNG buffer at the given DPI. Opens and
 * closes the document itself — for more than one page from the same PDF, use `openPdfForRender` + `renderLoadedPage` instead.
 *
 * @param pdfPath path to the PDF file
 * @param pageNum 1-based page number
 * @param dpi PDF user space is 72 units/inch, so scale = dpi / 72
 */
export async function renderPageToPNG(pdfPath: string, pageNum: number, dpi: number): Promise<RenderPageResult> {
  const loadingTask = openPdfForRender(pdfPath);
  try {
    const doc = await awaitPdfOpen(loadingTask, pdfPath);
    return await renderLoadedPage(doc, pageNum, dpi);
  } finally {
    await loadingTask.destroy();
  }
}
