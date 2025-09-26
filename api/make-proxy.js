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
    const rawEmail = String(body.email || '').trim();
    const tRaw = String(body.target || '').toLowerCase().trim();
    const mtRaw = String(body.media_type || '').toLowerCase().trim();

    // Verify reviewer email if configured
    const allowedEmail = String(process.env.REVIEW_EMAIL || '').trim();
    if (!allowedEmail || rawEmail.toLowerCase() !== allowedEmail.toLowerCase()) {
      return res.status(403).json({ error: 'Reviewer email not authorized' });
    }

    // Normalize target and media_type defensively
    const target = (tRaw === 'facebook' || tRaw === 'instagram') ? tRaw : '';
    const media_type = (mtRaw === 'image') ? 'photo' : mtRaw; // normalize image -> photo

    if (!target || (media_type !== 'photo' && media_type !== 'video')) {
      return res.status(400).json({ error: `Invalid target/media_type: ${tRaw}/${mtRaw}` });
    }

    const routeKey = String(body.routeKey || `${target}_${media_type}`);

    const routes = {
      instagram_photo: process.env.MAKE_IG_PHOTO_URL,
      instagram_video: process.env.MAKE_IG_VIDEO_URL,
      facebook_photo:  process.env.MAKE_FB_PHOTO_URL,
      facebook_video:  process.env.MAKE_FB_VIDEO_URL,
    };

    const webhook = routes[routeKey];
    if (!webhook) {
      return res.status(400).json({ error: `Unknown route: ${routeKey}` });
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