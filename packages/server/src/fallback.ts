import type { Theme } from '@markdown-rbmk/core';

function escapeXml(s: string): string {
  return s.replace(/[<>&"']/g, (c) => {
    switch (c) {
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '&':
        return '&amp;';
      case '"':
        return '&quot;';
      default:
        return '&apos;';
    }
  });
}

/**
 * A minimal "reactor offline" badge shown whenever a real badge cannot be
 * built (bad input, API error, scope=all). Always a valid standalone SVG so
 * the README image never appears broken (SPEC 8.3).
 */
export function fallbackSvg(message: string | string[], theme: Theme = 'dark'): string {
  const lines = Array.isArray(message) ? message : [message];
  const outline = theme === 'light' ? '#888888' : '#1a4a2a';
  const fg = theme === 'light' ? '#333333' : '#7F8C8D';

  const startY = 300 - ((lines.length - 1) * 24) / 2;
  const body = lines
    .map(
      (line, i) =>
        `<text x="300" y="${startY + i * 24}" text-anchor="middle" dominant-baseline="middle" ` +
        `font-size="18" font-family="ui-monospace,monospace" fill="${fg}">${escapeXml(line)}</text>`,
    )
    .join('');

  return (
    `<svg viewBox="0 0 600 600" xmlns="http://www.w3.org/2000/svg" ` +
    `style="width:100%;max-width:600px;display:block">` +
    `<circle cx="300" cy="300" r="278" fill="none" stroke="${outline}" stroke-width="1" opacity="0.6"/>` +
    `<circle cx="300" cy="300" r="200" fill="none" stroke="${outline}" stroke-width="1" opacity="0.3"/>` +
    `<text x="300" y="${startY - 50}" text-anchor="middle" font-size="13" letter-spacing="3" ` +
    `font-family="ui-monospace,monospace" fill="${outline}">REACTOR OFFLINE</text>` +
    body +
    `</svg>`
  );
}
