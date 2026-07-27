---
name: mobile-ui-standards-bible
description: DURABLE mobile-UI standards bible + universal per-element Playwright verification harness for ALL web apps (FAMLY-Office, WWW-Studio, Looking Glass, any SPA). Supersedes the page-level-only mobile-ui-verification-standard. Use on EVERY mobile UI build/fix. Prevents the "builds pass but broken on mobile" false-pass class. Defines measurable rules (touch targets, safe-area, per-element overflow with scroll-container exclusion, all-routes walk, touch-target audit) + the verification loop that must PASS with evidence before any "fixed" claim.
---

# Mobile UI Standards Bible + Verification SOP

> **This skill is the anti-"it builds, so it's fixed" protocol, hardened by 2 weeks of
> repeated false passes across 3 production apps.** It exists because we shipped
> "34/34 GREEN" three times while the user's phone still showed broken layouts. The root
> cause was always: the verification was too weak (page-level only, screenshots from a
> text-only model, trusting subagent "success" reports). This skill makes the gate
> *impossible to pass falsely*.

## 0. The Iron Rules (from OPS_LOG — what DOESN'T work, proven the hard way)

1. **git push ≠ prod deploy.** Vercel builds from git, but a manual `vercel deploy` from the
   wrong directory (e.g. `artifacts/family-office/` instead of repo root) FAILS with
   "Headless installation requires a pnpm-lock.yaml file" and the live alias serves the OLD
   build. The fix is only live after a deploy that builds from the repo root (or git-push
   auto-deploy). **Always verify the LIVE url, never localhost, never the git commit.**
2. **A page-level overflow check is NOT enough.** `scrollWidth <= innerWidth+1` PASSED while
   398 individual elements overflowed the viewport (wide `<table>`s inside pages with no
   scroll container). You MUST scan per-element AND exclude elements inside an
   `overflow-x:auto/scroll/hidden` ancestor (otherwise legitimately-scrollable tables
   false-positive). → see §2 harness.
