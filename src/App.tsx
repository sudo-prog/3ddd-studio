import React, { useState, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { set as idbSet, get as idbGet } from 'idb-keyval';
import { useProgress } from '@react-three/drei';
import { X, Check, Menu } from 'lucide-react';
import { useStore, LibraryItem as LibraryItemType } from './store';
import Viewer3D from './Viewer3D';
import { ImageEditor } from './ImageEditor';
import { FlatLayEditor } from './FlatLayEditor';

const LibraryItem = ({ item, index }: { item: LibraryItemType, index: number }) => {
  const { activeId, setActiveItem, renameLibraryItem, deleteLibraryItem } = useStore();
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(item.name);
  const isActive = activeId === item.id;

  const handleSave = () => {
    if (editName.trim()) {
      renameLibraryItem(item.id, editName.trim());
    }
    setIsEditing(false);
  };

  return (
    <div 
      className={`border-b border-black p-3 flex flex-col gap-2 transition-colors cursor-pointer ${isActive ? 'bg-[#f0f0f0]' : 'hover:bg-[#f8f8f8]'}`}
      onClick={() => setActiveItem(item.id)}
    >
      <div className="flex items-center justify-between">
        {isEditing ? (
          <div className="flex items-center gap-2">
            <input 
              autoFocus
              value={editName}
              onChange={e => setEditName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              className="text-[10px] font-bold border border-black px-1 outline-none w-24 bg-white"
              onClick={e => e.stopPropagation()}
            />
            <button onClick={(e) => { e.stopPropagation(); handleSave(); }} className="hover:text-green-600">
              <Check size={12} />
            </button>
          </div>
        ) : (
          <span 
            className="text-[10px] font-bold truncate" 
            onDoubleClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
          >
            {item.name}
          </span>
        )}
        <div className="flex items-center gap-2">
          {item.id !== '1' && item.id !== '2' && item.id !== '3' && (
            <button onClick={(e) => { e.stopPropagation(); deleteLibraryItem(item.id); }} className="opacity-50 hover:opacity-100 hover:text-red-600">
              <X size={12} />
            </button>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 text-[9px] opacity-50">
        <span>{item.baseGarment.toUpperCase()}</span>
        <span>•</span>
        <div className="w-2 h-2 border border-black" style={{ backgroundColor: item.color }} />
        {item.decals.length > 0 && (
          <>
            <span>•</span>
            <span>{item.decals.length} IMG</span>
          </>
        )}
      </div>
    </div>
  );
};

export default function App() {
  const { active, progress } = useProgress();
  const [leftSidebarCollapsed, setLeftSidebarCollapsed] = useState(false);
  const [fakeUploadProgress, setFakeUploadProgress] = useState<number | null>(null);
  const [isDraggingFileOverCanvas, setIsDraggingFileOverCanvas] = useState(false);
  const [modelsHydrated, setModelsHydrated] = useState(false);
  const [flatLayEditorPlacement, setFlatLayEditorPlacement] = useState<'front' | 'back' | 'left_arm' | 'right_arm' | null>(null);
  const dragCounter = useRef(0);
  const [editingImage, setEditingImage] = useState<{url: string, id?: string, clientX?: number, clientY?: number, placement?: string} | null>(null);
  const [parametersCollapsed, setParametersCollapsed] = useState(false);
  const [graphicsCollapsed, setGraphicsCollapsed] = useState(false);
  const [flatLayCollapsed, setFlatLayCollapsed] = useState(false);
  const [materialsCollapsed, setMaterialsCollapsed] = useState(false);
  const [effectsCollapsed, setEffectsCollapsed] = useState(false);
  const [galleryCollapsed, setGalleryCollapsed] = useState(false);

  const { 
    activeId, library, garment, materialsConfig, availableMaterials, color, setColor, roughness, setRoughness, metalness, setMetalness, 
    setMaterialConfig, addDecal, addDecalWithPlacement, decals, removeDecal, customModel, 
    setCustomModel, saveDraft, activeDecalId, setActiveDecalId, uploadedImages, addUploadedImage, removeUploadedImage, 
    updateDecal, ditheringEnabled, setDitheringEnabled, 
    ditheringGridSize, setDitheringGridSize, ditheringPixelRatio, 
    setDitheringPixelRatio, ditheringGrayscale, setDitheringGrayscale, isGarmentLocked
  } = useStore();

    useEffect(() => {
    const hydrateModels = async () => {
      let changed = false;
      const { library, customModel } = useStore.getState();
      const updatedLibrary = await Promise.all(library.map(async (item) => {
        if (item.customModel && item.customModel.fileId && !item.customModel.url) {
          try {
            const file = await idbGet('file_' + item.customModel.fileId);
            if (file) {
              const url = URL.createObjectURL(file as File);
              changed = true;
              return { ...item, customModel: { ...item.customModel, url } };
            }
          } catch (e) {
            console.error('Failed to load file from IDB', e);
          }
        }
        return item;
      }));
      
      if (changed) {
        useStore.setState({ library: updatedLibrary });
      }
      
      if (customModel && customModel.fileId && !customModel.url) {
        try {
          const file = await idbGet('file_' + customModel.fileId);
          if (file) {
            const url = URL.createObjectURL(file as File);
            useStore.setState({ customModel: { ...customModel, url } });
          }
        } catch (e) {}
      }
      setModelsHydrated(true);
    };

    // The zustand persist middleware reads from IndexedDB asynchronously
    // (createJSONStorage(idbStorage)), so on mount the store may not have
    // finished loading the saved state yet - there's no guarantee this
    // effect runs after that read completes. Running hydrateModels() too
    // early meant `customModel.fileId` wasn't in the store yet, so the
    // uploaded model's file was never reattached and the session silently
    // came back to the default garment - this was intermittent because it
    // depended on how fast the IndexedDB read happened to be on that
    // device, which is exactly why it looked flaky (worse on iPad than
    // desktop). Explicitly wait for hydration to finish before touching
    // customModel/library.
    if (useStore.persist.hasHydrated()) {
      hydrateModels();
    } else {
      const unsub = useStore.persist.onFinishHydration(() => {
        hydrateModels();
      });
      return unsub;
    }
  }, []);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const objInputRef = useRef<HTMLInputElement>(null);

  const handleObjUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFakeUploadProgress(0);
      const isGlb = file.name.toLowerCase().endsWith('.glb') || file.name.toLowerCase().endsWith('.gltf');
      const fileId = uuidv4();
      
      let p = 0;
      const interval = setInterval(() => {
        p += 15;
        if (p >= 100) {
          clearInterval(interval);
          setFakeUploadProgress(null);
          
          idbSet('file_' + fileId, file).then(() => {
            const url = URL.createObjectURL(file);
            useStore.getState().createCustomModelItem(file.name.split('.')[0], { url, type: isGlb ? 'glb' : 'obj', fileId });
          }).catch(err => {
            console.error('Failed to save file to IDB', err);
            // fallback to data url if idb fails
            const reader = new FileReader();
            reader.onload = (event) => {
              const dataUrl = event.target?.result as string;
              useStore.getState().createCustomModelItem(file.name.split('.')[0], { url: dataUrl, type: isGlb ? 'glb' : 'obj' });
            };
            reader.readAsDataURL(file);
          });
        } else {
          setFakeUploadProgress(p);
        }
      }, 50);
    }
    if (e.target) e.target.value = '';
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFakeUploadProgress(0);
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        let p = 0;
        const interval = setInterval(() => {
          p += 15;
          if (p >= 100) {
            clearInterval(interval);
            setFakeUploadProgress(null);
            setEditingImage({ url: dataUrl });
          } else {
            setFakeUploadProgress(p);
          }
        }, 50);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    dragCounter.current += 1;
    setIsDraggingFileOverCanvas(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    dragCounter.current = Math.max(0, dragCounter.current - 1);
    if (dragCounter.current === 0) setIsDraggingFileOverCanvas(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current = 0;
    setIsDraggingFileOverCanvas(false);

    // Dropping an image onto the garment only places it when the garment is
    // locked (i.e. in decal-editing mode). In unlocked/rotate mode the drop
    // is ignored so it can't be confused with the free-rotate gesture.
    if (!isGarmentLocked) return;

    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setFakeUploadProgress(0);
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        let p = 0;
        const interval = setInterval(() => {
          p += 15;
          if (p >= 100) {
            clearInterval(interval);
            setFakeUploadProgress(null);
            window.dispatchEvent(new CustomEvent('add-decal-3d', { detail: { url: dataUrl, clientX: e.clientX, clientY: e.clientY } }));
          } else {
            setFakeUploadProgress(p);
          }
        }, 50);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div 
      className="relative w-screen h-screen bg-white text-black font-sans text-xs overflow-hidden selection:bg-black selection:text-white uppercase"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <Viewer3D />

      {!modelsHydrated && (
        <div className="absolute inset-0 z-[70] flex items-center justify-center bg-white">
          <span className="text-[11px] font-bold tracking-widest animate-pulse">LOADING_SESSION...</span>
        </div>
      )}

      {isDraggingFileOverCanvas && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center pointer-events-none bg-black/40">
          <div className="bg-white border-2 border-black px-6 py-4 text-center max-w-xs">
            {isGarmentLocked ? (
              <span className="text-[11px] font-bold">DROP TO PLACE IMAGE ON GARMENT</span>
            ) : (
              <span className="text-[11px] font-bold text-red-600">LOCK THE GARMENT FIRST (padlock button) TO DROP IMAGES ONTO IT</span>
            )}
          </div>
        </div>
      )}
      
      <div className={`absolute inset-0 pointer-events-none flex flex-col md:grid transition-all duration-300 md:grid-rows-[50px_1fr_40px]`} style={{ gridTemplateColumns: `${leftSidebarCollapsed ? "50px" : "280px"} 1fr ${parametersCollapsed ? "50px" : "280px"}` }}>
        <header className="md:col-span-3 md:row-start-1 border-b border-black flex items-center justify-between px-4 h-[50px] shrink-0 pointer-events-auto bg-white z-50 relative">
          <div className="font-bold text-[18px] tracking-tighter flex items-center gap-2"><button className="md:hidden" onClick={() => { setLeftSidebarCollapsed(!leftSidebarCollapsed); setParametersCollapsed(true); }}><Menu size={16}/></button>3DDD.STUDIO</div>
          <div className="text-[11px] flex items-center gap-4">
            <button className="md:hidden flex items-center gap-1 font-bold tracking-widest uppercase" onClick={() => { setParametersCollapsed(!parametersCollapsed); setLeftSidebarCollapsed(true); }}>
              PARAMS
            </button>
            <div className="flex items-center">
            <span className="w-1.5 h-1.5 bg-black rounded-full inline-block mr-1.5"></span>
            LOCAL_SAVE
            </div>
          </div>
        </header>

        <aside className={`${leftSidebarCollapsed ? "hidden md:flex md:w-[50px] overflow-hidden" : "flex w-full md:w-auto absolute top-[50px] bottom-[40px] left-0 z-40 md:relative md:top-auto md:bottom-auto"} md:col-start-1 md:row-start-2 border-r border-black flex flex-col pointer-events-auto bg-white transition-all duration-300 h-full overflow-y-auto overflow-x-hidden`}>
          {leftSidebarCollapsed ? (
            <div className="flex flex-col items-center py-4 gap-4 h-full border-r border-black cursor-pointer bg-[#f0f0f0] hover:bg-[#e0e0e0]" onClick={() => setLeftSidebarCollapsed(false)}>
              <span className="[writing-mode:vertical-lr] font-bold text-[12px] tracking-widest uppercase">Expand Library</span>
            </div>
          ) : (
            <div className="flex flex-col w-full h-full">
          <div className="py-2 px-3 text-[10px] uppercase tracking-widest font-bold bg-[#f0f0f0] border-b border-black shrink-0 cursor-pointer select-none hover:bg-[#e0e0e0] flex items-center justify-between" onClick={() => setLeftSidebarCollapsed(true)}>
            [01] GARMENT_LIBRARY
            <span className="text-[9px]">-</span>
          </div>
          {true && (
            <div className="flex flex-col border-b border-black shrink-0" style={{ maxHeight: '30vh' }}>
              <div className="flex-1 overflow-y-auto">
                {library.map((item, i) => (
                  <LibraryItem key={item.id} item={item} index={i} />
                ))}
              </div>
              <div className="p-4 border-t border-black mt-auto shrink-0">
                <input 
                  type="file" 
                  accept=".obj,.glb,.gltf"
                  ref={objInputRef}
                  className="hidden"
                  onChange={handleObjUpload}
                />
                <button 
                  onClick={() => objInputRef.current?.click()}
                  className="block w-full p-2 text-center border border-black text-[9px] uppercase cursor-pointer hover:bg-black hover:text-white transition-colors"
                >
                  UPLOAD_CUSTOM_MODEL
                </button>
              </div>
            </div>
          )}

          <div className="py-2 px-3 text-[10px] uppercase tracking-widest font-bold bg-[#f0f0f0] border-b border-black shrink-0 cursor-pointer select-none hover:bg-[#e0e0e0] flex items-center justify-between" onClick={() => setGraphicsCollapsed(!graphicsCollapsed)}>
            [02] GRAPHICS_UPLOAD
            <span className="text-[9px]">{graphicsCollapsed ? '+' : '-'}</span>
          </div>
          {!graphicsCollapsed && (
            <div className="p-4 border-b border-black shrink-0">              
              <div className="space-y-2 mb-3">
                {decals.map((decal, i) => (
                  <div 
                    key={decal.id} 
                    className={`border border-black p-2 flex flex-col gap-2 transition-colors cursor-pointer ${activeDecalId === decal.id ? 'bg-[#f0f0f0]' : 'hover:bg-[#f8f8f8]'}`}
                    onClick={() => setActiveDecalId(decal.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <img src={decal.url} alt="decal" className="w-6 h-6 object-contain border border-black/10 bg-white" onDoubleClick={(e) => { e.stopPropagation(); setEditingImage({ url: decal.url, id: decal.id, placement: decal.placement })}} draggable={false} />
                        <span className="truncate text-[10px] font-bold">LAYER_{i + 1}</span>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); removeDecal(decal.id); }} className="opacity-50 hover:opacity-100 hover:text-red-600">
                        <X size={12} />
                      </button>
                    </div>
                    
                    {activeDecalId === decal.id && (
                      <div className="mt-1 pt-2 border-t border-black/10">
                        <div className="flex justify-between text-[9px] mb-1">
                          <span>SCALE</span>
                          <span>{(decal.scale[0] * 100).toFixed(0)}%</span>
                        </div>
                        <input 
                          type="range" 
                          min="1" max="200" 
                          value={decal.scale[0] * 100} 
                          onChange={(e) => {
                            const s = parseInt(e.target.value) / 100;
                            updateDecal(decal.id, { scale: [s, s, 1] });
                          }} 
                          className="w-full accent-black h-1" 
                        />
                        <div className="text-[9px] opacity-50 mt-2 italic">
                          Double-click thumbnail to edit image
                        </div>
                      </div>
                    )}
                  </div>
                ))} 
                {decals.length === 0 && (
                  <div className="text-[10px] opacity-40 text-center py-2 border border-black border-dashed">
                    [ NO_GRAPHICS ]
                  </div>
                )}
              </div>
              <input 
                type="file" 
                accept="image/*"
                ref={fileInputRef}
                className="hidden"
                onChange={handleFileUpload}
              />
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="block w-full p-2.5 text-center border border-black text-[11px] uppercase cursor-pointer hover:bg-black hover:text-white transition-colors"
              >
                UPLOAD_ASSET
              </button>
              <div className="text-[10px] opacity-50 italic mt-2">Supports: PNG, SVG, JPG</div>
            </div>
          )}

          
          {/* IMAGE GALLERY */}
          <div className="py-2 px-3 text-[10px] uppercase tracking-widest font-bold bg-[#f0f0f0] border-b border-black shrink-0 cursor-pointer select-none hover:bg-[#e0e0e0] flex items-center justify-between" onClick={() => setGalleryCollapsed(!galleryCollapsed)}>
            [04] IMAGE_GALLERY
            <span className="text-[9px]">{galleryCollapsed ? '+' : '-'}</span>
          </div>
          {!galleryCollapsed && (
            <div className="p-4 border-b border-black shrink-0">
              {uploadedImages.length > 0 ? (
                <div className="grid grid-cols-4 gap-2">
                  {uploadedImages.map((imgUrl, i) => (
                    <div key={i} className="relative group border border-black/20 aspect-square">
                      <img src={imgUrl} className="w-full h-full object-contain cursor-pointer hover:bg-black/5" onClick={() => setEditingImage({ url: imgUrl })} />
                      <button 
                        className="absolute -top-1.5 -right-1.5 bg-white border border-black rounded-full opacity-0 group-hover:opacity-100 hover:bg-red-500 hover:text-white"
                        onClick={(e) => { e.stopPropagation(); removeUploadedImage(imgUrl); }}
                      >
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-[10px] opacity-40 text-center py-2 border border-black border-dashed">
                  [ NO_IMAGES ]
                </div>
              )}
            </div>
          )}

          <div className="py-2 px-3 text-[10px] uppercase tracking-widest font-bold bg-[#f0f0f0] border-b border-black shrink-0 cursor-pointer select-none hover:bg-[#e0e0e0] flex items-center justify-between" onClick={() => setFlatLayCollapsed(!flatLayCollapsed)}>
            [03] FLAT_LAY_PLACEMENT
            <span className="text-[9px]">{flatLayCollapsed ? '+' : '-'}</span>
          </div>
          {!flatLayCollapsed && (
            <div className="p-4 border-b border-black shrink-0">
              <div className="grid grid-cols-2 gap-2 mt-2">
                {(['front', 'back', 'left_arm', 'right_arm'] as const).map((placement) => {
                  // Previously this used .find(), which only ever surfaced a
                  // single decal per section and silently overwrote it on the
                  // next upload. Sections can now hold any number of images.
                  const placementDecals = decals.filter(d => d.placement === placement);
                  return (
                  <div key={placement} className="relative border border-dashed border-gray-400 min-h-24 flex flex-col hover:bg-gray-50 transition-colors group overflow-hidden p-1.5">
                    <button
                      className="text-[9px] uppercase font-bold text-gray-400 mb-1 px-0.5 text-left hover:text-black hover:underline w-fit"
                      onClick={() => setFlatLayEditorPlacement(placement)}
                    >
                      {placement.replace('_', ' ')} {placementDecals.length > 0 && `(${placementDecals.length})`}
                    </button>
                    <div className="flex flex-wrap gap-1 flex-1 content-start">
                      {placementDecals.map((d) => (
                        <div key={d.id} className="relative w-9 h-9 border border-black/10 bg-white shrink-0 group/thumb">
                          <img
                            src={d.url}
                            alt={placement}
                            className="w-full h-full object-contain cursor-pointer"
                            onClick={() => setEditingImage({ url: d.url, id: d.id, placement })}
                            draggable={false}
                          />
                          <button
                            className="absolute -top-1.5 -right-1.5 z-10 bg-white border border-black text-black hover:bg-red-500 hover:text-white rounded-full p-0.5 opacity-0 group-hover/thumb:opacity-100 transition-opacity"
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              removeDecal(d.id);
                            }}
                          >
                            <X size={10} />
                          </button>
                        </div>
                      ))}
                      <button
                        className="relative w-9 h-9 border border-dashed border-gray-400 flex items-center justify-center cursor-pointer hover:border-black hover:text-black text-gray-400 shrink-0 text-[14px] leading-none"
                        onClick={() => setFlatLayEditorPlacement(placement)}
                      >
                        +
                      </button>
                    </div>
                  </div>
                )})}
              </div>
            </div>
          )}
          </div>
        )}</aside>

        {flatLayEditorPlacement && (
          <FlatLayEditor placement={flatLayEditorPlacement} onClose={() => setFlatLayEditorPlacement(null)} />
        )}
        
        <main className="col-start-2 row-start-2 relative pointer-events-none">
          <div className="py-2 px-3 text-[10px] uppercase tracking-widest font-bold bg-transparent">
            [ VIEWPORT_3D ]
          </div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none text-center text-[10px] opacity-100 mt-[150px] font-bold">
             {fakeUploadProgress !== null ? (
               `[ UPLOADING_ASSET... ${fakeUploadProgress}% ]`
             ) : active ? (
               `[ LOADING_MODEL... ${progress.toFixed(0)}% ]`
             ) : (

               <span className="opacity-30">[ 3D_VIEW_ACTIVE ]</span>
             )}
          </div>
        </main>
        
        <aside className={`${parametersCollapsed ? "hidden md:flex md:w-[50px] overflow-hidden" : "flex w-full md:w-auto absolute top-[50px] bottom-[40px] right-0 z-40 md:relative md:top-auto md:bottom-auto"} md:col-start-3 md:row-start-2 border-l border-black flex flex-col pointer-events-auto bg-white transition-all duration-300 h-full overflow-y-auto`}>
          {parametersCollapsed ? (
            <div className="flex flex-col items-center py-4 gap-4 h-full border-l border-black cursor-pointer bg-[#f0f0f0] hover:bg-[#e0e0e0]" onClick={() => setParametersCollapsed(false)}>
              <span className="[writing-mode:vertical-lr] font-bold text-[12px] tracking-widest uppercase">Parameters</span>
            </div>
          ) : (
            <div className="flex flex-col w-full h-full">
          <div className="py-2 px-3 text-[10px] uppercase tracking-widest font-bold bg-[#f0f0f0] border-b border-black shrink-0 cursor-pointer select-none hover:bg-[#e0e0e0] flex items-center justify-between" onClick={() => setParametersCollapsed(!parametersCollapsed)}>
            [04] {!parametersCollapsed && "PARAMETERS"}
          </div>
          
          {!parametersCollapsed && (
            <>
              <div className="p-4 border-b border-black">
                <div className="flex justify-between items-center cursor-pointer mb-1.5 opacity-60 hover:opacity-100" onClick={() => setMaterialsCollapsed(!materialsCollapsed)}>
                  <label className="text-[9px] uppercase cursor-pointer">Materials</label>
                  <span className="text-[9px]">{materialsCollapsed ? '+' : '-'}</span>
                </div>
                {!materialsCollapsed && (
                  <>
                    {availableMaterials.length === 0 && !customModel && (<div className="mb-4 border border-[#e0e0e0] p-2"><label className="text-[10px] font-bold mb-2 block">Garment</label><div className="w-full h-[20px] border border-black mb-2 relative"><input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="opacity-0 absolute inset-0 w-full h-full cursor-pointer" /><div className="w-full h-full pointer-events-none" style={{ backgroundColor: color }} /></div><div className="flex justify-between items-center text-[10px] mb-2"><span>HEX</span><span>{color}</span></div><div className="mt-2"><div className="flex justify-between items-center text-[9px] mb-1"><span>ROUGHNESS</span><span>{roughness?.toFixed(2)}</span></div><input type="range" min="0" max="1" step="0.01" value={roughness || 0} onChange={(e) => setRoughness(parseFloat(e.target.value))} className="w-full accent-black h-1" /></div><div className="mt-2"><div className="flex justify-between items-center text-[9px] mb-1"><span>METALNESS</span><span>{metalness?.toFixed(2)}</span></div><input type="range" min="0" max="1" step="0.01" value={metalness || 0} onChange={(e) => setMetalness(parseFloat(e.target.value))} className="w-full accent-black h-1" /></div></div>)}
                    {availableMaterials.map((matName) => {
                      const config = materialsConfig[matName] || { color: '#ffffff', roughness: 0.8, metalness: 0.1 };
                      return (
                        <div key={matName} className="mb-4 border border-[#e0e0e0] p-2">
                          <label className="text-[10px] font-bold mb-2 block">{matName}</label>
                          
                          <div className="w-full h-[20px] border border-black mb-2 relative">
                            <input 
                              type="color" 
                              value={config.color}
                              onChange={(e) => setMaterialConfig(matName, { color: e.target.value })}
                              className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                            />
                            <div className="w-full h-full pointer-events-none" style={{ backgroundColor: config.color }} />
                          </div>
                          <div className="flex justify-between items-center text-[10px] mb-2">
                            <span>HEX</span>
                            <span>{config.color}</span>
                          </div>
                          
                          <div className="mt-2">
                            <div className="flex justify-between items-center text-[9px] mb-1">
                              <span>ROUGHNESS</span>
                              <span>{config.roughness?.toFixed(2)}</span>
                            </div>
                            <input 
                              type="range" 
                              min="0" max="1" step="0.01" 
                              value={config.roughness || 0}
                              onChange={(e) => setMaterialConfig(matName, { roughness: parseFloat(e.target.value) })}
                              className="w-full accent-black h-1" 
                            />
                          </div>
                          
                          <div className="mt-2">
                            <div className="flex justify-between items-center text-[9px] mb-1">
                              <span>METALNESS</span>
                              <span>{config.metalness?.toFixed(2)}</span>
                            </div>
                            <input 
                              type="range" 
                              min="0" max="1" step="0.01" 
                              value={config.metalness || 0}
                              onChange={(e) => setMaterialConfig(matName, { metalness: parseFloat(e.target.value) })}
                              className="w-full accent-black h-1" 
                            />
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
              
              <div className="p-4 border-b border-black">
                <div className="flex justify-between items-center cursor-pointer mb-1.5 opacity-60 hover:opacity-100" onClick={() => setEffectsCollapsed(!effectsCollapsed)}>
                  <label className="text-[9px] uppercase cursor-pointer">3D_Effects</label>
                  <span className="text-[9px]">{effectsCollapsed ? '+' : '-'}</span>
                </div>
                {!effectsCollapsed && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold">DITHERING SHADER</span>
                      <button 
                        onClick={() => setDitheringEnabled(!ditheringEnabled)}
                        className={`text-[9px] px-2 py-1 border transition-colors ${ditheringEnabled ? 'bg-black text-white border-black' : 'border-gray-400 hover:bg-gray-100'}`}
                      >
                        {ditheringEnabled ? 'ON' : 'OFF'}
                      </button>
                    </div>
                    
                    {ditheringEnabled && (
                      <>
                        <div>
                          <div className="flex justify-between items-center text-[9px] mb-1">
                            <span>GRID SIZE</span>
                            <span>{ditheringGridSize.toFixed(1)}</span>
                          </div>
                          <input
                            type="range"
                            min="1" max="10" step="0.5"
                            value={ditheringGridSize}
                            onChange={(e) => setDitheringGridSize(parseFloat(e.target.value))}
                            className="w-full accent-black h-1"
                          />
                        </div>
                        <div>
                          <div className="flex justify-between items-center text-[9px] mb-1">
                            <span>PIXEL RATIO</span>
                            <span>{ditheringPixelRatio.toFixed(1)}</span>
                          </div>
                          <input
                            type="range"
                            min="0.5" max="5" step="0.1"
                            value={ditheringPixelRatio}
                            onChange={(e) => setDitheringPixelRatio(parseFloat(e.target.value))}
                            className="w-full accent-black h-1"
                          />
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-[9px]">GRAYSCALE</span>
                          <input
                            type="checkbox"
                            checked={ditheringGrayscale}
                            onChange={(e) => setDitheringGrayscale(e.target.checked)}
                            className="accent-black"
                          />
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
              <div className="p-4 mt-auto">
                <button 
                  onClick={() => useStore.getState().triggerExport()}
                  className="block w-full p-2.5 text-center border border-black text-[11px] uppercase cursor-pointer bg-black text-white hover:bg-black/80 transition-colors mb-2"
                >
                  EXPORT_GLB
                </button>
                <button 
                  onClick={saveDraft}
                  className="block w-full p-2.5 text-center border border-black text-[11px] uppercase cursor-pointer hover:bg-[#f0f0f0] transition-colors"
                >
                  SAVE_AS_NEW_VERSION
                </button>
                <div className="text-[9px] opacity-50 italic mt-2">
                  Saves the current garment (color, images, model) as a new entry in the library on the left. Any further edits keep autosaving into whichever version is active.
                </div>
              </div>
            </>
          )}
          </div>
        )}</aside>
        
        <footer className="col-span-3 row-start-3 border-t border-black flex items-center justify-between px-4 pointer-events-auto bg-black text-white">
           <div className="text-[10px]">
             XRTailor Engine: OFFLINE BAKE // T-Designer 3D: ACTIVE // MESH: PBR_READY
           </div>
           <div className="text-[10px] tracking-[2px]">
              3DDD_2024_PROTOTYPE
           </div>
        </footer>
      </div>

      {editingImage && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 pointer-events-auto backdrop-blur-sm">
          <div className="bg-white border-2 border-black p-4 max-h-[90vh] overflow-y-auto max-w-[90vw] w-[500px]">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-[14px] font-bold uppercase">Edit Image</h2>
              <button onClick={() => setEditingImage(null)} className="hover:opacity-50"><X size={16} /></button>
            </div>
            <ImageEditor 
              src={editingImage.url} 
              onSave={(url) => {
                useStore.getState().addUploadedImage(url);
                if (editingImage.id) {
                  useStore.getState().updateDecal(editingImage.id, { url });
                } else {
                  if (editingImage.placement) {
                    window.dispatchEvent(new CustomEvent('add-decal-placement', { detail: { url, placement: editingImage.placement } }));
                  } else if (editingImage.clientX !== undefined && editingImage.clientY !== undefined) {
                    window.dispatchEvent(new CustomEvent('add-decal-3d', { detail: { url, clientX: editingImage.clientX, clientY: editingImage.clientY } }));
                  } else {
                    // No click position and no section chosen (the plain
                    // "Upload Image" button) - previously this called
                    // addDecal(url) with a hardcoded guessed position and
                    // mesh index 0, which only worked for the built-in
                    // placeholder shape. For a custom uploaded model, mesh
                    // 0 is whatever happened to come first in the file and
                    // that fixed point often doesn't even touch its
                    // surface, so the decal geometry came out empty -
                    // nothing rendered, with no error. Raycast from the
                    // center of the screen against whatever garment is
                    // actually there instead of guessing.
                    window.dispatchEvent(new CustomEvent('add-decal-3d', { detail: { url, clientX: window.innerWidth / 2, clientY: window.innerHeight / 2 } }));
                  }
                }
                setEditingImage(null);
              }} 
              onCancel={() => setEditingImage(null)} 
            />
          </div>
        </div>
      )}
    </div>
  );
}
