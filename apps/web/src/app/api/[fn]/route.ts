import { handleApi } from '@temple/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST /api/<function> — the former Cloud Functions callables, served by Vercel. */
export async function POST(req: Request, ctx: { params: Promise<{ fn: string }> }) {
  const { fn } = await ctx.params;
  return handleApi(req, fn, 'customer');
}
