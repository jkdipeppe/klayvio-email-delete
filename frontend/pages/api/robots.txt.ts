import type { NextApiRequest, NextApiResponse } from 'next';

const SITE_URL = 'https://klaviyocleaner.com';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const robotsTxt = `# Klaviyo Spam Profile Cleaner - robots.txt
# https://klaviyocleaner.com

User-agent: *
Allow: /
Allow: /pricing
Allow: /faq
Allow: /privacy

# Disallow authenticated/app pages
Disallow: /dashboard
Disallow: /subscription
Disallow: /api/
Disallow: /auth/

# AI crawlers - welcome to index public content
User-agent: GPTBot
Allow: /
Allow: /pricing
Allow: /faq
Disallow: /dashboard
Disallow: /api/
Disallow: /auth/

User-agent: Claude-Web
Allow: /
Allow: /pricing
Allow: /faq
Disallow: /dashboard
Disallow: /api/
Disallow: /auth/

User-agent: anthropic-ai
Allow: /
Allow: /pricing
Allow: /faq
Disallow: /dashboard
Disallow: /api/
Disallow: /auth/

User-agent: PerplexityBot
Allow: /
Allow: /pricing
Allow: /faq
Disallow: /dashboard
Disallow: /api/
Disallow: /auth/

User-agent: Googlebot
Allow: /
Allow: /pricing
Allow: /faq
Disallow: /dashboard
Disallow: /subscription
Disallow: /api/
Disallow: /auth/

Sitemap: ${SITE_URL}/api/sitemap.xml
`;

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=43200');
  res.status(200).send(robotsTxt);
}
