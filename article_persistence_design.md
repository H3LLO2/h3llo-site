# Data Persistence Strategy for Articles

**1. Storage Mechanism Recommendation:**

*   **Recommendation:** **Vercel KV Store**
*   **Justification:**
    *   **Simplicity & Ease of Integration:** Vercel KV is a serverless data store built on Redis, offering a simple key-value API (`@vercel/kv` package). It integrates seamlessly with Vercel serverless functions, requiring minimal setup.
    *   **Scalability for a Blog:** While starting with a moderate number of articles, Vercel KV can handle the anticipated growth (10-20 new articles/month) efficiently. It's suitable for storing article objects as JSON.
    *   **Vercel Ecosystem:** Being part of the Vercel ecosystem ensures optimized performance and ease of management within your existing hosting environment.
    *   **Querying Needs:** It can support direct lookups by `articleId`, and with careful key design (see Data Retrieval Strategy), it can also facilitate fetching by `slug`, listing published articles, and filtering by `tags`.
    *   **Persistence:** Unlike the ephemeral filesystem of serverless functions, Vercel KV provides persistent storage. This is crucial as your API endpoints need to write data that lasts beyond a single invocation.
    *   **Cost-Effective:** Vercel KV has a generous free tier, making it cost-effective for projects of this scale.

    While flat files (JSON/Markdown) are simple, they present challenges for dynamic writes and querying within Vercel's serverless environment without a more complex Git-based workflow or triggering rebuilds. A full SQL database like Vercel Postgres is powerful but might be overkill for the current, clearly defined needs and emphasis on simplicity. Vercel KV strikes a good balance.

**2. Data Structure/Schema:**

Each article will be stored as a JSON object. The primary key for an article in the KV store could be `article:<articleId>`.

```json
{
  "articleId": "string", // Unique identifier, e.g., "ksi5fs4f6s7g8h9"
  "title": "string", // Initial title from POST, can be overridden by seoTitle for display
  "rawContent": "string", // Raw content (e.g., Markdown, plain text) from initial submission
  "finalHtmlContent": "string", // SEO-optimized HTML content from PUT
  "seoTitle": "string", // SEO-optimized title
  "metaDescription": "string",
  "metaKeywords": ["string"], // Array of keywords
  "slug": "string", // URL-friendly slug, must be unique
  "status": "string", // "draft", "pending_review", "published", "scheduled"
  "authorName": "string", // Optional
  "sourceUrl": "string", // Optional, URL of the original source if any
  "submissionPlatform": "string", // Optional, e.g., "N8N", "Make.com"
  "tags": ["string"], // Array of tags, e.g., ["seo", "content-marketing"]
  "initialSubmissionDate": "ISO8601_string", // Timestamp, e.g., "2023-10-27T10:00:00Z"
  "lastUpdatedDate": "ISO8601_string", // Timestamp, e.g., "2023-10-28T14:30:00Z"
  "publicationDate": "ISO8601_string", // Optional, required if status is "scheduled", e.g., "2023-11-15T09:00:00Z"
  "featuredImageUrl": "string", // Optional
  "canonicalUrl": "string", // Optional
  "authorId": "string", // Optional, if you have a separate authors collection/system
  "categoryId": "string" // Optional, if you have a separate categories collection/system
}
```

**Key Naming Conventions for Vercel KV:**
*   **Individual Articles:** `article:<articleId>` (e.g., `article:ksi5fs4f6s7g8h9`) -> Stores the JSON object above.
*   **Slug to Article ID Mapping:** `slug:<slugValue>` (e.g., `slug:my-awesome-post`) -> Stores `articleId`. This allows for quick lookups by slug and helps ensure slug uniqueness.
*   **Tag to Article IDs Mapping:** `tag:<tagName>` (e.g., `tag:seo`) -> Stores a Vercel KV Set of `articleId`s that have this tag.
*   **Published Articles Sorted by Date:** `articles_published_by_date` -> A Vercel KV Sorted Set where:
    *   **Score:** `publicationDate` (Unix timestamp or lexicographically sortable ISO8601 string).
    *   **Member:** `articleId`.

**3. API Integration Points:**

*   **`POST /api/articles` ([`api/articles.js`](api/articles.js:1)):**
    1.  Receives raw article data (`title`, `rawContent`, `authorName`, etc.).
    2.  Generates a unique `articleId` (current method is fine: [`Date.now().toString(36) + Math.random().toString(36).substring(2);`](api/articles.js:95)).
    3.  Sets `initialSubmissionDate` to the current timestamp.
    4.  Sets `lastUpdatedDate` to the current timestamp.
    5.  Determines `status` (e.g., `initialStatus` from request body or default to "pending_review").
    6.  Constructs the article JSON object with the initial data.
    7.  **Storage Interaction (Vercel KV):**
        *   `await kv.set('article:<articleId>', articleObject);`
        *   If a `slug` is generated at this stage (e.g., from the title), also:
            *   `await kv.set('slug:<generatedSlug>', articleId);` (Check for slug uniqueness first by trying to get `slug:<generatedSlug>`).
        *   If `tags` are provided:
            *   For each tag in `articleObject.tags`: `await kv.sadd('tag:<tagName>', articleId);`
    8.  Returns `articleId` and `status`.

