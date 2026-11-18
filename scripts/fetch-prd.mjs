#!/usr/bin/env node
/**
 * 从 code-review-agent 仓库同步文档内容到站点。
 *
 * 只由 .github/workflows/sync-prd.yml 调用（不挂 prebuild），
 * 避免构建时二次拉取把刚提交的内容覆盖回旧版。
 *
 * 同步内容：
 *   - PRD.md            → src/pages/docs/code-review-agent/prd.md
 *   - 13 张图册 PNG      → public/docs/code-review-agent/figures/
 *   - 可用性报告 HTML    → public/docs/code-review-agent/usability.html
 *   - 9 张报告截图       → public/docs/code-review-agent/shots/
 */
import { writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const REPO = process.env.PRD_REPO ?? 'yemuxue/code-review-agent';
const CC_REPO = process.env.CC_REPO ?? 'yemuxue/colorcheck-pipeline';
const BRANCH = process.env.PRD_BRANCH ?? 'main';
const TOKEN = process.env.GITHUB_TOKEN;

const DIR = '可信代码审查Agent';
const OUT = path.resolve('src/pages/docs/code-review-agent/prd.md');
const DOCS = path.resolve('public/docs/code-review-agent');
const FIG_DIR = path.join(DOCS, 'figures');
const SHOT_DIR = path.join(DOCS, 'shots');
const USABILITY_OUT = path.resolve('src/pages/docs/code-review-agent/usability.md');
const CC_OUT = path.resolve('src/content/notes/colorcheck-method.md');

// colorcheck 的图、封面与数据包：仓库路径 → 站点路径
const CC_ASSETS = [
  ['02_核心图_PNG/00_封面.png', 'public/covers/colorcheck/cover.png'],
  ['02_核心图_PNG/01_F01_实验设计.png', 'public/docs/colorcheck/figures/01_F01_实验设计.png'],
  ['02_核心图_PNG/02_C01_三模型结果矩阵.png', 'public/docs/colorcheck/figures/02_C01_三模型结果矩阵.png'],
  ['03_数据产物/results.zip', 'public/data/colorcheck/results.zip'],
  ['03_数据产物/stimuli.zip', 'public/data/colorcheck/stimuli.zip'],
];

const FIGURES = [
  '01_F01_系统上下文.png', '02_F02_业务能力地图.png', '03_F03_角色与权限矩阵.png',
  '04_U01_代码作者用例.png', '05_U02_Reviewer用例.png', '06_U03_平台管理员用例.png',
  '07_D01_主流程泳道图.png', '08_D02_任务状态机.png', '09_D03_页面流程图.png',
  '10_D04_一次审查时序图.png', '11_C01_三场景覆盖矩阵.png', '12_C02_放行判定流程.png',
  '13_P01_部署与数据流.png',
];

const SHOTS = [
  '01-任务列表.png', '02-发现列表.png', '03-高风险证据.png',
  '04-反馈忽略.png', '05-补丁预览.png', '06-验证结果.png',
  '07-质量报告.png', '08-模拟用户测试面板.png', '09-移动端任务列表.png',
];

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

/** raw 有 CDN 缓存，加时间戳强制取最新 */
function rawUrl(relPath, repo = REPO) {
  const encoded = relPath.split('/').map(encodeURIComponent).join('/');
  return `https://raw.githubusercontent.com/${repo}/${BRANCH}/${encoded}?t=${Date.now()}`;
}

/** 备用源：jsDelivr 镜像，raw 拉取失败时兜底 */
function jsdelivrUrl(relPath, repo = REPO) {
  const encoded = relPath.split('/').map(encodeURIComponent).join('/');
  return `https://cdn.jsdelivr.net/gh/${repo}@${BRANCH}/${encoded}`;
}

async function fetchBuffer(relPath, repo = REPO) {
  const headers = {
    'user-agent': 'xsssx-site-sync',
    ...(TOKEN ? { authorization: `Bearer ${TOKEN}` } : {}),
  };
  for (const url of [rawUrl(relPath, repo), jsdelivrUrl(relPath, repo)]) {
    const res = await fetch(url, { headers });
    if (res.ok) return Buffer.from(await res.arrayBuffer());
  }
  throw new Error(`两个源均失败：${relPath.split('/').pop()}`);
}

async function withRetry(label, fn) {
  let lastErr;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
  }
  console.warn(`[sync] ${label} 失败：${lastErr.message}`);
  return null;
}

