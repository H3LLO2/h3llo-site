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

    // Defensive normalization and required-field checks
    const tRaw = String(body.target || '').toLowerCase().trim();
    const mtRaw = String(body.media_type || '').toLowerCase().trim();
    const target = (tRaw === 'facebook' || tRaw === 'instagram') ? tRaw : '';
    const media_type = (mtRaw === 'image') ? 'photo' : mtRaw; // normalize image -> photo
    const email = String(body.email || '').toLowerCase().trim();
    const media_url = String(body.media_url || '').trim();

    // Validate required fields (return booleans so caller sees what is missing)
    if (!email || !target || !media_type || !media_url) {
      return res.status(400).json({
        error: 'Missing required fields',
        fields: {
          email: !!email,
          target: !!target,
          media_type: !!media_type,
          media_url: !!media_url
        }
      });
    }

    // Verify reviewer email matches configured REVIEW_EMAIL
    const allowedEmail = String(process.env.REVIEW_EMAIL || '').toLowerCase().trim();
    if (!allowedEmail || email !== allowedEmail) {
      return res.status(403).json({ error: 'Reviewer email not authorized' });
    }

    // Validate media_type values
    if (media_type !== 'photo' && media_type !== 'video') {
      return res.status(400).json({ error: `Invalid media_type: ${media_type}` });
    }

    // Determine routeKey and ensure corresponding webhook env var exists
    const routeKey = `${target}_${media_type}`; // e.g., instagram_photo
    const routes = {
      instagram_photo: process.env.MAKE_IG_PHOTO_URL,
      instagram_video: process.env.MAKE_IG_VIDEO_URL,
      facebook_photo:  process.env.MAKE_FB_PHOTO_URL,
      facebook_video:  process.env.MAKE_FB_VIDEO_URL,
    };
    const webhook = routes[routeKey];

    if (!webhook) {
      // Return which envs are present as booleans without exposing values
      return res.status(400).json({
        error: `Unknown route or missing env var for route: ${routeKey}`,
        have: {
          MAKE_IG_PHOTO_URL: !!process.env.MAKE_IG_PHOTO_URL,
          MAKE_IG_VIDEO_URL: !!process.env.MAKE_IG_VIDEO_URL,
          MAKE_FB_PHOTO_URL: !!process.env.MAKE_FB_PHOTO_URL,
          MAKE_FB_VIDEO_URL: !!process.env.MAKE_FB_VIDEO_URL,
        }
      });
    }

    // Build minimal forwarding payload
    const payload = {
      email,
      target,
      media_type,
      media_url,
      routeKey,
      source: 'reviewer-portal',
      label: 'review'
    };

    const r = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const text = await r.text();

    // Allow same-origin calls; return JSON
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');

    if (!r.ok) {
      // Proxy upstream status and body/text (try JSON)
      try {
        const parsed = JSON.parse(text);
        return res.status(r.status).json(parsed);
      } catch {
        return res.status(r.status).send(text || `Upstream error (${r.status})`);
      }
    }

    // Success
    return res.status(200).json({ ok: true, routeKey, status: r.status });
  } catch (err) {
    return res.status(500).json({ error: 'Proxy error', detail: String(err?.message || err) });
  }
}