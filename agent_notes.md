# 3DDD Studio — Agent Notes

> Last updated: 2026-07-27
> Stack: React 19 + React-Three-Fiber (Three.js 0.185) + @react-three/drei + @react-three/postprocessing + Tailwind v4 + Vite 6 + pnpm.

## Architecture

- **Entry:** `src/main.tsx` → `App.tsx` (top-level state, OBJ/GLB upload, mode switching).
- **3D scene:** `src/Viewer3D.tsx` — R3F Canvas, decal raycasting (mesh-local space), `DitheringPass` postprocessing.
- **Flat-lay editing:** `src/FlatLayEditor.tsx` — orthographic preview + image editor (`ImageEditor.tsx`), save-raycast shares the decal world→local bug class.
- **State:** `src/store.ts` (zustand).
- **Custom dither:** `src/DitheringEffect.ts` (extends `Effect` from `postprocessing`) + `src/DitheringShader.ts` + `src/DitheringPass` wrapper in `Viewer3D.tsx`.

## Critical Invariants (DO NOT BREAK)

1. **GLB 200MB cap** — `App.tsx` `handleObjUpload`. Size check BEFORE fake-progress/IDB write. `200 * 1024 * 1024` for GLB/GLTF, 50MB for OBJ.
2. **Decal raycast is MESH-LOCAL** — `Viewer3D.tsx` converts `hit.point`/`hit.face.normal` from world → mesh-local. Applied at all 4 raycast sites.
3. **`postprocessing` is a DIRECT dependency** (not transitive) — `DitheringEffect.ts` imports it. pnpm strict layout will fail the build otherwise.

## The .glb Upload Problem (2026-07-27 — OPEN, fix parked with Orca)

- **Transport works**; the bug is a **silent discard** in `Viewer3D.tsx` `InvalidModelFallback` (`setCustomModel(null)`) when `useGLTF` throws on Draco-compressed GLBs (no decoder wired).
- **No server persistence** — uploads are IndexedDB-only. Plan: make **GitHub the default storage** (`src/githubStorage.ts` → Contents API → `public/models/<file>`, static URL), IndexedDB fallback.
- Parked branch: `sudo-prog/glb-github-upload-v2`.

## Pitfalls (verified 2026-07-25)

- **"Syntax-clean" ≠ builds.** A sub-agent reported files "syntax-clean" but never ran `pnpm install`/`vercel build`. The build caught `postprocessing` resolution failure. Always run the real build as the gate.
- **`DitheringPass` lifecycle:** construct `DitheringEffect` once (useMemo), update via setters, `dispose()` on unmount.
- **`<orthographicCamera>` lowercase is NOT the render camera** → must use drei `<OrthographicCamera makeDefault manual>`.
- **Null-deref:** `e.intersections[0].object` guard on empty intersections; use `hit.face.normal` via `getWorldNormal`.

## Ops

- **Canonical repo:** GitHub `sudo-prog/3ddd-studio` `main` (1356eca). Deploy: push `main` → Vercel auto-deploy → https://3ddd-studio.vercel.app.
- **Local `20.17_3DDD_STUDIO` repo has DIVERGENT history from origin/main** — do NOT force-push local `main` over origin. Use feature branches.
- **Dev skills:** `./SKILLS/` (4× 3D codrops, 6× UI/quality) restored 2026-07-27.
- **Build gate:** `pnpm install && pnpm build` OR `vercel build` (both GREEN as of 2026-07-27).
- **VS Code headless sub-agent:** launched background 2026-07-27 (Xvfb :99, Kilo disabled) for dev-skills work.
- **Gemini web2api:** up (:8081/8082/8083 + LB :8090) — local free model gateway.
- **ACP kanban board:** running (hermes acp, pid 246233).
