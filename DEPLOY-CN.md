# 国内上线全流程（阿里云 · 个人备案）

> **当前方案是 Cloudflare Pages，先看 [DEPLOY.md](./DEPLOY.md)。**
> 本文保留作备用：只有当你明确需要中国大陆访问速度、愿意等 7–20 个工作日备案时才用。

目标：`https://yourdomain.com` 公网可访问、HTTPS、备案合规。

顺序不能乱：**买域名 → 实名 → 买服务器拿备案服务号 → 备案 → 解析 → 部署 → 证书 → 挂备案号**。

总耗时约 **2–4 周**，其中 90% 的时间在等管局审核。

---

## 0. 先认清三件事

| 事项 | 说明 |
|---|---|
| 备案是强制的 | 域名解析到中国大陆服务器，必须先取得 ICP 备案号 |
| 备案要「接入商」 | 在阿里云/腾讯云买资源，由它代提交；个人也能备 |
| 备案需要一台服务器 | 轻量应用服务器（≥3 个月）才能生成「备案服务号」，纯 OSS 不行 |

> 不想备案的唯一办法：托管到境外（Cloudflare Pages 等），国内访问速度会波动。你选了国内，就按下面走。

---

## 1. 买域名（30 分钟 + 1–3 天实名）

1. 阿里云万网 / 腾讯云 / Namesilo 均可，建议 `.com`（60–90 元/年）或 `.me`。
2. 注册时填写**真实姓名与身份证**，提交实名认证，通常 1–3 个工作日。
3. 开启 **WHOIS 隐私保护**（免费），否则手机号会被公开爬取。
4. 域名注册商和备案接入商可以不同，但备案时域名必须已完成实名。

**命名建议**：`yourname.com`、`yourname.me`、`yourname.dev`。别用拼音全拼 + 生日的组合，容易被猜。

---

## 2. 买服务器，拿备案服务号（30 分钟）

1. 阿里云 → 轻量应用服务器 → 选**中国内地**地域（如杭州/北京），最低配即可（2 核 2G）。
2. 购买时长 **≥ 3 个月**（这是生成备案服务号的前提）。
3. 控制台 → 备案 → 申请备案服务号，记下这串号。
4. 同时把服务器的 80/443 端口在防火墙里放行。

> 这台机器备案通过后可以继续用（Nginx 托管静态站），也可以只留作备案、网站放 OSS。**推荐继续用**，配置最简单。

---

## 3. 提交备案（1–2 小时操作 + 7–20 工作日等待）

1. 阿里云 App 或 [阿里云备案系统](https://beian.aliyun.com/) → 开始备案 → 选择「个人」。
2. 填写：主体信息（姓名、身份证、手机号）、网站信息（网站名称、域名、服务内容）。
3. 上传身份证正反面，完成人脸核验。
4. 网站名称规则（个人）：
   - 不能含「公司 / 集团 / 工作室 / 中心」等组织词；
   - 不能含「中国 / 中华 / 国家」等；
   - 建议写成「某某的学习笔记」「某某的个人主页」；
   - 名称要与网站实际内容相关。
5. 服务内容选「其他」或「博客」，**不要选经营性内容**（个人备案不允许电商、付费课程、广告联盟）。
6. 提交后：阿里云初审 1–2 个工作日 → 管局审核 7–20 个工作日。
7. 期间保持手机畅通，管局可能电话核验；接不到会驳回。

**备案期间能不能访问？**
多数省份要求域名**不要**解析到内地服务器；个别省份要求网站已可访问且内容与备案一致。以你所在省份管局提示为准。稳妥做法：备案期间用 `http://服务器IP:8080` 预览，域名先不解析。

**常见驳回原因**：网站名称不合规、内容与备案不符、域名未实名、手机号非本人、身份证照片反光。

---

## 4. 解析与部署（备案通过后，1 小时）

### 4.1 域名解析

阿里云 DNS → 添加记录：

| 记录类型 | 主机记录 | 记录值 |
|---|---|---|
| A | @ | 服务器公网 IP |
| A | www | 服务器公网 IP |

TTL 默认 10 分钟，生效后用 `ping yourdomain.com` 验证。

### 4.2 服务器初始化（Ubuntu 22.04 为例）

```bash
ssh root@服务器IP

apt update && apt install -y nginx rsync

mkdir -p /var/www/site
```

### 4.3 上传构建产物

本地：

```bash
SITE_URL=https://yourdomain.com pnpm build
rsync -avz --delete dist/ root@服务器IP:/var/www/site/
```

### 4.4 Nginx 配置

`/etc/nginx/sites-available/site`：

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    root /var/www/site;
    index index.html;

    location / {
        try_files $uri $uri/ $uri/index.html =404;
    }

    error_page 404 /404.html;

    # 带哈希的静态资源可长缓存
    location ~* \.(css|js|svg|png|jpg|jpeg|webp|woff2)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # HTML 不缓存，保证更新立即生效
    location ~* \.html$ {
        add_header Cache-Control "no-cache";
    }
}
```

启用并检查：

```bash
ln -s /etc/nginx/sites-available/site /etc/nginx/sites-enabled/site
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
```

此时 `http://yourdomain.com` 应该能打开。

