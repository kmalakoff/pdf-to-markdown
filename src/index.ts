// Public library API. Deliberately small: every export is a stability
// promise; internals stay module-private behind these.

export type { AnalyzeOcrOptions, AnalyzeOptions, AnalyzeTextOptions } from './analyze.ts';
export { analyze } from './analyze.ts';
export type { AuditResult } from './audit.ts';
export { auditWords } from './audit.ts';
export type { PdfToMdErrorCode } from './errors.ts';
export { PdfToMdError } from './errors.ts';
export type {
  ExtractOcrOptions,
  ExtractResult,
  ExtractTextOptions,
  OcrProgressEvent,
  OcrWordInput,
  PageSelection,
  PdfToMarkdownOptions,
} from './extract.ts';
export { extractOcr, extractText, pdfToMarkdown } from './extract.ts';
export type { PageWord, Tuning } from './geometry.ts';
export { DEFAULT_TUNING } from './geometry.ts';
export type { RenderPageResult } from './raster.ts';
export { renderPageToPNG } from './raster.ts';
export { toMarkdown, toText } from './render-analysis.ts';
export { OUTPUT_VERSION } from './report.ts';
export type { Analysis, AnalysisBlock, AnalysisPage, AnalysisWord, PageStatsRow, Report } from './types.ts';
