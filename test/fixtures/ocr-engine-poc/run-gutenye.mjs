// run-gutenye.mjs — run @gutenye/ocr-node over a set of PNGs, dump line-level
// results (text + frame) per page as JSON to out/gutenye-<label>.json.
import Ocr from '@gutenye/ocr-node';
import { writeFileSync } from 'node:fs';
import path from 'node:path';

const pages = [
  ['original-p10', 'render/original-p10.png'],
  ['original-p27', 'render/original-p27.png'],
  ['original-p57', 'render/original-p57.png'],
  ['ocr-single-p1', 'render/ocr-single-p1.png'],
];

const t0 = Date.now();
const ocr = await Ocr.create();
const loadMs = Date.now() - t0;
console.error(`model load: ${loadMs}ms`);

for (const [label, file] of pages) {
  const start = Date.now();
  const result = await ocr.detect(path.resolve(file));
  const ms = Date.now() - start;
  // NOTE: README documents `{ text, score, frame:{top,left,width,height} }` but the
  // installed 1.4.8 build actually returns `{ text, mean, box }` where `box` is a
  // 4-point pixel-coordinate quad [[x,y]x4] (line-level, not word-level) and `mean`
  // is the confidence. Docs/runtime mismatch — recorded as an install gotcha.
  const lines = result.map((l) => ({ text: l.text, mean: l.mean, box: l.box }));
  writeFileSync(`out/gutenye-${label}.json`, JSON.stringify({ engine: 'gutenye', page: label, ms, lines }, null, 2));
  console.error(`${label}: ${ms}ms, ${lines.length} lines`);
}
process.exit(0);
