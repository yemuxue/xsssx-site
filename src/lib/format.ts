/** 统一日期格式：2026-11-13 */
export function formatDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** 年份，用于按年分组 */
export function yearOf(date: Date): string {
  return String(date.getUTCFullYear());
}

/** 按日期从新到旧排序 */
export function byDateDesc<T extends { data: { date: Date } }>(a: T, b: T): number {
  return b.data.date.valueOf() - a.data.date.valueOf();
}
