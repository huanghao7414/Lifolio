/**
 * Lifolio 设计系统 v2.0 —— 移动端颜色
 *
 * 真源是 packages/tokens/tokens.json，本文件只做两件事：
 *   1. 保留旧字段名 `Colors.*`，值全部换成 v2.0 token（老代码不改也能获得 AA 合规色）
 *   2. 重新导出 token 常量，新代码请直接用 `color` / `radius` / `touchMin`
 *
 * ⚠️ 旧值 → 新值的合规性说明（白底对比度）：
 *   brand      #FF4500 → #D63600   按钮底色必须配白字达标（3.44:1 → 4.79:1）
 *   textTertiary #9CA3AF → #6E6E73 旧值 2.9:1 不达 AA，正文层级请靠字号表达而非颜色
 *   success    #10B981 → #1E7A34   旧值 2.28:1 仅可用于非文本
 *   warning    #F59E0B → #B25E00   旧值 1.9:1 仅可用于非文本
 *   error      #EF4444 → #D63600   旧值 3.76:1 不达 AA
 */
import {
  color,
  radius,
  duration,
  touchMin,
  type as typeScale,
} from '@lifolio/tokens';

export const Colors = {
  /* ── 品牌三档：accent 限图形/大号数字，strong 配白字，text 用于强调文字 ── */
  brand: color.accentStrong, // 旧代码里的按钮底色，换成 #D63600 后白字达标
  brandLight: '#FF8A4D',
  brandDim: '#FF450020',
  brandText: color.accentText, // 新增：强调文字 / 链接（5.63:1）
  brandAccent: color.accent, // 新增：纯图形填充（3.44:1，仅非文本）

  /* ── AI 内容 ── */
  aiBackground: color.accentWash,
  aiBorder: color.accentLine,
  aiInk: color.accentInk, // AI 卡片正文色（wash 上 6.51:1）

  /* ── 中性 ── */
  background: color.canvas,
  surface: color.surface,
  dark: color.aiSurface,

  text: color.ink1,
  textSecondary: color.ink2,
  textTertiary: color.ink2, // 见顶部说明：与 secondary 同色，层级靠字号

  border: color.line,
  divider: color.track,

  /* ── 语义 ── */
  success: color.success,
  successSoft: color.successSoft,
  warning: color.warning,
  warningSoft: color.warningSoft,
  error: color.danger,
  errorSoft: color.dangerSoft,
  info: color.info,
  infoSoft: color.infoSoft,

  /* ── AI 深色专注面 ── */
  aiCanvas: color.aiCanvas,
  aiSurface: color.aiSurface,
  aiElevated: color.aiElevated,
  aiText: color.aiText,
  aiSub: color.aiSub,
} as const;

/* 新代码直接用这些 —— @lifolio/tokens 的完整导出 */
export { color, radius, duration, touchMin, typeScale };
