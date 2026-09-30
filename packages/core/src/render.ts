import type { RenderOptions } from './types';
import { renderClassic } from './renderers/classic';
import { renderV2 } from './renderers/v2';

/**
 * Render a reactor-core badge as a standalone, animated SVG string.
 *
 * Dispatches on `style`. Omitting it selects `classic`, the frozen v1 look,
 * so every existing embed keeps rendering exactly as before.
 */
export function render(opts: RenderOptions): string {
  switch (opts.style ?? 'classic') {
    case 'v2':
      return renderV2(opts);
    case 'classic':
    default:
      return renderClassic(opts);
  }
}
