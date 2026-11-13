import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

export const GET: APIRoute = async ({ site }) => {
  const origin = (site ?? new URL('https://example.com')).origin;

  const notes = await getCollection('notes', ({ data }) => !data.draft);
  const works = await getCollection('works', ({ data }) => !data.draft);

  const paths = [
    '/',
    '/notes/',
    '/works/',
    '/about/',
    ...notes.map((entry) => `/notes/${entry.id}/`),
    ...works.map((entry) => `/works/${entry.id}/`),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${paths.map((path) => `  <url><loc>${origin}${path}</loc></url>`).join('\n')}
</urlset>
`;

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
