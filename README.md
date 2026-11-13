# 个人站（Astro）

一个只做两件事的静态站：**放学习资料**、**放作品**。构建产物是纯 HTML，可以托管在任何静态空间（阿里云 OSS + CDN、Nginx、Cloudflare Pages）。

## 本地开发

需要 Node.js 22.12+ 与 pnpm（`corepack enable` 会自动装好对应版本）。

```bash
pnpm install
pnpm dev        # http://localhost:4321 预览
pnpm build      # 产出 dist/
pnpm preview    # 预览构建结果
```

## 改站点信息

只改一个文件：`src/consts.ts`。姓名、简介、邮箱、GitHub、导航、备案号都在里面。

正式域名改两处之一：

```bash
# 方式一：构建时传参（推荐，CI 用）
SITE_URL=https://yourdomain.com pnpm build
```

```js
// 方式二：改 astro.config.mjs 里的默认值
const SITE_URL = process.env.SITE_URL || 'https://yourdomain.com';
```

## 加内容

### 一篇资料

新建 `src/content/notes/任意名字.md`：

```yaml
---
title: 标题
description: 一句话摘要（会出现在列表与搜索结果）
date: 2026-11-13
tags: ['标签一', '标签二']
draft: false
---
```

### 一个作品

新建 `src/content/works/任意名字.md`：

```yaml
---
title: 项目名
description: 一句话说清做了什么
date: 2026-11-01
role: 独立完成
period: 2026.09 – 2026.10
stack: ['Python', 'SQL']
featured: true      # 首页精选
link: https://...   # 可选
repo: https://...   # 可选
cover: /covers/x.png # 可选，放 public/covers/ 下
---
```

文件名就是 URL：`src/content/notes/rag-eval.md` → `/notes/rag-eval/`。

## 目录

```
src/
├── consts.ts            # 站点配置（先改这里）
├── content.config.ts    # 内容字段定义
├── content/
│   ├── notes/           # 资料
│   └── works/           # 作品
├── layouts/BaseLayout.astro
├── components/          # Header / Footer / WorkCard
├── lib/format.ts
├── pages/               # 路由
└── styles/global.css    # 设计令牌与全部样式
```

## 上线

走 Cloudflare Pages：见 [DEPLOY.md](./DEPLOY.md)（Git 连接 → 自动构建 → 绑定域名，**免备案**）。

如果以后需要国内速度、决定备案，再参考 [DEPLOY-CN.md](./DEPLOY-CN.md)。

## 三条红线

1. **不要**把 `id_rsa`、`.env`、客户材料放进这个仓库（`.gitignore` 已挡，但别依赖它）。
2. **不要**把企业交付物、他人论文全文原样上传；先脱敏。
3. **不要**在页面里写真实手机号；邮箱也建议用别名。
