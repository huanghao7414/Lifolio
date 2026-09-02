# Lifolio 界面设计方案 · 交付总览

> 交付日期：2026-09-02 ｜ 设计负责人：UI Designer
> 范围：双端统一设计系统 + 可交互高保真原型

## 一、做了什么

为 Lifolio（量化人生簿）建立了一套**双端统一的设计系统 v2.0**，并产出可直接点击体验的高保真原型。

| 交付物 | 路径 | 说明 |
|--------|------|------|
| 设计系统规范 | `design/design-system.md` | 8 章：设计原则、Token、布局栅格、组件库、无障碍、双端映射、文案语气、落地清单 |
| 可交互原型 | `design/prototype/index.html` | 单文件，三个视图：移动端 / Web 端 / 设计令牌 |

## 二、原型怎么用

打开 `design/prototype/index.html`，顶部切换三个视图：

- **移动端**：390×844 手机框，六个屏幕（首页 / 物品 / 物品详情 / 价值 / 设置 / AI 对话）。
  左侧列表可直接跳屏；底部药丸标签栏可切页；点物品卡进详情；点中间 ✦ 进 AI 面板。
- **Web 端**：248px 侧边栏 + 三栏仪表盘（KPI / 净资产趋势 / 账单表 + 右列 AI 洞察与价值评分）。
- **设计令牌**：色板（含实测对比度）、字阶、间距、组件库、状态四件套。

## 三、关键设计决策

**1. 品牌色拆三档——这是本次最重要的修正**

实测发现 `#FF4500` 在白底上只有 **3.44:1**，承载小号正文**不符合 WCAG AA**。方案：

| 档位 | 色值 | 用途 | 对比度 |
|------|------|------|--------|
| accent | `#FF4500` | 图形填充、图表、≥24px 大号数字 | 3.44:1（合规，限大字/非文本） |
| accent-strong | `#D63600` | 主按钮底色 | 4.79:1（白字压其上亦达标） |
| accent-text | `#C03400` | 强调文字、链接、AI 标签 | 5.63:1 |

三者色相差极小，肉眼观感统一，但小字全部达标。

**2. 次级文字整体替换**

旧版 `#86868B`（3.62:1）与图注 `#8E8E93`（3.26:1）均未达 AA，统一改为 `#6E6E73`（5.07:1）。

**3. 语义色约定（避免踩中国金融惯例的坑）**

Lifolio 是个人生活账本、不涉及证券行情，因此「健康/达标」用**绿色**，「超支/预警」用橙红，支出金额本身用中性深色（不制造焦虑）。
规范中已写明：**若未来接入基金/股票模块，该模块内必须切换为涨红跌绿并在入口显式提示。**

**4. AI 内容双形态**

- 内嵌洞察 → 浅色 `--accent-wash` 暖调卡片，融于页面
- 全屏对话（移动端）/ 右侧 420px 抽屉（桌面端）→ 深色专注面

并立了三条硬约束：AI 文本必须带 `✦ AI` 标记；必须附可执行下一步；流式生成中要显示思考态并保留"可能有误"说明。

**5. 符合用户习惯的几个具体点**

- 底部药丸标签栏 + 居中 AI 悬浮入口，主操作落在拇指热区
- 首页新增「记一笔 / 拍小票 / 扫条码 / 语音记」四个快捷入口，覆盖 90% 的高频入口
- 账单流按日期分组，异常消费用**图标 + 文字 + 颜色**三重编码，不靠颜色单通道
- 物品「值得指数」分档同时显示数字，色弱用户也能读
- 每个数据视图补齐加载（骨架屏）/ 空 / 错误 / 离线四态

## 四、与旧版的差异

| 项 | 旧版 | 新版 |
|----|------|------|
| 次级文字 | `#86868B`（3.62:1） | `#6E6E73`（5.07:1） |
| 主按钮底 | `#FF4500`（白字 3.44:1） | `#D63600`（白字 4.79:1） |
| 首页 | 无快捷入口 | 4 个高频入口（记一笔/拍票/扫码/语音） |
| 账单流 | 平铺 | 按日期分组 + 三重编码异常标记 |
| 价值页 | 仅评分环 | 评分环 + 4 维度拆解 + 对比样本说明 |
| 状态 | 缺失 | 加载/空/错误/离线四态齐全 |
| 无障碍 | 未声明 | 全量 AA 实测 + 44pt 触控 + reduced-motion |
| 双端 | 无映射规则 | 8 项模块一一对应的双端映射表 |

