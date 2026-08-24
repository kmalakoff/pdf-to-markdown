// Resolves an installed package file's on-disk path for both build targets:
// ESM's import.meta.resolve returns a file:// URL, the CJS build's rewritten require.resolve a plain path — normalizes both to a plain path.
import { fileURLToPath } from 'node:url';

export function resolvePackagePath(specifier: string): string {
  const resolved = import.meta.resolve(specifier);
  return resolved.startsWith('file://') ? fileURLToPath(resolved) : resolved;
}
