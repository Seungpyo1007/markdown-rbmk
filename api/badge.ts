// @ts-nocheck
/**
 * Vercel function entrypoint for `GET /api/badge`.
 *
 * Vercel detects this small file as a Serverless Function and re-exports the
 * prebuilt, self-contained handler bundle (`pnpm build:fn`). The explicit
 * `.js` extension lets the bundle resolve at runtime under Node's ESM loader.
 */
export { default } from '../badge-bundle.js';
