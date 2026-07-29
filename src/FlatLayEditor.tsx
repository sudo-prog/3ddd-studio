import React, { useState, useCallback, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { X, Upload } from 'lucide-react';
import { useStore } from './store';
import { GarmentMeshes } from './Viewer3D';
import { ImageEditor } from './ImageEditor';
import { repaintPanel } from './panelTexture';

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;

const angleBetween = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.atan2(b.y - a.y, b.x - a.x) * (180 / Math.PI);
const distBetween = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(b.x - a.x, b.y - a.y);

export const FlatLayEditor = ({ placement, onClose }: { placement: Placement; onClose: () => void }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const [rawImageForEdit, setRawImageForEdit] = useState<string | null>(null);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [box, setBox] = useState<Box>({ x: 0.35, y: 0.35, w: 0.3, h: 0.3, rotation: 0 });

  // Tracks every active pointer on the box (by pointerId) so we can tell a
  // one-finger drag (move) apart from a two-finger touch (pinch to
  // resize + twist to rotate, like every native photo app).
  const activePointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const gesture = useRef<{
    mode: 'move' | 'pinch' | null;
    startBox: Box;
    startDist: number;
    startAngle: number;
    startCenter: { x: number; y: number };
    startPointer: { x: number; y: number };
  }>({ mode: null, startBox: box, startDist: 0, startAngle: 0, startCenter: { x: 0, y: 0 }, startPointer: { x: 0, y: 0 } });

  const handleMeshesReady = useCallback((m: THREE.Mesh[]) => { }, []);

  const loadFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    // Route every image - whether it came from the camera roll, an album,
    // or a drag-and-drop - through the same image editor used everywhere
    // else in the app before it becomes placeable, so edits (crop, cutout,
    // color adjustments, etc.) apply first and "Apply" is what drops it
    // onto the flat garment.
    reader.onload = (e) => setRawImageForEdit(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOverDrop(false);
    const file = e.dataTransfer.files?.[0];
    if (file) loadFile(file);
  };

  const recomputeGestureMode = () => {
    const pts = Array.from(activePointers.current.values());
    if (pts.length >= 2) {
      gesture.current = {
        mode: 'pinch',
        startBox: box,
        startDist: distBetween(pts[0], pts[1]),
        startAngle: angleBetween(pts[0], pts[1]),
        startCenter: { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 },
        startPointer: pts[0],
      };
    } else if (pts.length === 1) {
      gesture.current = {
        mode: 'move',
        startBox: box,
        startDist: 0,
        startAngle: 0,
        startCenter: { x: 0, y: 0 },
        startPointer: pts[0],
      };
    } else {
      gesture.current.mode = null;
    }
  };

  const onBoxPointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    recomputeGestureMode();
  };

  const onGlobalPointerMove = (e: PointerEvent) => {
    if (!activePointers.current.has(e.pointerId)) return;
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const container = containerRef.current;
    const g = gesture.current;
    if (!container || !g.mode) return;
    const rect = container.getBoundingClientRect();

    if (g.mode === 'move') {
      const pt = activePointers.current.get(e.pointerId)!;
      const dx = (pt.x - g.startPointer.x) / rect.width;
      const dy = (pt.y - g.startPointer.y) / rect.height;
      setBox({
        ...g.startBox,
        x: Math.min(1 - g.startBox.w, Math.max(0, g.startBox.x + dx)),
        y: Math.min(1 - g.startBox.h, Math.max(0, g.startBox.y + dy)),
      });
    } else if (g.mode === 'pinch') {
      const pts = Array.from(activePointers.current.values());
      if (pts.length < 2) return;
      const dist = distBetween(pts[0], pts[1]);
      const angle = angleBetween(pts[0], pts[1]);
      const scaleRatio = dist / (g.startDist || 1);
      const deltaAngle = angle - g.startAngle;

      const newW = Math.min(0.95, Math.max(0.06, g.startBox.w * scaleRatio));
      const newH = Math.min(0.95, Math.max(0.06, g.startBox.h * scaleRatio));
      // Keep the box's own center fixed while scaling/rotating, like
      // pinch-zooming a photo in place.
      const cx = g.startBox.x + g.startBox.w / 2;
      const cy = g.startBox.y + g.startBox.h / 2;
      setBox({
        x: Math.min(1 - newW, Math.max(0, cx - newW / 2)),
        y: Math.min(1 - newH, Math.max(0, cy - newH / 2)),
        w: newW,
        h: newH,
        rotation: g.startBox.rotation + deltaAngle,
      });
    }
  };

  const onGlobalPointerUp = (e: PointerEvent) => {
    activePointers.current.delete(e.pointerId);
    recomputeGestureMode();
  };

  useEffect(() => {
    window.addEventListener('pointermove', onGlobalPointerMove);
    window.addEventListener('pointerup', onGlobalPointerUp);
    window.addEventListener('pointercancel', onGlobalPointerUp);
    return () => {
      window.removeEventListener('pointermove', onGlobalPointerMove);
      window.removeEventListener('pointerup', onGlobalPointerUp);
      window.removeEventListener('pointercancel', onGlobalPointerUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [box]);

  // Desktop-only manual resize handle (mouse drag), separate from the
  // touch pinch gesture above.
  const mouseResizeState = useRef<{ startX: number; startY: number; startBox: Box } | null>(null);
  const onResizeHandlePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    mouseResizeState.current = { startX: e.clientX, startY: e.clientY, startBox: box };
    const onMove = (ev: PointerEvent) => {
      const container = containerRef.current;
      const st = mouseResizeState.current;
      if (!container || !st) return;
      const rect = container.getBoundingClientRect();
      const dx = (ev.clientX - st.startX) / rect.width;
      const dy = (ev.clientY - st.startY) / rect.height;
      setBox({
        ...st.startBox,
        w: Math.min(1 - st.startBox.x, Math.max(0.05, st.startBox.w + dx)),
        h: Math.min(1 - st.startBox.y, Math.max(0.05, st.startBox.h + dy)),
      });
    };
    const onUp = () => {
      mouseResizeState.current = null;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const handleSave = () => {
    if (!pendingImage) { onClose(); return; }
    useStore.getState().addDecal(placement, pendingImage, {
      x: box.x, y: box.y, w: box.w, h: box.h, rotation: box.rotation,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/70 flex items-center justify-center p-4">
      <div className="bg-white border-2 border-black w-full max-w-xl flex flex-col">
        <div className="flex items-center justify-between border-b border-black p-3">
          <span className="text-[11px] font-bold uppercase">{placement.replace('_', ' ')} — FLAT VIEW</span>
          <button onClick={onClose} className="p-1 hover:bg-black hover:text-white"><X size={16} /></button>
        </div>

        <div
          ref={containerRef}
          className="relative w-full aspect-square bg-[#eaeaea] touch-none select-none overflow-hidden"
          onDragOver={(e) => { e.preventDefault(); setIsDraggingOverDrop(true); }}
          onDragLeave={() => setIsDraggingOverDrop(false)}
          onDrop={handleDrop}
        >
          <Canvas orthographic dpr={[1, 2]} gl={{ preserveDrawingBuffer: true }}>
            <SceneBridge onMeshesReady={handleMeshesReady} />
          </Canvas>

          {pendingImage ? (
            <div
              className="absolute border-2 border-black bg-black/5 cursor-move touch-none"
              style={{
                left: `${box.x * 100}%`,
                top: `${box.y * 100}%`,
                width: `${box.w * 100}%`,
                height: `${box.h * 100}%`,
                transform: `rotate(${box.rotation}deg)`,
              }}
              onPointerDown={onBoxPointerDown}
            >
              <img src={pendingImage} alt="placement" className="w-full h-full object-contain pointer-events-none" draggable={false} />
              <div
                className="absolute -right-2 -bottom-2 w-6 h-6 bg-black cursor-nwse-resize touch-none flex items-center justify-center"
                onPointerDown={onResizeHandlePointerDown}
              >
                <RotateCw size={11} className="text-white pointer-events-none" />
              </div>
              <button
                className="absolute -top-2 -right-2 bg-white border border-black rounded-full p-0.5 hover:bg-red-500 hover:text-white"
                onClick={(e) => { e.stopPropagation(); setPendingImage(null); setBox({ x: 0.35, y: 0.35, w: 0.3, h: 0.3, rotation: 0 }); }}
              >
                <X size={10} />
              </button>
            </div>
          ) : (
            <label
              className={`absolute inset-0 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors ${isDraggingOverDrop ? 'bg-black/10' : ''}`}
            >
              <Upload size={20} />
              <span className="text-[10px] font-bold uppercase text-center px-6">
                Choose from photos, or drag & drop an image here
              </span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) loadFile(f); if (e.target) e.target.value = ''; }}
              />
            </label>
          )}

          {/* Preview zoom - adjusts how close the garment view itself is, independent of the image box */}
          <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-white/90 border border-black px-1.5 py-1">
            <button
              className="p-1 hover:bg-black hover:text-white disabled:opacity-30"
              disabled={previewZoom <= MIN_ZOOM}
              onClick={() => setPreviewZoom(z => Math.max(MIN_ZOOM, +(z - 0.25).toFixed(2)))}
            >
              <ZoomOut size={13} />
            </button>
            <span className="text-[9px] font-bold w-8 text-center">{Math.round(previewZoom * 100)}%</span>
            <button
              className="p-1 hover:bg-black hover:text-white disabled:opacity-30"
              disabled={previewZoom >= MAX_ZOOM}
              onClick={() => setPreviewZoom(z => Math.min(MAX_ZOOM, +(z + 0.25).toFixed(2)))}
            >
              <ZoomIn size={13} />
            </button>
          </div>
        </div>

        {pendingImage && (
          <div className="px-3 pt-2 text-[9px] opacity-50 italic">
            Drag to move · pinch with two fingers to resize · twist with two fingers to rotate
          </div>
        )}

        <div className="flex items-center gap-2 p-3 border-t border-black">
          <button onClick={onClose} className="flex-1 p-2.5 text-center border border-black text-[11px] uppercase hover:bg-[#f0f0f0]">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!pendingImage}
            className="flex-1 p-2.5 text-center border border-black text-[11px] uppercase bg-black text-white hover:opacity-80 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Save & Update Garment
          </button>
        </div>
      </div>

      {rawImageForEdit && (
        <div className="fixed inset-0 z-[110]">
          <ImageEditor
            src={rawImageForEdit}
            onSave={(dataUrl) => { setPendingImage(dataUrl); setRawImageForEdit(null); }}
            onCancel={() => setRawImageForEdit(null)}
          />
        </div>
      )}
    </div>
  );
};
