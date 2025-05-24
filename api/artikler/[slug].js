// Fil: H3llo site/api/artikler/[slug].js
import { kv } from '@vercel/kv';

export default async function handler(request, response) {
  // Log for at bekræfte at denne funktion kaldes
  console.log(`[API /api/artikler/[slug]] Handler invoked. Method: '${request.method}', Path: '${request.url}'`);

  // Vi tillader kun GET requests til denne rute
  if (request.method !== 'GET') {
    console.warn(`[API /api/artikler/[slug]] Method Not Allowed - ${request.method}`);
    response.setHeader('Allow', ['GET']);
    return response.status(405).json({ error: 'Method Not Allowed. Only GET requests are allowed.' });
  }

  // Hent slug fra URL'ens query parametre
  const { slug } = request.query;
  console.log(`[API /api/artikler/[slug]] Handling request for slug: '${slug}'`);

  // Valider at slug er til stede og er en non-empty string
  if (!slug || typeof slug !== 'string' || slug.trim() === "") {
    console.error(`[API /api/artikler/[slug]] Slug parameter is missing or invalid.`);
    return response.status(400).json({ error: 'Slug parameter is required and must be a non-empty string.' });
  }

  try {
    // Definer nøglen, som den fulde HTML er gemt under i Vercel KV
    const kvKey = `html:${slug}`;
    console.log(`[API /api/artikler/[slug]] Attempting to fetch HTML from KV with key: '${kvKey}'`);

    // Hent HTML-indholdet fra KV
    const htmlContent = await kv.get(kvKey);

    // Hvis intet indhold findes for den givne nøgle (slug)
    if (htmlContent === null || htmlContent === undefined) {
      console.warn(`[API /api/artikler/[slug]] HTML content not found in KV for key: ${kvKey}. Serving 404 page.`);
      response.setHeader('Content-Type', 'text/html; charset=utf-8');
      // Server en simpel 404 HTML-side
      return response.status(404).send(
        `<!DOCTYPE html><html lang="da"><head><meta charset="UTF-8"><title>404 - Siden blev ikke fundet</title><link rel="stylesheet" href="/style.css"></head><body><nav class="sticky-nav" role="navigation" aria-label="Hovednavigation"><div class="nav-container"><a href="https://www.h3llo.dk" class="nav-logo-link"><img src="/images/For%20Web/White%20logo%20-%20no%20background.svg" alt="H3LLO Logo" class="nav-logo" style="height: 40px;"></a><ul><li><a href="https://www.h3llo.dk">Hjem</a></li><li><a href="/articles.html">Artikler</a></li></ul></div></nav><main role="main" style="text-align:center; padding: 50px 20px; min-height: 60vh; display: flex; flex-direction: column; justify-content: center; align-items: center;"><h1 style="font-size: 2.5rem; margin-bottom: 1rem;">404 - Artiklen blev ikke fundet</h1><p style="font-size: 1.1rem; color: #bbb; margin-bottom: 2rem;">Beklager, vi kunne ikke finde den artikel, du ledte efter.</p><a href="/articles.html" class="btn btn-primary" style="padding: 12px 25px; font-size: 1rem; text-decoration: none;">Se alle artikler</a></main><footer class="site-footer" role="contentinfo"><div class="container"><p>© ${new Date().getFullYear()} H3LLO ApS. Alle rettigheder forbeholdes.</p></div></footer></body></html>`
      );
    }

    // Hvis HTML-indholdet blev fundet
    console.log(`[API /api/artikler/[slug]] HTML content found for key: ${kvKey}. Serving...`);
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    // Sæt Cache-Control header for at tillade Vercel at cache dette statiske indhold effektivt
    // s-maxage=300: Cache på CDN i 5 minutter
    // stale-while-revalidate=600: Hvis cache er udløbet, server stale content i op til 10 minutter mens den revaliderer i baggrunden
    response.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    return response.status(200).send(htmlContent);

  } catch (error) {
    // Hvis der sker en uventet fejl undervejs
    console.error(`[API /api/artikler/[slug]] Error fetching HTML from KV or serving page for slug '${slug}':`, error);
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    // Server en simpel 500 HTML-fejlside
    return response.status(500).send(
       `<!DOCTYPE html><html lang="da"><head><meta charset="UTF-8"><title>500 - Intern Server Fejl</title><link rel="stylesheet" href="/style.css"></head><body><nav class="sticky-nav" role="navigation" aria-label="Hovednavigation"><div class="nav-container"><a href="https://www.h3llo.dk" class="nav-logo-link"><img src="/images/For%20Web/White%20logo%20-%20no%20background.svg" alt="H3LLO Logo" class="nav-logo" style="height: 40px;"></a></div></nav><main role="main" style="text-align:center; padding: 50px 20px; min-height: 60vh; display: flex; flex-direction: column; justify-content: center; align-items: center;"><h1 style="font-size: 2.5rem; margin-bottom: 1rem;">500 - Intern Server Fejl</h1><p style="font-size: 1.1rem; color: #bbb;">Der opstod en teknisk fejl på serveren. Prøv venligst igen senere.</p></main><footer class="site-footer" role="contentinfo"><div class="container"><p>© ${new Date().getFullYear()} H3LLO ApS. Alle rettigheder forbeholdes.</p></div></footer></body></html>`
    );
  }
}