---

## 5. HTTPS（10 分钟）

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

按提示选「自动跳转 HTTPS」。证书 90 天有效，certbot 会自动续期，验证一下：

```bash
systemctl list-timers | grep certbot
```

> 也可以用阿里云免费 DV 证书（1 年），在 SSL 证书控制台申请后手动配置。

---

## 6. 备案号与公安备案（必做）

1. **页脚悬挂备案号**，并链接到工信部：
   在 `src/consts.ts` 里填 `icp: '京ICP备2026xxxxxx号-1'`，页脚会自动显示并链接到 `beian.miit.gov.cn`。
2. **公安联网备案**：网站开通后 30 日内，到 [全国互联网安全管理服务平台](https://beian.mps.gov.cn/) 提交，审核通过后同样在页脚展示（带盾牌图标）。
3. 备案信息变更（换域名、换服务器、换主体）要在 30 日内做「变更备案」。

---

## 7. 可选：改用 OSS + CDN

服务器方案够用；如果以后流量变大或不想维护机器，可以迁到对象存储：

1. 创建 Bucket：地域选靠近读者的内地地域，读写权限「公共读」。
2. 开启**静态网站托管**：默认首页 `index.html`，默认 404 页 `404.html`。
3. 上传：`ossutil sync dist/ oss://your-bucket/ --delete -f`（安装见 [ossutil 文档](https://help.aliyun.com/zh/oss/developer-reference/ossutil)）。
4. Bucket → 域名管理 → 绑定已备案域名。
5. CDN 控制台 → 添加加速域名 → 源站选 OSS 域名 → 配置 HTTPS 证书。
6. 解析改 CNAME 到 CDN 提供的地址。

**注意**：OSS 静态托管的「默认首页」对子目录不生效，`/notes/` 这类地址需要：
- 在 CDN 配置「回源 URL 改写」把 `/xxx/` 改写为 `/xxx/index.html`；或
- 继续用 Nginx（`try_files` 天然支持）。

费用：存储 0.12 元/GB/月 + CDN 流量约 0.2 元/GB，小站一年几十元。

---

## 8. 日常发布流程

```bash
# 本地
SITE_URL=https://yourdomain.com pnpm build

# 上传
rsync -avz --delete dist/ root@服务器IP:/var/www/site/

# 或在服务器上拉取
```

想自动化：GitHub 仓库 → Actions → 用 `appleboy/ssh-action` 在 push 到 `main` 时执行 `git pull && pnpm build && rsync`。

---

## 9. 上线检查清单

- [ ] `https://yourdomain.com` 能打开，证书有效、无混合内容
- [ ] `http://` 自动跳 `https://`
- [ ] 手机 4G（非 WiFi）能打开
- [ ] `/notes/`、`/works/`、任意详情页、`/404` 都正常
- [ ] 页脚有备案号且链接正确
- [ ] `/robots.txt`、`/sitemap.xml`、`/rss.xml` 可访问
- [ ] 百度站长、必应、Google Search Console 提交 sitemap
- [ ] 全站搜一遍：`id_rsa`、`身份证`、`手机号`、客户名、`内部`、`机密`
- [ ] 图片压缩过（WebP），首屏 < 1.5s
- [ ] 备份：服务器上的 `dist/` 与 Git 仓库至少各一份

---

## 10. 成本与时间

| 项目 | 费用 | 时间 |
|---|---|---|
| 域名 | 60–90 元/年 | 实名 1–3 天 |
| 轻量服务器（2 核 2G） | 促销 60–150 元/年，常规 24–40 元/月 | 即时 |
| 备案 | 免费 | 7–20 工作日 |
| SSL | 免费（Let's Encrypt） | 10 分钟 |
| **合计（首年）** | **约 150–250 元** | **2–4 周** |

---

## 11. 几个坑

1. **先备案再解析**：未备案域名解析到内地 IP 会被拦截，80/443 直接不通。
2. **备案服务号有有效期**：申请后尽快提交，过期要重新申请。
3. **个人备案不能商用**：挂广告、卖课、接支付都会被注销备案。
4. **换服务器要变更备案**：IP 变了但没做变更，可能被抽查注销。
5. **别把 `id_rsa` 传上去**：`.gitignore` 已挡，但 `rsync` 传的是 `dist/`，记得构建产物里也不要有私密文件。
