import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/** 学习资料 / 笔记 */
const notes = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/notes' }),
  schema: z.object({
    title: z.string(),
    description: z.string().default(''),
    date: z.coerce.date(),
    tags: z.array(z.string()).default([]),
    /** 草稿不会出现在列表、RSS 与 sitemap 中 */
    draft: z.boolean().default(false),
  }),
});

/** 作品 / 项目 */
const works = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/works' }),
  schema: z.object({
    title: z.string(),
    description: z.string().default(''),
    date: z.coerce.date(),
    /** 你的角色，例：产品设计 / 独立开发 */
    role: z.string().default(''),
    /** 时间范围，例：2026.03 – 2026.06 */
    period: z.string().default(''),
    stack: z.array(z.string()).default([]),
    /** 线上地址或作品链接 */
    link: z.string().url().optional(),
    repo: z.string().url().optional(),
    /** 封面图，放在 public/ 下，例：/covers/demo.png；不填则用渐变占位 */
    cover: z.string().optional(),
    featured: z.boolean().default(false),
    draft: z.boolean().default(false),
  }),
});

export const collections = { notes, works };
