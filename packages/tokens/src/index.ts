/**
 * @lifolio/tokens — Lifolio 设计系统 v2.0 单一数据源
 *
 * tokens.json 是唯一真源：
 *   - Web  消费 tokens.css（CSS 变量）+ Tailwind 主题
 *   - 移动端消费本文件导出的 JS 常量（React Native 无 CSS 变量）
 * 改色请改 tokens.json，然后 `node packages/tokens/scripts/build-css.mjs`。
 */
import raw from '../tokens.json';

/* ────────────────────────── 类型 ────────────────────────── */

export interface Tokens {
  color: {
    ink: { 1: string; 2: string; 3: string };
    line: string;
    track: string;
    surface: string;
    canvas: string;
    accent: {
      DEFAULT: string;
      strong: string;
      text: string;
      soft: string;
      wash: string;
      line: string;
      ink: string;
    };
    success: { DEFAULT: string; soft: string };
    warning: { DEFAULT: string; soft: string };
    danger: { DEFAULT: string; soft: string };
    info: { DEFAULT: string; soft: string };
    ai: {
      canvas: string;
      surface: string;
      elevated: string;
      text: string;
      sub: string;
    };
  };
  radius: {
    sm: string;
    md: string;
    lg: string;
    card: string;
    sheet: string;
    full: string;
  };
  space: Record<'1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10', string>;
  shadow: { 1: string; 2: string; 3: string; focus: string };
  fontSize: Record<
    'display' | 'h1' | 'h2' | 'h3' | 'body' | 'callout' | 'subhead' | 'caption' | 'micro',
    [string, { lineHeight: string; letterSpacing?: string; fontWeight: string }]
  >;
  motion: { fast: string; base: string; slow: string };
  touch: { min: string };
}

/* ────────────────── 运行时：剥掉 { value, note } ────────────────── */

function unwrap(node: unknown): unknown {
  if (Array.isArray(node)) return node;
  if (node && typeof node === 'object') {
    if ('value' in (node as Record<string, unknown>)) {
      return (node as { value: string }).value;
    }
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) out[k] = unwrap(v);
    return out;
  }
  return node;
}

export const tokens = unwrap(raw) as Tokens;

/* ────────────────── 移动端友好的扁平常量 ────────────────── */

const c = tokens.color;

/** 语义色 —— RN 里直接用 <View style={{ backgroundColor: color.accentStrong }} /> */
export const color = {
  ink1: c.ink[1],
  ink2: c.ink[2],
  ink3: c.ink[3],
  line: c.line,
  track: c.track,
  surface: c.surface,
  canvas: c.canvas,

  /** 品牌原色：仅用于图形填充与 ≥24px 大号数字（白底 3.44:1，不合规于小字正文） */
  accent: c.accent.DEFAULT,
  /** 主按钮底色：白字压其上 4.79:1，达标 */
  accentStrong: c.accent.strong,
  /** 强调文字：白底 5.63:1，达标 */
  accentText: c.accent.text,
  accentSoft: c.accent.soft,
  accentWash: c.accent.wash,
  accentLine: c.accent.line,
  /** AI 卡片正文色：配 accentWash 6.51:1 */
  accentInk: c.accent.ink,

  success: c.success.DEFAULT,
  successSoft: c.success.soft,
  warning: c.warning.DEFAULT,
  warningSoft: c.warning.soft,
  danger: c.danger.DEFAULT,
  dangerSoft: c.danger.soft,
  info: c.info.DEFAULT,
  infoSoft: c.info.soft,

  aiCanvas: c.ai.canvas,
  aiSurface: c.ai.surface,
  aiElevated: c.ai.elevated,
  aiText: c.ai.text,
  aiSub: c.ai.sub,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  card: 20,
  sheet: 28,
  full: 999,
} as const;

/** 动效时长（毫秒数字，直接喂给 Animated.timing） */
export const duration = { fast: 120, base: 200, slow: 320 } as const;

export const easing = 'cubic-bezier(.2,0,1,1)' as const;

/** 最小触控目标（px / pt），所有可点击区域不得小于此值 */
export const touchMin = parseInt(tokens.touch.min, 10);

/** 字阶：[size, lineHeight, weight] */
export const type = Object.fromEntries(
  Object.entries(tokens.fontSize).map(([k, [size, meta]]) => [
    k,
    {
      size: parseFloat(size as string),
      lineHeight: parseFloat(meta.lineHeight),
      letterSpacing: meta.letterSpacing ? parseFloat(meta.letterSpacing) : undefined,
      fontWeight: meta.fontWeight,
    },
  ])
) as Record<
  keyof Tokens['fontSize'],
  { size: number; lineHeight: number; letterSpacing?: number; fontWeight: string }
>;

export default tokens;