function stripIntro(text) {
  return text
    .replace(/^# .*\n/, '')
    .replace(/^(?:>.*\n|\s*\n)+/, '')
    .replace(/^(?:- .*\n)+/, '')
    .replace(/^\s+/, '');
}

async function syncPrd() {
  const buf = await withRetry('PRD.md', () =>
    fetchBuffer(`${DIR}/01_正式文档/可信代码审查Agent-PRD.md`),
  );
  if (!buf) {
    if (!existsSync(OUT)) throw new Error('PRD 拉取失败且无本地副本');
    console.warn('[sync] 沿用已有 prd.md');
    return;
  }
  const body = stripIntro(buf.toString('utf8'));
  if (!body.includes('## ')) throw new Error('PRD 内容异常：缺少章节');
  await writeFile(OUT, FRONTMATTER + body, 'utf8');
  console.log('[sync] PRD 已更新');
}

async function syncDir(label, files, repoDir, outDir) {
  await mkdir(outDir, { recursive: true });
  let ok = 0;
  for (const name of files) {
    const buf = await withRetry(`${label} ${name}`, () =>
      fetchBuffer(`${DIR}/02_核心图_PNG/${repoDir}${name}`),
    );
    if (buf) {
      await writeFile(path.join(outDir, name), buf);
      ok += 1;
    }
  }
  console.log(`[sync] ${label} ${ok}/${files.length}`);
}

const USABILITY_FRONTMATTER = `---
layout: ../../../layouts/DocLayout.astro
title: 可信代码审查 Agent · 可用性测试报告
eyebrow: USABILITY · 2026.10
lede: 基于可点击原型的角色模拟测试，用于提前发现交互阻塞点；结论不能替代真实用户访谈。
meta:
  - { k: 角色, v: 'Reviewer / 代码作者 / 平台管理员' }
  - { k: 任务, v: '9 / 9 完成' }
  - { k: 性质, v: '角色模拟，非真实用户' }
---

`;

async function syncUsability() {
  const buf = await withRetry('可用性报告', () =>
    fetchBuffer(`${DIR}/01_正式文档/可信代码审查Agent-可用性测试报告.md`),
  );
  if (!buf) {
    if (!existsSync(USABILITY_OUT)) throw new Error('可用性报告拉取失败且无本地副本');
    console.warn('[sync] 可用性报告沿用已有文件');
    return;
  }
  const body = stripIntro(buf.toString('utf8'));
  await writeFile(USABILITY_OUT, USABILITY_FRONTMATTER + body, 'utf8');
  console.log('[sync] 可用性报告已更新');
}

async function syncColorcheck() {
  const buf = await withRetry('colorcheck 方法文章', () =>
    fetchBuffer('01_正式文档/colorcheck-method.md', CC_REPO),
  );
  if (!buf) {
    if (!existsSync(CC_OUT)) throw new Error('colorcheck 文章拉取失败且无本地副本');
    console.warn('[sync] colorcheck 文章沿用已有文件');
    return;
  }
  const text = buf.toString('utf8');
  if (!text.startsWith('---')) throw new Error('colorcheck 文章缺少 frontmatter');
  await writeFile(CC_OUT, text, 'utf8');
  console.log('[sync] colorcheck 方法文章已更新');
}

async function syncColorcheckAssets() {
  let ok = 0;
  for (const [src, dest] of CC_ASSETS) {
    const buf = await withRetry(`colorcheck ${src.split('/').pop()}`, () =>
      fetchBuffer(src, CC_REPO),
    );
    if (buf) {
      const target = path.resolve(dest);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, buf);
      ok += 1;
    }
  }
  console.log(`[sync] colorcheck 资源 ${ok}/${CC_ASSETS.length}`);
}

// --assets-only：构建期只补图（prd.md / usability.md 由 workflow 提交，构建不覆盖）
const assetsOnly = process.argv.includes('--assets-only');

if (assetsOnly) {
  console.log('[sync] 仅同步图资源');
} else {
  await syncPrd();
  await syncUsability();
  await syncColorcheck();
}
await syncDir('图册', FIGURES, '', FIG_DIR);
await syncDir('截图', SHOTS, '00_界面截图/', SHOT_DIR);
await syncColorcheckAssets();
