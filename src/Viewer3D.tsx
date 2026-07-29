import { EffectComposer } from '@react-three/postprocessing';
import { DitheringEffect } from './DitheringEffect';
import React, { forwardRef, useMemo, useRef, useEffect, Suspense, useCallback, useState } from 'react';
import { Canvas, useThree, useLoader } from '@react-three/fiber';
import { Html, OrbitControls, Environment, ContactShadows, RoundedBox, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { useStore } from './store';
import { ErrorBoundary } from './ErrorBoundary';
import { useGesture } from '@use-gesture/react';
import { Lock, Unlock } from 'lucide-react';
import { GARMENT_PANELS, PanelDef } from './garmentPanels';
import type { PanelId } from './store';
import { getPanelTexture, repaintPanel } from './panelTexture';

const DitheringPass = forwardRef((props: any, ref) => {
  // Construct the effect exactly once. The previous deps array was [props],
  // and since `props` is a fresh object every render this rebuilt (and
  // leaked, never disposing) a new DitheringEffect on each render.
  // Parameter changes are applied through the setters below instead.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const effect = useMemo(() => new DitheringEffect(props), []);
  useEffect(() => () => { effect.dispose(); }, [effect]);
  useEffect(() => {
    effect.setGridSize(props.gridSize);
    effect.setPixelSizeRatio(props.pixelSizeRatio);
    effect.setGrayscaleOnly(props.grayscaleOnly);
  }, [props.gridSize, props.pixelSizeRatio, props.grayscaleOnly, effect]);
  return <primitive ref={ref} object={effect} dispose={null} />;
});

// --- GLTF decoder wiring -------------------------------------------------
// Most real-world .glb exports (Sketchfab, Blender with compression, CLO3D,
// gltf-transform pipelines) are Draco- and/or meshopt-compressed. Without a
// decoder attached, GLTFLoader.parse throws ("No DRACOLoader instance
// provided") and the ErrorBoundary used to silently discard the model —
// which looked exactly like "upload failed". Wire both decoders once at
// module scope and pass them into every custom-model useGLTF call.
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
dracoLoader.setDecoderConfig({ type: 'js' });

const extendGltfLoader = (loader: any) => {
  loader.setDRACOLoader(dracoLoader as any);
  loader.setMeshoptDecoder(MeshoptDecoder as any);
};

const InvalidModelFallback = ({ error }: { error?: Error | null }) => {
  const setCustomModel = useStore(s => s.setCustomModel);
  const message = error?.message || 'The model file could not be parsed.';
  // Visible on-screen error instead of the old silent setCustomModel(null)
  // (which snapped back to the default t-shirt with zero feedback).
  return (
    <Html center zIndexRange={[100, 90]}>
      <div style={{
        background: '#fff', border: '2px solid #d00', color: '#111',
        padding: '12px 16px', width: 320, fontFamily: 'monospace',
        fontSize: 11, lineHeight: 1.5, boxShadow: '4px 4px 0 rgba(0,0,0,0.2)'
      }}>
        <div style={{ fontWeight: 700, color: '#d00', textTransform: 'uppercase', marginBottom: 6 }}>
          Model failed to load
        </div>
        <div style={{ wordBreak: 'break-word', maxHeight: 120, overflow: 'auto', marginBottom: 10 }}>
          {message}
        </div>
        <button
          onClick={() => setCustomModel(null)}
          style={{
            border: '1px solid #111', background: '#111', color: '#fff',
            padding: '6px 10px', fontSize: 10, textTransform: 'uppercase', cursor: 'pointer'
          }}
        >
          Remove model / back to default
        </button>
      </div>
    </Html>
  );
};

const CustomGLTFModel = ({ url, onMeshReady }: { url: string, onMeshReady: (m: THREE.Mesh[]) => void }) => {
  const { color, roughness, metalness, materialsConfig, initMaterialsConfig, setAvailableMaterials } = useStore();
  // useDraco/useMeshopt are disabled here so drei doesn't attach its own
  // (differently-configured) decoders after ours; extendGltfLoader wires
  // Draco (gstatic 1.5.7, js decoder) + meshopt in one place.
  const { scene } = useGLTF(url, false, false, extendGltfLoader);
  const clonedScene = useMemo(() => scene.clone(), [scene]);
  const materialsRef = useRef<THREE.MeshStandardMaterial[]>([]);

  useEffect(() => {
    clonedScene.scale.setScalar(1);
    clonedScene.position.set(0, 0, 0);
    clonedScene.updateMatrixWorld(true);

    const box = new THREE.Box3().setFromObject(clonedScene);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    
    if (maxDim > 0) {
      const scale = 3 / maxDim;
      clonedScene.scale.setScalar(scale);
      clonedScene.position.copy(center).multiplyScalar(-scale);
    }

    
    materialsRef.current = [];
    const childToTraverse = clonedScene;

    const extractedMaterials: Record<string, { color: string, roughness: number, metalness: number }> = {};
    const matNames: string[] = [];

    childToTraverse.traverse((child: any) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;

        // A mesh can have an ARRAY of materials (one per geometry group) -
        // this is exactly how a lot of garment models split the body, cuffs,
        // collar, zipper, etc. into separately colorable regions on a single
        // mesh. The previous version only ever cloned/tracked `material[0]`
        // and threw the rest away, so every region past the first silently
        // stayed the uploaded model's original color no matter what was
        // changed in the UI, and never appeared as its own control.
        const rawMats: THREE.Material[] = child.material
          ? (Array.isArray(child.material) ? child.material : [child.material])
          : [new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.8, metalness: 0.1 })];

        const clonedMats = rawMats.map((rawMat) => {
          const mat = rawMat.clone() as THREE.MeshStandardMaterial;
          const matName = mat.name || `Material_${materialsRef.current.length}`;
          mat.name = matName;
          if (!matNames.includes(matName)) matNames.push(matName);

          if (!materialsConfig[matName]) {
            extractedMaterials[matName] = {
              color: mat.color ? '#' + mat.color.getHexString() : '#ffffff',
              roughness: 'roughness' in mat ? mat.roughness : 0.8,
              metalness: 'metalness' in mat ? mat.metalness : 0.1
            };
          }

          const currentConfig = materialsConfig[matName] || extractedMaterials[matName];
          if (mat.color) mat.color.set(currentConfig.color);
          if ('roughness' in mat) (mat as any).roughness = currentConfig.roughness;
          if ('metalness' in mat) (mat as any).metalness = currentConfig.metalness;

          materialsRef.current.push(mat);
          return mat;
        });

        child.material = Array.isArray(child.material) ? clonedMats : clonedMats[0];
      }
    });

    if (Object.keys(extractedMaterials).length > 0) {
      setTimeout(() => {
        initMaterialsConfig(extractedMaterials);
      }, 0);
    }
    
        setTimeout(() => {
      const currentAvailable = useStore.getState().availableMaterials;
      if (currentAvailable.length !== matNames.length || !matNames.every((val, index) => val === currentAvailable[index])) {
        setAvailableMaterials(matNames);
      }
    }, 0);

    
    // Collect meshes for GLTF export.
    const meshes: THREE.Mesh[] = [];
    clonedScene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        meshes.push(child);
      }
    });
    if (meshes.length > 0) {
      onMeshReady(meshes);
    }
  }, [clonedScene, onMeshReady]);

  useEffect(() => {
    materialsRef.current.forEach(mat => {
      const matName = mat.name;
      const currentConfig = materialsConfig[matName];
      if (currentConfig) {
        if ((mat as any).color) (mat as any).color.set(currentConfig.color);
        if ('roughness' in mat) (mat as any).roughness = currentConfig.roughness;
        if ('metalness' in mat) (mat as any).metalness = currentConfig.metalness;
      } else {
        if ((mat as any).color) (mat as any).color.set(color);
        if ('roughness' in mat) (mat as any).roughness = roughness;
        if ('metalness' in mat) (mat as any).metalness = metalness;
      }
    });
  }, [color, roughness, metalness, materialsConfig]);

  return <primitive object={clonedScene} />;
};

