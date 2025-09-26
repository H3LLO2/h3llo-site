// /api/make-proxy.js
// CommonJS Vercel Serverless Function. Dispatches incoming requests to one of several Make webhooks
// based on target and mediaType. Route keys map to environment variables:
//   facebook_video  -> MAKE_FB_VIDEO_URL
//   facebook_photo  -> MAKE_FB_PHOTO_URL
//   instagram_video -> MAKE_IG_VIDEO_URL
//   instagram_photo -> MAKE_IG_PHOTO_URL

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const WEBHOOKS = {
    facebook_video: process.env.MAKE_FB_VIDEO_URL,
    facebook_photo: process.env.MAKE_FB_PHOTO_URL,
    instagram_video: process.env.MAKE_IG_VIDEO_URL,
    instagram_photo: process.env.MAKE_IG_PHOTO_URL
  };

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const target = String((body.target || "")).toLowerCase().trim();
    const mediaType = String((body.mediaType || body.media_type || "")).toLowerCase().trim();
    const routeKey = `${target}_${mediaType}`;
    const url = WEBHOOKS[routeKey];

    if (!url) {
      return res.status(400).json({ error: `Unknown route: ${routeKey}` });
    }

    const fwd = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, routeKey })
    });

    const text = await fwd.text();
    if (!fwd.ok) {
      return res.status(fwd.status).send(text || `Upstream error (${fwd.status})`);
    }

    // Try to return JSON when possible, otherwise fallback to a minimal OK payload
    try {
      const maybeJson = JSON.parse(text);
      return res.status(200).json({ ok: true, routeKey, status: fwd.status, upstream: maybeJson });
    } catch {
      return res.status(200).json({ ok: true, routeKey, status: fwd.status });
    }
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Proxy failed" });
  }
};