3. **Screenshots from a text-only model are unreliable.** Moondream (`moondream:v2`) via
   Ollama hallucinated "vertical letter stacks" from a normal H1. OmniParser detection-only
   (YOLO+OCR) is the reliable grounding signal; its Florence captioner needs `flash_attn`
   (CUDA-only, won't build on CPU) so run detection-only. **Verify via DOM state, not pixels.**
4. **`waitUntil:'networkidle'` never fires on SPAs with a persistent SSE/AI connection.**
   Use `domcontentloaded` + a fixed settle wait (2.5s). Otherwise the gate errors out falsely.
5. **Never trust a subagent's "success" report.** A subagent that says "built successfully"
   left `export-pdf.tsx` with an unbalanced `<div>` (build broken) once. **Independently
   re-run the build + the verification harness yourself.**
6. **Extend each project's OWN token system. Never import a foreign design system's CSS**
   (Codrops/Material/Nothing) that overrides `--z-*`/`--color-*` tokens → z-index/token wars.
7. **`width:max-content` on tables is a trap** on mobile: it sizes to content (624–672px) and,
   without a scroll wrapper, pushes past the viewport. Use `display:block;width:100%;
   overflow-x:auto` so the table is its own scroll container capped to the viewport.
   (`max-width:100%` does NOT cap it when the parent is already wide — use `width:100%`.)
8. **Tailwind v4 + older mobile browsers = silent oklab/color-mix color drop.** Downlevel
   `oklab/oklch/color-mix` → `rgb()/rgba()` in a post-build step for prod. iOS <16.4 and
   Android Chrome <113 reject oklab. (web-performance-seo skill covers the contrast side.)

## 1. The Standards (measurable rules — every build must satisfy these)

### Touch & targets
- **T-1 Tap target ≥ 44×44px** hit area (iOS HIG; WCAG 2.5.5). Prefer 48px (Material 3).
  Both the visible control AND its transparent hit area must meet this. Measured via
  `getBoundingClientRect()` of `button, a, [role=button]`.
- **T-2 No tap-swallow:** when a menu/sheet is open, `elementFromPoint(center)` must resolve
  to the menu, not the toolbar/sidebar. (Caught the "menu vanishes on tap" bug.)
- **T-3 Touch parity:** every desktop right-click action needs a long-press (≥500ms) or
  explicit button on touch.

### Safe area / viewport
- **S-1 Safe area:** bottom-docked UI uses `env(safe-area-inset-bottom)` (+ top/left/right),
  never bare `bottom:0`. Test at 390×844 (notched).
- **S-2 New content on-screen:** created elements render within `[0,390]×[0,844]`. Never
  spawn at hardcoded desktop coords (e.g. (400,300) → off-screen).
- **S-3 Mobile menus = bottom sheet** at ≤767px (full width, scrim, above toolbar z-index),
  not a floating desktop dropdown.

### Layout / overflow (the big one)
- **L-1 No horizontal overflow, PER ELEMENT:** every in-flow element's `right ≤ 390+1` on a
  390px viewport, EXCLUDING elements inside an `overflow-x:auto/scroll/hidden` ancestor
  (scrollable tables/carousels are correct, not bugs). → harness §2.
- **L-2 Wide `<table>`s:** self-scroll (`display:block;width:100%;overflow-x:auto`) OR
  card/stacked layout on mobile. Never `width:max-content` without a scroll wrapper.
- **L-3 Flex rows wrap:** `flex` containers that don't wrap (`flex-nowrap`) with wide children
  overflow. Use `flex-wrap` or stack to column at `<=640px`.
- **L-4 No fixed min-width / hardcoded px widths** wider than the viewport on mobile.
- **L-5 Content fits 320px** (WCAG 1.4.10 reflow): the layout must not require horizontal
  scroll at 320px CSS px.

### Color / contrast
- **C-1 Downlevel oklab/color-mix for prod** (see Iron Rule 8).
- **C-2 Contrast ≥ 4.5:1** (WCAG 1.4.3) for text; ≥3:1 for large text/UI. Outdoor readability.
- **C-3 Don't rely on color alone** to convey state (WCAG 1.4.1).

### PWA / install
- **P-1 iOS Safari has NO inline install prompt.** `beforeinstallprompt` does not fire on
  iOS. Detect `isIOSSafari` and show "Share → Add to Home Screen" instructions instead of a
  (permanently disabled on iOS) install button.

### Sources / adopted standards (research-validated 2026-07-16)
- **iOS HIG (ergonomics bible, reference-only):** https://developer.apple.com/design/human-interface-guidelines — 44pt tap target, safe-area `env()`, bottom sheets, tab bars.
- **WCAG 2.5.5 (44px), 2.5.8 (24px floor), 1.4.10 reflow @320px:** https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html
- **web.dev responsive / mobile-friendly:** https://web.dev/articles/responsive-web-design-basics
- **Front-End-Checklist (thedaviddias) — AI-agent-first, 385 rules, ships MCP + skills. ADOPT AS VERIFICATION GATE BACKBONE:** https://github.com/thedaviddias/Front-End-Checklist · MCP `mcp.frontendchecklist.io` · `npx skills add frontendchecklist/skills`.
- **DESIGN.md concept (awesome-design-md) — encode the standard as markdown the agent reads pre-build:** https://github.com/VoltAgent/awesome-design-md
- **awesome-design-systems (pattern inspiration, not copy):** https://github.com/alexpate/awesome-design-systems
- **shadcn/ui (+Radix) — RECOMMENDED COMPONENT BASE:** copy-in, AI-Ready, Tailwind-native, no foreign runtime tokens to fight. `Sheet side="bottom"` + vaul Drawer = native bottom sheets. https://ui.shadcn.com
- **Material 3 / Ant Design Mobile / Ionic — REFERENCE PATTERNS ONLY (bottom sheet, FAB, swipe, pull-to-refresh, safe-area). DO NOT `npm i` raw beside Tailwind — token/z-index wars.**
- **REJECTED as base for a Tailwind PWA: Mantine, Chakra (Emotion/style-prop engines duplicate Tailwind = dual-token trap).**

## 1b. The composite standard (what to actually bake in)
`MOBILE-UI-STANDARD.md` (rules: 44px, safe-area, bottom sheet, no-token-wars) **+** shadcn/ui components **+** Tailwind responsive/container-query/safe-area utilities **+** Material3/HIG as referenced patterns **+** the §2 verification loop on every build **+** a repo-root `DESIGN.md` the agent reads before building. Pair the loop with `mcp.frontendchecklist.io` for a vetted 385-rule pre-ship gate.

## 1c. Harness gotchas (from research, fold into §2)
- **`storageState` omits `sessionStorage`** — re-inject via `addInitScript` if the app gates auth on sessionStorage (not just localStorage).
- **`waitUntil:'networkidle'` never fires on SPAs with a persistent SSE/AI connection** — use `domcontentloaded` + a fixed settle wait (2.5s) or a `data-app-ready` selector.
- **Measure the element's own rect** (that IS the transparent hit area) for touch-target checks; gate at 44×44.
- **`100vh` vs `100dvh`** — `100vh` is wrong on mobile browsers with dynamic toolbars; use `100dvh`.
- **OmniParser cross-check** (`/home/thinkpad/Data/OmniParser/omni_detect.py`, detection-only, flash_attn bypassed) on clean screenshots (tour dismissed) → 0 boxes past viewport.

## 2. The Verification Harness (proven — caught the round-2 regression)

A single Playwright script run against the LIVE prod url, all routes, at 390×844.
Save as `fo-verify-mobile.cjs` (or `.mjs`) in the repo, run, then delete.

```js
// fo-verify-mobile.cjs — universal per-element mobile gate
import { chromium } from 'playwright';
import fs from 'fs';
const BASE = (process.env.TARGET_URL || 'https://<canonical>.vercel.app').replace(/\/$/, '');
const VW = 390, PIN = process.env.PIN || '123456';
const ROUTES = [/* ALL routes from the app's router, not just 8 */];
const browser = await chromium.launch({ headless: true });

// --- unlock auth/PIN once, persist storageState ---
const u = await browser.newContext({ viewport:{width:VW,height:844}, hasTouch:true, isMobile:true });
const up = await u.newPage();
await up.goto(BASE, { waitUntil:'domcontentloaded' }); await up.waitForTimeout(1500);
for (let r=0;r<2;r++){ for (const d of PIN){ await up.evaluate(x=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent?.trim()===x); if(b)b.click();},d); await up.waitForTimeout(200);} await up.waitForTimeout(800);}
await up.waitForTimeout(800);
await u.storageState({ path:'state.json' }); await u.close();

const gates = {};
for (const route of ROUTES) {
  const ctx = await browser.newContext({ viewport:{width:VW,height:844}, hasTouch:true, isMobile:true, storageState:'state.json' });
  const page = await ctx.newPage();
  const errs=[]; page.on('console',m=>m.type()==='error'&&errs.push(m.text()));
  page.on('pageerror',e=>errs.push('PE:'+e.message));
  try { await page.goto(BASE+route,{waitUntil:'domcontentloaded',timeout:25000}); } catch(e){}
  await page.waitForTimeout(2500); // SSE/AI: NO networkidle

  const res = await page.evaluate((vw)=>{
    const docOverflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;
    const inScroll = el => { let p=el.parentElement; while(p){ const cs=getComputedStyle(p);
      if((cs.overflowX==='auto'||cs.overflowX==='scroll'||cs.overflowX==='hidden') && p.getBoundingClientRect().width<=vw+1) return true; p=p.parentElement;} return false; };
    const off=[]; const walk=el=>{
      const cs=getComputedStyle(el); const pos=cs.position;
      if(pos==='fixed'||pos==='absolute'||pos==='sticky'){ for(const c of el.children) walk(c; return; }
      const r=el.getBoundingClientRect();
      if(r.width>0&&r.height>0&&el.offsetParent!==null&&r.right>vw+1 && !inScroll(el))
        off.push({tag:el.tagName.toLowerCase(),right:Math.round(r.right)});
      for(const c of el.children) walk(c);
    }; walk(document.body);
    // touch targets
    const taps=[...document.querySelectorAll('button,a,[role=button]')].map(e=>{const r=e.getBoundingClientRect();return {w:Math.round(r.width),h:Math.round(r.height)};}).filter(t=>t.h>0);
    const smallTaps=taps.filter(t=>t.w<44||t.h<44).length;
    return { docOverflow, realOff:off.length, offList:off.slice(0,10), totalTaps:taps.length, smallTaps };
  }, VW);
  gates[route] = { ...res, consoleErrs:errs.length };
  await ctx.close();
}
const bad = Object.entries(gates).filter(([_,g])=>g.realOff>0||g.docOverflow>2||g.consoleErrs>0||g.smallTaps>0);
fs.writeFileSync('verify-report.json', JSON.stringify(gates,null,2));
console.log(`ROUTES=${ROUTES.length} FAILING=${bad.length}`);
process.exit(bad.length?1:0);
```

### Gate assertions (all must pass)
- `docOverflow ≤ 2` (no page-level horizontal scroll)
- `realOff === 0` (no in-flow element past viewport, scrollable containers excluded)
- `consoleErrs === 0`
- `smallTaps === 0` (every tap target ≥44px)

### Cross-check (optional, stronger)
- **OmniParser detection-only** (`/home/thinkpad/Data/OmniParser/omni_detect.py`) on clean
  screenshots (tour dismissed) → 0 boxes past 390px. Bypasses Florence `flash_attn`.
- **agent-browser**: `evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)` → 0.

## 3. The Loop (before ANY "fixed" claim)
1. Edit → 2. **commit + push** → 3. **deploy from repo root** (or git-push auto-deploy) →
4. **run §2 harness against the LIVE url** → 5. if any gate fails, fix root cause (read the
   actual component), rebuild, redeploy, re-verify. Do not stop at "build passes".
6. Only THEN claim fixed — with the harness's PASS output as evidence.

## 3b. NO-DEPLOY mode (when a task forbids vercel deploy / git push)
Some tasks gate on the **freshly-built dist served locally** and require **proof of work
from `git diff`** instead of a live deploy. This is a valid, weaker-but-honest variant:
1. Edit `src/...` (e.g. `src/index.css`) → 2. **rebuild** (`pnpm --filter <pkg> run build`,
   assert exit 0) → 3. `pnpm --filter <pkg> run serve --port 4173` (vite preview of the
   **built** `dist`, not the dev server) → 4. run a Playwright harness pointed at
   `http://127.0.0.1:4173` → 5. assert `git diff --stat -- <src>` is **non-empty** as the
   proof-of-work artifact (a real change to source files, committed-or-not).
- This proves: (a) the fix is in source, (b) it compiles, (c) it holds in the built output
  at runtime. It does NOT prove the live site (that needs §3 deploy + live url). State which
  mode you ran. NEVER invent a deploy you didn't do.
- **Require non-empty `git diff` of `src/`** — if the change is only to untracked scripts or
  `.gitignore`, it is not proof the app was fixed. The diff must touch the `src/` that ships.

### 3b-pitfalls (from a real no-deploy LG session — cost real iterations)
1. **Serve the BUILT `dist/` on a FREE port.** `vite preview` is SILENT if the port is taken —
   it serves a DIFFERENT project's DOM (4173/4174 were held by WWW Studio). Probe a free
   port (`for p in 4180 4190 4200 4300 4400 4500; do echo > /dev/tcp/localhost/$p || { echo "$p FREE"; break; }; done`)
   and always pass `--strictPort`. Serve the built `dist/`, not the dev server.
2. **Playwright `page.evaluate(fn, a, b)` throws `Too many arguments`** — pass ONE object arg:
   `evaluate(({vw,vh})=>{...}, {vw,vh})`. AND Node-scope `const`s are NOT in scope inside the
   browser fn — inline selector strings; don't reference a `SELECTOR` const declared in Node.
3. **Assert `matchMedia('(pointer: coarse)').matches` is true** on the mobile context BEFORE
   asserting 44px — the responsive rules fire on coarse pointers; a silent non-fire = false pass.
4. **Probe the EXACT failing element first** (print `el.outerHTML` via `page.evaluate`). Two 30×15
   inputs in LG were an unclassed tag input (→ add `lg-tag-input` class + `.lg-tag-input{min-height:44px}`)
   and a `<a class="card-link">↗</a>` with NO css rule (→ `.card-link{min-width:44px;min-height:44px}`).
   Don't guess — print `el.outerHTML` so you target the real source.
5. **Run the harness FROM the repo dir** (ESM ignores `NODE_PATH`): copy `lg_verify2.mjs` into the
   repo and `node ./lg_verify2.mjs`, not `node /tmp/lg_verify2.mjs`.
6. **Add two gates the base §2 harness lacks:** (a) pairwise control-overlap (fixed `.lg-orb-root`
   bottom-center overlapped the docked toolbar — lift root above the bar + raise z-index); (b)
   panel-unmount-intercept (a conditionally-rendered modal is unmounted when closed →
   `document.querySelector('.ai-summarise-panel')` must be null → cannot eat clicks).
See `references/no-deploy-playwright-recipe.md` for the full skeleton (free-port probe, tap
audit, overlap detection, panel-unmount check, empty-board seed check, required proof).

## 3c. REPRODUCE-FIRST when the reported class can't be found
Before assuming a bug "is fixed" or writing a fix, confirm the failing element **actually
exists in THIS build**. A prior audit may have measured a stale build (e.g. a different
Vercel deploy). Search exhaustively, in order:
1. `src/` (all extensions, regex + glob) — the class may be **constructed**, not a literal
   (e.g. `cn(\`toolbar-${variant}\`)`); grep for partials `toolbar` and template patterns.
2. `dist/` (built output) — was the class renamed/stripped by the bundler?
3. `node_modules/` (esp. workspace pkgs like `@agent-native/core` or `@workspace/*`) — a
   "site-wide" palette often ships from a dependency, not app `src`.
4. The **live site** (Playwright `goto` the prod url) — confirms a stale deploy isn't the
   source of the claim.
If the class renders **0 times on every route** in all four, the reported failure is
**not reproducible in the current source**. Then: (a) still land the defensive CSS fix if
cheap, (b) report `reproducibleInThisBuild: false` honestly, (c) do NOT claim a false pass —
say the tap-target criterion holds because 0 sub-44px elements were found, but the specific
element named in the ticket isn't present.

## 3d. Classify console/page errors by the CHANGE CLASS before failing the run
A verification run can surface errors unrelated to the fix. A **CSS-only change cannot
introduce a JS `TypeError`** (e.g. `TypeError: r.filter is not a function`,
`Cannot read properties of undefined`). Such errors are **pre-existing runtime data bugs**
in the app bundle, orthogonal to a layout/tap-target fix. Rule:
- If the change is CSS-only → report console/page errors but **do not let them block the
  tap-target gate**; note them as a separate pre-existing issue (worthy of its own task).
- If the change touched the failing code path → it IS your regression; fix it.
This prevents a false **FAIL** from noise and prevents a false **PASS** from swallowing a
real regression. State the classification explicitly in the verify JSON.

## Support files in this skill
- `references/taptarget-css-recipe.md` — the exact CSS to grow a 32px icon button to a 44px
  hit area (Tailwind v4, `!important` + `inline-flex` centering), plus the generic fallback.
- `references/no-deploy-playwright-recipe.md` — no-deploy (§3b) Playwright recipe from a real
  LG session: free-port probe + `--strictPort`, `page.evaluate` one-arg/inline-selector
  gotchas, `matchMedia('(pointer:coarse)')` assertion, tap audit, pairwise overlap detection,
  panel-unmount-intercept check, empty-board seed check, required proof.
- `scripts/taptarget-audit.mjs` — no-auth Playwright gate for the tap-target class (T-1):
  walks routes at 390×844, measures the target class + all sub-44px interactives, writes
  `/tmp/ws_taptarget.json`, exits non-zero on failure. Set `BASE` and `TARGET_CLASS` env vars.
  (For overflow/menus/safe-area use the full §2 harness; this is the minimal 44px gate.)

## 4. Per-project notes
- **Family Office:** 25 routes; tables now self-scroll (`src/index.css` `@media(max-width:640px)
  {table{display:block;width:100%;overflow-x:auto}}`). PIN `123456`. Verified 0 real breakage
  on all 25 routes post round-2 regression fix.
- **WWW Studio / Looking Glass:** same harness; audit bottom sheets, safe-area, tap targets.
- **WWW Studio (44px toolbar-btn, 2026-07-23):** the reported `.toolbar-btn` (32×32) was NOT
  present in `src/`, `dist/`, `node_modules/`, OR the live site — the prior audit measured a
  stale Vercel build. Reproduce-first (§3c) confirmed 0 renders; global CSS already forced
  44px; landed an explicit `.toolbar-btn` 44px rule anyway. No-deploy mode (§3b) used: gated on
  `vite preview` of built `dist` + non-empty `git diff src/index.css` as proof. `TypeError:
  r.filter is not a function` console errors were classified (§3d) as pre-existing JS, not the
  CSS fix. See `scripts/taptarget-audit.mjs` + `references/taptarget-css-recipe.md`.
