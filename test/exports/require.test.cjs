const assert = require('assert');
const pdfToMdModule = require('@effortlessmotion/pdf-to-md');
const { analyze, auditWords, DEFAULT_TUNING, extractOcr, extractText, PdfToMdError, pdfToMarkdown, renderPageToPNG, toMarkdown, toText } = pdfToMdModule;

// Pins the EXACT exported key set (not just "these 10 names exist") — a
// future internal leak (or an accidental drop) fails THIS test instead of
// depending on a human recount. OUTPUT_VERSION included: it's a real named
// export (src/index.ts) the per-name checks below never touch. `__esModule`
// (non-enumerable on the built CJS output — see dist/cjs/index.js) is
// correctly absent from Object.keys here, not filtered out by hand.
const EXPECTED_EXPORTS = ['DEFAULT_TUNING', 'OUTPUT_VERSION', 'PdfToMdError', 'analyze', 'auditWords', 'extractOcr', 'extractText', 'pdfToMarkdown', 'renderPageToPNG', 'toMarkdown', 'toText'].sort();

describe('exports .cjs', () => {
  it('exports EXACTLY this key set — no more, no fewer (catches a leaked internal or a silent drop)', () => {
    assert.deepEqual(Object.keys(pdfToMdModule).sort(), EXPECTED_EXPORTS);
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
