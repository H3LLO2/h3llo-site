import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    console.log('[linking-candidates] Method not allowed:', req.method);
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const { current_type, current_challenge, current_geo, exclude_slug, limit: limitStr } = req.query;

    // Validate required parameters
    if (!current_type) {
      console.log('[linking-candidates] Missing current_type parameter');
      return res.status(400).json({ message: 'Missing current_type parameter' });
    }
    if (!current_challenge) {
      console.log('[linking-candidates] Missing current_challenge parameter');
      return res.status(400).json({ message: 'Missing current_challenge parameter' });
    }
    if (!current_geo) {
      console.log('[linking-candidates] Missing current_geo parameter');
      return res.status(400).json({ message: 'Missing current_geo parameter' });
    }
    if (!exclude_slug) {
      console.log('[linking-candidates] Missing exclude_slug parameter');
      return res.status(400).json({ message: 'Missing exclude_slug parameter' });
    }

    // Validate and parse limit parameter
    const limit = limitStr ? parseInt(limitStr, 10) : 30;
    if (isNaN(limit) || limit <= 0 || limit > 100) {
      console.log('[linking-candidates] Invalid limit parameter:', limitStr);
      return res.status(400).json({ message: 'Invalid limit parameter. Must be a positive integer <= 100' });
    }

    // Fetch all published article IDs
    const articleIds = await kv.zrange('articles_published_by_date', 0, -1, { rev: true });
    if (!articleIds || articleIds.length === 0) {
      console.log('[linking-candidates] No published articles found');
      return res.status(200).json([]);
    }

    // Fetch full article objects
    const articleKeys = articleIds.map(id => `article:${id}`);
    const articles = await kv.mget(...articleKeys);

    // Filter and validate candidates
    const candidates = articles.filter(article => {
      if (!article) return false;
      if (article.status !== 'published') return false;
      if (article.slug === exclude_slug) return false;
      if (!article.title || !article.slug || !article.type || !article.challenge || !article.geo || !article.publicationDate) return false;
      return true;
    });

    // Score each valid candidate article
    const scoredCandidates = candidates.map(candidate => {
      let score = 0;
      if (candidate.type === current_type) score += 3;
      if (candidate.challenge === current_challenge) score += 2;
      if (candidate.geo === current_geo) score += 1;
      return { ...candidate, score };
    });

    // Sort candidates
    scoredCandidates.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return new Date(b.publicationDate) - new Date(a.publicationDate);
    });

    // Limit the number of candidates
    const limitedCandidates = scoredCandidates.slice(0, limit);

    // Format output
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