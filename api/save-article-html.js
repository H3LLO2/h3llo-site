import { kv } from '@vercel/kv';

// Helper function to parse the request body
async function getJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', chunk => {
      body += chunk.toString(); // convert Buffer to string
    });
    request.on('end', () => {
      try {
        resolve(JSON.parse(body));
      } catch (e) {
        reject(e);
      }
    });
    request.on('error', (err) => {
        reject(err);
    });
  });
}

export default async function handler(request, response) {
  console.log(`[save-article-html] Received request. Method: ${request.method}, URL: ${request.url}`);
  console.log(`[save-article-html] Request headers:`, JSON.stringify(request.headers, null, 2));


  if (request.method !== 'POST') {
    console.log('[save-article-html] Method not allowed:', request.method);
    response.setHeader('Allow', ['POST']);
    return response.status(405).json({ message: 'Method Not Allowed. Please use POST.' });
  }

  let parsedBody;
  try {
    // Check if body is already parsed by Vercel (e.g., in Next.js pages/api context)
    if (request.body && typeof request.body === 'object' && Object.keys(request.body).length > 0) {
        console.log('[save-article-html] Request body was pre-parsed by Vercel/Next.js.');
        parsedBody = request.body;
    } else if (request.headers['content-type'] && request.headers['content-type'].includes('application/json')) {
        console.log('[save-article-html] Attempting to manually parse JSON body stream.');
        parsedBody = await getJsonBody(request);
        console.log('[save-article-html] Manually parsed body content:', parsedBody);
    } else {
        console.log('[save-article-html] Content-Type is not application/json or body is missing.');
        return response.status(400).json({ message: 'Request body is missing or Content-Type is not application/json.' });
    }
  } catch (error) {
      console.error('[save-article-html] Error manually parsing JSON body:', error);
      return response.status(400).json({ message: 'Invalid JSON in request body.', details: error.message });
  }

  // Fra nu af, brug 'parsedBody' i stedet for 'request.body' eller den tidligere 'body' variabel
  try {
    // Den 'body' variabel, der fejlede før, skal nu erstattes med 'parsedBody'
    const { slug, htmlContent } = parsedBody; 

    console.log(`[save-article-html] Received slug from parsedBody: ${slug}`);
    console.log(`[save-article-html] Received htmlContent (first 100 chars from parsedBody): ${htmlContent ? htmlContent.substring(0, 100) : 'No htmlContent received'}`);

    // Validering af slug og htmlContent (som før)
    if (!slug || typeof slug !== 'string' || slug.trim() === "") {
      console.log('[save-article-html] Missing or invalid slug in parsedBody.');
      return response.status(400).json({ message: 'Missing or invalid "slug" in parsed body.' });
    }
    if (!htmlContent || typeof htmlContent !== 'string') {
      console.log('[save-article-html] Missing or invalid htmlContent in parsedBody.');
      return response.status(400).json({ message: 'Missing or invalid "htmlContent" in parsed body.' });
    }

    const kvKey = `html:${slug}`;
    console.log(`[save-article-html] Attempting to save HTML to KV with key: ${kvKey}`);

    await kv.set(kvKey, htmlContent);
    
    console.log(`[save-article-html] Successfully saved HTML to KV for key: ${kvKey}`);
    return response.status(200).json({ message: 'HTML content saved successfully.', kvKey: kvKey });

  } catch (error) {
    // Dette fanger fejl fra dekonstruktion (hvis slug/htmlContent mangler i parsedBody)
    // eller fra kv.set() operationen.
    console.error('[save-article-html] Error processing request after body parsing:', error);
    // Tjek om fejlen skyldes, at slug/htmlContent ikke kunne dekonstrueres fra parsedBody
    if (error instanceof TypeError && error.message.includes("Cannot destructure property")) {
        return response.status(400).json({ message: 'Required fields (slug, htmlContent) not found in request body.', details: error.message });
    }
    return response.status(500).json({ message: 'Internal Server Error while saving HTML content.', details: error.message });
  }
}