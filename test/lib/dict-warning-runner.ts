// dict-warning-runner.ts — run as its own child process by
// dict-warning.test.ts, so PDF_TO_MD_DICT_PATH is set before src/dict.ts's module-level DICT_PATH is read, isolated from other test files' module caches.
import { analyze } from '../../src/analyze.ts';
import { extractOcr, extractText } from '../../src/extract.ts';

const [, , mode, pdfPath] = process.argv;
if (mode === 'analyze-text' || mode === 'analyze-ocr') {
  const warnings: string[] = [];
  const opts = { onWarning: (m: string) => warnings.push(m) };
  await (mode === 'analyze-ocr' ? analyze(pdfPath, { ...opts, path: 'ocr' }) : analyze(pdfPath, opts));
  process.stdout.write(JSON.stringify({ markdown: '', warnings }));
} else {
  const result = mode === 'ocr' ? await extractOcr({ pdfPath }) : await extractText(pdfPath);
  process.stdout.write(JSON.stringify({ markdown: result.markdown, warnings: result.warnings }));
}
