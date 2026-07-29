import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import { get, set, del } from 'idb-keyval';

let timeoutId: any;
let lastResolve: any;
// Tracks the most recent not-yet-written value so it can be flushed
// immediately (instead of lost) if the page is hidden/closed before the
// debounce timer fires. This was the main reason edits made right before
// switching apps or closing the tab silently failed to persist.
let pendingWrite: { name: string; value: string } | null = null;

const flushPendingWrite = async () => {
  if (!pendingWrite) return;
  const { name, value } = pendingWrite;
  pendingWrite = null;
  if (timeoutId) {
    clearTimeout(timeoutId);
    timeoutId = null;
  }
  try {
    await set(name, value);
  } catch (e) {
    console.error('IDB flush error', e);
  } finally {
    if (lastResolve) {
      lastResolve();
      lastResolve = null;
    }
  }
};

if (typeof document !== 'undefined') {
  // 'visibilitychange' -> 'hidden' is the most reliable cross-platform signal
  // (including mobile PWAs) that the app is about to be backgrounded/killed;
  // 'beforeunload'/'unload' are not reliably fired on mobile.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushPendingWrite();
  });
  window.addEventListener('pagehide', () => flushPendingWrite());
}

const idbStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    return (await get(name)) || null;
  },
  setItem: async (name: string, value: string): Promise<void> => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      if (lastResolve) {
        lastResolve();
      }
    }
    pendingWrite = { name, value };
    return new Promise((resolve, reject) => {
      lastResolve = resolve;
      timeoutId = setTimeout(async () => {
        pendingWrite = null;
        try {
          await set(name, value);
          resolve();
        } catch (e) {
          console.error('IDB Set Error', e);
          reject(e);
        } finally {
          lastResolve = null;
        }
      }, 500);
    });
  },
  removeItem: async (name: string): Promise<void> => {
    await del(name);
  },
};

export type GarmentType = 'tshirt' | 'hoodie' | 'bomber' | string;

export type PanelId = 'front' | 'back' | 'left_arm' | 'right_arm';

export type Decal = {
  id: string;
  url: string;
  panel: PanelId;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  zIndex: number;
};

export interface MaterialState {
  color: string;
  roughness: number;
  metalness: number;
}

export interface LibraryItem {
  id: string;
  name: string;
  color: string;
  roughness: number;
  metalness: number;
  materialsConfig?: Record<string, MaterialState>;
  decals: Decal[];
  customModel: { url: string, type: 'obj' | 'glb', fileId?: string } | null;
  baseGarment: GarmentType;
}

const SEED_LIBRARY_ITEMS: LibraryItem[] = [
  {
    id: 'seed-t-shirt-hoodie',
    name: 'T-SHIRT HOODIE',
    color: '#ffffff',
    roughness: 0.8,
    metalness: 0.1,
    decals: [],
    customModel: { url: '/models/t_shirt_hoodie.glb', type: 'glb' },
    baseGarment: 'tshirt',
  },
  {
    id: 'seed-classic-hoodie',
    name: 'BLACK FLAME HOODIE',
    color: '#ffffff',
    roughness: 0.8,
    metalness: 0.1,
    decals: [],
    customModel: { url: '/models/classic_black_flame_hoodie.glb', type: 'glb' },
    baseGarment: 'hoodie',
  },
];

interface AppState {
  library: LibraryItem[];
  activeId: string | null;
  
  // Active state
  garment: GarmentType;
  color: string;
  roughness: number;
  metalness: number;
  materialsConfig: Record<string, MaterialState>;
  availableMaterials: string[];
  
  decals: Decal[];
  uploadedImages: string[];
  addUploadedImage: (url: string) => void;
  removeUploadedImage: (url: string) => void;
  customModel: { url: string, type: 'obj' | 'glb', fileId?: string } | null;

  setActiveItem: (id: string) => void;
  setColor: (color: string) => void;
  setRoughness: (r: number) => void;
  setMetalness: (m: number) => void;
  
  setAvailableMaterials: (mats: string[]) => void;
  setMaterialConfig: (name: string, config: Partial<MaterialState>) => void;
  initMaterialsConfig: (defaultConfigs: Record<string, MaterialState>) => void;

  addDecal: (panel: PanelId, url: string, box: { x: number; y: number; w: number; h: number; rotation: number }) => void;
  removeDecal: (id: string) => void;
  updateDecal: (id: string, updates: Partial<Pick<Decal, 'x'|'y'|'w'|'h'|'rotation'|'zIndex'>>) => void;
  setCustomModel: (model: { url: string, type: 'obj' | 'glb', fileId?: string } | null) => void;
  createCustomModelItem: (name: string, model: { url: string, type: 'obj' | 'glb', fileId?: string }) => void;

