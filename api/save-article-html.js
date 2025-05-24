import { kv } from '@vercel/kv';

export default async function handler(request, response) {
  // Log request method and URL for debugging
  console.log(`[save-article-html] Received request. Method: ${request.method}, URL: ${request.url}`);

  if (request.method !== 'POST') {
    console.log('[save-article-html] Method not allowed:', request.method);
    response.setHeader('Allow', ['POST']);
    return response.status(405).json({ message: 'Method Not Allowed. Please use POST.' });
  }

  try {
      let body;

      // Log den rå request.body for at se, hvad der ankommer
      console.log('[save-article-html] Raw request.body type:', typeof request.body);
      console.log('[save-article-html] Raw request.body content:', request.body);

      if (request.body) {
        if (typeof request.body === 'object' && request.body !== null && Object.keys(request.body).length > 0) {
          // Hvis Vercel allerede har parset det til et ikke-tomt objekt
          body = request.body;
          console.log('[save-article-html] Used request.body directly as object.');
        } else if (typeof request.body === 'string' && request.body.trim() !== "") {
          // Hvis det er en ikke-tom streng, prøv at parse
          try {
            body = JSON.parse(request.body);
            console.log('[save-article-html] Parsed request.body from string to object.');
          } catch (e) {
            console.error('[save-article-html] Failed to parse request.body string as JSON:', e, 'Request body string was:', request.body);
            return response.status(400).json({ message: 'Invalid JSON format in request body string.' });
          }
        } else {
          // Hvis request.body er et tomt objekt, en tom streng, eller en uventet type
          console.error('[save-article-html] request.body is present but empty or of unexpected type. Type:', typeof request.body, 'Content:', request.body);
          return response.status(400).json({ message: 'Request body is present but empty or not in expected format.' });
        }
      } else { 
         // Hvis request.body er null eller undefined
         console.error('[save-article-html] Request body is missing (null or undefined).');
         return response.status(400).json({ message: 'Request body is missing.' });
      }

      // Nu bør 'body' være et gyldigt JavaScript-objekt
      // Hvis 'body' stadig er undefined her, eller ikke et objekt, er der et fundamentalt problem
      if (!body || typeof body !== 'object') {
        console.error('[save-article-html] Critical error: body variable is not a valid object after parsing attempts. Body:', body);
        return response.status(500).json({ message: 'Internal server error: Failed to process request body.' });
      }
      
      const { slug, htmlContent } = body; 

      // Validering af slug og htmlContent (som du havde før)
      if (!slug || typeof slug !== 'string' || slug.trim() === "") {
        console.log('[save-article-html] Missing or invalid slug after destructuring.');
        return response.status(400).json({ message: 'Missing or invalid "slug" in parsed body.' });
      }
      if (!htmlContent || typeof htmlContent !== 'string') {
        console.log('[save-article-html] Missing or invalid htmlContent after destructuring.');
        return response.status(400).json({ message: 'Missing or invalid "htmlContent" in parsed body.' });
      }

    const kvKey = `html:${slug}`; // Using the 'slug_for_kv' which is already cleaned
    console.log(`[save-article-html] Attempting to save HTML to KV with key: ${kvKey}`);

    await kv.set(kvKey, htmlContent);

    console.log(`[save-article-html] Successfully saved HTML to KV for key: ${kvKey}`);
    return response.status(200).json({ message: 'HTML content saved successfully.', kvKey: kvKey });

  } catch (error) {
    console.error('[save-article-html] Error processing request:', error);
    return response.status(500).json({ message: 'Internal Server Error while saving HTML content.', details: error.message });
  }
}