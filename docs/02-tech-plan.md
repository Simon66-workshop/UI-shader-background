# 技术方案（一期）

> 审计编号：FK-TECH-001
> 范围：只覆盖一期终端工具。二期不在此设计。

## 1. 目标架构

```
浏览器
 ├─ Explore 页（Grid / Immersive）
 │    ├─ 过程式目录 catalog.ts（2240 条，种子可复现）
 │    ├─ WebGL2 画布池（最多 10 个上下文，离屏释放）
 │    └─ Copy menu → clipboard（4 种文本）
 └─ 无 API 写路径
```

预览一律走 **WebGL2**（兼容面）。WebGPU 只出现在复制文本里，避免预览在不支持 `navigator.gpu` 的环境变空白。

## 2. 目录与稀有度

权重（PRD，合计 100%）：

| type | 占比 | 2240 条整数配额 |
|---|---|---|
| pure | 39% | 874 |
| grain | 13% | 291 |
| ascii | 12% | 269 |
| dither | 10% | 224 |
| halftone | 9% | 202 |
| sparkle | 7% | 157 |
| liquid | 5% | 112 |
| mosaic | 4% | 90 |
| chroma | 1% | 21 |

配额合计必须等于 2240。对账测试：`observedPct - expectedPct` 的绝对值 ≤ 1.0。

每条记录：

- `id` 数字，新到旧（2240 … 1）
- `handle` 由种子生成，全表唯一
- `type` 九选一
- `params` 字段着色器常数（hue、warp、shear…）

禁止把 GLSL 源按条存仓库。

## 3. 着色器

一条 fragment shader，用 `u_effect` 切换 9 种后处理：

0. Pure field — 域扭曲色带
1. Grain — 亮度噪声
2. ASCII — 单元格字形
3. Dither — Bayer 4×4
4. Halftone — 旋转网点
5. Sparkle — 稀疏闪点
6. Liquid — 额外低频扭曲
7. Mosaic — 量化 UV
8. Chroma — RGB 分离

公共 uniform：`resolution, time, pixelRatio, lightMode, darkBackground, lightBackground` + 字段参数。

主题：`lightMode` 在 0..1 间过渡；背景色来自页面 CSS 变量 `--bg` 对应的 dark/light 两个 hex。

## 4. 复制代码契约（冻结）

四种格式都必须是**可粘贴即用**的文本，不是伪代码。

公共 API：

```ts
createShader(canvas: HTMLCanvasElement, options?: { theme?: "dark" | "light" }): Promise<{
  setTheme(theme: "dark" | "light"): void
  destroy(): void
}>
```

复制文本必须包含：

- 当前条的常数（HUE、WARP_* 等）
- `pixelRatio` 上限（≤ 2）
- 画布最大边（≤ 1920）
- `ResizeObserver` 与 `destroy` 释放

React 两种格式是对上述模块的 `useEffect` 包装，不得另写一套着色器。

## 5. 性能预算（可判定）

| 项 | 上限 |
|---|---|
| 同时存活的 WebGL 上下文 | 10 |
| 卡片 `devicePixelRatio` | min(dpr, 1.5) |
| 放大预览 `devicePixelRatio` | min(dpr, 2) |
| 画布长边 | 卡片 720 / 放大 1920 |
| 首屏 DOM 卡 | 18（滚动再追加） |
| `prefers-reduced-motion: reduce` | 时间冻结在 0 |

离屏卡必须停 rAF。页签隐藏必须停 rAF。

## 6. 前端栈

已给定：TanStack Start + React 19 + Tailwind v4。一期不新增 3D 引擎、不引入 three.js。

路由：

- `/` Explore（search：`view` `rarity` `id`）
- `/about` 一页说明（不是营销站）

状态：search params 为唯一筛选来源，可刷新复现。

## 7. 后端 / 数据 / 安全（一期结论）

- 后端：无写接口，无用户表。本条若被打破，技术方案作废。
- 数据：目录纯函数；单测锁配额。
- 安全：不收集 PII；复制仅在 click 里调 `clipboard.writeText`；外链 GitHub / X intent 用 `rel="noopener"`。

## 8. 风险与缓解

| 风险 | 缓解 | 验收点 |
|---|---|---|
| 浏览器 WebGL 上下文耗尽 | 池化 10 + 离屏 destroy | 滚动 100 张不白屏 |
| WebGPU 预览不可用 | 预览不用 WebGPU | 无 GPU 的环境仍能看卡 |
| 复制内容不能跑 | 模板与引擎同源生成 | 单测锁关键字；人工粘贴一次 |
| 高分屏过载 | 像素上限 | 源码含 MAX_PIXEL_RATIO 与 MAX_DIMENSION |
