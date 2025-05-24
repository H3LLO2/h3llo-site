import { kv } from '@vercel/kv';

const BASE_URL = 'https://www.h3llo.dk'; // Din hjemmesides URL

export default async function handler(request, response) {
  console.log(`[API /api/sitemap] Handler invoked. Method: '${request.method}', Path: '${request.url}'`);

  if (request.method !== 'GET') {
    response.setHeader('Allow', ['GET']);
    return response.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const articleIds = await kv.zrange('articles_published_by_date', 0, -1, { rev: true });

    let sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    sitemapXml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

    // Tilføj forsiden
    sitemapXml += `  <url>\n`;
    sitemapXml += `    <loc>${BASE_URL}/</loc>\n`;
    sitemapXml += `    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>\n`;
    sitemapXml += `    <changefreq>daily</changefreq>\n`;
    sitemapXml += `    <priority>1.0</priority>\n`;
    sitemapXml += `  </url>\n`;

    // Tilføj andre vigtige statiske sider manuelt
    // Sørg for at stierne er korrekte og fjerner .html hvis cleanUrls er aktiv (det er den)
    const staticPages = [
      { path: 'articles', priority: '0.9', changefreq: 'weekly' }, // Tidligere articles.html
      { path: 'demo', priority: '0.8', changefreq: 'monthly' },     // Tidligere demo.html
      { path: 'kampagnepris', priority: '0.8', changefreq: 'monthly' }, // Tidligere kampagnepris.html
      { path: 'privacy', priority: '0.5', changefreq: 'yearly' } // Tidligere privacy.html
      // Tilføj flere statiske sider her hvis du har dem, f.eks. 'om-os', 'kontakt'
    ];

    staticPages.forEach(page => {
      sitemapXml += `  <url>\n`;
      sitemapXml += `    <loc>${BASE_URL}/${page.path}</loc>\n`;
      sitemapXml += `    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>\n`;
      sitemapXml += `    <changefreq>${page.changefreq}</changefreq>\n`;
      sitemapXml += `    <priority>${page.priority}</priority>\n`;
      sitemapXml += `  </url>\n`;
    });
    
    if (articleIds && articleIds.length > 0) {
      const articleObjects = await kv.mget(...articleIds.map(id => `article:${id}`));

      articleObjects.forEach(article => {
        if (article && article.slug && article.status === 'published') {
          sitemapXml += `  <url>\n`;
          sitemapXml += `    <loc>${BASE_URL}/artikler/${article.slug}</loc>\n`;
          const lastMod = article.publicationDate ? new Date(article.publicationDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
          sitemapXml += `    <lastmod>${lastMod}</lastmod>\n`;
          sitemapXml += `    <changefreq>weekly</changefreq>\n`; 
          sitemapXml += `    <priority>0.7</priority>\n`;
          sitemapXml += `  </url>\n`;
        }
      });
    }

    sitemapXml += `</urlset>`;

    response.setHeader('Content-Type', 'application/xml');
    response.setHeader('Cache-Control', 'public, s-maxage=43200, stale-while-revalidate=86400'); // Cache i 12 timer
    return response.status(200).send(sitemapXml);

  } catch (error) {
    console.error('[API /api/sitemap] Error generating sitemap:', error);
    return response.status(500).json({ error: 'Internal Server Error generating sitemap.' });
  }
}