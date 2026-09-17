# 审计记录

> 本文件只记事实：命令、退出码、PASS/FAIL。不写感想。
> 模板：一次跑次一个小节。最终 push 前必须有一节「结论：通过」。

## 跑次 0 — 文档门（代码前）

- 时间：2026-09-17
- 范围：把大规格砍为一期终端工具，二期 = 网站/加密/风控
- 产出：`00-scope-cut.md` `01-phasing.md` `02-tech-plan.md` `03-sop.md` `04-acceptance.md`
- 判定：文档门通过后才允许写应用代码

| 项 | 结果 |
|---|---|
| 一期 MUST 六条已写进砍需求 | PASS |
| 验收表每条可判对错 | PASS |
| 二期名单含网站、加密、风控 | PASS |

---

## 跑次 1 — 自动 + 交互验收

- 时间：2026-09-17
- 范围：Fieldkit 一期终端工具
- 失败项：无

### 命令

| 命令 | 退出码 | 判定 |
|---|---|---|
| `node --experimental-strip-types --test src/lib/shaders/catalog.test.ts` | 0 | 14/14 PASS（AC-CAT-01..05, AC-COPY-01..05, AC-COPY-07, AC-HIDPI-01/02, AC-GL-02） |
| `npm run typecheck` | 0 | AC-ENG-01 PASS |
| `npm run build` | 0 | 生产构建 PASS |
| `curl -L http://127.0.0.1:8080/` | 200 | AC-ENG-04 PASS（裸 `/` 先 307 到 `/?view=grid&rarity=all`） |
| `curl -L http://127.0.0.1:8080/about` | 200 | About 可读 |
| `node scripts/browser-smoke.mjs http://127.0.0.1:8080/` | 0 | 桌面+移动：status 200，hasCanvas true，overflowX false，consoleErrors []，pageErrors [] |
| `node scripts/browser-smoke.mjs http://127.0.0.1:8081/ --baseline …preview.json` | 0 | `divergesFromBaseline: false` |

### 交互（agent-browser，`http://127.0.0.1:8080`）

| ID | 观察 | 结果 |
|---|---|---|
| AC-FLT-01 | 文案 `2,240 fields`，18 张 canvas | PASS |
| AC-FLT-02/03 | Grain → URL `rarity=grain`，`291 fields`，`Grain shaders` | PASS |
| AC-COPY-01 | 菜单四项：WebGL、WebGPU、React · WebGL、React · WebGPU | PASS |
| AC-COPY-06 | 点 WebGPU 后该项显示 Copied | PASS |
| AC-THM-01 | 点击主题后 `html[data-theme]=light` | PASS |
| AC-UI-01 | Immersive：`view=immersive`，6 张 canvas / 6 张 article | PASS |
| AC-UI-02 | 点卡 `id=2239`（数字，非 JSON 引号），Close + Share on X 可见 | PASS |
| AC-UI-03 | 390px smoke `horizontalOverflow: false` | PASS |
| AC-GL-01 | 首页 canvas ≥ 1；冒烟 consoleErrors 空；无 WebGL compile 刷屏 | PASS |
| AC-NO-01 | `document.body` 无 Claim yours / 认领 | PASS |
| AC-NO-02 | 无 `input[type=email]` / 登录表单 | PASS |
| AC-NO-03 | `src/**` 无 gtag/mixpanel/posthog/plausible | PASS |
| AC-NO-04 | 无用户写入 API | PASS |

### 截图

- `/workspace/screenshots/qa-home.png`
- `/workspace/screenshots/qa-grain.png`
- `/workspace/screenshots/qa-rarity-open.png`
- `/workspace/screenshots/qa-copy-menu.png`
- `/workspace/screenshots/qa-copied.png`
- `/workspace/screenshots/qa-immersive.png`
- `/workspace/screenshots/qa-detail.png`
- `/workspace/screenshots/qa-light.png`
- `/workspace/screenshots/qa-about.png`
- `/workspace/screenshots/app-builder-preview.png`（桌面）
- `/workspace/screenshots/app-builder-preview-mobile.png`（390×844）
- `/workspace/screenshots/app-builder-built.png`（生产构建）

### 已知非失败

- 冒烟 `BRAND WARNING`：canvas 被误判为游戏，要求 `og:type=x:game` 与 `x-banner.jpg`。产品不是游戏，不设。wontfix。
- 平台 `scripts/grok-pwa-plugin.test.mjs` 部分断言默认 og:title，与 Fieldkit 品牌冲突。一期验收以 `catalog.test.ts` + typecheck 为准，不改平台测试。

---

## 结论：通过

一期验收表 `docs/04-acceptance.md` 全部 PASS。允许 push 到 `Simon66-workshop/UI-shader-background`。
