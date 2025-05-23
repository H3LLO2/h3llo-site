import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const { current_type, current_challenge, current_geo, exclude_slug, limit: limitStr } = req.query;

    if (!current_type || !current_challenge || !current_geo || !exclude_slug) {
      return res.status(400).json({ message: 'Missing required query parameters' });
    }

    const limit = limitStr ? Math.min(100, parseInt(limitStr, 10)) : 30;

    if (isNaN(limit) || limit <= 0) {
      return res.status(400).json({ message: 'Invalid limit parameter' });
    }

    console.log('[linking-candidates] Received parameters:', { current_type, current_challenge, current_geo, exclude_slug, limit });

    const articleIds = await kv.zrange('articles_published_by_date', 0, -1, { rev: true });

    if (!articleIds || articleIds.length === 0) {
      console.log('[linking-candidates] No published articles found.');
      return res.status(200).json([]);
    }

    const articleKeys = articleIds.map(id => `article:${id}`);
    const articles = await kv.mget(...articleKeys);

    const validCandidates = articles
      .filter(article => article !== null)
      .filter(article => article.status === 'published')
      .filter(article => article.slug !== exclude_slug)
      .filter(article => {
        return (
          typeof article.title === 'string' &&
          typeof article.slug === 'string' &&
          typeof article.type === 'string' &&
          typeof article.challenge === 'string' &&
          typeof article.geo === 'string' &&
          typeof article.publicationDate === 'string'
        );
      });

    const scoredCandidates = validCandidates.map(candidate => {
      let score = 0;
      if (candidate.type === current_type) score += 3;
      if (candidate.challenge === current_challenge) score += 2;
      if (candidate.geo === current_geo) score += 1;
      return { ...candidate, score };
    });

    scoredCandidates.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return new Date(b.publicationDate) - new Date(a.publicationDate);
    });

    const limitedCandidates = scoredCandidates.slice(0, limit);

    const formattedCandidates = limitedCandidates.map(candidate => ({
      title: candidate.title,
      slug: `/${candidate.slug}`,
      type: candidate.type,
      challenge: candidate.challenge,
      geo: candidate.geo,
    }));

    console.log(`[linking-candidates] Returning ${formattedCandidates.length} candidates`);
    return res.status(200).json(formattedCandidates);
  } catch (error) {
    console.error('[linking-candidates] Error:', error);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
}