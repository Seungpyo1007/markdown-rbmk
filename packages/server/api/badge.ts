import { handleBadge } from '../src/badge';

/**
 * Vercel function entrypoint for `GET /api/badge` (SPEC 8.1).
 * Uses the Web Request/Response signature on the Node runtime.
 */
export default function handler(request: Request): Promise<Response> {
  return handleBadge(request);
}

export const config = { runtime: 'nodejs' };
