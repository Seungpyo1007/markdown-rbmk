import type { StyleName, StyleRenderer } from './types';
import { render as skala } from './skala';
import { render as blueprint } from './blueprint';
import { render as cherenkov } from './cherenkov';
import { render as pyatachok } from './pyatachok';
import { render as dosimeter } from './dosimeter';
import { render as poster } from './poster';
import { render as gauge } from './gauge';
import { render as minimal } from './minimal';

/** Renderer for each named style. */
export const STYLE_RENDERERS: Record<StyleName, StyleRenderer> = {
  skala,
  blueprint,
  cherenkov,
  pyatachok,
  dosimeter,
  poster,
  gauge,
  minimal,
};

export * from './types';
export * from './meta';
export {
  assignCells,
  buildStyleInput,
  contrast,
  defaultStats,
  escapeXml,
  grouped,
  resolveStats,
  summarise,
  HYBRID_INNER_FRACTION,
  MONO,
  REDUCED_MOTION_CSS,
  SANS,
} from './shared';