*   **`PUT /api/articles/{articleId}` ([`api/articles/[articleId].js`](api/articles/[articleId].js:1)):**
    1.  Receives `articleId` (from path and body), `finalHtmlContent`, `seoTitle`, `metaDescription`, `slug`, `status`, and other metadata.
    2.  **Storage Interaction (Vercel KV):**
        *   Fetch the existing article: `const existingArticle = await kv.get('article:<articleId>');`
        *   If `!existingArticle`, return a 404 error.
        *   **Slug Management:**
            *   If the `slug` in the payload is different from `existingArticle.slug`:
                *   Check if the new slug already exists: `const slugOwner = await kv.get('slug:<newSlug>');` If it exists and `slugOwner !== articleId`, return a conflict error (slug not unique).
                *   Delete the old slug mapping: `await kv.del('slug:<existingArticle.slug>');`
                *   Add the new slug mapping: `await kv.set('slug:<newSlug>', articleId);`
        *   **Tag Management:**
            *   Determine tags to remove: `tagsToRemove = existingArticle.tags.filter(t => !newArticleData.tags.includes(t))`
            *   Determine tags to add: `tagsToAdd = newArticleData.tags.filter(t => !existingArticle.tags.includes(t))`
            *   For each tag in `tagsToRemove`: `await kv.srem('tag:<tagName>', articleId);`
            *   For each tag in `tagsToAdd`: `await kv.sadd('tag:<tagName>', articleId);`
        *   Merge the new data into `existingArticle`, updating fields like `finalHtmlContent`, `seoTitle`, `metaDescription`, `slug`, `status`, `metaKeywords`, `tags`, `publicationDate`, `featuredImageUrl`, etc.
        *   Update `lastUpdatedDate` to the current timestamp.
        *   `await kv.set('article:<articleId>', updatedArticleObject);`
        *   **Published/Scheduled Status Management for Sorted Set:**
            *   If `existingArticle.status` was "published" or "scheduled" and the new `status` is different OR `publicationDate` changed: Remove from `articles_published_by_date` sorted set: `await kv.zrem('articles_published_by_date', articleId);`
            *   If `updatedArticleObject.status` is "published" or "scheduled" and `publicationDate` is set: Add/update in sorted set: `await kv.zadd('articles_published_by_date', { score: new Date(updatedArticleObject.publicationDate).getTime(), member: articleId });`
    3.  Returns success response with `articleId`, `status`, and `url` or `publicationDate` as appropriate.

**4. Data Retrieval Strategy (for website display):**

*   **Fetching a single article by its `slug`:**
    1.  `const articleId = await kv.get('slug:<slugValue>');`
    2.  If `articleId`: `const article = await kv.get('article:<articleId>');`
    3.  Ensure `article.status === 'published'` (and `publicationDate` is in the past if it was "scheduled") before displaying.

*   **Fetching a list of all "published" articles, sorted by `publicationDate` (descending for newest first):**
    1.  `const articleIds = await kv.zrange('articles_published_by_date', 0, -1, { rev: true });` (Using `rev: true` for descending order. The score should be publication timestamp).
        *   This retrieves `articleId`s whose `status` is "published" or "scheduled" (and whose `publicationDate` is in the past). You might need an additional check or a separate sorted set if you only want *currently* published articles. For simplicity, this sorted set would typically only contain articles intended for public view.
    2.  For each `articleId` (or a paginated subset): `const article = await kv.get('article:<articleId>');`
    3.  This might involve multiple `kv.get` calls. For larger lists, consider `kv.mget(...articleIds)` if fetching many at once.

*   **Fetching articles by `tag`:**
    1.  `const articleIds = await kv.smembers('tag:<tagName>');`
    2.  For each `articleId` in the set: `const article = await kv.get('article:<articleId>');`
    3.  Filter these articles further by `status === 'published'` and sort as needed (e.g., by `publicationDate`) in your application code.

**5. Directory Structure (if file-based):**

*   Since Vercel KV is recommended (a database-like store), a traditional file-based directory structure like `content/articles/{articleId}.json` is not directly applicable for the primary data storage. The "directory" is managed by the key naming conventions within Vercel KV as outlined above (e.g., `article:*`, `slug:*`, `tag:*`).