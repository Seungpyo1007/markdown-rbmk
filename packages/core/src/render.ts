import type { RenderOptions } from './types';
import { renderClassic } from './renderers/classic';
import { buildStyleInput, STYLE_RENDERERS } from './styles';

/**
 * Render a reactor-core badge as a standalone, animated SVG string.
 *
 * Dispatches on `style`. Omitting it selects `classic`, the frozen v1 look,
 * so every existing embed keeps rendering exactly as before. Any other name
 * is one of the v2 styles in `styles/`.
 */
export function render(opts: RenderOptions): string {
  const style = opts.style ?? 'classic';
  if (style === 'classic') return renderClassic(opts);

  const renderer = STYLE_RENDERERS[style];
  return renderer(
    buildStyleInput({
      style,
      mode: opts.mode ?? 'commit',
      username: opts.username,
      preset: opts.preset ?? opts.theme ?? 'dark',
      view: opts.view ?? 'full',
      panel: opts.panel ?? 'right',
      cell: opts.cell ?? 'default',
      animate: opts.animate ?? true,
      accent: opts.accent ?? null,
      heat: opts.heat ?? null,
      stats: opts.panelStats ?? null,
      langStats: opts.stats,
      contributions: opts.contributions,
    }),
  );
}
