import type { NextApiRequest, NextApiResponse } from 'next';

const SITE_URL = 'https://klaviyocleaner.com';

const staticPages = [
  { url: '/', changefreq: 'weekly', priority: '1.0' },
  { url: '/pricing', changefreq: 'monthly', priority: '0.9' },
  { url: '/faq', changefreq: 'monthly', priority: '0.8' },
  { url: '/privacy', changefreq: 'yearly', priority: '0.3' },
];

function generateSitemap(): string {
  const lastmod = new Date().toISOString().split('T')[0];

  const urlEntries = staticPages
    .map(
      ({ url, changefreq, priority }) => `
  <url>
    <loc>${SITE_URL}${url}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`
    )
    .join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
          http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">
${urlEntries}
</urlset>`;
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=43200');
  res.status(200).send(generateSitemap());
}
