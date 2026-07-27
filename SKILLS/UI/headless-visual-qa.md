---
name: headless-visual-qa
description: Verify web UI fidelity on a headless Linux server by taking Playwright screenshots and analyzing them with AI vision against reference images.
trigger: User needs to check if a web UI looks correct, compare a rendered page to a design mockup, or verify CSS changes on a machine without a display.
actions: ['view', 'execute']
tags: {tags: [playwright, visual-qa, ui-testing, headless, screenshot, vision]}
---
# Headless Visual QA with Playwright + Vision

On a headless server (no monitor), verify that a web application renders correctly by combining Playwright screenshots with AI vision analysis against a reference image or design description.

## When to Use This

- Developing UI on a headless Linux server (e.g., ThinkPad T460 over SSH)
- Need pixel-perfect fidelity against a reference image
- Tailwind CSS or other styles may be failing silently
- Iterating rapidly on layout, colors, fonts, or component positioning

## Prerequisites

- Playwright installed with Chromium:
  ```bash
  npx playwright install chromium
  ```
- A running local dev server (Vite, Next.js, etc.) accessible on `localhost` or LAN IP
- A reference image (design mockup, screenshot, or detailed text description)

## Workflow

### Step 1: Capture Screenshot

Use Playwright headless to load the page and take a full screenshot:

```typescript
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

// Set viewport to match target device (e.g., iPhone 14 Pro)
await page.setViewportSize({ width: 430, height: 932 });

// Navigate to the local dev server
await page.goto('http://192.168.1.218:5173');

// Wait for fonts and layout to settle
await page.waitForTimeout(2000);

// Screenshot the full page or a specific element
await page.screenshot({ path: '/tmp/ui-check.png', fullPage: true });

await browser.close();
```

Run via `npx tsx screenshot.ts` or wrap in a shell one-liner using `execute_code`.

### Step 2: Analyze with Moondream2 via Ollama

