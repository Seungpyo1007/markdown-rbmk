/**
 * GitHub linguist language colours (curated subset, ~50 most common languages).
 * Source: github-linguist/linguist (MIT).
 */
export const LANGUAGE_COLORS: Record<string, string> = {
  JavaScript: '#f1e05a',
  TypeScript: '#3178c6',
  Python: '#3572A5',
  Java: '#b07219',
  C: '#555555',
  'C++': '#f34b7d',
  'C#': '#178600',
  Go: '#00ADD8',
  Rust: '#dea584',
  Ruby: '#701516',
  PHP: '#4F5D95',
  Swift: '#F05138',
  Kotlin: '#A97BFF',
  Dart: '#00B4AB',
  Scala: '#c22d40',
  Shell: '#89e051',
  HTML: '#e34c26',
  CSS: '#563d7c',
  SCSS: '#c6538c',
  Vue: '#41b883',
  Svelte: '#ff3e00',
  Astro: '#ff5a03',
  Elixir: '#6e4a7e',
  Erlang: '#B83998',
  Haskell: '#5e5086',
  Lua: '#000080',
  Perl: '#0298c3',
  R: '#198CE7',
  Julia: '#a270ba',
  Clojure: '#db5855',
  OCaml: '#3be133',
  'F#': '#b845fc',
  'Objective-C': '#438eff',
  Assembly: '#6E4C13',
  PowerShell: '#012456',
  Groovy: '#4298b8',
  MATLAB: '#e16737',
  TeX: '#3D6117',
  'Vim Script': '#199f4b',
  Nix: '#7e7eff',
  Zig: '#ec915c',
  Solidity: '#AA6746',
  Markdown: '#083fa1',
  Dockerfile: '#384d54',
  Makefile: '#427819',
  'Jupyter Notebook': '#DA5B0B',
  CoffeeScript: '#244776',
  Crystal: '#000100',
  Nim: '#ffc200',
  WebAssembly: '#04133b',
};

/** Fallback colours for slots 1-4 when a language has no linguist colour. */
export const SLOT_FALLBACK_COLORS = ['#2ECC71', '#F1C40F', '#E74C3C', '#3498DB'] as const;

/** Colour for the "Other" bucket (slot 5+). */
export const OTHER_COLOR = '#7F8C8D';

export function colorForLanguage(name: string): string | undefined {
  return LANGUAGE_COLORS[name];
}

/**
 * Resolve a display colour for a language at a given slot index (0-based).
 * Prefers the linguist colour, then a per-slot fallback, then the "Other" grey.
 */
export function resolveColor(name: string, slotIndex: number): string {
  return LANGUAGE_COLORS[name] ?? SLOT_FALLBACK_COLORS[slotIndex] ?? OTHER_COLOR;
}
