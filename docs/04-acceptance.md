# 一期验收标准

> 审计编号：FK-AC-001
> 规则：每条必须能判 PASS / FAIL。含「更好看」「尽量」的句子不准进表。
> 记录：跑次写入 `docs/AUDIT.md`，不在本文件改判定词。

## A. 目录与过滤

| ID | 标准 | 判据 |
|---|---|---|
| AC-CAT-01 | 目录长度 = 2240 | `getCatalog().length === 2240` |
| AC-CAT-02 | handle 全表唯一 | `new Set(handles).size === 2240` |
| AC-CAT-03 | 九种类型都出现 | 集合相等 |
| AC-CAT-04 | 配额表对账 | 各 type 计数与 `docs/02-tech-plan.md` 整数配额完全相等 |
| AC-CAT-05 | 占比误差 | `abs(count/2240 - weight) ≤ 0.010` |
| AC-FLT-01 | All rarities 列出全部 | 可见卡对应 2240（分页不改变总数文案） |
| AC-FLT-02 | 选 Grain 只出 grain | 每一张 `type === "grain"` |
| AC-FLT-03 | 计数文案 = 过滤后长度 | 例 Grain → `291 fields` |

## B. 复制

| ID | 标准 | 判据 |
|---|---|---|
| AC-COPY-01 | 菜单四项文案 | WebGL、WebGPU、React · WebGL、React · WebGPU |
| AC-COPY-02 | WebGL 文本含 API | 同时含 `createShader`、`setTheme`、`destroy` |
| AC-COPY-03 | WebGPU 文本含 WGSL | 含 `@fragment` 或 `fn main` 与 `createShader` |
| AC-COPY-04 | React 文本含 hook | 含 `useEffect` 与 `createShader` |
| AC-COPY-05 | 当前条常数被写入 | 复制文本含该卡 `HUE` 数值（至少 5 位小数或源码同值） |
| AC-COPY-06 | 点击后剪贴板非空 | `navigator.clipboard.readText()` 与生成文本一致（或 UI 显示 Copied 且生成函数返回非空） |
| AC-COPY-07 | 含像素上限 | 文本含 `pixelRatio` 与数字 `1920` 或 `MAX_DIMENSION` |

## C. 主题与高分屏

| ID | 标准 | 判据 |
|---|---|---|
| AC-THM-01 | 存在暗/亮切换 | 点击后 `html[data-theme]` 在 `dark`/`light` 间变化 |
| AC-THM-02 | 复制注释含双色 | 文本含 `background.dark` 与 `background.light` |
| AC-THM-03 | 运行时主题 API | 文本含 `setTheme("light")` 或等价 |
| AC-HIDPI-01 | 预览 dpr 封顶 | 引擎 `capPixelRatio(dpr, 1.5) ≤ 1.5`（卡片） |
| AC-HIDPI-02 | 放大 dpr 封顶 | 放大预览 `≤ 2` |

## D. 预览与性能

| ID | 标准 | 判据 |
|---|---|---|
| AC-GL-01 | 首页至少 1 张 canvas 在画 | `document.querySelectorAll("canvas").length ≥ 1` 且无 WebGL 错误刷屏 |
| AC-GL-02 | 上下文池 | 同时 `WebGLRenderingContext` 创建 ≤ 10（引擎常量 `MAX_CONTEXTS === 10`） |
| AC-GL-03 | 离屏停止 | `destroy()` 后不再申请 rAF（引擎 `disposed === true`） |
| AC-UI-01 | Grid 与 Immersive 可切换 | search `view` 为 `grid` 或 `immersive` |
| AC-UI-02 | 点卡进入放大 | search 出现 `id`，放大层可见 handle |
| AC-UI-03 | 390px 无横向滚动 | 冒烟 JSON `overflowX === false` |

## E. 一期禁区（出现即 FAIL）

| ID | 标准 |
|---|---|
| AC-NO-01 | 页面无 Claim yours / 认领 |
| AC-NO-02 | 无登录表单、无邮箱 input |
| AC-NO-03 | 无分析 SDK（ga、gtag、mixpanel、posthog、plausible 字符串不得出现在一期自有源码，第三方库名除外需人工确认） |
| AC-NO-04 | 无用户写入 API |

## F. 工程门禁

| ID | 标准 |
|---|---|
| AC-ENG-01 | `npm run typecheck` 退出码 0 |
| AC-ENG-02 | 目录单测退出码 0 |
| AC-ENG-03 | 复制单测退出码 0 |
| AC-ENG-04 | 首页 HTTP 200 |

## 不算验收（明确排除）

- 「看起来像 OpenShaders」——主观，不进表
- 「2200 个手写着色器文件」——一期用种子，不验文件数
- WebGPU 预览能在所有浏览器跑 —— 一期不验
- 认领、加密、风控 —— 二期
