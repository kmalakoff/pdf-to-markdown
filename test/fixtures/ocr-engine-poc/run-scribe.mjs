// run-scribe.mjs — run scribe.js-ocr over a set of PNGs, dump word-level results
// (text + pixel bbox) per page as JSON to out/scribe-<label>.json.
import scribe from 'scribe.js-ocr';
import { writeFileSync } from 'node:fs';
import path from 'node:path';

const pages = [
  ['original-p10', 'render/original-p10.png'],
  ['original-p27', 'render/original-p27.png'],
  ['original-p57', 'render/original-p57.png'],
  ['ocr-single-p1', 'render/ocr-single-p1.png'],
];

for (const [label, file] of pages) {
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
  await doc.close();
}
await scribe.terminate();
process.exit(0);
