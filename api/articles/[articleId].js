import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  const { articleId: pathArticleId } = req.query;

  if (req.method !== 'PUT') {
    res.setHeader('Allow', ['PUT']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    const body = req.body;

    // Validate required fields from the body for an update
    // Based on design, these are typically what you'd update.
    // articleId is in path, but also expected in body for confirmation.
    const requiredFieldsForUpdate = ['articleId', 'status']; // finalHtmlContent, seoTitle, etc., are primary data.
    const missingFields = [];
    for (const field of requiredFieldsForUpdate) {
      if (body[field] === undefined || body[field] === null || (typeof body[field] === 'string' && body[field].trim() === '')) {
        missingFields.push(field);
      }
    }
    if (missingFields.length > 0) {
      return res.status(400).json({
        error: 'Bad Request: Missing required fields for update.',
        details: `Missing or empty fields: ${missingFields.join(', ')}`,
      });
    }

    // Validate articleId from body matches pathArticleId
    if (body.articleId !== pathArticleId) {
      return res.status(400).json({
        error: 'Bad Request: Article ID mismatch.',
        details: `The articleId in the request body ('${body.articleId}') does not match the articleId in the URL path ('${pathArticleId}').`,
      });
    }

    // --- Vercel KV Integration ---
    const kvKey = `article:${pathArticleId}`;
    const existingArticle = await kv.get(kvKey);

    if (!existingArticle) {
      return res.status(404).json({ error: 'Not Found', details: `Article with ID '${pathArticleId}' not found.` });
    }

    // Slug Management (as per design doc)
    const oldSlug = existingArticle.slug;
    const newSlug = body.slug; // slug from request body

    if (newSlug && newSlug !== oldSlug) {
      // Check if the new slug already exists and is not owned by the current article
      const slugOwner = await kv.get(`slug:${newSlug}`);
      if (slugOwner && slugOwner !== pathArticleId) {
        return res.status(409).json({ error: 'Conflict', details: `Slug '${newSlug}' is already in use.` });
      }
      // Delete old slug mapping if it existed
      if (oldSlug) {
        await kv.del(`slug:${oldSlug}`);
      }
      // Add new slug mapping
      await kv.set(`slug:${newSlug}`, pathArticleId);
    }


    // Tag Management (as per design doc)
    const existingTags = existingArticle.tags || [];
    const newTags = body.tags || []; // tags from request body, ensure it's an array

    if (body.tags !== undefined && !Array.isArray(newTags)) {
        return res.status(400).json({ error: 'Bad Request: Invalid data format.', details: "Field 'tags' must be an array of strings if provided."});
    }
    if (newTags.some(tag => typeof tag !== 'string')) {
        return res.status(400).json({ error: 'Bad Request: Invalid data format.', details: "All items in 'tags' must be strings."});
    }


    const tagsToRemove = existingTags.filter(t => !newTags.includes(t));
    const tagsToAdd = newTags.filter(t => !existingTags.includes(t));

    for (const tag of tagsToRemove) {
      await kv.srem(`tag:${tag}`, pathArticleId);
    }
    for (const tag of tagsToAdd) {
      await kv.sadd(`tag:${tag}`, pathArticleId);
    }

    // Merge new data into existingArticle
    const updatedArticle = {
      ...existingArticle,
      ...body, // This will overwrite fields in existingArticle with those from body
      lastUpdatedDate: new Date().toISOString(),
    };
    
    // Ensure specific fields that might be explicitly nulled or not present in body are handled
    // For example, if body.finalHtmlContent is not provided, it should retain existingArticle.finalHtmlContent
    // The spread operator handles this well, but be mindful of fields you want to explicitly clear if body doesn't send them.
    // The design implies body will contain all fields to be updated.

    // Validate publicationDate if status is 'scheduled'
    if (updatedArticle.status === 'scheduled' && !updatedArticle.publicationDate) {
      return res.status(400).json({
        error: 'Bad Request: Missing publicationDate for scheduled status.',
        details: "Field 'publicationDate' is required when status is 'scheduled'.",
      });
    }
    if (updatedArticle.publicationDate && (typeof updatedArticle.publicationDate !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(updatedArticle.publicationDate))) {
        return res.status(400).json({
          error: 'Bad Request: Invalid data format for publicationDate.',
          details: "Field 'publicationDate' must be a valid ISO 8601 date-time string (e.g., '2023-10-26T10:00:00Z').",
        });
    }


    // Published/Scheduled Status Management for Sorted Set (as per design doc)
    const oldStatus = existingArticle.status;
    const oldPublicationDate = existingArticle.publicationDate;
    const newStatus = updatedArticle.status;
    const newPublicationDate = updatedArticle.publicationDate;

    if ((oldStatus === "published" || oldStatus === "scheduled") && (newStatus !== oldStatus || newPublicationDate !== oldPublicationDate)) {
        if (oldPublicationDate) { // Only attempt zrem if there was a score to remove by
             await kv.zrem('articles_published_by_date', pathArticleId);
        }
    }

    if ((newStatus === "published" || newStatus === "scheduled") && newPublicationDate) {
      await kv.zadd('articles_published_by_date', { score: new Date(newPublicationDate).getTime(), member: pathArticleId });
    }


    // Store the updated article object back into Vercel KV
    await kv.set(kvKey, updatedArticle);

    // Construct success response
    res.setHeader('Content-Type', 'application/json');
    let successResponse;
    if (updatedArticle.status === 'published') {
      successResponse = {
        message: 'Article updated and published successfully.',
        articleId: pathArticleId,
        status: updatedArticle.status,
        url: `/articles/${updatedArticle.slug}`,
      };
    } else if (updatedArticle.status === 'scheduled') {
      successResponse = {
        message: 'Article updated and scheduled for publication.',
        articleId: pathArticleId,
        status: updatedArticle.status,
        publicationDate: updatedArticle.publicationDate,
      };
    } else {
      successResponse = {
        message: 'Article updated successfully.',
        articleId: pathArticleId,
        status: updatedArticle.status,
      };
    }
    
    console.log(`Article ${pathArticleId} updated. Status: ${updatedArticle.status}.`);
    return res.status(200).json(successResponse);

  } catch (error) {
    console.error(`Error processing PUT /api/articles/${pathArticleId}:`, error);
    if (error instanceof SyntaxError && error.message.includes('JSON')) {
        return res.status(400).json({ error: 'Bad Request: Invalid JSON format.' });
    }
    // Distinguish KV errors if possible, though generic 500 is okay
    return res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
}