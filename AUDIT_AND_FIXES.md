# 3DDD Studio — Audit & Permanent Fixes

This document explains, in plain terms, why decal images were breaking on the
3D garment, why they'd disappear after unrelated edits, and what was changed
to fix each issue for good. It also covers the new multi-image-per-section
support and the cross-session save/gallery fixes.

The project had accumulated ~50 one-off `fix_*.cjs` / `patch_*.js` scripts
from previous sessions. Several of them patched symptoms rather than the
root cause, and at least one (`rewrite_decal.cjs`) silently undid an earlier,
correct fix — which is why the same bugs kept coming back. All of those
throwaway scripts have been removed; the fixes below are made directly in
`src/`, so there's nothing left to regenerate or re-break.

---

## 1. Decals were applied to *every* mesh in the garment, not just one

**File:** `src/Viewer3D.tsx` — `DecalsContainer`

**Before:**
```tsx
{decals.map((decal) => (
  meshesRef.current?.map((mesh, i) => (
    <DecalItem decal={decal} meshRef={{ current: mesh }} isFirst={i === 0} />
  ))
))}
```
This is a nested loop: for every decal, it rendered one copy **per mesh** in
the garment. A shirt built from a torso mesh + two sleeve meshes would stamp
the same image, at the same position, onto all three — which is why images
sometimes showed up in the wrong place (e.g. bleeding onto a sleeve) or
seemed to duplicate.

**Fix:** each decal now stores which mesh it was actually placed on
(`decal.meshIndex`, added to the `Decal` type in `src/store.ts`), and
`DecalsContainer` renders exactly one instance per decal, against that one
mesh:
```tsx
const meshIndex = Math.min(decal.meshIndex ?? 0, meshes.length - 1);
const mesh = meshes[meshIndex];
return <DecalItem decal={decal} meshRef={{ current: mesh }} isFirst={true} />;
```
`meshIndex` is resolved from the actual raycast hit at the moment the image
is placed (both free-placement clicks and the front/back/arm placement flow
in `Viewer3D.tsx`), so it always points at the mesh the user actually clicked.

---

## 2. Oversized decal projector depth → clipping through + mirrored image on the back

**File:** `src/Viewer3D.tsx` — `DecalItem`

**Before:** the decal's projector box depth (the z-scale passed to drei's
`<Decal>`) was hardcoded to `1.5`. A garment wall is typically only
`0.2–0.4` units thick. Drei's `<Decal>` projects the texture onto *any*
geometry inside that box with no front/back filtering — so a box that deep
punched straight through the garment and painted the image onto the inside
of the opposite wall too. Viewed from the back, that projection reads as a
mirrored copy of the front image. This is also what caused the "clipping
through" look.

**Fix:** the projector depth is now derived from the target mesh's own
bounding box instead of a fixed number:
```tsx
const decalDepth = useMemo(() => {
  const size = new THREE.Vector3();
  mesh.geometry.boundingBox!.getSize(size);
  const smallestDim = Math.min(size.x, size.y, size.z) || 0.3;
  return Math.min(0.6, Math.max(0.08, smallestDim * 0.6));
}, [mesh]);
```
This keeps the projector box inside a single wall of whatever garment is
loaded (placeholder box, t-shirt GLB, custom upload) instead of a value that
only happened to sort-of work for one specific mesh size.

**Note on history:** an earlier session had already solved this correctly
with a custom decal geometry that manually culled back-facing triangles
(`fix_decal_cull*.cjs`, `triNormal.dot(...)`). A later session
(`rewrite_decal.cjs`) regenerated `DecalItem` from scratch using plain drei
`<Decal>` and deleted that fix without anyone noticing — which is why the
bug seemed to "come back" after previously being fixed. The new fix above is
simpler (no custom geometry to maintain) and doesn't depend on remembering
that a specific script exists.

---

## 3. Mesh references were being rebuilt on every unrelated render

**File:** `src/Viewer3D.tsx` — `GarmentPlaceholder`

