// File: api/articles.js
import { kv } from '@vercel/kv';

export default async function handler(request, response) {
  console.log(`[api/articles] Handler invoked. Method: '${request.method}', Path: '${request.url}'`); // KRITISK LOG-LINJE

  if (request.method === 'GET') {
    console.log('[GET /api/articles] Entered GET handler.');
    const { page = 1, limit = 10 } = request.query;
    console.log(`[GET /api/articles] Page: ${page}, Limit: ${limit}`);

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);

    if (isNaN(pageNum) || pageNum < 1 || isNaN(limitNum) || limitNum < 1 || limitNum > 100) { // Add max limit
      console.error('[GET /api/articles] Invalid pagination parameters.');
      return response.status(400).json({ error: 'Invalid pagination parameters. Max limit is 100.' });
    }

    const startIndex = (pageNum - 1) * limitNum;
    const endIndex = startIndex + limitNum - 1;
    console.log(`[GET /api/articles] Fetching article IDs from index ${startIndex} to ${endIndex}.`);

    try {
      const articleIds = await kv.zrange('articles_published_by_date', startIndex, endIndex, { rev: true });
      console.log(`[GET /api/articles] Fetched ${articleIds ? articleIds.length : 0} article IDs.`);

      if (!articleIds || articleIds.length === 0) {
        console.log('[GET /api/articles] No articles found for this page.');
        return response.status(200).json({ data: [], pagination: { page: pageNum, limit: limitNum, totalPages: 0, totalItems: 0 } });
      }

      console.log('[GET /api/articles] Fetching full article objects using mget.');
      const articles = await kv.mget(...articleIds.map(id => `article:${id}`));
      console.log(`[GET /api/articles] Fetched ${articles ? articles.length : 0} full article objects.`);

      const publishedArticles = articles.filter(article => article && article.status === 'published');
      console.log(`[GET /api/articles] Filtered down to ${publishedArticles.length} published articles.`);

      const totalPublishedArticles = await kv.zcard('articles_published_by_date');
      console.log(`[GET /api/articles] Total published articles in KV: ${totalPublishedArticles}.`);

      console.log('[GET /api/articles] Sending success response.');
      return response.status(200).json({
        data: publishedArticles,
        pagination: {
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(totalPublishedArticles / limitNum),
          totalItems: totalPublishedArticles
        }
      });

    } catch (error) {
      console.error('[GET /api/articles] Error during GET processing:', error);
      return response.status(500).json({ error: 'Internal Server Error while fetching articles.' });
    }
  } else if (request.method === 'POST') {
    // LOGGING: Print the entire request body
    console.log("Received request body in /api/articles:", JSON.stringify(request.body, null, 2));

    // Destructure 'status' from the request body
    const {
      articleId: requestArticleId,
      title,
      rawContent,
      authorName,
      sourceUrl,
      submissionPlatform,
      tags,
      status, // Dette er feltet, vi forventer fra n8n
      finalHtmlContent,
      seoTitle,
      metaDescription,
      metaKeywords,
      slug,
      publicationDate,
      featuredImageUrl,
      featuredImageAltText,
      canonicalUrl,
      authorId,
      categoryId
    } = request.body;

  // 3. Validate required fields
  if (!title || !rawContent || !slug) {
    return response.status(400).json({
      error: "Missing required fields",
      details: "The following fields are required: title, rawContent, slug"
    });
  }

  // 4. Basic type validation (can be expanded)
  if (typeof title !== 'string') {
    return response.status(400).json({ error: "Invalid data format", details: "Field 'title' must be of type 'string'." });
  }
  if (typeof rawContent !== 'string') {
    return response.status(400).json({ error: "Invalid data format", details: "Field 'rawContent' must be of type 'string'." });
  }
  if (authorName && typeof authorName !== 'string') {
    return response.status(400).json({ error: "Invalid data format", details: "Field 'authorName' must be of type 'string'." });
  }
  if (sourceUrl) {
    if (typeof sourceUrl !== 'string') {
        return response.status(400).json({ error: "Invalid data format", details: "Field 'sourceUrl' must be of type 'string'." });
    }
    try {
      new URL(sourceUrl);
    } catch (_) {
      return response.status(422).json({ error: "Unprocessable content", details: "Field 'sourceUrl' must be a valid URL." });
    }
  }
  if (submissionPlatform && typeof submissionPlatform !== 'string') {
    return response.status(400).json({ error: "Invalid data format", details: "Field 'submissionPlatform' must be of type 'string'." });
  }
  if (tags && (!Array.isArray(tags) || !tags.every(tag => typeof tag === 'string'))) {
    return response.status(400).json({ error: "Invalid data format", details: "Field 'tags' must be an array of strings." });
  }
  if (status && typeof status !== 'string') {
    return response.status(400).json({ error: "Invalid data format", details: "Field 'status' must be of type 'string'." });
  }

  // 5. Use provided articleId or generate a unique one
  const articleId = requestArticleId || Date.now().toString(36) + Math.random().toString(36).substring(2);

  // 6. Check if articleId already exists
  const existingArticle = await kv.get(`article:${articleId}`);
  if (existingArticle) {
    return response.status(409).json({
      error: "Article ID already exists",
      details: `Article with ID '${articleId}' already exists. Use PUT to update.`
    });
  }

  const currentDate = new Date().toISOString();

  // 7. Construct the article object
  const articleObject = {
    articleId,
    title,
    rawContent,
    initialSubmissionDate: currentDate,
    lastUpdatedDate: currentDate,
    status: status || "pending_review", // Bruger 'status' fra payload, ellers default
    finalHtmlContent: finalHtmlContent || null,
    seoTitle: seoTitle || null,
    metaDescription: metaDescription || null,
    metaKeywords: metaKeywords || [],
    slug: slug || null,
    publicationDate: publicationDate || null,
    featuredImageUrl: featuredImageUrl || null,
    featuredImageAltText: featuredImageAltText || null,
    canonicalUrl: canonicalUrl || null,
    authorName: authorName || null,
    authorId: authorId || null,
    categoryId: categoryId || null,
    sourceUrl: sourceUrl || null,
    submissionPlatform: submissionPlatform || null,
    tags: tags || [],
  };

  try {
    // 8. Store the article object in Vercel KV
    await kv.set(`article:${articleId}`, articleObject);

    // 9. Handle slug mapping
    const slugKey = `slug:${slug}`;
    const existingSlug = await kv.get(slugKey);
    if (existingSlug && existingSlug !== articleId) {
      return response.status(409).json({
        error: "Slug already exists",
        details: `Slug '${slug}' is already in use by article ID '${existingSlug}'.`
      });
    }
    await kv.set(slugKey, articleId);

    // 10. Handle tags
    if (articleObject.tags && articleObject.tags.length > 0) {
      for (const tag of articleObject.tags) {
        await kv.sadd(`tag:${tag}`, articleId);
      }
    }

    // 11. Handle published/scheduled status
    if (articleObject.status === "published" || articleObject.status === "scheduled") {
      const pubDate = articleObject.publicationDate ? new Date(articleObject.publicationDate).getTime() : new Date().getTime();
      try {
        await kv.zadd('articles_published_by_date', {
          score: pubDate,
          member: articleId
        });
      } catch (zaddError) {
        console.error("Error adding to sorted set:", zaddError);
        return response.status(500).json({
          error: "Failed to add to sorted set",
          details: zaddError.message
        });
      }
    }

    // 12. Return successful response
    response.setHeader('Content-Type', 'application/json');
    return response.status(201).json({
      message: "Article submitted and published successfully.",
      articleId: articleId,
      status: articleObject.status,
      url: `/articles/${slug}`
    });

  } catch (error) {
    console.error("KV operation failed:", error);
    return response.status(500).json({
      error: "Failed to store article",
      details: error.message
    });
  }
  } else {
    response.setHeader('Allow', ['GET', 'POST']);
    return response.status(405).json({ error: `Method ${request.method} Not Allowed` });
  }
}