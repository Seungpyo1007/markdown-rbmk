import type { StyleInput } from './types';

/** Style `poster` — placeholder, replaced by the real renderer. */
export function render(_input: StyleInput): string {
  throw new Error('style "poster" is not implemented yet.');
}