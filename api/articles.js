// File: api/articles.js
import { kv } from '@vercel/kv';

// Define the serverless function handler
export default async function handler(request, response) {
  if (request.method === 'GET') {
    // Logic for GET /api/articles (List Published Articles)
    const { page = 1, limit = 10 } = request.query;
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);

    if (isNaN(pageNum) || pageNum < 1 || isNaN(limitNum) || limitNum < 1) {
      return response.status(400).json({ error: 'Invalid pagination parameters' });
    }

    const startIndex = (pageNum - 1) * limitNum;
    const endIndex = startIndex + limitNum - 1;

    try {
      // Retrieve articleIds from the sorted set
      const articleIds = await kv.zrange('articles_published_by_date', startIndex, endIndex, { rev: true });

      if (!articleIds || articleIds.length === 0) {
        return response.status(200).json({ data: [], pagination: { page: pageNum, limit: limitNum, totalPages: 0, totalItems: 0 } });
      }

      // Fetch full article objects using mget
      const articles = await kv.mget(...articleIds.map(id => `article:${id}`));
      
      // Filter out any null articles (if an ID in the sorted set doesn't have a corresponding article)
      // and ensure they are indeed published (though articles_published_by_date should only contain published/scheduled)
      const publishedArticles = articles.filter(article => article && article.status === 'published');

      // Optionally, get total count for pagination metadata
      const totalPublishedArticles = await kv.zcard('articles_published_by_date');

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
      console.error('Error fetching published articles:', error);
      return response.status(500).json({ error: 'Internal Server Error' });
    }
  } else if (request.method === 'POST') {
    // 2. Get data from the request body
  const {
    articleId: requestArticleId, // Use requestArticleId to avoid shadowing
    title,
    rawContent,
    authorName,
    sourceUrl,
    submissionPlatform,
    tags,
    initialStatus,
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
  if (initialStatus && typeof initialStatus !== 'string') {
    return response.status(400).json({ error: "Invalid data format", details: "Field 'initialStatus' must be of type 'string'." });
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
    status: initialStatus || "pending_review",
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
      if (!articleObject.publicationDate) {
        return response.status(400).json({
          error: "Missing publicationDate",
          details: "publicationDate is required when status is 'published' or 'scheduled'."
        });
      }
      await kv.zadd('articles_published_by_date', {
        score: new Date(articleObject.publicationDate).getTime(),
        member: articleId
      });
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