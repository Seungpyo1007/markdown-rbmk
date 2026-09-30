/**
 * Conformance suite every v2 style must pass. Run one style with:
 *   pnpm exec vitest run packages/core/test/styles/conformance.test.ts -t "<name>"
 */
import { describe, it, expect } from 'vitest';
import { render } from '../../src/render';
import { STYLE_META, STYLE_NAMES } from '../../src/styles';
import type { CellShape, PanelPosition, View } from '../../src/styles';
import type { RenderMode } from '../../src/types';
import { FIXTURE_USER, fixtureContributions, fixtureStats } from '../fixtures';

const MODES: RenderMode[] = ['commit', 'language', 'hybrid'];
const LAYOUTS: Array<[View, PanelPosition]> = [
  ['full', 'right'],
  ['full', 'bottom'],
  ['core', 'right'],
  ['panel', 'right'],
  ['panel', 'bottom'],
];
const CELLS: CellShape[] = ['default', 'square', 'round', 'circle', 'hex'];
const MAX_BYTES = 120_000;

/** Balanced-tag check (enough for generated SVG: no CDATA, no comments). */
function wellFormed(svg: string): boolean {
  const stack: string[] = [];
  const body = svg.replace(/<style>[\s\S]*?<\/style>/g, '<style></style>');
  for (const m of body.matchAll(/<(\/?)([a-zA-Z][\w:-]*)[^>]*?(\/?)>/g)) {
    const [, close, name, self] = m;
    if (self) continue;
    if (close) {
      if (stack.pop() !== name) return false;
    } else stack.push(name!);
  }
  return stack.length === 0;
}

const contributions = fixtureContributions();

for (const style of STYLE_NAMES) {
  const draw = (o: Record<string, unknown> = {}) =>
    render({
      style,
      mode: 'commit',
      username: FIXTURE_USER,
      stats: fixtureStats,
      contributions,
      ...o,
    });

  describe(`style ${style}`, () => {
    for (const mode of MODES) {
      for (const [view, panel] of LAYOUTS) {
        for (const preset of STYLE_META[style].presets) {
          it(`${mode} ${view}/${panel} ${preset}: valid, safe, accessible`, () => {
            const svg = draw({ mode, view, panel, preset });
            expect(svg.startsWith('<svg')).toBe(true);
            expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
            expect(svg).toMatch(/viewBox="0 0 \d+(\.\d+)? \d+(\.\d+)?"/);
            expect(svg).toContain('role="img"');
            expect(wellFormed(svg)).toBe(true);
            const title = /<title>([^<]*)<\/title>/.exec(svg)?.[1] ?? '';
            expect(title).toContain(style);
            expect(title).toContain(`@${FIXTURE_USER}`);
            // @username visible as text in every view
            expect(svg.replace(/<title>[^<]*<\/title>/, '')).toContain(`@${FIXTURE_USER}`);
            for (const bad of ['<script', '<animate', '<set', 'foreignObject', 'http://', 'https://', '@import', 'NaN', 'undefined', 'Infinity']) {
              expect(svg.replace('http://www.w3.org/2000/svg', '')).not.toContain(bad);
            }
            if (svg.includes('@keyframes')) expect(svg).toContain('prefers-reduced-motion');
            expect(svg.length).toBeLessThan(MAX_BYTES);
          });
        }
      }
    }

    it('shows real numbers from the data', () => {
      const svg = draw({ mode: 'commit', view: 'panel' });
      const total = contributions.days.reduce((s, d) => s + d.count, 0);
      const grouped = String(total).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      expect(svg.includes(grouped) || svg.includes(String(total))).toBe(true);
      const lang = draw({ mode: 'language', view: 'panel' });
      expect(lang).toContain('TypeScript');
    });

    it('supports every cell shape', () => {
      for (const cell of CELLS) {
        const svg = draw({ view: 'core', cell });
        expect(wellFormed(svg)).toBe(true);
      }
      expect(draw({ view: 'core', cell: 'hex' })).not.toBe(draw({ view: 'core', cell: 'square' }));
    });

    it('honours accent and heat overrides', () => {
      const svg = draw({ accent: '#ff00aa', heat: ['#010203', '#111111', '#222222', '#333333', '#444444'] });
      expect(svg.toLowerCase()).toContain('#ff00aa');
      expect(svg.toLowerCase()).toContain('#444444');
    });

    it('honours the stats list', () => {
      const a = draw({ view: 'panel', panelStats: ['total'] });
      const b = draw({ view: 'panel', panelStats: ['total', 'streak', 'longest'] });
      expect(a).not.toBe(b);
    });

    it('anim=off emits no animation', () => {
      const svg = draw({ animate: false });
      expect(svg).not.toContain('@keyframes');
      expect(svg).not.toMatch(/animation\s*:/);
    });

    it('never hides content statically (reduced motion shows everything)', () => {
      const svg = draw();
      expect(svg).not.toMatch(/\sopacity="0"/);
      expect(svg).not.toMatch(/opacity:\s*0\s*[;}]/);
    });

    it('is deterministic and username-seeded', () => {
      expect(draw()).toBe(draw());
      const other = render({ style, mode: 'commit', username: 'torvalds', stats: fixtureStats, contributions: { ...contributions, username: 'torvalds' } });
      expect(other).toContain('@torvalds');
    });

    it('does not depend on the clock', () => {
      const svg = draw();
      const today = new Date().toISOString().slice(0, 10);
      if (!contributions.days.some((d) => d.date === today)) expect(svg).not.toContain(today);
    });
  });
}
