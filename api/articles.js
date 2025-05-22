// File: api/articles.js
import { kv } from '@vercel/kv';

export default async function handler(request, response) {
  if (request.method === 'POST') {
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