const CustomOBJModel = ({ url, onMeshReady }: { url: string, onMeshReady: (m: THREE.Mesh[]) => void }) => {
  const { color, roughness, metalness, materialsConfig, initMaterialsConfig, setAvailableMaterials } = useStore();
  const obj = useLoader(OBJLoader, url);
  const clonedObj = useMemo(() => obj.clone(), [obj]);
  const materialsRef = useRef<THREE.MeshStandardMaterial[]>([]);

  useEffect(() => {
    clonedObj.scale.setScalar(1);
    clonedObj.position.set(0, 0, 0);
    clonedObj.updateMatrixWorld(true);

    const box = new THREE.Box3().setFromObject(clonedObj);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    
    if (maxDim > 0) {
      const scale = 3 / maxDim;
      clonedObj.scale.setScalar(scale);
      clonedObj.position.copy(center).multiplyScalar(-scale);
    }

    
    materialsRef.current = [];
    const childToTraverse = clonedObj;

    const extractedMaterials: Record<string, { color: string, roughness: number, metalness: number }> = {};
    const matNames: string[] = [];

    childToTraverse.traverse((child: any) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;

        // A mesh can have an ARRAY of materials (one per geometry group) -
        // this is exactly how a lot of garment models split the body, cuffs,
        // collar, zipper, etc. into separately colorable regions on a single
        // mesh. The previous version only ever cloned/tracked `material[0]`
        // and threw the rest away, so every region past the first silently
        // stayed the uploaded model's original color no matter what was
        // changed in the UI, and never appeared as its own control.
        const rawMats: THREE.Material[] = child.material
          ? (Array.isArray(child.material) ? child.material : [child.material])
          : [new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.8, metalness: 0.1 })];

        const clonedMats = rawMats.map((rawMat) => {
          const mat = rawMat.clone() as THREE.MeshStandardMaterial;
          const matName = mat.name || `Material_${materialsRef.current.length}`;
          mat.name = matName;
          if (!matNames.includes(matName)) matNames.push(matName);

          if (!materialsConfig[matName]) {
            extractedMaterials[matName] = {
              color: mat.color ? '#' + mat.color.getHexString() : '#ffffff',
              roughness: 'roughness' in mat ? mat.roughness : 0.8,
              metalness: 'metalness' in mat ? mat.metalness : 0.1
            };
          }

          const currentConfig = materialsConfig[matName] || extractedMaterials[matName];
          if (mat.color) mat.color.set(currentConfig.color);
          if ('roughness' in mat) (mat as any).roughness = currentConfig.roughness;
          if ('metalness' in mat) (mat as any).metalness = currentConfig.metalness;

          materialsRef.current.push(mat);
          return mat;
        });

        child.material = Array.isArray(child.material) ? clonedMats : clonedMats[0];
      }
    });

    if (Object.keys(extractedMaterials).length > 0) {
      setTimeout(() => {
        initMaterialsConfig(extractedMaterials);
      }, 0);
    }
    
        setTimeout(() => {
      const currentAvailable = useStore.getState().availableMaterials;
      if (currentAvailable.length !== matNames.length || !matNames.every((val, index) => val === currentAvailable[index])) {
        setAvailableMaterials(matNames);
      }
    }, 0);

    
    const meshes: THREE.Mesh[] = [];
    clonedObj.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        meshes.push(child);
      }
    });
    if (meshes.length > 0) {
      onMeshReady(meshes);
    }
  }, [clonedObj, onMeshReady]);

  useEffect(() => {
    materialsRef.current.forEach(mat => {
      const matName = mat.name;
      const currentConfig = materialsConfig[matName];
      if (currentConfig) {
        if ((mat as any).color) (mat as any).color.set(currentConfig.color);
        if ('roughness' in mat) (mat as any).roughness = currentConfig.roughness;
        if ('metalness' in mat) (mat as any).metalness = currentConfig.metalness;
      } else {
        if ((mat as any).color) (mat as any).color.set(color);
        if ('roughness' in mat) (mat as any).roughness = roughness;
        if ('metalness' in mat) (mat as any).metalness = metalness;
      }
    });
  }, [color, roughness, metalness, materialsConfig]);

  return <primitive object={clonedObj} />;
};

