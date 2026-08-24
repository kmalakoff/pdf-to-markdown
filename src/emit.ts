// emit.ts — OCR-path pass 3: lines -> markdown blocks.
import { getDict } from './dict.ts';
import type { OcrLine, PageOCR, Tuning, Word } from './geometry.ts';
import { bucket } from './geometry.ts';

// Join a wrapped line onto the open paragraph, closing a line-final hyphen
// only when the dictionary confirms the joined form is a word.
function hyphenJoin(acc: string, next: string): string {
  if (acc.endsWith('-')) {
    const withoutDash = acc.slice(0, -1);
    const pen = withoutDash.at(-1);
    if (pen && /[A-Za-z0-9]/.test(pen)) {
      const head = withoutDash.split(' ').pop() ?? '';
      const firstTok = next.split(' ')[0] ?? '';
      const filtered = [...firstTok].filter((c) => /[A-Za-z-]/.test(c)).join('');
      const tail = filtered.split('-')[0] ?? '';
      const close = getDict().has((head + tail).toLowerCase());
      return (close ? withoutDash : acc) + next;
    }
  }
  return `${acc} ${next}`;
}

// Blocks with too few word-like tokens to trust as prose (see
// UNSTRUCTURED_WORDLIKE_FRACTION below) are labeled `> [review: reason] text` instead of guessed at.
const REVIEW_REASON = {
  unstructuredLabels: 'unstructured labels',
} as const;

/** Share of word-like tokens (3+ letter run) below which a block counts as
 * unstructured. Measured (`review-blocks.test.ts`): junk 0.000-0.100 vs prose 0.743-0.857, cut 0.4. */
export const UNSTRUCTURED_WORDLIKE_FRACTION = 0.4;
function isUnstructured(text: string): boolean {
  const tokens = text.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return false; // never mark an empty block
  const wordLike = tokens.filter((t) => /[A-Za-z]{3}/.test(t)).length;
  return wordLike / tokens.length < UNSTRUCTURED_WORDLIKE_FRACTION;
}

function reviewLine(reason: string, text: string): string {
  return `> [review: ${reason}] ${text}`;
}

// One classified block, carrying constituent words for analyze()'s
// block->word linkage; discriminated on `kind` so `reason`/`level` are compile-time guaranteed present on their variants.
export type EmitBlock =
  | { kind: 'heading'; text: string; level: number; words: Word[] }
  | { kind: 'paragraph'; text: string; words: Word[] }
  | { kind: 'quote'; text: string; words: Word[] }
  | {
      kind: 'review';
      text: string;
      /** The parseable reason inside `> [review: ...]`, carried on the block
       * so more reasons can be added without changing the render format. */
      reason: string;
      words: Word[];
    };

// Renders one EmitBlock to the exact markdown emitPage used to push
// directly — shared so extract.ts and analyze.ts produce byte-identical text.
export function renderEmitBlock(b: EmitBlock): string {
  switch (b.kind) {
    case 'heading':
      return `${'#'.repeat(b.level)} ${b.text}`;
    case 'quote':
      return `> ${b.text}`;
    case 'review':
      return reviewLine(b.reason, b.text);
    default:
      return b.text;
  }
}

export function emitPage(p: PageOCR, levelOf: Map<number, number>, tuning: Tuning): EmitBlock[] {
  const blocks: EmitBlock[] = [];
  let para: OcrLine[] = [];
  const flush = () => {
    if (!para.length) return;
    const texts = para.map((l) => l.text);
    const merged = texts.slice(1).reduce(hyphenJoin, texts[0]);
    const words = para.flatMap((l) => l.words);
    // Same review-marker rule as the heading path below: no word may be
    // dropped or reordered here, only how the block renders changes.
    blocks.push(isUnstructured(merged) ? { kind: 'review', text: merged, reason: REVIEW_REASON.unstructuredLabels, words } : { kind: 'paragraph', text: merged, words });
    para = [];
  };

  let i = 0;
  while (i < p.lines.length) {
    const line: OcrLine = p.lines[i];
    const prev = i > 0 ? p.lines[i - 1] : null;
    if (prev && (line.col !== prev.col || prev.midY - line.midY > p.pitch * tuning.paraGap)) {
      // Join across a column break (instead of flushing) only when the column
      // changed, the paragraph dangles (no terminal punct), and the new text starts lowercase; a miss stays visible via pageStats.danglingLong.
      const danglingEnd = para.length > 0 && !/[.!?:;"'”’)\]]$/.test(para[para.length - 1].text);
      const continuationStart = /^[a-z]/.test(line.text);
      const joinAcrossColumns = line.col !== prev.col && danglingEnd && continuationStart && !levelOf.has(bucket(line.h));
      if (!joinAcrossColumns) flush();
    }

    if (levelOf.has(bucket(line.h))) {
      // Gather the run of consecutive heading-size lines: a wrapped title is
      // one heading, a long run is a pull quote in a bigger face.
      flush();
      const run: OcrLine[] = [line];
      let maxB = bucket(line.h);
      while (i + 1 < p.lines.length && levelOf.has(bucket(p.lines[i + 1].h)) && p.lines[i + 1].col === p.lines[i].col && p.lines[i].midY - p.lines[i + 1].midY < Math.max(p.lines[i].h, p.lines[i + 1].h) * 2.2) {
        i++;
        run.push(p.lines[i]);
        maxB = Math.max(maxB, bucket(p.lines[i].h));
      }
      const runTexts = run.map((l) => l.text);
      const merged = runTexts.slice(1).reduce(hyphenJoin, runTexts[0]);
      const words = run.flatMap((l) => l.words);
      // Below UNSTRUCTURED_WORDLIKE_FRACTION = chart labels/stray numerals,
      // not a heading; checked FIRST so a long numeral run isn't asserted as a pull quote.
      const junk = isUnstructured(merged);
      if (junk) blocks.push({ kind: 'review', text: merged, reason: REVIEW_REASON.unstructuredLabels, words });
      else if (merged.length > 150) blocks.push({ kind: 'quote', text: merged, words });
      else blocks.push({ kind: 'heading', text: merged, level: levelOf.get(maxB) as number, words });
    } else {
      para.push(line);
    }
    i++;
  }
  flush();
  return blocks;
}
