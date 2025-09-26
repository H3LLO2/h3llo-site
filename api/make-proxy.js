// api/make-proxy.js  (ES module compatible with "type":"module")
export default async function handler(req, res) {
  // Health check for GET so opening the URL in a browser won’t crash
  if (req.method === 'GET') {
    res.setHeader('Content-Type', 'application/json');
    res.status(200).send(JSON.stringify({ ok: true, service: 'make-proxy', status: 'ready' }));
    return;
  }

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const { routeKey, media_url, target, fb_page_id, ig_user_id, media_type } = body;

    // Map to Make webhooks via env vars (already set in Vercel)
    const routes = {
      instagram_photo: process.env.MAKE_IG_PHOTO_URL,
      instagram_video: process.env.MAKE_IG_VIDEO_URL,
      facebook_photo:  process.env.MAKE_FB_PHOTO_URL,
      facebook_video:  process.env.MAKE_FB_VIDEO_URL,
    };

    // Infer routeKey if not provided
    const rk = routeKey || `${target}_${media_type}`;
    const webhook = routes[rk];
    if (!webhook) {
      res.status(400).json({ error: `Unknown route: ${rk}` });
      return;
    }

    const payload = {
      media_url,
      target,
      fb_page_id,
      ig_user_id,
      media_type,
      routeKey: rk,
      label: 'review',
    };

    const r = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const text = await r.text();
    // Allow the form page to call this endpoint from the same origin
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');
    res.status(200).send(
      JSON.stringify({
        ok: true,
        routeKey: rk,
        status: r.status,
        makeSnippet: text.slice(0, 200),
      })
    );
  } catch (err) {
    res.status(500).json({ error: 'Proxy error', detail: String(err?.message || err) });
  }
}