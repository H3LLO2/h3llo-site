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
    title,
    rawContent,
    authorName,
    sourceUrl,
    submissionPlatform,
    tags, // Assuming tags is an array of strings
    // suggestedPublicationDate is not directly used in the article object based on design for POST
    initialStatus,
    // Fields from design not explicitly in old request body, but could be added:
    // metaKeywords, slug (though slug is usually generated or set in PUT), authorId, categoryId, featuredImageUrl
  } = request.body;

  // 3. Validate required fields
  if (!title || !rawContent) {
    return response.status(400).json({
      error: "Missing required fields",
      details: "The following fields are required: title, rawContent"
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

  // 5. Generate a unique articleId
  const articleId = Date.now().toString(36) + Math.random().toString(36).substring(2);
  const currentDate = new Date().toISOString();

  // 6. Construct the article object
  const articleObject = {
    articleId,
    title,
    rawContent,
    initialSubmissionDate: currentDate,
    lastUpdatedDate: currentDate,
    status: initialStatus || "pending_review",
    // Optional fields from request body
    ...(authorName && { authorName }),
    ...(sourceUrl && { sourceUrl }),
    ...(submissionPlatform && { submissionPlatform }),
    ...(tags && { tags }), // Ensure tags are included if provided
    // Fields from schema with no direct input yet, to be set to null or default
    finalHtmlContent: null,
    seoTitle: null,
    metaDescription: null,
    metaKeywords: [], // Default to empty array as per schema
    slug: null, // Slug might be generated later or on PUT
    publicationDate: null,
    featuredImageUrl: null,
    canonicalUrl: null,
    authorId: null,
    categoryId: null,
  };

  try {
    // 7. Store the article object in Vercel KV
    await kv.set(`article:${articleId}`, articleObject);

    // As per design doc: If a slug is generated at this stage (e.g., from the title), also:
    // await kv.set('slug:<generatedSlug>', articleId); (Check for slug uniqueness first)
    // For now, we are not generating slug on POST as per simpler interpretation of task.
    // Slug management will be more robustly handled in PUT.

    // As per design doc: If tags are provided:
    // For each tag in articleObject.tags: await kv.sadd('tag:<tagName>', articleId);
    if (articleObject.tags && articleObject.tags.length > 0) {
      for (const tag of articleObject.tags) {
        await kv.sadd(`tag:${tag}`, articleId);
      }
    }

    // 8. Return successful response
    response.setHeader('Content-Type', 'application/json');
    return response.status(201).json({
      message: "Article submitted successfully and stored.",
      articleId: articleId,
      status: articleObject.status
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