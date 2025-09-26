// /api/make-proxy.js
// Vercel Serverless Function. Dispatches incoming requests to one of several Make webhooks
// based on target and mediaType. Route keys map to environment variables:
//   facebook_video  -> MAKE_FB_VIDEO_URL
//   facebook_photo  -> MAKE_FB_PHOTO_URL
//   instagram_video -> MAKE_IG_VIDEO_URL
//   instagram_photo -> MAKE_IG_PHOTO_URL

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const body = req.body || {};
  const rawTarget = (body.target || "").toString();
  const rawMediaType = (body.mediaType || body.media_type || "").toString();
  const target = rawTarget.trim().toLowerCase();
  const mediaType = rawMediaType.trim().toLowerCase();
  const routeKey = `${target}_${mediaType}`;

  const allowed = new Set([
    "facebook_video",
    "facebook_photo",
    "instagram_video",
    "instagram_photo"
  ]);

  if (!allowed.has(routeKey)) {
    return res.status(400).json({ error: `Unknown route: ${routeKey}` });
  }

  const webhookMap = {
    facebook_video: process.env.MAKE_FB_VIDEO_URL,
    facebook_photo: process.env.MAKE_FB_PHOTO_URL,
    instagram_video: process.env.MAKE_IG_VIDEO_URL,
    instagram_photo: process.env.MAKE_IG_PHOTO_URL
  };

  const webhook = webhookMap[routeKey];
  if (!webhook) {
    // upstream webhook not configured
    return res.status(500).json({ error: "Upstream webhook not configured" });
  }

  try {
    const forwardedBody = { ...body, routeKey };
    const result = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(forwardedBody)
    });

    const text = await result.text();

    if (!result.ok) {
      // Try to return JSON error if upstream sent JSON
      try {
        const parsed = JSON.parse(text);
        return res.status(result.status).json(parsed);
      } catch (e) {
        return res.status(result.status).send(text);
      }
    }

    return res.status(200).json({ ok: true, routeKey, status: result.status });
  } catch (err) {
    // generic error; do not leak env values
    console.error("Make proxy error", err);
    return res.status(500).json({ error: "Proxy failed" });
  }
}