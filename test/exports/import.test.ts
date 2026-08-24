import assert from 'node:assert';
import * as pdfToMdNamespace from '@effortlessmotion/pdf-to-md';
import { analyze, auditWords, DEFAULT_TUNING, extractOcr, extractText, PdfToMdError, pdfToMarkdown, renderPageToPNG, toMarkdown, toText } from '@effortlessmotion/pdf-to-md';

// Pins the EXACT exported key set (not just "these names exist"), so a
// future internal leak or accidental drop fails this test. Includes OUTPUT_VERSION, which the per-name checks below never touch.
const EXPECTED_EXPORTS = ['DEFAULT_TUNING', 'OUTPUT_VERSION', 'PdfToMdError', 'analyze', 'auditWords', 'extractOcr', 'extractText', 'pdfToMarkdown', 'renderPageToPNG', 'toMarkdown', 'toText'].sort();

describe('exports .ts', () => {
  it('exports EXACTLY this key set — no more, no fewer (catches a leaked internal or a silent drop)', () => {
    assert.deepEqual(Object.keys(pdfToMdNamespace).sort(), EXPECTED_EXPORTS);
  });

  it('pdfToMarkdown', () => {
    assert.equal(typeof pdfToMarkdown, 'function');
  });
  it('extractText', () => {
    assert.equal(typeof extractText, 'function');
  });
  it('extractOcr', () => {
    assert.equal(typeof extractOcr, 'function');
  });
  it('PdfToMdError', () => {
    assert.equal(typeof PdfToMdError, 'function');
  });
  it('DEFAULT_TUNING', () => {
    assert.equal(typeof DEFAULT_TUNING, 'object');
  });
  it('renderPageToPNG', () => {
    assert.equal(typeof renderPageToPNG, 'function');
  });
  it('analyze', () => {
    assert.equal(typeof analyze, 'function');
  });
  it('toMarkdown', () => {
    assert.equal(typeof toMarkdown, 'function');
  });
  it('toText', () => {
    assert.equal(typeof toText, 'function');
  });
  it('auditWords', () => {
    assert.equal(typeof auditWords, 'function');
  });
});
