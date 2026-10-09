import { handleCron } from '@temple/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Daily housekeeping backstop (see vercel.json). Holds also expire opportunistically on every booking. */
export async function GET(req: Request) {
  return handleCron(req);
}
