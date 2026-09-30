import type { RenderOptions } from '../../types';

/**
 * The v2 renderer — placeholder until the redesign is chosen and built.
 * It is not reachable from the server or the Action yet.
 */
export function renderV2(_opts: RenderOptions): string {
  throw new Error('render: style "v2" is not implemented yet.');
}
