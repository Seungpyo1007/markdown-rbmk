// Cross-platform tail of `pnpm build:fn`: move the ncc output to the file the
// Vercel entrypoint (`api/badge.ts`) re-exports, then drop the temp dir.
import { copyFileSync, rmSync } from 'node:fs';

copyFileSync('.fn-build/index.js', 'badge-bundle.js');
rmSync('.fn-build', { recursive: true, force: true });
