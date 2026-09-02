/**
 * 从 tokens.json 生成 tokens.css
 * tokens.json 是全端唯一数据源，本脚本产物请勿手改。
 *   node scripts/build-css.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const tokens = JSON.parse(readFileSync(join(root, 'tokens.json'), 'utf8'));

const lines = [
  '/* 自动生成，请勿手改 —— 源：packages/tokens/tokens.json */',
  '/* 生成命令：node packages/tokens/scripts/build-css.mjs */',
  ':root {',
  '  /* ── 颜色 ── */',
];

/** 把 { value, note } 叶子节点摊平成 CSS 变量 */
function walkColor(node, path) {
  for (const [key, val] of Object.entries(node)) {
    const name = key === 'DEFAULT' ? path : path ? `${path}-${key}` : key;
    if (val && typeof val === 'object' && 'value' in val) {
      lines.push(`  --color-${name}: ${val.value};${val.note ? ` /* ${val.note} */` : ''}`);
    } else if (val && typeof val === 'object') {
      walkColor(val, name);
    }
  }
}
walkColor(tokens.color, '');

lines.push(
  '',
  '  /* ── 圆角 ── */'
);
for (const [k, v] of Object.entries(tokens.radius)) lines.push(`  --radius-${k}: ${v};`);

lines.push('', '  /* ── 阴影 / 层级 ── */');
for (const [k, v] of Object.entries(tokens.shadow)) lines.push(`  --shadow-${k}: ${v};`);

lines.push('', '  /* ── 字阶 ── */');
for (const [k, v] of Object.entries(tokens.fontSize)) {
  const [size, meta] = v;
  lines.push(`  --text-${k}: ${size};`);
  if (meta?.lineHeight) lines.push(`  --leading-${k}: ${meta.lineHeight};`);
  if (meta?.letterSpacing) lines.push(`  --tracking-${k}: ${meta.letterSpacing};`);
}

lines.push('', '  /* ── 动效 ── */');
for (const [k, v] of Object.entries(tokens.motion)) lines.push(`  --motion-${k}: ${v};`);

lines.push('', '  /* ── 触控 ── */', `  --touch-min: ${tokens.touch.min};`, '}', '');

writeFileSync(join(root, 'tokens.css'), lines.join('\n'));
console.log(`✓ tokens.css 已生成（${lines.length} 行）`);
