/**
 * Golden snapshots of the classic (v1) renderer. Real users embed these
 * badges, so the default output must stay byte-identical forever. If one of
 * these fails, the change broke backward compatibility — fix the code, do not
 * update the snapshot.
 */
import { describe, it, expect } from 'vitest';
import { render } from '../src/index';
import type { RenderMode, Theme } from '../src/types';
import { FIXTURE_USER, fixtureContributions, fixtureStats } from './fixtures';

const modes: RenderMode[] = ['commit', 'language', 'hybrid'];
const themes: Theme[] = ['dark', 'light'];

describe('classic renderer golden snapshots', () => {
  for (const mode of modes) {
    for (const theme of themes) {
      for (const showLegend of [true, false]) {
        const name = `${mode}-${theme}${showLegend ? '' : '-nolegend'}`;
        it(name, async () => {
          const svg = render({
            mode,
            username: FIXTURE_USER,
            theme,
            showLegend,
            stats: fixtureStats,
            contributions: fixtureContributions(),
          });
          await expect(svg).toMatchFileSnapshot(`./__golden__/${name}.svg`);
        });
      }
    }
  }

  it('omitted mode/theme/legend equal the commit-dark default', () => {
    const contributions = fixtureContributions();
    expect(render({ username: FIXTURE_USER, contributions })).toBe(
      render({ mode: 'commit', theme: 'dark', showLegend: true, username: FIXTURE_USER, contributions }),
    );
  });
});
