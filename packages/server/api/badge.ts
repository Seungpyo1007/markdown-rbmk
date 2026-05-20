import { handleBadge } from '../src/badge';

/**
 * Vercel Node.js function entrypoint for `GET /api/badge`.
 *
 * Adapts the Web-standard `handleBadge(Request) -> Response` to the Node
 * `(req, res)` signature so it runs on the default Vercel runtime. This file is
 * bundled into a single self-contained `api/badge.js` by `pnpm build:fn`.
 */
interface NodeRequest {
  url?: string;
  headers: Record<string, string | string[] | undefined>;
}
interface NodeResponse {
  statusCode: number;
  setHeader(name: string, value: string): void;
  end(body: string): void;
}

export default async function handler(req: NodeRequest, res: NodeResponse): Promise<void> {
  const rawHost = req.headers['host'];
  const host = (Array.isArray(rawHost) ? rawHost[0] : rawHost) ?? 'localhost';
  const response = await handleBadge(new Request(`https://${host}${req.url ?? '/'}`));

  res.statusCode = response.status;
  response.headers.forEach((value, key) => res.setHeader(key, value));
  res.end(await response.text());
}
