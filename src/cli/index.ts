import type { Command } from './types.ts';

// Lazy registry: a command's imports load only when it runs. These names are
// reserved — a PDF literally named `extract`/`render` (no extension) needs a ./ prefix.
export const COMMANDS: Record<string, () => Promise<{ default: Command }>> = {
  extract: () => import('./extract.ts'),
  render: () => import('./render.ts'),
  audit: () => import('./audit.ts'),
};

export type { Command, Ctx } from './types.ts';
