/**
 * Golden snapshots of each v2 style's default look (full, right panel, every
 * mode, dark and light). Styles may evolve, but only on purpose: review the
 * diff, then update with `vitest run -u`.
 */
import { describe, it, expect } from 'vitest';
import { render } from '../../src/render';
import { STYLE_NAMES } from '../../src/styles';
import type { RenderMode } from '../../src/types';
import { FIXTURE_USER, fixtureContributions, fixtureStats } from '../fixtures';

const MODES: RenderMode[] = ['commit', 'language', 'hybrid'];

describe('v2 style golden snapshots', () => {
  for (const style of STYLE_NAMES) {
    for (const mode of MODES) {
      for (const preset of ['dark', 'light']) {
        it(`${style} ${mode} ${preset}`, async () => {
          const svg = render({
            style,
            mode,
            preset,
            username: FIXTURE_USER,
            stats: fixtureStats,
            contributions: fixtureContributions(),
          });
          await expect(svg).toMatchFileSnapshot(`./__golden__/${style}-${mode}-${preset}.svg`);
        });
      }
    }
  }
});
