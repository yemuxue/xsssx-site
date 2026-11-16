// 站点信息：改这里就行，全站导航、页脚、SEO 都读这份配置。
export const SITE = {
  /** 显示名（首页大标题） */
  name: 'XSSSX',
  /** 品牌缩写（左上角 Logo，可留空则显示姓名） */
  mark: 'X',
  /** 一句话定位 */
  tagline: '收集资料，展示作品，记录过程。',
  /** 站点副标题，用于 SEO 与首页说明 */
  title: '资料与作品集',
  description:
    'XSSSX 的个人站：归档资料与作品，保留来源与过程，持续更新。',
  /** 关于页介绍（支持多段，用数组） */
  intro: [
    '这里收集我整理过的资料，也展示做过的作品。放在同一个地方，是为了以后能找得到、说得清。',
    '资料按主题归档，作品按时间排列。每一条都尽量保留来源和过程，方便回看，也方便别人判断。',
  ],
  /** 关注方向 / 技能标签 */
  focus: ['资料归档', '项目作品', '持续记录'],
  email: 'xxxsss0723@gmail.com',
  /** GitHub 关联邮箱 */
  githubEmail: '2782830732@qq.com',
  github: 'https://github.com/yemuxue/',
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
export const LATEST_NOTES_LIMIT = 5;
