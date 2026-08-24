// audit-words.ts — re-export shim over src/audit.ts's shipped `auditWords`
// (also the `pdf-to-md audit` CLI), kept so old imports and this file's own script-runnable CLI usage still work.
import type { AuditResult } from '../../src/audit.ts';
import { auditWords } from '../../src/audit.ts';

export type { AuditResult } from '../../src/audit.ts';
export const audit = auditWords;

function main(): void {
  const [, , wordsPath, mdPath] = process.argv;
  if (!wordsPath || !mdPath) {
    console.error('usage: audit-words.ts <words.jsonl> <markdown.md>');
    process.exit(2);
  }
  const result: AuditResult = auditWords(wordsPath, mdPath);
  for (const line of result.lines) console.log(line);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