// Wraps the GLTF model component and races its (otherwise indefinite) Suspense
// load against a ~9s timeout. drei's useGLTF has no built-in timeout, so a
// slow/unreachable .glb would suspend the component forever and the canvas
// would show an infinite spinner. On timeout we render a visible error
// fallback with a "Remove model" button instead of hanging. The Suspense
// boundary in GarmentMeshes stays intact for the normal loading path.
const CustomGLTFModelLoadGate = ({ url, onMeshReady }: { url: string, onMeshReady: (m: THREE.Mesh[]) => void }) => {
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    setTimedOut(false);
    const t = setTimeout(() => setTimedOut(true), 9000);
    return () => clearTimeout(t);
  }, [url]);

  if (timedOut) {
    return (
      <InvalidModelFallback
        error={new Error('Model timed out loading (over 9s). The file may be too large or the URL is unreachable.')}
      />
    );
  }

  return <CustomGLTFModel url={url} onMeshReady={onMeshReady} />;
};




export const GarmentMeshes = ({ onMeshReady }: { onMeshReady: (m: THREE.Mesh[]) => void }) => {
  const { color, roughness, metalness, customModel, garment } = useStore();
  const collectedRef = useRef(false);
  const meshCollectScheduled = useRef(false);

  useEffect(() => {
    collectedRef.current = false;
    meshCollectScheduled.current = false;
  }, [customModel, garment]);

  const handleReady = useCallback((nodes: THREE.Mesh[]) => {
    collectedRef.current = true;
    onMeshReady(nodes);
  }, [onMeshReady]);

  if (customModel) {
    return (
      <ErrorBoundary fallback={(error) => <InvalidModelFallback error={error} />}>
        <Suspense fallback={null}>
          {customModel.url ? (
            customModel.type === 'obj' ? (
              <CustomOBJModel url={customModel.url} onMeshReady={handleReady} />
            ) : (
              <CustomGLTFModelLoadGate url={customModel.url} onMeshReady={handleReady} />
            )
          ) : null}
        </Suspense>
      </ErrorBoundary>
    );
  }

  return (
    <group>
      {garment === 'tshirt' && (
        <group ref={(node) => {
          if (node && !collectedRef.current && !meshCollectScheduled.current) {
            meshCollectScheduled.current = true;
            setTimeout(() => {
              const meshes: THREE.Mesh[] = [];
              node.traverse(c => { if (c instanceof THREE.Mesh) meshes.push(c) });
              if (meshes.length > 0) handleReady(meshes);
              meshCollectScheduled.current = false;
            }, 100);
          }
        }}>
          <RoundedBox castShadow receiveShadow position={[0, 0, 0]} args={[1.2, 1.8, 0.3]} radius={0.05} smoothness={4}><meshStandardMaterial attach="material" color={color} roughness={roughness} metalness={metalness} /></RoundedBox>
          <RoundedBox castShadow receiveShadow position={[-0.8, 0.6, 0]} rotation={[0, 0, 0.4]} args={[0.6, 0.5, 0.3]} radius={0.05} smoothness={4}><meshStandardMaterial attach="material" color={color} roughness={roughness} metalness={metalness} /></RoundedBox>
          <RoundedBox castShadow receiveShadow position={[0.8, 0.6, 0]} rotation={[0, 0, -0.4]} args={[0.6, 0.5, 0.3]} radius={0.05} smoothness={4}><meshStandardMaterial attach="material" color={color} roughness={roughness} metalness={metalness} /></RoundedBox>
        </group>
      )}
      {garment === 'hoodie' && (
        <group ref={(node) => {
          if (node && !collectedRef.current && !meshCollectScheduled.current) {
            meshCollectScheduled.current = true;
            setTimeout(() => {
              const meshes: THREE.Mesh[] = [];
              node.traverse(c => { if (c instanceof THREE.Mesh) meshes.push(c) });
              if (meshes.length > 0) handleReady(meshes);
              meshCollectScheduled.current = false;
            }, 100);
          }
        }}>
          <RoundedBox castShadow receiveShadow position={[0, 0, 0]} args={[1.3, 1.8, 0.4]} radius={0.05} smoothness={4}><meshStandardMaterial attach="material" color={color} roughness={roughness} metalness={metalness} /></RoundedBox>
          <RoundedBox castShadow receiveShadow position={[0, 1.1, -0.1]} args={[0.8, 0.6, 0.6]} radius={0.05} smoothness={4}><meshStandardMaterial attach="material" color={color} roughness={roughness} metalness={metalness} /></RoundedBox>
          <RoundedBox castShadow receiveShadow position={[-0.9, 0.5, 0]} rotation={[0, 0, 0.5]} args={[0.7, 0.6, 0.4]} radius={0.05} smoothness={4}><meshStandardMaterial attach="material" color={color} roughness={roughness} metalness={metalness} /></RoundedBox>
          <RoundedBox castShadow receiveShadow position={[0.9, 0.5, 0]} rotation={[0, 0, -0.5]} args={[0.7, 0.6, 0.4]} radius={0.05} smoothness={4}><meshStandardMaterial attach="material" color={color} roughness={roughness} metalness={metalness} /></RoundedBox>
        </group>
      )}
      {garment === 'bomber' && (
        <group ref={(node) => {
          if (node && !collectedRef.current && !meshCollectScheduled.current) {
            meshCollectScheduled.current = true;
            setTimeout(() => {
              const meshes: THREE.Mesh[] = [];
              node.traverse(c => { if (c instanceof THREE.Mesh) meshes.push(c) });
              if (meshes.length > 0) handleReady(meshes);
              meshCollectScheduled.current = false;
            }, 100);
          }
        }}>
          <RoundedBox castShadow receiveShadow position={[0, 0, 0]} args={[1.4, 1.7, 0.5]} radius={0.05} smoothness={4}><meshStandardMaterial attach="material" color={color} roughness={roughness} metalness={metalness} /></RoundedBox>
          <RoundedBox castShadow receiveShadow position={[-1.0, 0.4, 0]} rotation={[0, 0, 0.4]} args={[0.7, 0.6, 0.5]} radius={0.05} smoothness={4}><meshStandardMaterial attach="material" color={color} roughness={roughness} metalness={metalness} /></RoundedBox>
          <RoundedBox castShadow receiveShadow position={[1.0, 0.4, 0]} rotation={[0, 0, -0.4]} args={[0.7, 0.6, 0.5]} radius={0.05} smoothness={4}><meshStandardMaterial attach="material" color={color} roughness={roughness} metalness={metalness} /></RoundedBox>
        </group>
      )}
    </group>
  );
};

