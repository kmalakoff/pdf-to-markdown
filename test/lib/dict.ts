// dict.ts — shared "is a hyphen-rejoin dictionary available" check, mirroring
// src/dict.ts's DICT_PATH resolution (incl. the PDF_TO_MD_DICT_PATH test-only override) so tests agree with the code under test.
import { existsSync } from 'node:fs';
import wordListPath from 'word-list';

export const HAS_DICT = existsSync(process.env.PDF_TO_MD_DICT_PATH || wordListPath);
