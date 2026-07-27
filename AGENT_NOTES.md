# AGENT_NOTES — 3DDD STUDIO

## Identity
- Project: 3DDD Studio (3D product configurator / t-shirt viewer)
- Canonical repo: `/home/thinkpad/Data/20_Projects/20.17_3DDD_STUDIO`
- GitHub: `sudo-prog/3ddd-studio` (branch `main`)
- Prod: https://3ddd-studio.vercel.app (Vercel auto-deploys on push to main)
- Stack: Vite 6 + React 19 + react-three-fiber 9 / three 0.185 + tailwind v4
- **STATUS (2026-07-28): VERIFIED WORKING.** Blank-viewport bug fixed (Round 5):
  `<Environment preset="studio">` wrapped in `<Suspense>` + `<ErrorBoundary>`
  (failed/blocked HDR no longer blanks the canvas); decals parented via
  `createPortal` into target mesh; drag-drop `.glb/.obj` upload unblocked.
  Live render verified by viewport pixel analysis (27.6% non-white, centered
  garment silhouette). See AUDIT_AND_FIXES.md "Round 5".

## Agent workflow (how to work on this repo)
- VS Code headless sub-agent host (launched by Hermes, not in-editor extensions):
  `/home/thinkpad/.hermes/profiles/chief-of-staff/bin/vscode-headless-launch.sh /home/thinkpad/Data/20_Projects/20.17_3DDD_STUDIO`
  Uses an isolated `--user-data-dir` (Kilo/Roo disabled). LLM provider = Gemini web2api at `:8081`.
- LLM must be FREE/LOCAL only — gemini-web2api (`:8081`) or OmniRoute (`:20128`). No paid models.
- Verify before claiming done: `pnpm build` + `vercel build`. A sub-agent's "builds pass" is false until the orchestrator runs the real build.

## Cleanup state (2026-07-28)
- Removed: Trash copies (`3ddd studio fixed` / `.zip`); `BACKUP_3DDD_SQUAD_20260727`.
- Sub-agent consolidating: stray clone `/home/thinkpad/20_projects/3DDD studio`,
  `~/Downloads/3ddd_studio_fixed`, and orca worktrees
  (`~/orca/workspaces/20.17_3DDD_STUDIO/{3ddd-fix-v2,3ddd-fix-v3,verify-3ddd-glb-fix}`).
- Single source of truth = `20.17_3DDD_STUDIO`. Keep tooling: `launch_3ddd_*.sh`,
  `~/.hermes/kanban/boards/3ddd-studio`, `~/.vscode-headless-3ddd`.
- Naming rule: folders + doc files are UPPERCASE_WITH_UNDERSCORES. Do NOT create a
  lowercase `agent_notes.md` here — it would duplicate this file.

## Architecture
- Entry: `src/main.tsx` → `App.tsx` (top-level state, OBJ/GLB upload, mode switching).
- 3D scene: `src/Viewer3D.tsx` — R3F Canvas, decal raycasting (mesh-local space), `DitheringPass` postprocessing.
- Flat-lay editing: `src/FlatLayEditor.tsx` — orthographic preview + image editor (`ImageEditor.tsx`).
- State: `src/store.ts` (zustand).
- Custom dither: `src/DitheringEffect.ts` (extends `Effect` from `postprocessing`) + `src/DitheringShader.ts` + `DitheringPass` wrapper in `Viewer3D.tsx`.
- GLB storage: `src/githubStorage.ts` — GitHub Contents API → `public/models/<file>`, static URL; IndexedDB fallback.

## Critical Invariants (DO NOT BREAK)
1. GLB 200MB cap — `App.tsx` `handleObjUpload`. Size check BEFORE fake-progress/IDB write. `200 * 1024 * 1024` GLB/GLTF, 50MB OBJ.
2. Decal raycast is MESH-LOCAL — `Viewer3D.tsx` converts `hit.point`/`hit.face.normal` world→mesh-local. Applied at all 4 raycast sites.
3. `postprocessing` is a DIRECT dependency (not transitive) — `DitheringEffect.ts` imports it; pnpm strict layout fails the build otherwise.

## Pitfalls (verified)
- "Syntax-clean" ≠ builds. A sub-agent reported files syntax-clean but never ran the real build; the build caught `postprocessing` resolution failure. Always run `pnpm build` OR `vercel build` as the gate.
- `DitheringPass` lifecycle: construct `DitheringEffect` once (useMemo), update via setters, `dispose()` on unmount.
- `<OrthographicCamera makeDefault manual>` required (lowercase `<orthographicCamera>` is NOT the render camera).
- Null-deref: guard `e.intersections[0].object` on empty intersections; use `hit.face.normal` via `getWorldNormal`.

## Fixes already merged to main
- GLB 200MB upload cap (`App.tsx` `handleObjUpload`)
- GLB upload fixed: Draco/meshopt decoder wired, visible errors, GitHub default storage (`githubStorage.ts`), garments persist across sessions + drag-drop `.glb` upload (commits e04e10b, d5d2b5a, fcd6229)
- Decal raycast world→local (`getWorldNormal` / `worldPointToMeshLocal` / `worldQuatToMeshLocalEuler`, all 4 raycast sites)
- `DitheringEffect.ts` needs `postprocessing@^6.39.3` as a direct dep (pnpm strict — transitive import breaks `vercel build`)

## Cleanup state (2026-07-28, COMPLETE)
- Removed: Trash copies (`3ddd studio fixed` / `.zip`); `BACKUP_3DDD_SQUAD_20260727`; stray clone `~/20_projects/3DDD studio`; `~/Downloads/3ddd_studio_fixed`; orca worktrees (`3ddd-fix-v2/v3`, `verify-3ddd-glb-fix`, `glb-github-upload`, `glb-github-upload-v2`); empty `~/orca/workspaces/20.17_3DDD_STUDIO` shell.
- Deleted redundant remote branches: `fix/glb-upload`, `sudo-prog/glb-github-upload`, `sudo-prog/glb-github-upload-v2`, `sudo-prog/verify-3ddd-glb-fix`. Merged `docs-sync-origin` → main (gitignore build artifacts + dev SKILLS bundle + KANBAN.md + dev_roadmap.md + sketchfab script).
- Single source of truth = `20.17_3DDD_STUDIO` (main). Keep tooling: `launch_3ddd_*.sh`, `~/.hermes/kanban/boards/3ddd-studio`, `~/.vscode-headless-3ddd`.
- Naming rule: folders + doc files are UPPERCASE_WITH_UNDERSCORES. Do NOT create a lowercase `agent_notes.md` here — it would duplicate this file. (NOTE: a stale lowercase `agent_notes.md` was merged in from `docs-sync-origin` on 2026-07-28 and deleted — this uppercase file is the only canonical one.)
