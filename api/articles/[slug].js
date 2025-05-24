import { kv } from '@vercel/kv';

export default async function handler(request, response) {
  // Hent slug fra query-parametre (Vercel router filnavnet [slug].js til request.query.slug)
  const { slug } = request.query;

  // Log for debugging
  console.log(`[api/articles/${slug}] Received request for slug: ${slug}`);

  if (!slug || typeof slug !== 'string') {
    console.log(`[api/articles/${slug}] Invalid or missing slug.`);
    return response.status(400).send('Bad request: Slug is missing or invalid.');
  }

  try {
    const kvKey = `html:${slug}`; // Præcis samme nøgleformat som da vi gemte
    console.log(`[api/articles/${slug}] Attempting to fetch HTML from KV with key: ${kvKey}`);

    const htmlContent = await kv.get(kvKey);

    if (htmlContent === null || htmlContent === undefined) { // Check for null (key not found) or undefined
      console.log(`[api/articles/${slug}] HTML content not found in KV for key: ${kvKey}`);
      return response.status(404).setHeader('Content-Type', 'text/html').send('<h1>404 - Siden blev ikke fundet</h1><p>Beklager, den artikel du ledte efter, findes ikke.</p>');
    }

    console.log(`[api/articles/${slug}] HTML content found for key: ${kvKey}. Serving...`);
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    return response.status(200).send(htmlContent);

  } catch (error) {
    console.error(`[api/articles/${slug}] Error fetching HTML from KV or serving page:`, error);
    return response.status(500).setHeader('Content-Type', 'text/html').send('<h1>500 - Intern Server Fejl</h1><p>Der opstod en fejl under forsøget på at vise siden.</p>');
  }
}