import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { SITE } from '../consts';
import { byDateDesc } from '../lib/format';

const escapeXml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

export const GET: APIRoute = async ({ site }) => {
  const origin = (site ?? new URL('https://example.com')).origin;

  const notes = (await getCollection('notes', ({ data }) => !data.draft)).sort(byDateDesc);
  const works = (await getCollection('works', ({ data }) => !data.draft)).sort(byDateDesc);

  const items = [
    ...notes.map((entry) => ({
      title: entry.data.title,
      description: entry.data.description,
      date: entry.data.date,
      url: `${origin}/notes/${entry.id}/`,
    })),
    ...works.map((entry) => ({
      title: entry.data.title,
      description: entry.data.description,
      date: entry.data.date,
      url: `${origin}/works/${entry.id}/`,
    })),
  ].sort((a, b) => b.date.valueOf() - a.date.valueOf());

  const body = items
    .map(
      (item) => `    <item>
      <title>${escapeXml(item.title)}</title>
      <link>${escapeXml(item.url)}</link>
      <guid isPermaLink="true">${escapeXml(item.url)}</guid>
      <description>${escapeXml(item.description)}</description>
      <pubDate>${item.date.toUTCString()}</pubDate>
    </item>`
    )
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(`${SITE.name} · ${SITE.title}`)}</title>
    <link>${escapeXml(origin)}</link>
    <description>${escapeXml(SITE.description)}</description>
    <language>zh-CN</language>
    <atom:link href="${escapeXml(`${origin}/rss.xml`)}" rel="self" type="application/rss+xml" />
${body}
  </channel>
</rss>
`;

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
