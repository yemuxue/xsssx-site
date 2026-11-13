import { defineConfig } from 'astro/config';

// 正式域名只在这里改一处（或用环境变量覆盖）：
//   SITE_URL=https://yourdomain.com pnpm build
// 换域名时记得同步改 src/consts.ts 里的 email / github 等信息。
const SITE_URL = process.env.SITE_URL || 'https://xsssx-site.pages.dev';

export default defineConfig({
  site: SITE_URL,
  output: 'static',
  // 统一带尾斜杠：OSS / Nginx 都能直接命中 index.html，避免 404
  trailingSlash: 'always',
  build: {
    format: 'directory',
    // CSS 内联进 HTML：跨境访问时少一次往返（每个 RTT 约 200–300ms）
    inlineStylesheets: 'always',
  },
  server: {
    host: true,
    port: 4321,
  },
});
