# 20.17_3DDD_STUDIO — Dev Roadmap

> Last updated: 2026-07-27
> Status: MERGED + AUDITED + DEPLOYED ✅ (GitHub main `1356eca`, live https://3ddd-studio.vercel.app HTTP 200). Open .glb upload fix PARKED (Orca deferred) — GitHub-as-default-storage + Draco decoder not yet implemented in code.

## The Divergence Problem (2026-07-23 → 2026-07-25)

Two divergent versions of 3DDD Studio existed:

1. **AI-Studio export** (`~/20_projects/3DDD studio`, force-pushed to GitHub `main` as `d361c0c`) — added `FlatLayEditor.tsx`, revamped `Viewer3D.tsx`, changed `App.tsx`/`store.ts`. **LOST two critical 20.17 fixes.**
2. **Original `20.17_3DDD_STUDIO`** (branch `dmitri`, `7af4d13`) — had the two critical fixes but NOT the AI-Studio features.

## Resolution (2026-07-25)

Merged the **best of both** into GitHub `main` via Orca worktree `3ddd-squad` (`sudo-prog/3ddd-squad` branch → force-pushed to `main` as `1356eca`):

- Kept all AI-Studio additions: `FlatLayEditor.tsx`, revamped `Viewer3D.tsx`, `App.tsx`/`store.ts` changes.
- **Restored GLB 200MB upload cap** in `App.tsx` `handleObjUpload`.
- **Restored decal raycast world→local conversion** in `Viewer3D.tsx`.

## Build / Deploy Verification (2026-07-25 + 2026-07-27)

- `pnpm build` → ✅ (2026-07-25)
- `vercel build` → ✅ `Build Completed in .vercel/output` (2026-07-25)
- **2026-07-27 re-verify:** `vercel build --yes` → ✅ 2280 modules transformed, dist/ 1.45MB (407KB gzip). Only the known >500KB chunk-size warning (pre-existing, non-blocking).

## The .glb Upload Problem (2026-07-27 — OPEN)

**Symptom:** user reports `.glb` files do not upload from their end.

**Root cause (verified):** The upload *transport* works (file input → IndexedDB → blob URL, `App.tsx` `handleObjUpload`, accept includes `.glb`). The failure is:
1. `src/Viewer3D.tsx` wraps the loaded model in `<ErrorBoundary fallback={<InvalidModelFallback/>}>` and `InvalidModelFallback` calls `setCustomModel(null)`. If `useGLTF`/GLTFLoader **throws** (Draco-compressed GLBs are the common case; the app wires **NO Draco decoder**), the model is **silently discarded** and the default t-shirt returns → looks exactly like "upload failed."
2. There is **no server-side persistence** — uploads live only in browser IndexedDB and vanish on reload.

**Required fix (NOT yet implemented — parked with Orca):**
- A) Add Draco + meshopt decoder in `Viewer3D.tsx` (DRACOLoader + MeshoptDecoder) so real-world GLBs load.
- B) Make upload errors VISIBLE (replace silent `setCustomModel(null)` with an on-screen error state).
- C) **GitHub as DEFAULT upload storage:** `src/githubStorage.ts` using the Contents API (`PUT /repos/sudo-prog/3ddd-studio/contents/public/models/<filename>`, base64) → raw URL served statically (Vercel has no static size limit). IndexedDB remains offline fallback. Token via `import.meta.env.VITE_GITHUB_TOKEN` (from Bitwarden, never hardcoded).
- D) Update `UPLOAD_CUSTOM_MODEL` label to indicate files save to the repo.

**Branch parked:** `sudo-prog/glb-github-upload-v2` (Orca worktree at `/home/thinkpad/orca/workspaces/20.17_3DDD_STUDIO/glb-github-upload-v2`). Resume with Orca later.

## Repo Topology Note (IMPORTANT)

The local `20.17_3DDD_STUDIO` repo has **divergent history** from `origin/main` (two different root commits; `dev_roadmap.md` notes the local lineage was intentionally left unrelated). **`origin/main` (1356eca) is canonical.** Do NOT force-push local `main` over origin. Doc/skills sync was delivered via branch `docs-sync-origin` (pushed 2026-07-27) on top of origin/main.

## Next

- Implement the .glb fix (A–D above) via Orca sub-agent, then PR into `origin/main`.
- Code-split the 1.45MB bundle (manualChunks / dynamic import) to silence the >500KB warning.
- Add a real test harness (Vitest + Playwright) for the decal + GLB-cap + upload-storage paths.
