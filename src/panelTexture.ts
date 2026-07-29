import * as THREE from 'three';
import { GARMENT_PANELS, PanelDef } from './garmentPanels';
import { Decal, PanelId } from './store';

export type PanelKey = `${string}:${PanelId}`;

const canvases = new Map<PanelKey, HTMLCanvasElement>();
const textures = new Map<PanelKey, THREE.CanvasTexture>();
const imageCache = new Map<string, HTMLImageElement>();

function loadImage(url: string): Promise<HTMLImageElement> {
  const cached = imageCache.get(url);
  if (cached) return Promise.resolve(cached);

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imageCache.set(url, img);
      resolve(img);
    };
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    img.src = url;
  });
}

export function getPanelTexture(libraryItemId: string, panel: PanelId, def: PanelDef): THREE.CanvasTexture {
  const key: PanelKey = `${libraryItemId}:${panel}`;
  const existing = textures.get(key);
  if (existing) return existing;

  const canvas = document.createElement('canvas');
  canvas.width = def.textureSize;
  canvas.height = def.textureSize;

  const tex = new THREE.CanvasTexture(canvas);
  tex.flipY = false;
  tex.colorSpace = THREE.SRGBColorSpace;

  canvases.set(key, canvas);
  textures.set(key, tex);

  return tex;
}

export async function repaintPanel(libraryItemId: string, panel: PanelId, baseColorHex: string, decals: Decal[]): Promise<void> {
  const key: PanelKey = `${libraryItemId}:${panel}`;
  const canvas = canvases.get(key);
  const tex = textures.get(key);
  if (!canvas || !tex) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Clear and fill base color
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = baseColorHex;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Filter decals for this panel, sorted by zIndex
  const panelDecals = decals
    .filter(d => d.panel === panel)
    .sort((a, b) => a.zIndex - b.zIndex);

  for (const decal of panelDecals) {
    try {
      const img = await loadImage(decal.url);
      ctx.save();
      ctx.translate(decal.x, decal.y);
      ctx.rotate(decal.rotation);
      ctx.drawImage(img, -img.width / 2, -img.height / 2, img.width, img.height);
      ctx.restore();
    } catch {
      // Skip broken images silently
    }
  }

  tex.needsUpdate = true;
}

export function disposePanelTexture(libraryItemId: string, panel: PanelId): void {
  const key: PanelKey = `${libraryItemId}:${panel}`;
  const tex = textures.get(key);
  if (tex) {
    tex.dispose();
    textures.delete(key);
  }
  canvases.delete(key);
}
