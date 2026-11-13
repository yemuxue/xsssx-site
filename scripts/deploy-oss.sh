#!/usr/bin/env bash
# 发布到阿里云 OSS
#
# 用法：
#   SITE_URL=https://yourdomain.com OSS_BUCKET=your-bucket ./scripts/deploy-oss.sh
#
# 前置：
#   - 已安装 pnpm 与 ossutil，并执行过 ossutil config
#   - Bucket 已开启静态网站托管，且已绑定已备案域名
set -euo pipefail

: "${OSS_BUCKET:?请设置 OSS_BUCKET，例如 OSS_BUCKET=my-site}"
: "${SITE_URL:?请设置 SITE_URL，例如 SITE_URL=https://example.com}"

command -v pnpm >/dev/null 2>&1 || { echo "缺少 pnpm，请先安装 Node.js 与 pnpm"; exit 1; }
command -v ossutil >/dev/null 2>&1 || { echo "缺少 ossutil，见 DEPLOY-CN.md 第 5 节"; exit 1; }

export SITE_URL

echo "==> 构建（站点地址：${SITE_URL}）"
pnpm build

echo "==> 同步到 oss://${OSS_BUCKET}/"
ossutil sync dist/ "oss://${OSS_BUCKET}/" --delete -f

echo "==> 完成：${SITE_URL}"
echo "    提示：HTML 建议 CDN 缓存 0–10 分钟，_astro/ 下的哈希资源可缓存 1 年。"