const GarmentPlaceholder = () => {
  const { color, roughness, metalness, exportTrigger, customModel, garment, decals } = useStore();
  const groupRef = useRef<THREE.Group>(null);
  const libraryItemId = useStore(s => s.activeId);

  const meshCollectorRef = useRef<THREE.Mesh[]>([]);

  const handleMeshReady = useCallback((nodes: THREE.Mesh[]) => {
    meshCollectorRef.current = nodes;
  }, []);

  useEffect(() => {
    meshCollectorRef.current = [];
  }, [customModel, garment]);

  useEffect(() => {
    if (exportTrigger > 0 && groupRef.current) {
      const exporter = new GLTFExporter();
      exporter.parse(
        groupRef.current,
        (gltf) => {
          const blob = new Blob([gltf as ArrayBuffer], { type: 'model/gltf-binary' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.style.display = 'none';
          link.href = url;
          link.download = '3ddd_garment.glb';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        },
        (error) => {
          console.error('An error happened during parsing', error);
        },
        { binary: true }
      );
    }
  }, [exportTrigger]);

  
  const activeId = libraryItemId;

  // Assign canvas textures to meshes that match garment panel definitions
  useEffect(() => {
    if (!activeId) return;
    const panelDefs = GARMENT_PANELS[activeId];
    if (!panelDefs) return;
    const meshes = meshCollectorRef.current;
    if (meshes.length === 0) return;

    const allPanelKeys = Object.values(panelDefs) as PanelDef[];
    for (const def of allPanelKeys) {
      const panelId = def.meshName.split('_').pop()?.toLowerCase() as PanelId || 'front';
      for (const mesh of meshes) {
        if (!mesh.material) continue;
        const material = mesh.material.clone() as THREE.MeshStandardMaterial;
        material.color.set('#ffffff');
        material.map = getPanelTexture(activeId, panelId, def);
        mesh.material = material;
      }
    }
  }, [activeId, customModel, garment]);

  useEffect(() => {
    if (!activeId) return;
    const def = GARMENT_PANELS[activeId]?.front;
    if (!def) return;
    const activeDecals = useStore.getState().decals;
    const activeColor = useStore.getState().color;
    repaintPanel(activeId, 'front', activeColor, activeDecals);
  }, [decals, color, activeId]);

  return (
    <group ref={groupRef} position={[0, 0, 0]}>
      <GarmentMeshes onMeshReady={handleMeshReady} />
    </group>
  );
};


const PostProcessingContainer = () => {
  const { ditheringEnabled, ditheringGridSize, ditheringPixelRatio, ditheringGrayscale } = useStore();
  
  if (!ditheringEnabled) return null;
  
  return (
    <EffectComposer>
      <DitheringPass 
        gridSize={ditheringGridSize} 
        pixelSizeRatio={ditheringPixelRatio} 
        grayscaleOnly={ditheringGrayscale} 
      />
    </EffectComposer>
  );
};

export default function Viewer3D() {
  const { isGarmentLocked, setIsGarmentLocked } = useStore();

  return (
    <div className={`w-full h-full absolute inset-0 z-0 bg-[#fcfcfc] ${isGarmentLocked ? 'touch-none' : ''}`}>
      <Canvas shadows camera={{ position: [0, 0, 5], fov: 45 }}>
        <color attach="background" args={['#fcfcfc']} />
        <ambientLight intensity={0.3} />
        <directionalLight castShadow position={[2, 4, 3]} intensity={1.5} shadow-mapSize={[1024, 1024]} shadow-bias={-0.001}>
          <orthographicCamera attach="shadow-camera" args={[-2, 2, 2, -2, 0.1, 10]} />
        </directionalLight>
        
        <GarmentPlaceholder />
        
        <ContactShadows position={[0, -0.75, 0]} opacity={0.6} scale={8} blur={1.8} far={1} />
        {/* Environment fetches a remote HDR; if that fetch fails it THROWS
            (Suspense only handles suspension, not errors). Without this
            ErrorBoundary the throw would unmount the entire Canvas subtree,
            blanking the viewport. With it, a failed/blocked HDR just means
            no env reflections — the garment still renders. */}
        <ErrorBoundary fallback={null}>
          <Suspense fallback={null}>
            <Environment preset="studio" />
          </Suspense>
        </ErrorBoundary>
        
        <OrbitControls 
          enabled={!isGarmentLocked}
          enablePan={false} 
          minDistance={2} 
          maxDistance={8} 
          autoRotate={!isGarmentLocked} 
          autoRotateSpeed={0.5} 
        />
        <PostProcessingContainer />

      </Canvas>
      <button 
        className={`absolute bottom-6 left-1/2 -translate-x-1/2 z-10 p-3 rounded-full shadow-lg border transition-colors ${isGarmentLocked ? 'bg-black text-white border-black' : 'bg-white text-black border-gray-200'}`}
        onClick={() => setIsGarmentLocked(!isGarmentLocked)}
      >
        {isGarmentLocked ? <Lock size={20} /> : <Unlock size={20} />}
      </button>
    </div>
  );
}
