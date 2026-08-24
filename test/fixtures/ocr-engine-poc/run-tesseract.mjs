// run-tesseract.mjs — control candidate. tesseract.js over the same PNGs,
// dumping word-level results (text + pixel bbox) per page.
import { createWorker } from 'tesseract.js';
import { writeFileSync } from 'node:fs';
import path from 'node:path';

const pages = [
  ['original-p10', 'render/original-p10.png'],
  ['original-p27', 'render/original-p27.png'],
  ['original-p57', 'render/original-p57.png'],
  ['ocr-single-p1', 'render/ocr-single-p1.png'],
];

const t0 = Date.now();
const worker = await createWorker('eng');
const loadMs = Date.now() - t0;
console.error(`worker+model load: ${loadMs}ms`);

for (const [label, file] of pages) {
  const start = Date.now();
  const { data } = await worker.recognize(path.resolve(file), {}, { blocks: true });
  const ms = Date.now() - start;
  const words = [];
  for (const block of data.blocks ?? []) {
    for (const para of block.paragraphs ?? []) {
      for (const line of para.lines ?? []) {
        for (const w of line.words ?? []) {
          words.push({ text: w.text, confidence: w.confidence, bbox: w.bbox });
        }
      }
    }
  }
  writeFileSync(`out/tesseract-${label}.json`, JSON.stringify({ engine: 'tesseract', page: label, ms, wordCount: words.length, words }, null, 2));
  console.error(`${label}: ${ms}ms, ${words.length} words`);
}
await worker.terminate();
process.exit(0);
