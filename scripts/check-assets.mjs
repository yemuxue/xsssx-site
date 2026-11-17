#!/usr/bin/env node
/**
 * 构建后校验：图册与截图必须全部产出，缺一个就让构建失败。
 * 避免「页面能开但图 404」这种静默故障。
 */
import { existsSync } from 'node:fs';

const REQUIRED = {
  'dist/docs/code-review-agent/figures': [
    '01_F01_系统上下文.png', '02_F02_业务能力地图.png', '03_F03_角色与权限矩阵.png',
    '04_U01_代码作者用例.png', '05_U02_Reviewer用例.png', '06_U03_平台管理员用例.png',
    '07_D01_主流程泳道图.png', '08_D02_任务状态机.png', '09_D03_页面流程图.png',
    '10_D04_一次审查时序图.png', '11_C01_三场景覆盖矩阵.png', '12_C02_放行判定流程.png',
    '13_P01_部署与数据流.png',
  ],
  'dist/docs/code-review-agent/shots': [
    '01-任务列表.png', '02-发现列表.png', '03-高风险证据.png', '04-反馈忽略.png',
    '05-补丁预览.png', '06-验证结果.png', '07-质量报告.png', '08-模拟用户测试面板.png',
    '09-移动端任务列表.png',
  ],
};

let missing = [];
for (const [dir, files] of Object.entries(REQUIRED)) {
  for (const f of files) {
    if (!existsSync(`${dir}/${f}`)) missing.push(`${dir}/${f}`);
  }
}

if (missing.length) {
  console.error(`[check] 缺少 ${missing.length} 个资源：`);
  for (const m of missing) console.error('  -', m);
  process.exit(1);
}
console.log('[check] 图册 13 张、截图 9 张齐全');
