import { kv } from '@vercel/kv';

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    console.error(`[linking-candidates] Method ${request.method} Not Allowed`);
    response.setHeader('Allow', ['GET']);
    return response.status(405).json({ error: `Method ${request.method} Not Allowed` });
  }

  const { current_type, current_challenge, current_geo, exclude_slug, limit = 30 } = request.query;

  if (!current_type || !current_challenge || !current_geo || !exclude_slug) {
    console.error('[linking-candidates] Missing required query parameters');
    return response.status(400).json({ error: 'Missing required query parameters' });
  }

  const limitNum = parseInt(limit, 10);
  if (isNaN(limitNum) || limitNum < 1) {
    console.error('[linking-candidates] Invalid limit parameter');
    return response.status(400).json({ error: 'Invalid limit parameter' });
  }

  try {
    console.log('[linking-candidates] Fetching all published article IDs');
    const articleIds = await kv.zrange('articles_published_by_date', 0, -1, { rev: true });

    if (!articleIds || articleIds.length === 0) {
      console.log('[linking-candidates] No published articles found');
      return response.status(200).json([]);
    }

    console.log(`[linking-candidates] Found ${articleIds.length} article IDs, fetching article objects`);
    const articles = await kv.mget(...articleIds.map(id => `article:${id}`));

    console.log(`[linking-candidates] Filtering articles`);
    const candidateArticles = articles
      .filter(article => article && article.status === 'published' && article.slug !== exclude_slug &&
                         article.type && article.challenge && article.geo && article.title && article.slug)
      .map(article => ({
        ...article,
        score: 0
      }));

    console.log(`[linking-candidates] Scoring articles`);
    candidateArticles.forEach(article => {
      if (article.type === current_type) {
        article.score += 3;
      }
      if (article.challenge === current_challenge) {
        article.score += 2;
      }
      if (article.geo === current_geo) {
        article.score += 1;
      }
    });

    console.log(`[linking-candidates] Sorting articles`);
    candidateArticles.sort((a, b) => {
      if (a.score !== b.score) {
        return b.score - a.score;
      }
      return new Date(b.publicationDate) - new Date(a.publicationDate);
    });

    console.log(`[linking-candidates] Limiting to ${limitNum} articles`);
    const limitedCandidates = candidateArticles.slice(0, limitNum);

    console.log(`[linking-candidates] Formatting output`);
    const output = limitedCandidates.map(article => ({
      title: article.title,
      slug: `/${article.slug}`,
      type: article.type,
      challenge: article.challenge,
      geo: article.geo
    }));

    console.log(`[linking-candidates] Returning ${output.length} candidates`);
    return response.status(200).json(output);

  } catch (error) {
    console.error('[linking-candidates] KV operation failed:', error);
    return response.status(500).json({ error: 'Internal Server Error' });
  }
}