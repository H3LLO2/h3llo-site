// api/reviewer-dispatch.ts
export const config = { runtime: 'edge' };

export default async function handler(req: Request) {
  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405, headers: { 'content-type': 'application/json' }});
    }
    let payload: any;
    try {
      payload = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400, headers: { 'content-type': 'application/json' }});
    }
    if (!payload || typeof payload.action !== 'string' || !payload.action.trim()) {
      return new Response(JSON.stringify({ error: 'Missing "action" in payload' }), { status: 400, headers: { 'content-type': 'application/json' }});
    }

    const hook = (globalThis as any).process?.env?.MAKE_REVIEW_WEBHOOK;
    if (!hook) {
      return new Response(JSON.stringify({ error: 'Server not configured: MAKE_REVIEW_WEBHOOK missing' }), { status: 500, headers: { 'content-type': 'application/json' }});
    }

    const upstream = await fetch(hook, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const contentType = upstream.headers.get('content-type') || 'application/json';
    const text = await upstream.text();
    return new Response(text, { status: upstream.status, headers: { 'content-type': contentType }});
  } catch (err: any) {
    return new Response(JSON.stringify({ error: 'Proxy failure', details: String(err?.message || err) }), { status: 500, headers: { 'content-type': 'application/json' }});
  }
}