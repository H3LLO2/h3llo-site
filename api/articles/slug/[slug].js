import { kv } from '@vercel/kv';

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    return response.status(405).json({ error: 'Method Not Allowed' });
  }

  const { slug } = request.query;

  if (!slug) {
    return response.status(400).json({ error: 'Slug parameter is required' });
  }

  try {
    const articleId = await kv.get(`slug:${slug}`);

    if (!articleId) {
      return response.status(404).json({ error: 'Article not found for this slug' });
    }

    const article = await kv.get(`article:${articleId}`);

    if (!article) {
      // This case should ideally not happen if slug mapping is consistent
      console.error(`Consistency issue: articleId ${articleId} found for slug ${slug}, but article data not found.`);
      return response.status(404).json({ error: 'Article data not found' });
    }

    if (article.status !== 'published') {
      return response.status(404).json({ error: 'Article not published' });
    }
    
    // Optional: Check publicationDate if status was 'scheduled'
    // if (article.status === 'scheduled' && new Date(article.publicationDate) > new Date()) {
    //   return response.status(404).json({ error: 'Article not yet published' });
    // }


    return response.status(200).json(article);
  } catch (error) {
    console.error('Error fetching article by slug:', error);
    return response.status(500).json({ error: 'Internal Server Error' });
  }
}