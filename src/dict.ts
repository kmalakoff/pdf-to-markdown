// The hyphen-rejoin dictionary, shared by src/emit.ts and src/markdown.ts.
// Loaded once, lazily, on first use — never at import — so importing the library does no file IO on its own.
import { existsSync, readFileSync } from 'node:fs';
import wordListPath from 'word-list';

// Bundled list (not the OS's /usr/share/dict/words) → identical rejoin decisions on every
// OS/machine. PDF_TO_MD_DICT_PATH overrides it — the test seam for simulating no dictionary.
export const DICT_PATH = process.env.PDF_TO_MD_DICT_PATH || wordListPath;

let cache: { words: Set<string>; available: boolean } | null = null;

function load(): { words: Set<string>; available: boolean } {
  if (!cache) {
    const available = existsSync(DICT_PATH);
    cache = { words: available ? new Set(readFileSync(DICT_PATH, 'utf8').toLowerCase().split('\n')) : new Set(), available };
  }
  return cache;
}

/** The hyphen-rejoin dictionary; an empty set if none was found. */
export function getDict(): Set<string> {
  return load().words;
}

/** False when no dictionary file exists at DICT_PATH — every line-final
 * hyphen then stays unresolved. */
export function dictAvailable(): boolean {
  return load().available;
}

/** The notice callers surface via warn() when dictAvailable() is false. */
export function dictUnavailableWarning(): string {
  return `no dictionary at ${DICT_PATH} — line-final hyphens kept unresolved`;
}
