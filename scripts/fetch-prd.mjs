#!/usr/bin/env node
/**
 * 构建前拉取 PRD 最新版：从 code-review-agent 仓库读取 Markdown，
 * 生成 src/pages/docs/code-review-agent/prd.md。
 *
 * - 本地 `pnpm build` 会先跑（prebuild）
 * - Cloudflare 构建同样会先跑（build command 里包含 pnpm build）
 * - 拉取失败时保留现有文件，不让构建挂掉
 */
import { writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const REPO = process.env.PRD_REPO ?? 'yemuxue/code-review-agent';
const BRANCH = process.env.PRD_BRANCH ?? 'main';
const SRC = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/${encodeURIComponent(
  '可信代码审查Agent/01_正式文档/可信代码审查Agent-PRD.md',
)}`;
const OUT = path.resolve('src/pages/docs/code-review-agent/prd.md');
const FIG_DIR = path.resolve('public/docs/code-review-agent/figures');

// 图册：编号 → 仓库内的 PNG 文件名（02_核心图_PNG/）
const FIGURES = [
  '01_F01_系统上下文.png',
  '02_F02_业务能力地图.png',
  '03_F03_角色与权限矩阵.png',
  '04_U01_代码作者用例.png',
  '05_U02_Reviewer用例.png',
  '06_U03_平台管理员用例.png',
  '07_D01_主流程泳道图.png',
  '08_D02_任务状态机.png',
  '09_D03_页面流程图.png',
  '10_D04_一次审查时序图.png',
  '11_C01_三场景覆盖矩阵.png',
  '12_C02_放行判定流程.png',
  '13_P01_部署与数据流.png',
];

const RAW = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/${encodeURIComponent(
  '可信代码审查Agent/02_核心图_PNG',
)}`;

async function syncFigures() {
  await mkdir(FIG_DIR, { recursive: true });
  let ok = 0;
  for (const name of FIGURES) {
    let lastErr;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const res = await fetch(`${RAW}/${encodeURIComponent(name)}`, {
          headers: { 'user-agent': 'xsssx-site-build' },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        await writeFile(path.join(FIG_DIR, name), Buffer.from(await res.arrayBuffer()));
        lastErr = null;
        break;
      } catch (err) {
        lastErr = err;
        await new Promise((r) => setTimeout(r, 600 * attempt));
      }
    }
    if (lastErr) {
      console.warn(`[prd] 图 ${name} 拉取失败：${lastErr.message}`);
    } else {
      ok += 1;
    }
  }
  console.log(`[prd] 图册 ${ok}/${FIGURES.length} 张已同步`);
}

const FRONTMATTER = `---
layout: ../../../layouts/DocLayout.astro
title: 可信代码审查 Agent · 产品需求文档
eyebrow: PRD · v1.0 · 2026.11
lede: 把「AI 生成评论」做成可核验、可处理、可回滚的审查单元。这份文档说明它解决什么问题、边界在哪、以及每个判断的依据。
meta:
  - { k: 范围, v: 'MVP · 只读审查 + 审批后修复' }
  - { k: 角色, v: '代码作者 / Reviewer / 平台管理员' }
  - { k: 状态, v: '原型已验证，待试点' }
---

`;

function stripIntro(text) {
  return text
    .replace(/^# .*\n/, '')
    .replace(/^(?:>.*\n|\s*\n)+/, '')
    .replace(/^(?:- .*\n)+/, '')
    .replace(/^\s+/, '');
}

try {
  const res = await fetch(SRC, { headers: { 'user-agent': 'xsssx-site-build' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = stripIntro(await res.text());
  if (!body.includes('## ')) throw new Error('内容异常：缺少章节');
  await writeFile(OUT, FRONTMATTER + body, 'utf8');
  console.log(`[prd] 已从 ${REPO}@${BRANCH} 同步`);
  await syncFigures();
} catch (err) {
  if (existsSync(OUT)) {
    console.warn(`[prd] 拉取失败（${err.message}），沿用已有文件`);
  } else {
    console.error(`[prd] 拉取失败且无本地副本：${err.message}`);
    process.exit(1);
  }
}