  showGrid: boolean;
  setShowGrid: (show: boolean) => void;
  isGarmentLocked: boolean;
  setIsGarmentLocked: (locked: boolean) => void;
  activeDecalId: string | null;
  setActiveDecalId: (id: string | null) => void;
  exportTrigger: number;
  triggerExport: () => void;
  
  ditheringEnabled: boolean;
  setDitheringEnabled: (enabled: boolean) => void;
  ditheringGridSize: number;
  setDitheringGridSize: (size: number) => void;
  ditheringPixelRatio: number;
  setDitheringPixelRatio: (ratio: number) => void;
  ditheringGrayscale: boolean;
  setDitheringGrayscale: (gray: boolean) => void;

  saveDraft: () => void;
  renameLibraryItem: (id: string, newName: string) => void;
  deleteLibraryItem: (id: string) => void;
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
  library: SEED_LIBRARY_ITEMS,
  activeId: null,
  
      garment: 'tshirt',
  color: '#1a1a1a',
  roughness: 0.8,
  metalness: 0.1,
  materialsConfig: {},
  availableMaterials: [],
  decals: [],
  customModel: null,
  uploadedImages: [],
  addUploadedImage: (url) => set((state) => ({ uploadedImages: [...new Set([url, ...state.uploadedImages])] })),
  removeUploadedImage: (url) => set((state) => ({ uploadedImages: state.uploadedImages.filter(i => i !== url) })),

    setActiveItem: (id) => {
    const item = get().library.find(i => i.id === id);
    if (item) {
      set({ 
        activeId: id,
        garment: item.baseGarment,
        color: item.color,
        roughness: item.roughness || 0.8,
        metalness: item.metalness || 0.1,
        materialsConfig: item.materialsConfig || {},
        decals: [...item.decals],
        customModel: item.customModel
      });
    }
  },
  
    setAvailableMaterials: (mats) => set({ availableMaterials: mats }),
  setMaterialConfig: (name, config) => set((state) => {
    const newConfig = {
      ...state.materialsConfig,
      [name]: {
        ...(state.materialsConfig[name] || { color: '#ffffff', roughness: 0.8, metalness: 0.1 }),
        ...config
      }
    };
    return {
      materialsConfig: newConfig,
      library: state.library.map(i => i.id === state.activeId ? { ...i, materialsConfig: newConfig } : i)
    };
  }),
  initMaterialsConfig: (defaultConfigs) => set((state) => {
    const newConfig = { ...defaultConfigs, ...state.materialsConfig };
    return {
      materialsConfig: newConfig,
      library: state.library.map(i => i.id === state.activeId ? { ...i, materialsConfig: newConfig } : i)
    };
  }),
  setColor: (color) => set((state) => ({ 
     color, 
     library: state.library.map(i => i.id === state.activeId ? { ...i, color } : i) 
   })),
  setRoughness: (roughness) => set((state) => ({ 
     roughness, 
     library: state.library.map(i => i.id === state.activeId ? { ...i, roughness } : i) 
   })),
  setMetalness: (metalness) => set((state) => ({ 
     metalness, 
     library: state.library.map(i => i.id === state.activeId ? { ...i, metalness } : i) 
   })),
  
  addDecal: (panel, url, box) => set((state) => {
    const newId = uuidv4();
    const newDecal: Decal = {
      id: newId,
      url,
      panel,
      x: box.x,
      y: box.y,
      w: box.w,
      h: box.h,
      rotation: box.rotation,
      zIndex: state.decals.length,
    };
    const newDecals = [...state.decals, newDecal];
    return {
      decals: newDecals,
      activeDecalId: newId,
      library: state.library.map(i => i.id === state.activeId ? { ...i, decals: newDecals } : i)
    };
  }),
  
  removeDecal: (id) => set((state) => {
    const newDecals = state.decals.filter(d => d.id !== id);
    return {
      decals: newDecals,
      library: state.library.map(i => i.id === state.activeId ? { ...i, decals: newDecals } : i)
    };
  }),
  
  updateDecal: (id, updates) => set((state) => {
    const newDecals = state.decals.map(d => d.id === id ? { ...d, ...updates } : d);
    return {
      decals: newDecals,
      library: state.library.map(i => i.id === state.activeId ? { ...i, decals: newDecals } : i)
    };
  }),

  setCustomModel: (model) => set((state) => ({ 
    customModel: model,
    library: state.library.map(i => i.id === state.activeId ? { ...i, customModel: model } : i)
  })),

    createCustomModelItem: (name, model) => {
    const newItem: LibraryItem = {
      id: uuidv4(),
      name: name.substring(0, 15).toUpperCase(),
      color: '#ffffff',
      decals: [],
      customModel: model,
      baseGarment: 'tshirt',
      roughness: 0.8,
      metalness: 0.1,
      materialsConfig: {}
    };
    set((state) => ({
      library: [...state.library, newItem],
      activeId: newItem.id,
      color: newItem.color,
      materialsConfig: {},
      decals: newItem.decals,
      customModel: newItem.customModel,
      garment: newItem.baseGarment
    }));
  },

