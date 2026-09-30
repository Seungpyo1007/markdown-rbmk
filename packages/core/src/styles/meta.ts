import type { StyleMeta, StyleName } from './types';

/**
 * The style catalogue. Kept free of renderer imports so the option parser
 * and the website can read it cheaply.
 */
export const STYLE_META: Record<StyleName, StyleMeta> = {
  skala: {
    name: 'skala',
    label: 'SKALA console',
    description: 'Control-room channel map with a phosphor CRT readout.',
    presets: ['dark', 'light', 'green'],
  },
  blueprint: {
    name: 'blueprint',
    label: 'Blueprint',
    description: 'Engineering drawing of the core with a title-block panel.',
    presets: ['dark', 'light', 'sepia'],
  },
  cherenkov: {
    name: 'cherenkov',
    label: 'Cherenkov',
    description: 'The blue glow of a reactor pool — luminous points, calm breathing.',
    presets: ['dark', 'light', 'abyss'],
  },
  pyatachok: {
    name: 'pyatachok',
    label: 'Pyatachok',
    description: 'The reactor lid from above — steel channel caps and a riveted plate.',
    presets: ['dark', 'light', 'oxide'],
  },
  dosimeter: {
    name: 'dosimeter',
    label: 'Dosimeter',
    description: 'A handheld counter with a reflective LCD and seven-segment digits.',
    presets: ['dark', 'light', 'green'],
  },
  poster: {
    name: 'poster',
    label: 'Poster',
    description: 'Bold constructivist geometry — diagonals, flat colour, big numbers.',
    presets: ['dark', 'light', 'cobalt'],
  },
  gauge: {
    name: 'gauge',
    label: 'Gauge',
    description: 'Analog instrument panel — tick bezel, needle dial and meters.',
    presets: ['dark', 'light', 'cherenkov'],
  },
  minimal: {
    name: 'minimal',
    label: 'Minimal',
    description: 'Quiet and GitHub-native — hairlines, big numbers, slim bars.',
    presets: ['dark', 'light', 'cherenkov'],
  },
};