The hoodie/bomber placeholder groups used an inline ref callback that
unconditionally re-collected all meshes on *every* render of the component —
and `GarmentPlaceholder` subscribes to the whole store, so it re-renders on
basically any UI interaction (moving a slider, dragging a decal, opening a
panel). This didn't destroy the garment outright, but it was needless churn
that made mesh identity less predictable and made the decal/back-bleed bug
harder to reproduce consistently ("sometimes it works, sometimes it
doesn't").

**Fix:** mesh collection for all three placeholder garments (tshirt/hoodie/
bomber) is now guarded so it only runs once, the same way the tshirt group
already did it, plus a scheduling guard to stop duplicate `setTimeout`s from
stacking up during fast re-renders.

---

## 4. Multiple images per section (front / back / left arm / right arm)

**Files:** `src/store.ts`, `src/App.tsx`

**Before:** the placement grid used `decals.find(d => d.placement === placement)`
— `.find()` only ever returns one match, so uploading a second image to a
section silently replaced the first one instead of adding to it.

**Fix:**
- `decals.filter(...)` is used instead of `.find()`, so each section can
  hold any number of images.
- Each section now shows a small thumbnail grid with individual remove
  buttons, plus a persistent **+** tile to add another image to that
  section without disturbing the existing ones.
- Clicking an existing thumbnail opens it in the image editor to replace
  just that one image; the **+** tile always adds a new one.

---

## 5. Edits made right before closing/backgrounding the app could be lost

**File:** `src/store.ts` — `idbStorage`

The IndexedDB writer debounces saves by 500ms (so it isn't writing on every
single pixel of a drag). The problem: if the tab was closed, or the PWA was
backgrounded, within that 500ms window, the debounced write never fired and
the most recent change was silently lost — the exact kind of thing that
looks like "my garment/image gallery didn't save."

**Fix:** the store now listens for `visibilitychange` (going to `hidden`)
and `pagehide`, and immediately flushes any pending write when either fires,
instead of waiting out the debounce timer. `visibilitychange` is the
reliable signal here — `beforeunload`/`unload` don't fire consistently on
mobile, which matters since this is a PWA.

---

## 6. Garment/image versioning and gallery — clarified, not rebuilt

The underlying data model for this was already in place and working:
- Every field edit (color, material, decals, custom model) auto-syncs into
  the currently active library entry as you work.
- `uploadedImages` (the image gallery) already persisted correctly, since
  uploads go through `FileReader.readAsDataURL` (a `data:` URL), not
  `URL.createObjectURL` (a `blob:` URL) — `blob:` URLs are stripped on
  persistence because they don't survive a reload, and that's correct
  behavior for them.
- Custom uploaded `.glb`/`.obj` files are stored as raw files in IndexedDB
  (`idb-keyval`) and reattached via `fileId` on reload, since the model file
  itself is too large/binary to put through the JSON store.

What was missing was clarity, not a working save path — the button was
labeled `SAVE_DRAFT` with no explanation of what it actually did. It's been
relabeled `SAVE_AS_NEW_VERSION` with a one-line explanation, and each saved
version in the library sidebar now shows how many images it contains, so the
library reads as an actual version gallery rather than a flat, unlabeled
list.

---

## 7. Debug leftovers removed

- The `<Html>` overlay printing `Meshes: X | Ready: Y` over the garment
  (leftover debugging output) has been removed from `Viewer3D.tsx`.
- All one-off `fix_*.cjs`, `patch_*.js`, `test_*.cjs/js`, `update_*.cjs`,
  `revert_*.cjs`, `rewrite_*.cjs`, and `portal.cjs` scripts have been deleted
  from the project root. They were single-use regex patches against specific
  strings in `src/`; keeping them around served no purpose and made it easy
  to accidentally re-apply a stale patch.

---

## Summary of files changed

| File | Change |
|---|---|
| `src/store.ts` | Added `meshIndex` to `Decal`; `addDecal`/`addDecalWithPlacement` accept and store it; flush pending IndexedDB writes on `visibilitychange`/`pagehide`. |
| `src/Viewer3D.tsx` | `DecalsContainer` renders one decal → one mesh (no more cross-product loop); adaptive decal projector depth; raycast hit resolves `meshIndex`; guarded mesh collection for all placeholder garments; removed debug overlay. |
| `src/App.tsx` | Placement sections support multiple images (`.filter` instead of `.find`, thumbnail grid + add tile); relabeled save button; library items show image count. |

All changes were verified with `tsc --noEmit` and a full `vite build` —
both pass cleanly.

---

## Round 2 — Vercel deploy, drag-and-drop, touch sizing, multi-part color

### 8. Vercel deployment

- Added `vercel.json`: build command, output directory (`dist`), SPA
  rewrite (so any path falls back to `index.html`), and long-lived cache
  headers for the `.glb` garment files.
- Removed unused dependencies (`@google/genai`, `express`, `dotenv`,
  `@types/express`) — none of them were actually imported anywhere in
  `src/`; they were leftover from the AI Studio project scaffold and had no
  reason to ship. This is a pure static client app: no API keys, no server,
  no env vars needed.
- Replaced the stale AI-Studio boilerplate `README.md` with accurate local
  run + Vercel deploy instructions.
- Verified with a clean `npm install` + `tsc --noEmit` + `vite build`.

### 9. Drag-and-drop an image onto the garment (locked mode only)

**File:** `src/App.tsx`

Drag-and-drop of an image file from outside the browser (Finder/Photos/etc.)
onto the 3D view already existed, but fired regardless of lock state — so
dropping an image while free-rotating the camera would still try to place a
decal, which is confusing since you can't see or adjust it without locking
first.

**Fix:** the drop is now gated on `isGarmentLocked`. While dragging a file
over the canvas, an overlay tells you either "drop to place image on
garment" (when locked) or to lock the garment first (when unlocked), so the
required state is obvious instead of the drop silently doing nothing.

### 10. Adjusting placement & sizing with touch

**File:** `src/Viewer3D.tsx`

This was already implemented and is confirmed working:
- Single-finger drag repositions the active decal (re-projected onto the
  garment surface as you move, via Pointer Events — which already unify
  mouse/touch/pen, no separate touch code path needed).
- Two-finger pinch resizes the active decal (`useGesture`'s `onPinch`),
  mouse wheel does the same on desktop.
- `touch-action: none` is applied to the canvas while the garment is locked
  so the browser doesn't intercept the gesture for native scroll/zoom.

Locked vs. unlocked now works exactly as: **locked** = editing mode (camera
fixed, drag/pinch/drop the image around), **unlocked** = "locks in" the
current placement and hands control back to `OrbitControls` for free
rotation.

### 11. Garment color only affected one material per mesh

**File:** `src/Viewer3D.tsx` — `CustomGLTFModel`, `CustomOBJModel`

**Before:**
```ts
mat = Array.isArray(mat) ? mat[0].clone() : mat.clone();
```
A mesh can carry an *array* of materials — one per geometry group. This is
a common way to model a garment where the body, cuffs, collar, and zipper
are all one mesh but different colorable regions. The old code only ever
cloned and tracked `material[0]` and threw the rest of the array away, so:
- Only the first region's material was ever extracted into the per-material
  color panel — the others didn't even show up as controls.
- Any other regions kept rendering with the original uploaded material,
  untouched, no matter what was changed in the UI.

**Fix:** every material in the array is now cloned and tracked individually
by name, and the mesh's material array is rebuilt from the clones (or a
single clone, for meshes that only ever had one material). Each region of
the uploaded model now shows up as its own entry in the material list with
its own color/roughness/metalness controls, and actually applies when
changed.

---

## Summary of files changed (Round 2)

| File | Change |
|---|---|
| `vercel.json` (new) | Vercel build/output/rewrite/cache config. |
| `package.json` | Removed unused deps (`@google/genai`, `express`, `dotenv`, `@types/express`) and the now-irrelevant `clean` script. |
| `README.md` | Replaced stale AI Studio boilerplate with accurate run/deploy docs. |
| `src/App.tsx` | Drop-to-place gated on locked mode; drag-over hint overlay. |
| `src/Viewer3D.tsx` | Multi-material meshes now extract/clone/recolor every material slot, not just the first. |

---

## Round 3 — real regressions found from live testing on iPad

### 12. The main "Upload Image" button never actually placed the decal on a custom model

**File:** `src/App.tsx`

This was the actual reason images "loaded but never showed on the garment."
The plain Upload Image button (not the flat-lay grid, not drag-and-drop) had
no click position and no section to raycast from, so it fell back to
`addDecal(url)` with **no arguments** — which defaults to mesh index `0` and
a fixed position `(0, 0, 0.15)`. That fixed point only means anything for
the built-in placeholder shape. For a custom uploaded `.glb`, mesh `0` is
whatever happened to be first in the file (a cuff, a tag, anything) and that
fixed point usually doesn't even touch its surface — so the decal geometry
came out with zero triangles in it. Nothing renders, and nothing errors,
because technically nothing is wrong from the code's point of view - it's
just projecting onto empty space.

**Fix:** that button now fires the same real raycast (from the center of
the screen, into whatever mesh is actually there) that drag-and-drop already
used correctly, instead of guessing blind. The raycast-miss fallback paths
elsewhere were also hardened to target the real uploaded mesh's own bounding
box instead of the placeholder's fixed dimensions.

### 13. Images rendering "behind the fabric" or "inside" the garment

**Files:** `src/store.ts`, `src/Viewer3D.tsx`

Two compounding issues:
- The projector depth was estimated from the *whole mesh's* bounding box,
  which is a poor proxy for wall thickness at one specific point on an
  irregular custom model - it could be way off depending on where the decal
  landed.
- The polygon offset used to make the decal win the depth test against the
  fabric underneath it (`polygonOffsetFactor/Units: -1`) was too weak,
  especially on mobile GPUs with lower depth-buffer precision - which is
  exactly the iPad Safari environment this was tested in. When the decal
  loses that depth tie against the coplanar fabric, it renders behind it or
  flickers in and out.

**Fix:**
- Each decal now stores a `depth` measured with a real probe ray fired
  locally at the exact placement point (into the mesh, back out the far
  side), instead of a number derived from the whole mesh's bounding box.
- The placement point is nudged a hair off the surface along its normal
  before being stored, so it isn't sitting exactly on the fabric at
  floating-point precision.
- Polygon offset was strengthened (`-1` → `-4`) so the decal reliably wins
  the depth test.

### 14. Custom garments not saving across sessions — actual race condition found

**File:** `src/App.tsx`

The zustand store rehydrates from IndexedDB *asynchronously*
(`createJSONStorage(() => idbStorage)`), but the code that reattaches an
uploaded model's file (`hydrateModels`, matching a stored `fileId` back to a
usable blob URL) ran unconditionally on mount with no guarantee that
rehydration had actually finished first. If the IndexedDB read hadn't
resolved yet, `customModel.fileId` wasn't in the store yet, so nothing got
reattached and the app silently fell back to the default garment - a race
that depends on device speed, which is exactly why it looked flaky and
worse on iPad than desktop.

