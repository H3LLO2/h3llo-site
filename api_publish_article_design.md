## API Design: Publish SEO-Optimized Article

This document outlines the design for the API endpoint responsible for receiving and publishing the final, SEO-optimized version of an article after processing by an external service like N8N/Make.com.

---

### 1. Endpoint Path & HTTP Method

*   **Method:** `PUT`
*   **Path:** `/api/articles/{articleId}`

**Justification:**
*   The `PUT` method is appropriate as this operation updates an existing article resource that was initially created (or at least its record was established) via the `POST /api/articles` endpoint.
*   Using the `articleId` as a path parameter is a standard RESTful practice for identifying the specific resource to be updated. This clearly distinguishes it from creating a new resource.

---

### 2. Request Body (JSON)

The request body should be a JSON object containing the final, publishable details of the article.

**Structure and Fields:**

```json
{
  "articleId": "string", // Required: Matches the {articleId} in the path. For validation.
  "finalHtmlContent": "string", // Required: The full HTML content of the article body.
  "seoTitle": "string", // Required: The SEO-optimized title for the <title> tag and og:title.
  "metaDescription": "string", // Required: The description for <meta name="description"> and og:description.
  "slug": "string", // Required: URL-friendly version of the title (e.g., "my-awesome-seo-article"). Must be unique.
  "status": "string", // Required: The new status of the article (e.g., "published", "scheduled", "draft").
  "metaKeywords": ["string"], // Optional: Array of keywords for <meta name="keywords">.
  "publicationDate": "string", // Optional: ISO 8601 date-time string (e.g., "2023-10-26T10:00:00Z"). If provided and in the future, implies scheduling. If not provided, could default to immediate publication or retain existing.
  "featuredImageUrl": "string", // Optional: URL for the article's featured image.
  "canonicalUrl": "string", // Optional: If the article should point to another URL as the original source.
  "authorId": "string", // Optional: Identifier for the author if authors are managed as separate entities.
  "categoryId": "string" // Optional: Identifier for the article's category if categories are managed.
}
```

**Field Descriptions:**

*   `articleId`: (String, Required) The unique identifier of the article, obtained from the initial `POST /api/articles` submission. Must match the `articleId` in the URL path.
*   `finalHtmlContent`: (String, Required) The complete, SEO-optimized HTML content for the article's body.
*   `seoTitle`: (String, Required) The title to be used in the HTML `<title>` tag and for social sharing (e.g., `og:title`).
*   `metaDescription`: (String, Required) The description for search engines (`<meta name="description">`) and social sharing (e.g., `og:description`).
*   `slug`: (String, Required) A URL-friendly string derived from the title, used to access the article (e.g., `yourdomain.com/articles/{slug}`). This should be unique.
*   `status`: (String, Required) The intended publication status. Examples:
    *   `published`: The article is live and publicly accessible.
    *   `scheduled`: The article is set to go live at the `publicationDate`.
    *   `draft`: The article is saved but not yet published or scheduled.
    *   This will update the status set during the initial submission.
*   `metaKeywords`: (Array of Strings, Optional) A list of keywords relevant to the article content.
*   `publicationDate`: (String, Optional, ISO 8601 Format) The date and time when the article should be published. If this date is in the future and `status` is `scheduled`, the system should handle delayed publishing. If `status` is `published` and this is not set, it implies immediate publication.
*   `featuredImageUrl`: (String, Optional) URL of an image to be prominently displayed with the article.
*   `canonicalUrl`: (String, Optional) The canonical URL for the article, used if this content is a republication or should point to a different primary source for SEO purposes.
*   `authorId`: (String, Optional) If your system has a separate authors entity, this would be the foreign key.
*   `categoryId`: (String, Optional) If your system has a separate categories entity, this would be the foreign key.

---

### 3. Success Response

*   **HTTP Status Code:** `200 OK`
    *   This code indicates that the article resource identified by `{articleId}` was successfully updated with the provided data.

*   **Response Body (JSON Example):**
    ```json
    {
      "message": "Article updated and published successfully.",
      "articleId": "existingArticleId123",
      "status": "published", // The new status of the article
      "url": "/articles/my-awesome-seo-article" // Relative URL to the published article (if applicable and status is 'published')
    }
    ```
    Or, if scheduled:
    ```json
    {
      "message": "Article updated and scheduled for publication.",
      "articleId": "existingArticleId123",
      "status": "scheduled",
      "publicationDate": "2023-10-26T10:00:00Z"
    }
    ```

---

### 4. Error Responses

*   **400 Bad Request** (Missing or invalid required fields)
    *   **Response Body (JSON Example):**
        ```json
        {
          "error": "Bad Request: Missing required fields or invalid data format.",
          "details": "The following fields are required and must be valid: finalHtmlContent, seoTitle, metaDescription, slug, status. Field 'slug' must be a string."
        }
        ```

*   **404 Not Found** (`articleId` does not exist)
    *   **Response Body (JSON Example):**
        ```json
        {
          "error": "Not Found: Article with the specified ID does not exist.",
          "articleId": "nonExistentArticleId"
        }
        ```

*   **409 Conflict** (e.g., `slug` already exists for a different article)
    *   **Response Body (JSON Example):**
        ```json
        {
          "error": "Conflict: The provided slug is already in use.",
          "details": "The slug 'my-awesome-seo-article' is already associated with another article."
        }
        ```

*   **422 Unprocessable Content** (Data is well-formed but semantically incorrect, e.g., invalid `publicationDate` format if not caught by basic type validation)
    *   **Response Body (JSON Example):**
        ```json
        {
          "error": "Unprocessable Content: Invalid data provided.",
          "details": "Field 'publicationDate' must be a valid ISO 8601 date string if provided."
        }
        ```
---

### 5. Conceptual Data Handling

*   Upon receiving a `PUT` request to `/api/articles/{articleId}`:
    1.  The system will first attempt to locate the existing article record using the provided `articleId`. If not found, a `404 Not Found` error is returned.
    2.  The system will validate all required fields in the request body. If validation fails, a `400 Bad Request` or `422 Unprocessable Content` error is returned.
    3.  The system will check for potential conflicts, such as the uniqueness of the `slug`. If a conflict exists (e.g., slug is already used by another article), a `409 Conflict` error is returned.
    4.  If all checks pass, the system will update the existing article record in the data store (database, file system, etc.) with the new information:
        *   `finalHtmlContent` will replace or supplement any previously stored raw content.
        *   `seoTitle`, `metaDescription`, `metaKeywords`, `slug`, `featuredImageUrl`, `canonicalUrl`, `authorId`, `categoryId` will be stored.
        *   The article's `status` will be updated (e.g., to `published` or `scheduled`).
        *   If `publicationDate` is provided and the status is `scheduled`, the system should ensure the article becomes publicly available at that time.
    5.  The updated article will then be accessible on the website, typically via its `slug` (e.g., `yourdomain.com/articles/{slug}`).
    6.  A success response (`200 OK`) is returned, including a confirmation message and potentially a link to the published article.

This design provides a clear path for N8N/Make.com to submit the final, SEO-optimized content for an article, ensuring all necessary metadata is captured for publication.