  showGrid: true,
  setShowGrid: (show) => set({ showGrid: show }),
  isGarmentLocked: false,
  setIsGarmentLocked: (locked) => set({ isGarmentLocked: locked }),
  activeDecalId: null,
  setActiveDecalId: (id) => set({ activeDecalId: id }),
  exportTrigger: 0,
  triggerExport: () => set((state) => ({ exportTrigger: state.exportTrigger + 1 })),
  
  ditheringEnabled: false,
  setDitheringEnabled: (enabled) => set({ ditheringEnabled: enabled }),
  ditheringGridSize: 4.0,
  setDitheringGridSize: (size) => set({ ditheringGridSize: size }),
  ditheringPixelRatio: 1.0,
  setDitheringPixelRatio: (ratio) => set({ ditheringPixelRatio: ratio }),
  ditheringGrayscale: false,
  setDitheringGrayscale: (gray) => set({ ditheringGrayscale: gray }),

    saveDraft: () => {
    const state = get();
    const newItem: LibraryItem = {
      id: uuidv4(),
      name: `DRAFT_${state.library.length + 1}`,
      color: state.color,
      roughness: state.roughness,
      metalness: state.metalness,
      materialsConfig: state.materialsConfig,
      decals: [...state.decals],
      customModel: state.customModel,
      baseGarment: state.garment
    };
    set({ 
      library: [...state.library, newItem],
      activeId: newItem.id
    });
  },

  renameLibraryItem: (id, newName) => {
    set((state) => ({
      library: state.library.map(item => item.id === id ? { ...item, name: newName } : item)
    }));
  },

  deleteLibraryItem: (id) => {
    set((state) => {
      const newLibrary = state.library.filter(item => item.id !== id);
      if (state.activeId === id && newLibrary.length > 0) {
        const first = newLibrary[0];
        return {
          library: newLibrary,
          activeId: first.id,
          garment: first.baseGarment,
          color: first.color,
          roughness: first.roughness || 0.8,
          metalness: first.metalness || 0.1,
          decals: [...first.decals],
          customModel: first.customModel
        };
      } else if (state.activeId === id && newLibrary.length === 0) {
        return { 
          library: newLibrary, 
          activeId: null, 
          decals: [], 
          customModel: null 
        };
      }
      return { library: newLibrary };
    });
  }
}),
    {
      name: '3ddd-storage',
      storage: createJSONStorage(() => idbStorage),
            partialize: (state) => ({ 
        library: state.library.map(item => ({
          ...item,
          customModel: item.customModel?.fileId ? { ...item.customModel, url: '' } : (item.customModel?.url.startsWith('blob:') ? null : item.customModel),
          decals: item.decals.filter(d => !d.url.startsWith('blob:'))
        })),
        activeId: state.activeId,
        garment: state.garment,
        color: state.color,
        roughness: state.roughness,
        metalness: state.metalness,
        materialsConfig: state.materialsConfig,
        decals: state.decals.filter(d => !d.url.startsWith('blob:')),
        customModel: state.customModel?.fileId ? { ...state.customModel, url: '' } : (state.customModel?.url.startsWith('blob:') ? null : state.customModel),
        showGrid: state.showGrid,
        ditheringEnabled: state.ditheringEnabled,
        ditheringGridSize: state.ditheringGridSize,
        ditheringPixelRatio: state.ditheringPixelRatio,
        ditheringGrayscale: state.ditheringGrayscale,
        uploadedImages: state.uploadedImages || []
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Migrate: drop any decals that still have the old 3D-space shape
          // (meshIndex or position fields). These can't be converted to UV
          // space and must be discarded per spec §2.1.
          const isOldDecal = (d: any) => 'meshIndex' in d || 'position' in d;
          state.library = state.library.map(item => ({
            ...item,
            customModel: item.customModel?.fileId ? { ...item.customModel, url: '' } : (item.customModel?.url.startsWith('blob:') ? null : item.customModel),
            decals: item.decals.filter(d => !d.url.startsWith('blob:') && !isOldDecal(d))
          }));
          state.customModel = state.customModel?.url.startsWith('blob:') ? null : state.customModel;
          state.decals = state.decals.filter(d => !d.url.startsWith('blob:') && !isOldDecal(d));
          // Always ensure the seeded user garments are present, even if the
          // persisted library (e.g. from a session where upload failed) is empty
          // or was saved before the seeds existed. Merge by id, don't duplicate.
          const seedIds = new Set(state.library.map(i => i.id));
          for (const seed of SEED_LIBRARY_ITEMS) {
            if (!seedIds.has(seed.id)) state.library.unshift(seed);
          }
        }
      }
    }
  )
);
