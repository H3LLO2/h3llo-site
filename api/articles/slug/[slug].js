import { kv } from '@vercel/kv';

export default async function handler(request, response) {
  // Grundlæggende log for at se om funktionen overhovedet rammes
  console.log(`[[slug].js] Handler invoked. Method: '${request.method}', Path: '${request.url}'`);

  if (request.method !== 'GET') {
    console.warn(`[[slug].js] Method Not Allowed - ${request.method}`);
    return response.status(405).json({ error: 'Method Not Allowed' });
  }

  const { slug } = request.query;
  console.log(`[[slug].js] Handling request for slug: '${slug}'`);

  if (!slug) {
    console.error('[[slug].js] Slug parameter is missing.');
    return response.status(400).json({ error: 'Slug parameter is required' });
  }

  try {
    const articleIdKey = `slug:${slug}`;
    console.log(`[[slug].js] Attempting to get articleId from KV with key: '${articleIdKey}'`);
    const articleId = await kv.get(articleIdKey);

    if (!articleId) {
      console.warn(`[[slug].js] No articleId found in KV for slug: '${slug}'. Returning 404.`);
      return response.status(404).json({ error: 'Article not found for this slug' });
    }
    // Først log articleId når vi ved det ikke er null/undefined
    console.log(`[[slug].js] articleId found for slug '${slug}': '${articleId}'`);

    const articleKey = `article:${articleId}`;
    console.log(`[[slug].js] Attempting to get article data from KV with key: '${articleKey}'`);
    const article = await kv.get(articleKey);

    if (!article) {
      console.error(`[[slug].js] Consistency issue. articleId '${articleId}' found for slug '${slug}', but article data not found in KV. Returning 404.`);
      return response.status(404).json({ error: 'Article data not found' });
    }
    // Log relevante felter efter vi ved 'article' eksisterer
    console.log(`[[slug].js] Article found. ID: '${article.articleId}', Title: '${article.title}', Status: '${article.status}'`);

    if (article.status !== 'published') {
      console.warn(`[[slug].js] Article with slug '${slug}' (ID: '${articleId}') found, but status is '${article.status}', not 'published'. Returning 404.`);
      return response.status(404).json({ error: 'Article not published' });
    }

    // Optional: Check publicationDate if status was 'scheduled'
    // if (article.status === 'scheduled' && new Date(article.publicationDate) > new Date()) {
    //   console.warn(`[[slug].js] Article with slug '${slug}' (ID: '${articleId}') is scheduled for future publication. Returning 404.`);
    //   return response.status(404).json({ error: 'Article not yet published' });
    // }

    console.log(`[[slug].js] Article with slug '${slug}' is published. Returning article data.`);
    return response.status(200).json(article);

  } catch (error) {
    console.error(`[[slug].js] Error fetching article by slug '${slug}':`, error);
    return response.status(500).json({ error: 'Internal Server Error' });
  }
}