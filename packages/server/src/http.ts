/**
 * HTTP wrapper used by the Next.js route handlers in apps/web and apps/admin:
 *   POST /api/<name>  body: JSON  header: Authorization: Bearer <Firebase ID token>
 * Success → 200 { data }.  Failure → status { error: { code, message } } where code is a
 * BookingErrorCode the clients translate (or UNAUTHENTICATED / INTERNAL).
 */
import { callerFromRequest } from './core';
import { adminHandlers, customerHandlers, toApiError, type Handler } from './handlers';
import { runMaintenance } from './maintenance';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

export async function handleApi(req: Request, name: string, kind: 'customer' | 'admin'): Promise<Response> {
  const table: Record<string, Handler> = kind === 'admin' ? adminHandlers : customerHandlers;
  const handler = table[name];
  if (!handler) return json(404, { error: { code: 'NOT_FOUND', message: `Unknown function ${name}` } });
  try {
    const caller = await callerFromRequest(req);
    let data: unknown = {};
    const text = await req.text();
    if (text) {
      try { data = JSON.parse(text); } catch { return json(400, { error: { code: 'INVALID_INPUT', message: 'Body must be JSON' } }); }
    }
    const result = await handler(caller, data);
    return json(200, { data: result ?? null });
  } catch (e) {
    const err = toApiError(e);
    return json(err.status, { error: { code: err.code, message: err.message } });
  }
}

/** Daily cron backstop (Vercel Cron sends `Authorization: Bearer $CRON_SECRET`). */
export async function handleCron(req: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) return json(401, { error: { code: 'UNAUTHENTICATED', message: 'bad secret' } });
  try {
    return json(200, { data: await runMaintenance(true) });
  } catch (e) {
    const err = toApiError(e);
    return json(err.status, { error: { code: err.code, message: err.message } });
  }
}
