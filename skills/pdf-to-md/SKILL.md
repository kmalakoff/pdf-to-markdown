---
name: pdf-to-md
description: "Convert a PDF to markdown with pdf-to-md and drive its QA loop to a lossless result: read the --json report's pageStats to find suspect pages, render pages to PNG as ground truth, re-extract targeted page ranges with tuning flags, and run the severity-1 word-loss audit before trusting the output. Use when converting a PDF to markdown with pdf-to-md, when a pdf-to-md conversion looks wrong (garbled reading order, misplaced text, misread words, a suspicious page), or when asked to verify a pdf-to-md conversion is lossless."
---

# pdf-to-md

pdf-to-md converts PDFs to markdown: text layer via pdf.js, OCR (tesseract.js) fallback for
image-only or sparse pages. Its contract: recognized text is never silently dropped,
unrecoverable structure is marked (`> [review: ...]`) rather than guessed, and every claim the
output makes is mechanically checkable. This skill is the QA loop that contract is built for —
convert, read the report, verify against the real page, re-extract, audit.

## 1. Convert

```
pdf-to-md file.pdf --json
```

Auto-detects the OCR need (falls back when the text layer is too sparse) and prints the QA report
alongside the markdown. `--ocr` forces the OCR path; `--no-ocr` suppresses the fallback and keeps
the sparse text-layer output. `--pages N[-M]` limits to a page range; `--stdout` writes markdown
to stdout instead of a file.

## 2. Read the QA report

`report.pageStats` (one row per page) flags pages worth checking by hand:

- `danglingLong` — a paragraph broke off without terminal punctuation before the next one starts:
  a likely invisible sentence split the geometry got wrong.
- `reviewBlocks` — count of `> [review: reason]` blocks: the geometry declined to guess an order
  and labeled the block instead of guessing. Always worth reading.
- `lowConfidenceWords` / `lowConfidenceSample` — words the OCR engine itself scored below its
  confidence threshold; the sample is the actual suspect tokens, worst first. Probable misreads.
- `junkHeadings` — lines promoted to headings by a font-size heuristic that are probably not
  headings.
- `largeImages` (text path only) — a real text layer plus a large embedded image: text baked into
  the image may duplicate or replace what the text layer extracted. Don't assume the text layer
  is complete — compare it against `--pages N --ocr` on that page.

A page with none of these flags isn't proof it's correct, only that these particular detectors
found nothing — pair with step 3 for anything the report doesn't cover.

## 3. Ground truth: render the page

```
pdf-to-md render file.pdf N
```

Renders page N to PNG at 288dpi — the same resolution the OCR path reads at (override with
`--dpi`) — into the current directory (or `--out DIR`). View the PNG next to the flagged markdown;
this is the only real ground truth, everything in the report is inference on top of it.

## 4. Targeted re-extraction

Re-run just the flagged pages with an adjusted knob:

```
pdf-to-md file.pdf --pages 27-31 --stdout --dpi 400
```

Tuning flags (`--float-max-words`, `--para-gap`, `--heading-scale`, and the rest) are measured
defaults — read README's tuning table for what each one controls and its default rather than
guessing a value. Raising `--dpi` fixes chart/label corruption but can make scattered numerals on
the same page worse, not better — try it on the flagged page only and compare, don't assume higher
is strictly better.

## 5. Severity-1 audit

Before trusting a conversion, run the audit — the only mechanically-checkable proof that no
recognized word was silently dropped:

```
pdf-to-md file.pdf out.md --debug-words=words.jsonl
pdf-to-md audit words.jsonl out.md
```

Exits 1 if any word from the dump is missing from the markdown; `MISSING=0` in the printed summary
line is the pass signal. `--debug-words` output is JSON Lines with no guaranteed key order —
parse each line as JSON, never grep the file for text.

## 6. Machine-parseable markers

Two regex-matchable line prefixes carry content the geometry parked rather than lost:

```
^> \[(floats|review: [^\]]+)\] (.*)$
```

`> [floats]` is a fragment (short line, margin text, etc.) set aside as decoration; `> [review:
reason]` is a block the geometry couldn't order, with the reason inline. Both are visible in the
markdown and safe to post-process (move, drop, re-attach) once matched.

For programmatic convergence instead of eyeballing, `--format raw` returns the full `Analysis` as
JSON: every word and block with its coordinates (normalized `[0,1]`, origin bottom-left, y up)
plus the same `report` `--json` prints. Feed that into your own re-ordering or merge logic instead
of re-parsing the markdown.

## Reference

Full flag list: `pdf-to-md --help`. Tuning table and design contract: the package README. Every
exported function and option is documented at its declaration, visible in editor hover.
