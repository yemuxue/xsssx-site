# 上线：Cloudflare Pages

目标：`https://yourdomain.com` 公网可访问、HTTPS、自动部署。

不需要备案，也不用买服务器。域名是可选的——先用 `xxx.pages.dev` 也能跑通。

**代价**：免费版走境外节点，中国大陆访问延迟约 150–300ms，晚高峰可能抖动。个人作品集通常够用；要稳定国内速度再走 [DEPLOY-CN.md](./DEPLOY-CN.md) 的备案方案。

---

## 1. 推到 GitHub（10 分钟）

```bash
cd site
git config user.name "你的名字"
git config user.email "you@example.com"
git commit -m "init: personal site scaffold"

# 在 GitHub 网页新建空仓库（建议 Private），然后：
git remote add origin git@github.com:你的用户名/site.git
git push -u origin main
```

没有 SSH key 就用 HTTPS 地址 + Personal Access Token。

---

## 2. 连接 Cloudflare Pages（5 分钟）

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/) → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**。
2. 授权 GitHub，选中刚才的仓库。
3. 构建设置：

| 项 | 值 |
|---|---|
| Framework preset | Astro |
| Build command | `pnpm build` |
| Build output directory | `dist` |
| Root directory | `/`（仓库根就是站点） |

4. 环境变量（**Advanced → Environment variables**）：

| 变量 | 值 | 说明 |
|---|---|---|
| `SITE_URL` | `https://你的项目名.pages.dev` | canonical / sitemap / RSS 用的绝对地址 |
| `NODE_VERSION` | `22.12.0` | Astro 7 要求 ≥22.12 |

5. **Save and Deploy**。1–2 分钟后拿到 `https://你的项目名.pages.dev`。

> 首次构建若报 Node 版本错误，检查 `NODE_VERSION` 是否生效；`packageManager` 字段已锁定 pnpm 11。

---

## 3. 绑定自定义域名（可选，10 分钟 + 生效时间）

1. 在任意注册商买域名（60–90 元/年）。
2. Cloudflare → **Add a site** → 输入域名 → 选 Free 套餐 → 按提示把域名的 **NS** 改到 Cloudflare 给的两个地址。
3. 等 NS 生效（几分钟到 24 小时）。
4. 回到 Pages 项目 → **Custom domains** → **Set up a domain** → 填 `yourdomain.com`，再加 `www.yourdomain.com`。
5. 证书自动签发（几十秒），无需手动配置。
6. **回来改 `SITE_URL`** 为新域名 → **Deployments → Retry deployment**。

> `SITE_URL` 不改，页面里的 canonical 和 sitemap 会一直指向 `pages.dev`，影响 SEO。

**www 与主域二选一**：建议 apex（`yourdomain.com`）为主，在 Cloudflare **Rules → Redirect Rules** 加一条 `www` → apex 的 301。

---

## 4. 缓存与安全头（已配好）

`public/_headers` 会随构建进入 `dist/_headers`，Cloudflare 自动读取：

- `/_astro/*`：一年 `immutable`（文件名带哈希）
- `*.html`：`max-age=0, must-revalidate`（改完立刻生效）
- 全站：`nosniff`、`SAMEORIGIN`、`Referrer-Policy`、基础 CSP

如果以后加了统计脚本或外部字体，记得同步放宽 CSP，否则会被浏览器拦掉。

---

## 5. 日常发布

```bash
# 改内容
pnpm dev            # 本地预览 http://localhost:4321
git add -A && git commit -m "post: 新笔记"
git push            # 自动构建并部署
```

- 每次 push 到 `main` 触发生产部署。
- 开 PR 会生成独立预览地址，方便检查。
- 回滚：**Deployments** → 选历史版本 → **Rollback**。

### 可选：命令行直传（不走 Git）

```bash
pnpm build
npx wrangler pages deploy dist --project-name=你的项目名
```

`--project-name` 要和你创建的 Pages 项目名一致。

> ⚠️ **用 Git 集成部署时，仓库里不要放 `wrangler.toml`。**
> Cloudflare 看到它会把这个项目当成 Workers，构建完执行 `wrangler deploy`，
> 报 `Missing entry-point to Worker script or to assets directory`。
> Pages 项目只认 `wrangler pages deploy`。

---

## 6. 404 与跳转

- Pages 会自动把 `dist/404.html` 作为 404 页，已生成，无需配置。
- 尾斜杠：Pages 会把 `/notes` 308 跳到 `/notes/`，和站点的 `trailingSlash: 'always'` 一致。

---

## 7. 上线检查清单

- [ ] `https://xxx.pages.dev` 能打开，手机 4G 也能
- [ ] 自定义域名生效，`http://` 自动跳 `https://`
- [ ] `SITE_URL` 已改成正式域名并重新部署
- [ ] `/notes/`、`/works/`、详情页、`/404` 正常
- [ ] `/robots.txt`、`/sitemap.xml`、`/rss.xml` 可访问且域名正确
- [ ] 响应头里有 `content-security-policy` 与 `cache-control`
- [ ] 提交 Google Search Console / Bing / 百度站长，提交 sitemap
- [ ] 全站搜一遍：`id_rsa`、手机号、客户名、`机密`

---

## 8. 成本

| 项目 | 费用 |
|---|---|
| Cloudflare Pages | 0（免费额度：500 次构建/月、无限带宽、100 个自定义域） |
| 域名 | 60–90 元/年 |
| SSL | 0（自动） |
| **合计** | **约 60–90 元/年** |

---

## 9. 常见问题

**构建失败，提示 pnpm 版本？**
`package.json` 里的 `packageManager` 已锁定 `pnpm@11.8.0`；Cloudflare 会用 corepack 安装。若冲突，把该字段删掉，改用默认 pnpm。

**页面是旧的？**
HTML 已设不缓存；如果还旧，检查是不是 CDN 边缘缓存——Pages 每次部署会换资源哈希，正常刷新即可。

**国内打开很慢？**
免费版没有中国大陆节点。可接受就保持；不能接受就走备案 + 国内 CDN（`DEPLOY-CN.md`），或给站点加一个国内镜像域名。

**想换域名？**
改 `SITE_URL` → 重新部署；旧域名的 301 在 Cloudflare Redirect Rules 里配。