**Fix:** `hydrateModels()` now explicitly waits for
`useStore.persist.hasHydrated()` (or `onFinishHydration`) before doing
anything, and a brief `LOADING_SESSION...` gate is shown so the 3D view
doesn't flash the wrong garment before the real one is reattached.

### 15. Flat-lay section rebuilt: real garment preview, drag-and-drop, and 3D sync

**New file:** `src/FlatLayEditor.tsx`

Clicking a section (front / back / left arm / right arm) now opens a modal
showing the **actual uploaded garment**, locked to a straight-on orthographic
camera for that section - not a generic stock photo, which wouldn't match
whatever model was actually uploaded. Inside it:
- Drag and drop an image (or tap to choose one) directly onto the preview.
- Drag the image box to reposition it, drag its corner handle to resize it -
  both work with touch.
- **Save & Update Garment** raycasts from that same orthographic camera
  through the center of the box against the real mesh to find the exact 3D
  point and mesh, measures real wall thickness there the same way normal
  placement does, converts the box's on-screen size into world-space scale
  using the camera's known frustum, and writes the decal straight onto the
  3D model - closing the loop between what you saw in the flat view and what
  ends up on the garment.

This replaced the old placement grid's blind file input, and reuses the
same `GarmentMeshes` rendering used by the main 3D view (extracted out of
`GarmentPlaceholder` into its own exported component) so the flat preview is
never out of sync with what the real model looks like.