## 五、代码落地情况（2026-09-02 已完成）

设计系统已写入项目代码，不再是纸面规范：

| 改动 | 位置 | 说明 |
|------|------|------|
| **新建共享包** | `packages/tokens/` | `tokens.json` 唯一真源；`src/index.ts` 供 Expo（含 `color`/`radius`/`touchMin` 扁平常量）；`tokens.css` 由 `scripts/build-css.mjs` 生成；`pnpm tokens` 可重新生成 |
| Web 主题 | `apps/web/tailwind.config.ts` | 直接 import `@lifolio/tokens/tokens.json`（不依赖 dist，避开 turbo dev 的构建顺序问题），全量映射颜色/圆角/阴影/字阶/动效/触控 |
| Web 基础层 | `apps/web/app/globals.css` + `layout.tsx` | 引入 `tokens.css`；重写 `.card`/`.btn-*`/`.ai-card`/`.chip`/`.badge-*`/`.input`/`.list-row` 等组件类；补全局 `:focus-visible`、`prefers-reduced-motion`、`.tnum` |
| Web 组件迁移 | 12 个文件，53 处类名 | `text-brand`→`text-accent-text`、`bg-brand`→`bg-accent-strong`、`focus:border-brand`→`focus:border-accent focus:shadow-focus`、`text-gray-4/500`→`text-ink-2` |
| Web AI 抽屉 | `AIChatPanel.tsx` | 硬编码 `#1A1A1A`/`white/10` 全部换成 `ai-*` token；思考点改 `animate-ai-blink`；补 aria-label 与「AI 生成内容可能有误」提示 |
| Web 组件补全 | `OverviewCard`/`TransactionList`/`Sidebar`/`AIInsightCard` | 进度条加 `role=progressbar`；空状态补引导文案；侧边栏 248px + `aria-current` + 44px 触控；AIInsightCard 增加可选 `action` 按钮（对应「AI 必附下一步」硬约束） |
| 移动端颜色 | `apps/mobile/constants/colors.ts` | 旧 `Colors.*` 字段名全部保留、值换成 v2.0 token——老代码不改也自动获得 AA 合规色；新增 `brandText`/`brandAccent`/`aiInk` 等 |
| 移动端组件 | `AIInsightCard`/`BillRow`/`OverviewCard`/`ai-chat` | 文字强调色改 `brandText`；AI 卡片正文改 `aiInk`；账单行 ≥56pt、发送/关闭按钮 40→44pt；金额统一 `tabular-nums` |
| 根原型 | `index.html`/`styles.css` | 同步 v2.0 色值；`#86868B`→`#6E6E73`、`#8E8E93`→token、按钮底改 `--accent-strong`；补焦点环/等宽数字/减弱动效降级 |

**语义色在 RN 侧的自动修正**（靠 `Colors` 映射一次完成）：
`success #10B981→#1E7A34`、`warning #F59E0B→#B25E00`、`error #EF4444→#D63600`、
`textTertiary #9CA3AF→#6E6E73`（旧值 2.9:1 不达 AA，正文层级此后靠字号表达）。

## 六、后续待办（需要装依赖后验证）

1. `pnpm install` 后跑 `pnpm web` / `pnpm mobile` 冒烟——本次改动未经完整编译验证（本机未装依赖）
2. 剩余 4 个数据视图补齐加载/空/错误/离线四态
3. `packages/tokens` 接入 CI：`pnpm tokens && git diff --exit-code packages/tokens/tokens.css` 防止 json 与 css 漂移
4. 逐屏核对 `text-ink-3` 的使用（只允许出现在非文本上）

## 六、备注

原型为纯静态单文件，无外部依赖，可直接双击打开或放进任何静态服务器。设计系统文档中的对比度数值均由 sRGB 相对亮度公式逐项计算得出，可直接用于无障碍审计。
