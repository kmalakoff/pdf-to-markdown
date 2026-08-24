// analyze.mjs — compute word-overlap metrics (engine vs Vision baseline) per page.
// Normalization: lowercase, strip punctuation (keep alphanumerics), split on whitespace.
import { readFileSync, existsSync } from 'node:fs';

function norm(text) {
  return text
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter((w) => w.length > 0);
}

function multiset(words) {
  const m = new Map();
  for (const w of words) m.set(w, (m.get(w) || 0) + 1);
  return m;
}

function overlapStats(baseWords, engWords) {
  const base = multiset(baseWords);
  const eng = multiset(engWords);
  let matched = 0;
  const baseTotal = baseWords.length;
  const engTotal = engWords.length;
  const baseRemaining = new Map(base);
  for (const [w, c] of eng) {
    const avail = baseRemaining.get(w) || 0;
    const use = Math.min(avail, c);
    matched += use;
    if (avail > 0) baseRemaining.set(w, avail - use);
  }
  const engOnly = engTotal - matched;
  return {
    baseTotal,
    engTotal,
    matched,
    overlapPct: baseTotal ? (100 * matched) / baseTotal : 0,
    engOnlyCount: engOnly,
    engOnlyPct: engTotal ? (100 * engOnly) / engTotal : 0,
  };
}

const pages = ['original-p10', 'original-p27', 'original-p57', 'ocr-single-p1'];

// Load Vision baseline (image-fed) per page.
function loadVisionWords(page) {
  const file = `vision/${page}-imgvision.jsonl`;
  const lines = readFileSync(file, 'utf8').trim().split('\n').filter(Boolean);
  const words = lines.map((l) => JSON.parse(l).text);
  return words;
}

function loadGutenye(page) {
  const file = `out/gutenye-${page}.json`;
  if (!existsSync(file)) return null;
  const d = JSON.parse(readFileSync(file, 'utf8'));
  const words = d.lines.flatMap((l) => norm(l.text));
  return { words, ms: d.ms };
}

function loadScribe(page) {
  const file = `out/scribe-${page}.json`;
  if (!existsSync(file)) return null;
  const d = JSON.parse(readFileSync(file, 'utf8'));
  const words = d.words.flatMap((w) => norm(w.text));
  return { words, ms: d.ms };
}

function loadTesseract(page) {
  const file = `out/tesseract-${page}.json`;
  if (!existsSync(file)) return null;
  const d = JSON.parse(readFileSync(file, 'utf8'));
  const words = d.words.flatMap((w) => norm(w.text));
  return { words, ms: d.ms };
}

const engines = {
  gutenye: loadGutenye,
  scribe: loadScribe,
  tesseract: loadTesseract,
};

const results = {};
for (const page of pages) {
  const baseRaw = loadVisionWords(page);
  const baseWords = baseRaw.flatMap(norm);
  results[page] = { baseWordCount: baseWords.length };
  for (const [name, loader] of Object.entries(engines)) {
    const data = loader(page);
    if (!data) {
      results[page][name] = null;
      continue;
    }
    const stats = overlapStats(baseWords, data.words);
    results[page][name] = { ...stats, ms: data.ms };
  }
}

console.log(JSON.stringify(results, null, 2));
