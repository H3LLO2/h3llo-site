import { kv } from '@vercel/kv';

export default async function handler(request, response) {
  // Log request method and URL for debugging
  console.log(`[save-article-html] Received request. Method: ${request.method}, URL: ${request.url}`);

  if (request.method !== 'POST') {
    console.log('[save-article-html] Method not allowed:', request.method);
    response.setHeader('Allow', ['POST']);
    return response.status(405).json({ message: 'Method Not Allowed. Please use POST.' });
  }

  try {
    // Ensure the body is parsed as JSON
    let body;
    if (typeof request.body === 'string') {
      try {
        body = JSON.parse(request.body);
      } catch (parseError) {
        console.error('[save-article-html] Error parsing request body as JSON:', parseError);
        return response.status(400).json({ message: 'Invalid JSON in request body.' });
      }
    } else {
      body = request.body; // Assume it's already an object (common in Vercel)
    }

    const { slug, htmlContent } = body;

    // Log received slug and a snippet of HTML content for verification
    console.log(`[save-article-html] Received slug: ${slug}`);
    console.log(`[save-article-html] Received htmlContent (first 100 chars): ${htmlContent ? htmlContent.substring(0, 100) : 'No htmlContent received'}`);

    // Validate required parameters
    if (!slug || typeof slug !== 'string' || slug.trim() === "") {
      console.log('[save-article-html] Missing or invalid slug parameter.');
      return response.status(400).json({ message: 'Missing or invalid "slug" parameter. It must be a non-empty string.' });
    }
    if (!htmlContent || typeof htmlContent !== 'string') {
      console.log('[save-article-html] Missing or invalid htmlContent parameter.');
      return response.status(400).json({ message: 'Missing or invalid "htmlContent" parameter. It must be a string.' });
    }

    const kvKey = `html:${slug}`; // Using the 'slug_for_kv' which is already cleaned
    console.log(`[save-article-html] Attempting to save HTML to KV with key: ${kvKey}`);

    await kv.set(kvKey, htmlContent);

    console.log(`[save-article-html] Successfully saved HTML to KV for key: ${kvKey}`);
    return response.status(200).json({ message: 'HTML content saved successfully.', kvKey: kvKey });

  } catch (error) {
    console.error('[save-article-html] Error processing request:', error);
    return response.status(500).json({ message: 'Internal Server Error while saving HTML content.', details: error.message });
  }
}