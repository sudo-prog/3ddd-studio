# TACTICAL KANBAN — 20.17_3DDD_STUDIO

## Active
- [ ] FIX + STORAGE: Fix .glb upload (Draco decoder + visible upload errors) and make GitHub the DEFAULT upload storage backend (public/models/ via Contents API, IndexedDB fallback). Branch parked: sudo-prog/glb-github-upload-v2 (Orca worktree) — resume with Orca later.
- [ ] BUILD GATE: `pnpm install && pnpm build` / `vercel build` GREEN (verified 2026-07-27 on current main — 2280 modules, no errors).
- [ ] PUSH: branch `docs-sync-origin` pushed; main deploy via Vercel auto-deploy.
- [ ] DOCS: dev_roadmap.md, agent_notes.md, projects_master.md (root), OPS_LOG.md updated.

## Done
- [x] Gemini web2api confirmed up (:8081/8082/8083 + LB :8090)
- [x] ACP kanban board confirmed running (hermes acp pid 246233)
- [x] VS Code headless sub-agent spun up (background, session proc_dcebc6db884c)
- [x] Dev skills restored: SKILLS/ (4x 3D codrops, 6x UI/quality) into real repo
- [x] DIAGNOSE: .glb "not uploading" — client-side silent swallow in Viewer3D.tsx ErrorBoundary; no server upload path
- [x] INVESTIGATE: vercel.com/superpowerstudio/3ddd-squad = accident, 0 deployments — DELETED
- [x] CLEANUP: 3ddd-squad worktree/branch/Vercel project removed (backup at BACKUP_3DDD_SQUAD_20260727)
- [x] Fixed opencode `bash: "ask"` -> `"allow"` so agents run autonomously
- [x] VERCEL BUILD GATE passed (vercel build -> Build Completed)
- [x] dev_roadmap.md / agent_notes.md / projects_master.md / OPS_LOG.md updated
