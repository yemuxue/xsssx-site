// 站点信息：改这里就行，全站导航、页脚、SEO 都读这份配置。
export const SITE = {
  /** 显示名（首页大标题） */
  name: 'XSSSX',
  /** 品牌缩写（左上角 Logo，可留空则显示姓名） */
  mark: 'X',
  /** 一句话定位 */
  tagline: '把做过的留下来。',
  /** 站点副标题，用于 SEO 与首页说明 */
  title: '资料与作品集',
  description: 'XSSSX 的个人站。学习笔记与项目作品，也是简历之外的补充。',
  /** 关于页介绍（支持多段，用数组） */
  intro: [
    '目前求职阶段。过程和判断在这里补充。',
    '一半是学习笔记，按主题整理，标注来源和结论；一半是项目，写清做了什么、结果如何。',
    '内容按时间倒序排，旧的尽量不改，方便对照当时的想法。',
  ],
  /** 关注方向 / 技能标签 */
  focus: ['资料归档', '项目作品', '持续记录'],
  email: 'xxxsss0723@gmail.com',
  /** GitHub 账号关联邮箱 */
  githubEmail: '2782830732@qq.com',
  github: 'https://github.com/yemuxue/',
  /** GitHub 用户名（用于展示 @handle，避免从 URL 截取时带上尾斜杠） */
  githubHandle: 'yemuxue',
  location: '中国',
  /** 备案号：通过后填这里，例：京ICP备2026000000号-1；留空则不显示 */
  icp: '',
  nav: [
    { href: '/', label: '首页' },
    { href: '/notes/', label: '资料' },
    { href: '/works/', label: '作品' },
    { href: '/about/', label: '关于' },
  ],
};

/** 首页「精选作品」最多展示几个 */
export const FEATURED_LIMIT = 3;
/** 首页「最近更新」最多展示几条 */
export const LATEST_NOTES_LIMIT = 3;