---

## Summary of files changed (Round 3)

| File | Change |
|---|---|
| `src/App.tsx` | Upload Image button now raycasts from screen center instead of guessing a fixed position; hydration race fixed with an explicit wait + loading gate; flat-lay grid now opens the new editor. |
| `src/store.ts` | `Decal.depth` field for accurately-measured projector depth; `addDecal` threads it through. |
| `src/Viewer3D.tsx` | Real wall-thickness probe + surface-normal nudge on every placement path; stronger polygon offset; extracted reusable `GarmentMeshes` component. |
| `src/FlatLayEditor.tsx` (new) | Orthographic locked-camera flat view per section with drag/resize placement, synced back to the real 3D mesh. |

---

## Round 4 — flat-lay flow refined to match the actual intended workflow

**File:** `src/FlatLayEditor.tsx`

The first version of the flat-lay editor treated a dropped/chosen image as
immediately placeable. The actual intended flow is: pick an image from
photos/gallery/album (or drag one in) → it opens in the same image editor
used everywhere else in the app → make edits → **Apply** → *then* it becomes
a movable, pinchable, rotatable object on the flat garment view.

Changes:
- Picking or dropping an image now opens the existing `ImageEditor`
  (crop/cutout/color adjustments) first. Its "save" output is what becomes
  placeable on the flat view - nothing goes directly onto the garment
  unedited.
- Added real two-finger touch gestures on the placement box: pinch to
  resize, twist to rotate - tracked by pointer ID so a one-finger drag
  (move) and a two-finger gesture (pinch/rotate) are told apart correctly.
  A corner handle remains for mouse-only resizing on desktop.
- The rotation from the twist gesture is folded into the final 3D
  orientation on save (rolled around the decal's own projection axis before
  being aligned to the surface normal), so a rotated flat-lay placement
  comes out rotated on the mesh too, not flattened back to 0°.
- Added a **preview zoom** control (+/-, 50%–300%) in the corner of the flat
  view, independent of the image box's own size - it adjusts the
  orthographic camera's frustum so you can zoom into the garment itself
  while placing an image, without that affecting the image's scale.

---

## Verification & Deployment

- **TypeScript:** `tsc --noEmit` passes with zero errors.
- **Build:** `npm run build` succeeds (Vite production build, 2281 modules).
- **Lint/check:** Only standard chunk-size warning from Three.js bundle; no functional issues.
- **GitHub:** Pushed to `sudo-prog/3ddd-studio` (`main` branch). Remote history
  was replaced with the fully audited/fixed codebase from this session.

No fix scripts, debug overlays, or stale patch files remain in `src/`.
