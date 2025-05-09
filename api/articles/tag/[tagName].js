import { kv } from '@vercel/kv';

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    return response.status(405).json({ error: 'Method Not Allowed' });
  }

  const { tagName } = request.query;

  if (!tagName) {
    return response.status(400).json({ error: 'tagName parameter is required' });
  }

  try {
    const articleIds = await kv.smembers(`tag:${tagName}`);

    if (!articleIds || articleIds.length === 0) {
      return response.status(200).json([]); // No articles found for this tag
    }

    // Fetch all article objects.
    // Consider pagination if a tag can have a very large number of articles.
    const articles = await kv.mget(...articleIds.map(id => `article:${id}`));

    // Filter for published articles and remove any nulls (if an ID from set has no article)
    const publishedArticles = articles.filter(article => article && article.status === 'published');

    // Optional: Sort by publicationDate (descending)
    publishedArticles.sort((a, b) => {
      const dateA = a.publicationDate ? new Date(a.publicationDate) : new Date(0); // Treat missing date as very old
      const dateB = b.publicationDate ? new Date(b.publicationDate) : new Date(0);
      return dateB - dateA;
    });

    return response.status(200).json(publishedArticles);
  } catch (error) {
    console.error(`Error fetching articles by tag "${tagName}":`, error);
    return response.status(500).json({ error: 'Internal Server Error' });
  }
}