**DO NOT use `vision_analyze`** — it returns HTTP 404/500 (gemini-web2api doesn't support images).

Use the Moondream2 pipeline instead:

```python
import base64, json, urllib.request
with open('/tmp/ui-check.png', 'rb') as f:
    img_b64 = base64.b64encode(f.read()).decode()
payload = {"model": "moondream:v2", "prompt": "Describe the UI. List all visible elements, colors, layout.", "images": [img_b64], "stream": False}
data = json.dumps(payload).encode()
req = urllib.request.Request('http://localhost:11434/api/generate', data=data, headers={'Content-Type': 'application/json'})
with urllib.request.urlopen(req, timeout=180) as resp:
    result = json.loads(resp.read())
    print(result.get('response', 'No response'))
```

### Step 3: Iterate Based on Feedback

Common issues and fixes:

| Vision Feedback | Likely Cause | Fix |
|-----------------|--------------|-----|
| Layout broken / elements stacked wrong | Tailwind classes not loaded | Switch to inline styles (`style={{...}}`) |
| Colors wrong / black instead of green | CSS variables not applied | Use literal hex values in inline styles |
| Fonts missing / fallback serif shown | Google Fonts not imported | Add `<link>` in `index.html`, use `fontFamily` inline |
| Keyboard missing or misaligned | Flexbox overflow | Set exact `width`/`height` percentages, use `boxSizing: 'border-box'` |
| Scanlines / effects missing | CSS pseudo-elements not rendering | Ensure `::before`/`::after` have `content: ''` and `position: absolute` |

### Step 4: Re-verify

After applying fixes, repeat Step 1 and Step 2. Keep the reference image/description constant so feedback is comparable across iterations.

## Key Pitfalls

### Pitfall 1: Tailwind Classes Silently Fail

**Symptom:** Screenshot shows unstyled or incorrectly styled elements even though Tailwind classes are present in JSX.

**Cause:** Vite may not be processing Tailwind CSS if `postcss.config.js` is missing, `@tailwind` directives are absent from `index.css`, or the `content` glob in `tailwind.config.js` doesn't cover the source files.

**Fix:** Instead of debugging the build pipeline under time pressure, pivot to **inline styles**. They are guaranteed to apply and are immune to PostCSS/Tailwind build issues:

```tsx
// Before (may fail silently)
<div className="flex flex-col bg-black h-screen">

// After (guaranteed to render)
<div style={{ display: 'flex', flexDirection: 'column', backgroundColor: '#000000', height: '100vh' }}>
```

**When to pivot:** If two consecutive screenshot iterations show no visual change after modifying Tailwind classes, switch to inline styles immediately.

### Pitfall 2: `localhost` vs LAN IP

**Symptom:** Playwright cannot reach the dev server.

**Cause:** Playwright runs in the local shell context. If the dev server is bound to `127.0.0.1` inside a Docker container or WSL, the host Playwright may not reach it.

**Fix:** Bind the dev server to `0.0.0.0` or the LAN IP (`192.168.1.x`), or use `host.docker.internal` from inside containers.

### Pitfall 3: Viewport Mismatch

**Symptom:** Desktop layout is rendered when testing a mobile UI.

**Fix:** Always call `page.setViewportSize()` before navigating. Match the exact dimensions of the target device.

### Pitfall 4: Screenshot Timing

**Symptom:** Fonts, images, or CSS animations are mid-load, causing false negatives.

**Fix:** Add `await page.waitForTimeout(2000)` or wait for a specific selector before screenshotting.

### Pitfall 5: `getComputedStyle` Lies — Pixel-Level Verification

**Symptom:** `getComputedStyle(element).backgroundColor` reports `rgb(255,255,255)` (white) but the screenshot shows the card is invisible — same color as the canvas background.

**Cause:** The parent container's background can paint over children in certain stacking context configurations. Common with absolutely-positioned world/container divs that have `width: 1px; height: 1px` but `inset: 0` or a large background. The computed style is correct for the element itself, but the browser composites the parent background on top.

**Diagnosis:**
1. Sample actual pixels from the screenshot using Python PIL:
   ```python
   from PIL import Image
   img = Image.open('/tmp/screenshot.png')
   print('Card center:', img.getpixel((card_x, card_y)))
   print('Canvas bg:', img.getpixel((bg_x, bg_y)))
   ```
2. If pixels match but `getComputedStyle` says different → stacking context issue.
3. Check if the card's ancestor has a background that covers the card area.

**Fix:** Give the card an explicit `z-index` higher than the world/container background layer. Or restructure the DOM so cards are siblings of (not children of) the full-screen background div.

### Pitfall 6: Vision Model Can't See Subtle Contrast

**Symptom:** Vision model consistently reports "blank page" or "no cards visible" even though the accessibility tree and DOM confirm elements exist with correct content.

**Cause:** The vision model struggles with low-contrast differences — e.g., white `#ffffff` card (`rgb(255,255,255)`) on cream `#F5F2EE` canvas (`rgb(245,242,238)`). The ~3% brightness difference is below the model's detection threshold, especially after screenshot compression.

**Diagnosis:**
1. Use `browser_console` to check `getComputedStyle` — if styles look correct but vision says blank, suspect contrast.
2. Sample pixels with PIL to measure actual contrast ratio.
3. Temporarily switch the page to dark mode (which often has higher contrast) or increase border/shadow.

**Fix:** Use higher-contrast card backgrounds in both light and dark modes. Add visible borders (`1px solid rgba(0,0,0,0.12)` minimum). Prefer `box-shadow` with sufficient spread to create visible separation from the canvas.

## One-Liner Verification Script

Save this as `scripts/visual-qa.ts` in any project:

```typescript
import { chromium } from 'playwright';

(async () => {
  const url = process.env.TARGET_URL || 'http://localhost:5173';
  const out = process.env.OUTPUT_PATH || '/tmp/visual-qa.png';
  const vw = parseInt(process.env.VIEWPORT_W || '430');
  const vh = parseInt(process.env.VIEWPORT_H || '932');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: vw, height: vh });
  await page.goto(url);
  await page.waitForTimeout(2000);
  await page.screenshot({ path: out, fullPage: true });
  await browser.close();
  console.log(`Screenshot saved to ${out}`);
})();
```

Run with:
```bash
TARGET_URL=http://192.168.1.218:5173 npx tsx scripts/visual-qa.ts
```

## Security Note

Screenshots may contain sensitive data (API keys in UI, personal info). Save them to `/tmp` or a project-local path, and do not commit them to version control.

## Pitfall 7: Chrome Symlink Broken

**Symptom:** `browser_navigate` fails with "Failed to launch Chrome: No such file or directory" at `/home/thinkpad/.local/bin/chrome`.

**Cause:** The symlink `/home/thinkpad/.local/bin/chrome` → `/home/thinkpad/chrome-linux/chrome` is broken (target deleted). Playwright Chromium IS installed at `~/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome`.

**Fix:**
```bash
rm /home/thinkpad/.local/bin/chrome
ln -s /home/thinkpad/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome /home/thinkpad/.local/bin/chrome
```

After relinking, `browser_navigate` works normally. The browser tool uses Playwright under the hood.

## Vision Analysis: Use Moondream2, NOT vision_analyze

**CRITICAL:** The `vision_analyze` tool does NOT work on this workstation (returns HTTP 404/500 — gemini-web2api proxy doesn't support images). 

**Correct pipeline — Moondream2 via Ollama (localhost:11434):**

### Step 1: Capture screenshot
Two options:
- **Browser tool:** `browser_vision(question="...")` — returns `screenshot_path` even when vision analysis fails
- **Desktop capture:** `export DISPLAY=:0 && xwd -root -silent | convert xwd:- /tmp/screenshot.png`

### Step 2: Analyze with Moondream2
```python
import base64, json, urllib.request
with open('/path/to/screenshot.png', 'rb') as f:
    img_b64 = base64.b64encode(f.read()).decode()
payload = {"model": "moondream:v2", "prompt": "Describe what you see.", "images": [img_b64], "stream": False}
data = json.dumps(payload).encode()
req = urllib.request.Request('http://localhost:11434/api/generate', data=data, headers={'Content-Type': 'application/json'})
with urllib.request.urlopen(req, timeout=180) as resp:
    result = json.loads(resp.read())
    print(result.get('response', 'No response'))
```

Or as a one-liner:
```bash
curl -s http://localhost:11434/api/generate -d '{"model":"moondream:v2","prompt":"Describe this.","images":["'"$(base64 -w0 /tmp/screenshot.png)"'"],"stream":false}' | python3 -c 'import json,sys;print(json.load(sys.stdin).get("response",""))'
```

**Model info:** moondream:v2 (1.7GB), installed in Ollama. Fast (~5-15s per analysis). Good for layout, color, element detection.

## Fallback Verification (When Browser Truly Unavailable)

If browser tool is broken AND can't be fixed, verify feature correctness through build artifacts:

```bash
# 1. Syntax-check all new/modified files
for f in src/**/*.jsx src/**/*.js; do
  npx esbuild --bundle --outdir=/tmp/escheck --log-level=error --external:react --external:react-dom "$f" 2>&1 && echo "OK: $f" || echo "FAIL: $f"
done

# 2. Production build succeeds?
pnpm build 2>&1 | tail -5

# 3. Dev server serves correctly?
curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/

# 4. Feature code present in built bundle?
grep -o "SelectionToolbar\|FolderViewModal\|arrangeMasonry" dist/assets/index-*.js | sort | uniq -c

# 5. Components imported in correct parents?
grep -E "import.*SelectionToolbar|import.*FolderViewModal" src/components/App.jsx src/canvas/Canvas.jsx
```

This is NOT a substitute for real visual QA but confirms the code is syntactically valid, bundled, imported, and served.

## Geometric DOM Audit — the PRIMARY fallback when vision can't see (FALSE-POSITIVE PASS trap)

**Critical lesson (real incident):** An app passed build + 0 console errors + 0 overflow, yet was
genuinely broken — the board rendered **ZERO cards** and the bottom AI cluster had controls
**overlapping by 2125px²** (Add-note FAB stacked on the "Looking Glass AI" button on mobile).
A prior DOM/console-only "mobile compliance PASS" was a **false positive**. Clean console +
clean overflow ≠ correct UI.

When `vision_analyze` / `browser_vision` return "no image attached" (text-only model) — which is
the normal case on this workstation — do NOT trust a visual check that can't see. Instead run a
**geometric DOM audit**. It is deterministic, falsifiable, and needs no vision model.

Inside `page.evaluate`, from `getBoundingClientRect()`:
1. **Content present?** Count els matching the app's card/note class regex (`card|canvas-item|sticky|note`). `count===0` ⇒ empty board (critical).
2. **Interactive overlap:** pairwise `overlapArea = max(0,ix)*max(0,iy)` over `a,button,[role=button],input,textarea,[tabindex]` (w,h>0). Flag pairs >400px² (≥800 = high). Two clickables on top of each other ⇒ one unclickable.
3. **Partial off-screen:** `x<0 || y<0 || x+w>vw+1 || y+h>vh+1`.
4. **Text clipping:** leaf els where `scrollWidth > clientWidth + 2`.
5. **Horizontal overflow:** `de.scrollWidth > de.clientWidth + 1`.

Collect per viewport (mobile 390×844 `isMobile:true,hasTouch:true`; desktop 1280×900) for BOTH
the preview build (`vite preview --port 4173`) AND the live URL. Emit deduplicated
`{id,severity,viewport,url,title,detail,evidence}` JSON.

Reusable script: **`scripts/dom-audit.mjs`** (env-overridable: `REPO_ROOT, PREVIEW_URL, LIVE_URL,
VIEWPORTS, OUT_JSON, OUT_DIR, CARD_RX, OVERLAP_MIN`). Run FROM the project root so `createRequire`
resolves `node_modules/playwright`.

```bash
cd /proj && REPO_ROOT=/proj PREVIEW_URL=http://localhost:4173/ \
  LIVE_URL=https://your-app.vercel.app \
  node /path/to/headless-visual-qa/scripts/dom-audit.mjs
```

**ESM gotcha:** `import { chromium } from 'playwright'` with `NODE_PATH=node_modules` FAILS under
ESM (`ERR_MODULE_NOT_FOUND`). Use `createRequire(join(REPO_ROOT,'package.json'))` — which the
script already does. This also replaces the broken `vite preview` nohup pattern (see Pitfall 8).

**Report honestly.** If geometry proves breakage, state it plainly even if prior runs claimed
"PASS". Cite numbers (e.g. "overlap 2125px²", "0 cards", "label 61>42px clipped").

Details + real reproduction recipe: `references/dom-geometry-audit.md`.

## Pitfall 8: `vite preview` background launch + ESM Playwright require

**Symptom 1:** `terminal(background=true)` with a long-lived server is correct, but wrapping it in
`nohup ... &` triggers the harness guard ("uses shell-level background wrappers"). Use
`terminal(background=true)` with the server command directly; verify with `curl -sS -o /dev/null
-w "%{http_code}" http://localhost:4173/` (expect 200).

**Symptom 2:** `node audit.mjs` with `import { chromium } from 'playwright'` + `NODE_PATH` →
`ERR_MODULE_NOT_FOUND`. Fix: `const require = createRequire('/abs/project/'); const { chromium } = require('playwright');`

## See Also

- `scripts/dom-audit.mjs` — Reusable geometric DOM-audit (prefer over vision when the model can't see images).
- `references/dom-geometry-audit.md` — False-positive-PASS incident, overlap/geometry recipe, vision-tool reality on this workstation.
- `references/card-styles-migration-debug.md` — Debugging recipe for when CSS card styles are lost during a migration (V1→V2 rewrite). Covers diagnosis via `getComputedStyle`, pixel sampling with PIL, light/dark mode contrast issues, and canvas-world stacking context problems.
- `references/no-browser-verification.md` — Build-analysis fallback recipes for when no browser is available on the workstation.
