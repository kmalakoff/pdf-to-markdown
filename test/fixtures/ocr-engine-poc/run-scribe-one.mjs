// run-scribe-one.mjs — run scribe.js-ocr on ONE page, single process.
// Split out of run-scribe.mjs because running multiple pages in the same
// process crashed with a native Skia assertion (SkRefCnt fRefCnt==1) after
// the first successful page — recorded as a runtime gotcha; one process per
// page sidesteps it for the POC.
import scribe from 'scribe.js-ocr';
import { writeFileSync } from 'node:fs';
import path from 'node:path';

const [, , label, file] = process.argv;
if (!label || !file) {
  console.error('usage: node run-scribe-one.mjs <label> <file.png>');
  process.exit(1);
}

const t0 = Date.now();
const doc = await scribe.openDocument([path.resolve(file)]);
const openMs = Date.now() - t0;
const t1 = Date.now();
const ocrPages = await doc.recognize({ langs: ['eng'] });
const ms = Date.now() - t1;
const page = ocrPages[0];
const words = [];
for (const line of page.lines) {
  for (const w of line.words) {
    words.push({ text: w.text, conf: w.conf, bbox: w.bbox });
  }
}
writeFileSync(`out/scribe-${label}.json`, JSON.stringify({ engine: 'scribe', page: label, openMs, ms, wordCount: words.length, words }, null, 2));
console.error(`${label}: open=${openMs}ms recognize=${ms}ms, ${words.length} words`);
process.exit(0);
