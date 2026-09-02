import type { Config } from 'tailwindcss';
// 直接读 tokens.json 而非 @lifolio/tokens 的 dist：
// turbo 的 dev 任务没有 dependsOn ^build，dist 可能尚未生成，读 JSON 最稳。
import tokens from '@lifolio/tokens/tokens.json';

/** 把 { value, note } 叶子剥成纯字符串 */
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

const t = unwrap(tokens) as {
  color: Record<string, unknown>;
  radius: Record<string, string>;
  space: Record<string, string>;
  shadow: Record<string, string>;
  fontSize: Record<string, [string, { lineHeight: string; letterSpacing?: string }]>;
  motion: Record<string, string>;
};

export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: t.color as Record<string, any>,
      borderRadius: t.radius,
      spacing: t.space,
      boxShadow: t.shadow,
      fontSize: Object.fromEntries(
        Object.entries(t.fontSize).map(([k, [size, meta]]) => [k, [size, meta]])
      ) as Record<string, any>,
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          'SF Pro SC',
          'PingFang SC',
          'Inter',
          'Helvetica Neue',
          'Microsoft YaHei',
          'sans-serif',
        ],
        mono: ['SF Mono', 'JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      transitionTimingFunction: {
        swift: 'cubic-bezier(.2,0,1,1)',
      },
      transitionDuration: {
        fast: '120ms',
        base: '200ms',
        slow: '320ms',
      },
      minWidth: { touch: '44px' },
      minHeight: { touch: '44px' },
      keyframes: {
        'ai-blink': {
          '0%, 60%, 100%': { opacity: '0.28', transform: 'scale(0.85)' },
          '30%': { opacity: '1', transform: 'scale(1)' },
        },
        'skeleton': {
          '0%, 100%': { opacity: '0.55' },
          '50%': { opacity: '1' },
        },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'none' },
        },
      },
      animation: {
        'ai-blink': 'ai-blink 1.2s infinite',
        skeleton: 'skeleton 1.4s ease-in-out infinite',
        'fade-up': 'fade-up 200ms cubic-bezier(.2,0,1,1)',
      },
    },
  },
  plugins: [],
} satisfies Config;
