import { EffectComposer } from '@react-three/postprocessing';
import { DitheringEffect } from './DitheringEffect';
import React, { forwardRef, useMemo, useRef, useEffect, Suspense, useCallback, useState } from 'react';
import { Canvas, useThree, useLoader, ThreeEvent, useFrame, createPortal } from '@react-three/fiber';
import { Html, OrbitControls, Environment, ContactShadows, Decal, useTexture, RoundedBox, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { useStore } from './store';
import { ErrorBoundary } from './ErrorBoundary';
import { useGesture } from '@use-gesture/react';
import { Lock, Unlock } from 'lucide-react';

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

// three's Mesh raycast fills hit.face.normal (OBJECT space); hit.normal is
// not guaranteed across three versions. Normalize access in one place and
// always return a WORLD-space normal.
export const getWorldNormal = (hit: THREE.Intersection): THREE.Vector3 => {
  if (hit.face?.normal) return hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
  if ((hit as any).normal) return (hit as any).normal.clone().transformDirection(hit.object.matrixWorld);
  return new THREE.Vector3(0, 0, 1);
};

// drei's <Decal> zeroes the target mesh's world matrix before building
// DecalGeometry, so decal position/rotation must be expressed in the mesh's
// LOCAL space. These helpers convert a world-space point / orientation into
// the target mesh's local space (see AUDIT_AND_FIXES.md in the 20.17 repo:
// storing world-space hit.point put the projector box off the surface ->
// empty geometry -> invisible decal on any mesh with a world transform).
export const worldPointToMeshLocal = (mesh: THREE.Object3D, worldPoint: THREE.Vector3): THREE.Vector3 =>
  mesh.worldToLocal(worldPoint.clone());

export const worldQuatToMeshLocalEuler = (mesh: THREE.Object3D, worldQ: THREE.Quaternion): THREE.Euler => {
  const invMeshQ = mesh.getWorldQuaternion(new THREE.Quaternion()).invert();
  return new THREE.Euler().setFromQuaternion(invMeshQ.multiply(worldQ.clone()));
};

const InvalidModelFallback = () => {
  const setCustomModel = useStore(s => s.setCustomModel);
  useEffect(() => {
    setCustomModel(null);
  }, [setCustomModel]);
  return null;
};

const CustomGLTFModel = ({ url, onMeshReady }: { url: string, onMeshReady: (m: THREE.Mesh[]) => void }) => {
  const { color, roughness, metalness, materialsConfig, initMaterialsConfig, setAvailableMaterials } = useStore();
  const { scene } = useGLTF(url);
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

    
    // Collect meshes and hand them to the parent for decal raycasting.
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




const DecalItem = ({ decal, meshRef, isFirst }: { decal: any, meshRef: React.RefObject<THREE.Mesh>, isFirst: boolean }) => {
  const texture = useTexture(decal.url) as unknown as THREE.Texture;
  texture.colorSpace = THREE.SRGBColorSpace;
  const isGarmentLocked = useStore(state => state.isGarmentLocked);
  const activeDecalId = useStore(state => state.activeDecalId);
  const setActiveDecalId = useStore(state => state.setActiveDecalId);
  const updateDecal = useStore(state => state.updateDecal);
  const roughness = useStore(state => state.roughness);
  const metalness = useStore(state => state.metalness);
  const isActive = activeDecalId === decal.id;
  const mesh = meshRef.current;
  const decalRef = useRef<THREE.Mesh>(null);
  const proxyRef = useRef<THREE.Mesh>(null);
  const dragging = useRef(false);

  // Projector depth: the old code hardcoded 1.5, which is far deeper than a
  // garment wall (~0.2-0.4 units). That let the decal's projector box swallow
  // the back face of the mesh too, painting the image onto the inside of the
  // opposite wall - which is what showed up as a mirrored image on the back
  // and as clipping through the garment. Instead, derive the depth from the
  // target mesh's own bounding box so the projector box stays inside a single
  // wall of the garment, with sane floor/ceiling clamps.
  const decalDepth = useMemo(() => {
    if (decal.depth) return decal.depth;
    if (!mesh) return 0.3;
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    const bb = mesh.geometry.boundingBox;
    if (!bb) return 0.3;
    const size = new THREE.Vector3();
    bb.getSize(size);
    const smallestDim = Math.min(size.x, size.y, size.z) || 0.3;
    return Math.min(0.6, Math.max(0.08, smallestDim * 0.6));
  }, [mesh, decal.depth]);

  const targetPos = useRef(new THREE.Vector3(decal.position[0], decal.position[1], decal.position[2]));
  const targetRot = useRef(new THREE.Euler(decal.rotation[0], decal.rotation[1], decal.rotation[2]));

  useEffect(() => {
    targetPos.current.set(decal.position[0], decal.position[1], decal.position[2]);
    targetRot.current.set(decal.rotation[0], decal.rotation[1], decal.rotation[2]);
    if (!isActive && proxyRef.current) {
      proxyRef.current.position.set(decal.position[0], decal.position[1], decal.position[2]);
      proxyRef.current.rotation.set(decal.rotation[0], decal.rotation[1], decal.rotation[2]);
    }
  }, [decal.position, decal.rotation, isActive]);

  useFrame((state, delta) => {
    if (proxyRef.current && isActive && isGarmentLocked) {
      proxyRef.current.position.lerp(targetPos.current, 0.25);
      const currentQ = new THREE.Quaternion().setFromEuler(proxyRef.current.rotation);
      const targetQ = new THREE.Quaternion().setFromEuler(targetRot.current);
      currentQ.slerp(targetQ, 0.25);
      proxyRef.current.rotation.setFromQuaternion(currentQ);
    }
  });

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (!useStore.getState().isGarmentLocked) return;
    e.stopPropagation();
    setActiveDecalId(decal.id);
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    dragging.current = true;
  };

  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!useStore.getState().isGarmentLocked || !dragging.current || !mesh) return;
    e.stopPropagation();
    const raycaster = new THREE.Raycaster();
    raycaster.ray.copy(e.ray);
    const intersects = raycaster.intersectObject(mesh, false);
    if (intersects.length > 0) {
      const intersection = intersects[0];
      if (intersection.face) {
        const n = intersection.face.normal.clone();
        n.transformDirection(mesh.matrixWorld);
        // Decal position/rotation live in the mesh's LOCAL space (drei's
        // <Decal> zeroes the mesh's world matrix while building
        // DecalGeometry), so convert the world-space drag hit to local
        // before storing it - otherwise dragging a decal on a transformed
        // mesh made it jump off the surface.
        const nudged = intersection.point.clone().addScaledVector(n, 0.004);
        targetPos.current.copy(mesh.worldToLocal(nudged));
        const worldQ = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
        const invMeshQ = mesh.getWorldQuaternion(new THREE.Quaternion()).invert();
        targetRot.current.setFromQuaternion(invMeshQ.multiply(worldQ));
      }
    }
  };

  const handlePointerUp = useCallback((e?: any) => {
    if (!useStore.getState().isGarmentLocked) return;
    if (!dragging.current) return;
    dragging.current = false;
    
    if (isFirst) {
      const wp = targetPos.current.clone();
      const we = targetRot.current.clone();
      
      updateDecal(decal.id, {
        position: [wp.x, wp.y, wp.z],
        rotation: [we.x, we.y, we.z]
      });
    }
  }, [decal.id, updateDecal, isFirst]);

  const handleDoubleClick = (e: ThreeEvent<PointerEvent>) => {
    if (!useStore.getState().isGarmentLocked) return;
    e.stopPropagation();
    useStore.getState().removeDecal(decal.id);
  };

  if (!mesh) return null;

  return (
    <group>
      <Decal receiveShadow castShadow
        ref={decalRef}
        mesh={meshRef}
        position={[decal.position[0], decal.position[1], decal.position[2]]}
        rotation={[decal.rotation[0], decal.rotation[1], decal.rotation[2]]}
        scale={[decal.scale[0], decal.scale[1], decalDepth]}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onDoubleClick={handleDoubleClick}
      >
        <meshStandardMaterial
          map={texture}
          transparent
          alphaTest={0.01}
          depthTest={true}
          depthWrite={false}
          roughness={roughness}
          metalness={metalness}
          polygonOffset
          polygonOffsetFactor={-4}
          polygonOffsetUnits={-4}
        />
      </Decal>
      
      {!(isActive && dragging.current) && (
        <mesh ref={proxyRef} visible={false}>
          <boxGeometry args={[decal.scale[0], decal.scale[1], decalDepth]} />
          <meshBasicMaterial wireframe />
        </mesh>
      )}
    </group>
  );
};

class DecalErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: Error | null}> {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error("Decal Error:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <Html center position={[0, 1, 0]}>
          <div style={{ background: 'red', color: 'white', padding: '10px', width: '200px' }}>
            DECAL ERROR: {this.state.error?.message}
          </div>
        </Html>
      );
    }
    return this.props.children;
  }
}

const DecalsContainer = ({ meshesRef }: { meshesRef: React.RefObject<THREE.Mesh[]> }) => {
  const decals = useStore(state => state.decals);
  return (
    <>
      {decals.map((decal) => {
        const meshes = meshesRef.current;
        if (!meshes || meshes.length === 0) return null;
        // Each decal is bound to exactly one mesh (the one it was actually
        // placed/hit on). Previously this doubled as a nested loop over every
        // mesh in the garment, so a single decal on the torso would also get
        // stamped onto both sleeves (and any other mesh) at the same
        // position/rotation. See AUDIT_AND_FIXES.md, item 1.
        const meshIndex = Math.min(decal.meshIndex ?? 0, meshes.length - 1);
        const mesh = meshes[meshIndex];
        if (!mesh) return null;
        return (
          <DecalErrorBoundary key={decal.id}>
            <Suspense fallback={null}>
              <DecalItem decal={decal} meshRef={{ current: mesh }} isFirst={true} />
            </Suspense>
          </DecalErrorBoundary>
        );
      })}
    </>
  );
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
      <ErrorBoundary fallback={<InvalidModelFallback />}>
        <Suspense fallback={null}>
          {customModel.url ? (
            customModel.type === 'obj' ? (
              <CustomOBJModel url={customModel.url} onMeshReady={handleReady} />
            ) : (
              <CustomGLTFModel url={customModel.url} onMeshReady={handleReady} />
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
  const { color, roughness, metalness, exportTrigger, customModel, garment } = useStore();
  const groupRef = useRef<THREE.Group>(null);
  const meshesRef = useRef<THREE.Mesh[]>([]);
  const meshCollectScheduled = useRef(false);
  const [meshesReady, setMeshesReady] = useState(false);

  const handleCustomMeshReady = useCallback((nodes: THREE.Mesh[]) => {
    meshesRef.current = nodes;
    setMeshesReady(true);
  }, []);

  useEffect(() => {
    setMeshesReady(false);
    meshesRef.current = [];
    meshCollectScheduled.current = false;
  }, [customModel, garment]);

  const { controls, camera, gl } = useThree();

  // Measures actual wall thickness at the exact point a decal is being
  // placed by firing a short probe ray back into the mesh from just outside
  // the surface. Using one number derived from the whole garment's bounding
  // box (the previous approach) doesn't work for irregular custom models -
  // it can be far too deep at a thin point (letting the image bleed through
  // to the inside, which showed up as the image appearing "inside" the
  // model or hidden behind the fabric via z-fighting) or too shallow
  // elsewhere. Falls back to a safe default for single-sided/shell meshes
  // that have no measurable back wall.
  const probeWallThickness = (mesh: THREE.Mesh, point: THREE.Vector3, normal: THREE.Vector3): number => {
    try {
      const probeOrigin = point.clone().addScaledVector(normal, 0.5);
      const probeDir = normal.clone().negate();
      const probeRay = new THREE.Raycaster(probeOrigin, probeDir, 0, 2);
      const hits = probeRay.intersectObject(mesh, true);
      if (hits.length >= 2) {
        const thickness = Math.abs(hits[1].distance - hits[0].distance);
        if (thickness > 0.01) return Math.min(0.5, Math.max(0.06, thickness * 0.85));
      }
    } catch (e) { /* fall through to default */ }
    return 0.2;
  };

  // Pushes the placement point a hair off the surface along its normal so
  // the decal projector isn't centered exactly ON the fabric (which, at
  // floating point precision, can land on the wrong side of a thin wall or
  // z-fight with the fabric mesh underneath it).
  const nudgeOutward = (point: THREE.Vector3, normal: THREE.Vector3, eps = 0.004) =>
    point.clone().addScaledVector(normal, eps);

  // If a raycast for decal placement misses entirely (e.g. dropped right at
  // the silhouette edge), fall back to a point actually on the first real
  // mesh's surface - derived from its own bounding box - instead of a fixed
  // [0,0,0.15] that was tuned for the placeholder shape and can miss a
  // custom uploaded model's geometry completely (producing an invisible,
  // empty decal with no error). NOTE: decal transforms are stored in the
  // target mesh's LOCAL space (drei <Decal> zeroes the mesh's world matrix),
  // so this stays in the mesh's local bounding-box space on purpose.
  const getFallbackDecalPlacement = (): { position: [number, number, number]; rotation: [number, number, number]; meshIndex: number } => {
    const mesh = meshesRef.current[0];
    if (!mesh) return { position: [0, 0, 0.15], rotation: [0, 0, 0], meshIndex: 0 };
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    const bb = mesh.geometry.boundingBox;
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    if (bb) { bb.getSize(size); bb.getCenter(center); }
    // Nudge toward the camera-facing side of the mesh's own bounding box
    // rather than assuming a fixed depth.
    const zOffset = (size.z || 0.3) * 0.45;
    return { position: [center.x, center.y, center.z + zOffset], rotation: [0, 0, 0], meshIndex: 0 };
  };

  useEffect(() => {
    const handleAddDecal = (e: any) => {
      const { url, clientX, clientY } = e.detail;
      const x = (clientX / window.innerWidth) * 2 - 1;
      const y = -(clientY / window.innerHeight) * 2 + 1;
      
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(x, y), camera);
      
      const intersects = raycaster.intersectObjects(meshesRef.current, true);
      if (intersects.length > 0) {
        const hit = intersects[0];

        const n = getWorldNormal(hit);
        const meshIndex = Math.max(0, meshesRef.current.indexOf(hit.object as THREE.Mesh));
        const depth = probeWallThickness(hit.object as THREE.Mesh, hit.point, n);
        const placed = nudgeOutward(hit.point, n);

        // drei's <Decal> zeroes the target mesh's world matrix before building
        // DecalGeometry, so position/rotation are interpreted in the mesh's
        // LOCAL space. Convert the world-space raycast hit into local space.
        const localPoint = worldPointToMeshLocal(hit.object, placed);
        const worldQ = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
        const localEuler = worldQuatToMeshLocalEuler(hit.object, worldQ);
        useStore.getState().addDecal(url, [localPoint.x, localPoint.y, localPoint.z], [localEuler.x, localEuler.y, localEuler.z], 'front', meshIndex, depth);

      } else {
        const fallback = getFallbackDecalPlacement();
        useStore.getState().addDecal(url, fallback.position, fallback.rotation, 'front', fallback.meshIndex);
      }
    };
    
    const handleAddDecalPlacement = (e: any) => {
      const { url, placement } = e.detail;
      let origin = new THREE.Vector3();
      let direction = new THREE.Vector3();
      let euler = new THREE.Euler();

      if (placement === 'front') {
        origin.set(0, 0, 5);
        direction.set(0, 0, -1);
        euler.set(0, 0, 0);
      } else if (placement === 'back') {
        origin.set(0, 0, -5);
        direction.set(0, 0, 1);
        euler.set(0, Math.PI, 0);
      } else if (placement === 'left_arm') {
        origin.set(-5, 0.4, 0);
        direction.set(1, 0, 0);
        euler.set(0, -Math.PI / 2, 0);
      } else if (placement === 'right_arm') {
        origin.set(5, 0.4, 0);
        direction.set(-1, 0, 0);
        euler.set(0, Math.PI / 2, 0);
      }

      const raycaster = new THREE.Raycaster(origin, direction);
      const intersects = raycaster.intersectObjects(meshesRef.current, true);
      
      if (intersects.length > 0) {
        const hit = intersects[0];
        const meshIndex = Math.max(0, meshesRef.current.indexOf(hit.object as THREE.Mesh));
        const normal = direction.clone().negate();
        const depth = probeWallThickness(hit.object as THREE.Mesh, hit.point, normal);
        const placed = nudgeOutward(hit.point, normal);
        // Convert the world-space hit point & placement rotation into the
        // target mesh's LOCAL space (see handleAddDecal for why).
        const localPoint = worldPointToMeshLocal(hit.object, placed);
        const worldQ = new THREE.Quaternion().setFromEuler(euler);
        const localEuler = worldQuatToMeshLocalEuler(hit.object, worldQ);
        useStore.getState().addDecal(url, [localPoint.x, localPoint.y, localPoint.z], [localEuler.x, localEuler.y, localEuler.z], placement, meshIndex, depth);
      } else {
        const fallback = getFallbackDecalPlacement();
        useStore.getState().addDecal(url, fallback.position, [euler.x, euler.y, euler.z], placement, fallback.meshIndex);
      }
    };

    window.addEventListener('add-decal-3d', handleAddDecal);
    window.addEventListener('add-decal-placement', handleAddDecalPlacement);
    return () => {
      window.removeEventListener('add-decal-3d', handleAddDecal);
      window.removeEventListener('add-decal-placement', handleAddDecalPlacement);
    };
  }, [camera, meshesRef]);
  

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

  
  return (
    <group 
      ref={groupRef} 
      position={[0, 0, 0]}
      onPointerDown={(e) => {
        // Deselect the active decal when tapping empty garment space.
        // Guard the intersections access - it can be empty when the event
        // bubbles from a miss, and [0].object would throw.
        if (useStore.getState().isGarmentLocked && e.intersections.length > 0) {
           useStore.getState().setActiveDecalId(null);
        }
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        if (controls) {
          (controls as any).reset();
        }
      }}
    >
      <GarmentMeshes onMeshReady={handleCustomMeshReady} />
      {meshesReady && meshesRef.current.length > 0 && <DecalsContainer meshesRef={meshesRef} />}
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
  const { isGarmentLocked, setIsGarmentLocked, activeDecalId, decals, updateDecal } = useStore();

  const bind = useGesture({
    onPinch: ({ delta: [dd], event }) => {
      const state = useStore.getState();
      if (!state.isGarmentLocked || !state.activeDecalId) return;
      if (event && (event as any).preventDefault) (event as any).preventDefault();
      const decal = state.decals.find(d => d.id === state.activeDecalId);
      if (!decal) return;
      // dd is delta distance
      const factor = 1 + dd / 150;
      const newScale = decal.scale.map(s => Math.max(0.05, s * factor)) as [number, number, number];
      state.updateDecal(state.activeDecalId, { scale: newScale });
    },
    onWheel: ({ delta: [, dy], event }) => {
      const state = useStore.getState();
      if (!state.isGarmentLocked || !state.activeDecalId) return;
      const decal = state.decals.find(d => d.id === state.activeDecalId);
      if (!decal) return;
      const factor = dy > 0 ? 0.95 : 1.05;
      const newScale = decal.scale.map(s => Math.max(0.05, s * factor)) as [number, number, number];
      state.updateDecal(state.activeDecalId, { scale: newScale });
    }
  }) as any;

  return (
    <div {...bind()} className={`w-full h-full absolute inset-0 z-0 bg-[#fcfcfc] ${isGarmentLocked ? 'touch-none' : ''}`}>
      <Canvas shadows camera={{ position: [0, 0, 5], fov: 45 }}>
        <color attach="background" args={['#fcfcfc']} />
        <ambientLight intensity={0.3} />
        <directionalLight castShadow position={[2, 4, 3]} intensity={1.5} shadow-mapSize={[1024, 1024]} shadow-bias={-0.001}>
          <orthographicCamera attach="shadow-camera" args={[-2, 2, 2, -2, 0.1, 10]} />
        </directionalLight>
        
        <GarmentPlaceholder />
        
        <ContactShadows position={[0, -0.75, 0]} opacity={0.6} scale={8} blur={1.8} far={1} />
        <Environment preset="studio" />
        
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
