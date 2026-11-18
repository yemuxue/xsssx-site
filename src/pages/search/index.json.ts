import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { byDateDesc } from '../../lib/format';

/** 构建期生成站内搜索索引 */
export const GET: APIRoute = async () => {
  const notes = (await getCollection('notes', ({ data }) => !data.draft)).sort(byDateDesc);
  const works = (await getCollection('works', ({ data }) => !data.draft)).sort(byDateDesc);

  const items = [
    ...notes.map((n) => ({
      type: 'note',
      title: n.data.title,
      desc: n.data.description ?? '',
      tags: n.data.tags ?? [],
      url: `/notes/${n.id}/`,
      date: n.data.date.toISOString().slice(0, 10),
    })),
    ...works.map((w) => ({
      type: 'work',
      title: w.data.title,
      desc: w.data.description ?? '',
      tags: w.data.stack ?? [],
      url: `/works/${w.id}/`,
      date: w.data.date.toISOString().slice(0, 10),
    })),
  ];

  return new Response(JSON.stringify(items), {
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
};
