// debug-words.ts — test helper for src/cli/extract.ts's --debug-words=FILE
// dump (one JSON line per word: {page,text,x,y,w,h,confidence?}); a bad line fails the calling test loudly rather than being swallowed.
import { mkdtempSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export interface DebugWord {
  page: number;
  text: string;
  x: number;
  y: number;
  w: number;
  h: number;
  confidence?: number;
}

/** A fresh temp file path for a --debug-words=FILE run (caller passes it as the flag's value). */
export function debugWordsPath(): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'pdf-to-md-debug-words-'));
  return path.join(dir, 'words.jsonl');
}

/** Parse a --debug-words=FILE dump written by a completed CLI run. */
export function readDebugWords(file: string): DebugWord[] {
  const raw = readFileSync(file, 'utf8');
  const words: DebugWord[] = [];
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    words.push(JSON.parse(line));
  }
  return words;
}
