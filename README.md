# Fieldkit

Pick a shader field. Copy the code. Paste it into a project.

Phase 1 is a **client-side terminal tool**: 2,240 generated backgrounds, 9 effect types, four copy formats (WebGL, WebGPU, React · WebGL, React · WebGPU). No accounts, no claiming, no backend writes.

- Live app: this repository
- Docs: [`docs/00-scope-cut.md`](docs/00-scope-cut.md) · [`docs/04-acceptance.md`](docs/04-acceptance.md) · [`docs/AUDIT.md`](docs/AUDIT.md)
- GitHub: [Simon66-workshop/UI-shader-background](https://github.com/Simon66-workshop/UI-shader-background)

## Use a copied module

```js
import { createShader } from "./kestrel-shader.webgl.js";

const shader = await createShader(document.querySelector("canvas"), {
  theme: "dark",
  background: { dark: "#0a0a0b", light: "#f5f5f7" },
});
shader.setTheme("light");
shader.setBackground({ dark: "#111111", light: "#fafafa" });
shader.destroy();
```

Size the canvas with CSS. Pass `background.dark` / `background.light` as `#rrggbb`. Pixel ratio is capped at 2; the long edge is capped at 1920.

## Develop

```bash
npm install
npm run dev
```

Acceptance tests:

```bash
npm test
npm run typecheck
```

Phase 2 (not in this tree): marketing site, username claiming, encryption, risk controls.
