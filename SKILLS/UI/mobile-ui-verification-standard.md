---
name: mobile-ui-verification-standard
description: Mandatory mobile-UI correctness standard + runtime-verification loop for Looking Glass, Family Office, and WWW Studio (or any web app). Defines the authoritative touch-target / safe-area / bottom-sheet rules and the PLAYWRIGHT RUNTIME VERIFICATION that must pass BEFORE any "fixed" claim. Use on every mobile UI task; supersedes conflicting design skills.
---

# Mobile UI Verification Standard (the anti-"it builds, so it's fixed" protocol)

## Why this exists
Past "fixes" were declared done from a build + a code read + maybe one screenshot.
They were wrong because: (1) git-push != prod deploy on Vercel, (2) a static photo
cannot reveal interaction bugs (menu opens then is covered, card spawns off-screen),
(3) the agent model is text-only (no native vision) so photo "verification" is weak,
(4) mismatched design skills produced CSS that fought each project's own token system.

## THE RULES (authoritative — extend each project's OWN tokens, never import a foreign design system)
1. **Tap target:** minimum **44×44px** interactive hit area (iOS HIG / WCAG 2.5.5). Prefer 48px (Material 3). Visible controls AND their transparent hit areas must meet this.
2. **Safe area:** every bottom-docked UI must use `env(safe-area-inset-bottom)` (and top/left/right) — never a bare `bottom: 0`. Test on a notched viewport (390×844).
3. **Mobile menus = bottom sheet** on `<=767px` width, NOT a desktop dropdown that floats. The sheet must sit ABOVE the toolbar (higher z-index) and cover the full width with a scrim.
4. **No tap swallowing:** when a menu/sheet is open, `document.elementFromPoint(centerOfMenuItem)` must resolve to the MENU, not the toolbar/sidebar/overlay. (This caught the "menu disappears on tap" bug — the toolbar painted on top.)
5. **New content must be on-screen:** any newly created element must render within the current viewport bounds on a 390×844 mobile viewport (rect.x in [0,390], rect.y in [0,844]). Never spawn at a hardcoded desktop coordinate like (400,300).
6. **Touch parity:** every action reachable by right-click/desktop must also be reachable by long-press (>=500ms) or an explicit button on touch. Add `onTouchStart` long-press where there is only an `onContextMenu`.
7. **No horizontal overflow:** `document.documentElement.scrollWidth <= window.innerWidth + 1` on mobile.

## THE VERIFICATION LOOP (must run, with real evidence, before saying "fixed")
Do NOT claim success without this. Order matters.

### Step A — Deploy to PROD (the fix isn't live until this runs)
```
export PATH="/home/thinkpad/.nvm/versions/node/v22.23.0/bin:$PATH"
export VERCEL_TOKEN="$(grep VERCEL_TOKEN ~/.hermes/profiles/chief-of-staff/.env | cut -d= -f2)"
vercel deploy --prod --yes        # auto-promotes + aliases the canonical URL
```
git push alone does NOTHING for the live site. Verify the alias now points to a fresh build:
`vercel alias ls` / `vercel inspect <canonical-url>`.

### Step B — Runtime DOM verification with Playwright (NOT a screenshot)
The agent is text-only; assert DOM state instead of "looking". Run from the PROJECT dir
so `playwright` resolves from `./node_modules`:
```bash
export PATH="/home/thinkpad/.nvm/versions/node/v22.23.0/bin:$PATH"
export NODE_PATH="$(pwd)/node_modules"
export LG_URL="https://<canonical>.vercel.app"
node ./_verify_mobile.cjs
```
A reusable Playwright harness (save as `_verify_mobile.cjs` in the repo, delete after):
- `chromium.launch()`, `newContext({ viewport:{width:390,height:844}, hasTouch:true, isMobile:true, deviceScaleFactor:3 })`
- `page.goto(URL, { waitUntil:'networkidle' })` then wait 2.5s for boot.
- Collect `page.on('console', m=>m.type()==='error')` and `pageerror` — assert ZERO errors.
- **Menu-open test:** emulate long-press via CDP real touch, NOT synthetic JS TouchEvents
  (synthetic events often don't traverse React's root listener):
  ```js
  const client = await page.context().newCDPSession(page);
  await client.send('Input.dispatchTouchEvent', { type:'touchStart', touchPoints:[{x,y}] });
  await page.waitForTimeout(650);
  await client.send('Input.dispatchTouchEvent', { type:'touchEnd', touchPoints:[] });
  ```
  Then assert the menu's known labels (Delete/Stack/Folder/Summarise/Edit Tags/Open URL/Archive/Color)
  are now `isVisible()`, and `elementFromPoint(menuCenter)` resolves to the menu, not the toolbar.
- **On-screen test:** after creating an item, read `el.getBoundingClientRect()` and assert
  `rect.x in [0,390] && rect.y in [0,844]`. (This caught the off-screen spawn bug.)
- **Overflow test:** `await page.evaluate(()=>document.documentElement.scrollWidth)` <= innerWidth+1.
- Print a JSON report and assert each gate; exit non-zero on any failure.

### Step C — Real-verify the LIVE URL, not localhost
`localhost` has the dev server + tunnel; the DEPLOYED url is what users hit. Always point
Playwright at the production alias URL from Step A.

### Step D — Repeat until clean
If any gate fails, fix the root cause (read the actual component, don't guess), rebuild,
redeploy, re-verify. Do not stop at "build passes".

## Anti-patterns that previously caused false "fixed" claims
- Claiming done from `pnpm build` success alone.
- Reading code and inferring behavior instead of executing it on a mobile viewport.
- Pushing to git and assuming the site updated (it didn't — no prod deploy).
- Applying a Codrops/Material/foreign skill's CSS that overrode the project's own `--z-*`
  tokens, producing z-index wars. ALWAYS extend the existing token set.
- Using a static screenshot as "proof" (text-only model + one frame can't show interaction).

## Per-project notes
- **Looking Glass:** infinite canvas; new items spawned at hardcoded (400,300) → off-screen
  on mobile (FIXED via viewport-center helper). Menu now opens via long-press; verify no
  toolbar tap-swallow.
- **Family Office / WWW Studio:** run the same harness; audit bottom sheets, safe-area,
  tap targets, overflow on their own token systems.
