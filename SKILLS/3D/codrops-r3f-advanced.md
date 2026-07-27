---
name: codrops-r3f-advanced
description: >
  React Three Fiber advanced patterns — water simulation shader, stylized
  procedural terrain, 3D interactive cards with GLB, staggered 3D grid animations
  with perspective, and particle effects on scroll with GSAP.
---

# React Three Fiber Advanced (Codrops Pattern Library)

## When to Use

- "r3f" / "react three fiber"
- "stylized water"
- "water simulation"
- "3d cards"
- "interactive 3d"
- "staggered 3d grid"
- "discord wave" / "wave fall"
- "glb card scene"

---

## Key Libraries

```
React Three Fiber:     https://unpkg.com/@react-three/fiber@8/dist/react-three-fiber.min.js
React Three Drei:      https://unpkg.com/@react-three/drei@9/index.js
three-stdlib:          https://unpkg.com/three-stdlib@2.28/three-stdlib.module.js
zustand:               https://unpkg.com/zustand@4/dist/zustand.development.mjs
maath:                 https://unpkg.com/maath@0.10/dist/maath.umd.js  (math helpers)
```

---

## Pattern 1 — Stylized Water Effect

**Source demo:** Stylized Water Effects with React Three Fiber

**File: `Water.jsx`**

```jsx
import { useFrame } from '@react-three/fiber';
import { create } from 'zustand';
import * as THREE from 'three';
import { shaderMaterial } from '@react-three/drei';

export const useStore = create((set) => ({ waterLevel: 0.9 }));

// Water stripe shaderMaterial (vertex = move up/down)
const WaterStripeMaterial = shaderMaterial(
  { uTime: 0 },
  `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  `
    uniform float uTime;
    void main() {
      float stripe = step(0.4, sin(vUv.y * 30.0 - uTime * 2.0));
      gl_FragColor = vec4(0.0, 0.5, 1.0, stripe * 0.6);
    }
  `
);

export default function Water() {
  const glsl = useFrame(({ clock }) => {
    return { uTime: clock.elapsedTime };
  });
  return (
    <mesh rotation-x={-Math.PI / 2} position-y={0.9}>
      <planeGeometry args={[256, 256]} />
      <waterStripeMaterial uTime={glsl.uTime} />
    </mesh>
  );
}
```

---

## Pattern 2 — Interactive 3D Cards with GLB

**Source demo:** Interactive 3D Cards in Webflow with Three.js, Studio Null

Interactive camera orbit controls in a small card-sized canvas. Each card embeds a GLB model URL.

```jsx
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

function CardScene3D({ modelPath }) {
  const mountRef = useRef();
  const sceneRef = useRef();

  useEffect(() => {
    const gl = mountRef.current.getContext('webgl2');
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(2);
    const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
    camera.position.set(0, 0, 2.5);

    const controls = new OrbitControls(camera, mountRef.current);
    controls.enableZoom = false;

    new GLTFLoader().load(modelPath, (gltf) => {
      // Replace default Blender material with MeshStandard
      const nodes = gltf.scene.children;
      nodes.forEach(node => {
        if (node.isMesh) {
          node.material = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.35,
            metalness: 0.45
          });
        }
      });
      sceneRef.current.add(gltf.scene);
    });

    // Animate camera smoothly on mount
    gsap.to(camera.position, { z: 2.5, duration: 1.2 });

    // ← cleanup
  }, [modelPath]);
}
```

---

## Pattern 3 — Staggered 3D Grid (R3F + GSAP)

3D grid with perspective tint, offset items, scroll-triggered fly-in:

```jsx
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

function Staggered3DGrid() {
  const gridRef = useRef();

  useEffect(() => {
    gsap.from(gridRef.current.children, {
      opacity: 0,
      rotationX: 90,
      stagger: 0.12,
      duration: 0.9,
      ease: "power3.out",
      scrollTrigger: { trigger: gridRef, start: "top 80%" }
    });
  }, []);
}
```

Export as `MeshReflectorMaterial` – found in `drei` module. It reflects with a mirrored cascade pattern.

---

## Pro Tips

| Pitfall | Fix |
|---|---|
| `glb` material dark/environment—white skybox | Provide `scene.environment` via `pmremGenerator` rather than relying on default; aim for `scene.background = new THREE.Color('#050505')` |
| zustand store not updating → re-renders missed | Call `useStore.getState()` at module load, or read inside render via `const waterLevel = useStore(s => s.waterLevel)` only — do not mutate state synchronously |
| Perf drops with `MeshReflectorMaterial` | `high-resolution false` + `blur={[1000,300]}` typical defaults; you may not inherit `glsl`
| SSR issues → "window is not defined" | Wrap container ref in `useEffect(() => …, [])` to prevent SSR mount |
| Leaking dynamic buffers | on cleanup, call `ref.current.getContext('webgl2')` to force-control staging |


---

## References

- `codrops-threejs-basic` (non-React Three.js patterns), `codrops-canvas-webgl` (raw WebGL), `codrops-shader-programming` (GLSL fragment/vertex), `codrops-water-triangles` — glTF references Studio

## Additional Reference Blocks (28 patterns)


```javascript
// Import required libraries
import * as THREE from &#039;three&#039;;
import { OrbitControls } from &#039;three/addons/controls/OrbitControls.js&#039;;
import { GLTFLoader } from &#039;three/addons/loaders/GLTFLoader.js&#039;;
import gsap from &#039;gsap&#039;;

/**
 * This function initializes a Three.js scene inside a given container
 * and loads a .glb model into it.
 */
function createScene(containerSelector, glbPath) {
  const container = document.querySelector(containerSelector);

  // 1. Create a scene
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x202020); // dark background

  // 2. Set up the camera with perspective
  const camera = new THREE.PerspectiveCamera(
    45, // Field of view
    container.clientWidth / container.clientHeight, // Aspect ratio
    0.1, // Near clipping plane
    100  // Far clipping plane
  );
  camera.position.set(2, 0, 0); // Offset to the side for better viewing

  // 3. Create a renderer and append it to the container
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  container.appendChild(renderer.domElement);

  // 4. Add lighting
  const light = new THREE.DirectionalLight(0xffffff, 4);
  light.position.set(30, -10, 20);
  scene.add(light);

  const ambientLight = new THREE.AmbientLight(0x404040); // soft light
  scene.add(ambientLight);

  // 5. Set up OrbitControls to allow rotation
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableZoom = false; // no zooming
  controls.enablePan = false;  // no dragging
  controls.minPolarAngle = Math.PI / 2; // lock vertical angle
  controls.maxPolarAngle = Math.PI / 2;
  controls.enableDamping = true; // smooth movement

  // 6. Load the GLB model
  const loader = new GLTFLoader();
  loader.load(
    glbPath,
    (gltf) => {
      scene.add(gltf.scene); // Add model to the scene
    },
    (xhr) => {
      console.log(`${containerSelector}: ${(xhr.loaded / xhr.total) * 100}% loaded`);
    },
    (error) => {
      console.error(`Error loading ${glbPath}`, error);
    }
  );

  // 7. Make it responsive
  window.addEventListener(&quot;resize&quot;, () => {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  });

  // 8. Animate the scene
  function animate() {
    requestAnimationFrame(animate);
    controls.update(); // updates rotation smoothly
    renderer.render(scene, camera);
  }

  animate(); // start the animation loop
}

// 9. Initialize scenes for each card (replace with your URLs)
createScene(&quot;.div&quot;,  &quot;https://yourdomain.com/models/yourmodel.glb&quot;);
createScene(&quot;.div2&quot;, &quot;https://yourdomain.com/models/yourmodel2.glb&quot;);
createScene(&quot;.div3&quot;, &quot;https://yourdomain.com/models/yourmodel3.glb&quot;);
```

```text
<script type=&quot;module&quot;>
```

```jsx
const { nodes } = useGLTF(&quot;/models/terrain.glb&quot;)

return (
  <group dispose={null}>
    <mesh 
      geometry={nodes.plane.geometry} 
      material={nodes.plane.material} // We&#039;ll replace this default Blender material later
      receiveShadow
    />

    <mesh
      rotation-x={-Math.PI / 2}
      position={[0, -0.01, 0]} // Moved it down to prevent the visual glitch from plane collision
      material={nodes.plane.material} // Using the same material for a seamless look
      receiveShadow
    >
      <planeGeometry args={[256, 256]} />
    </mesh>
  </group>
)
```

```jsx
import { create } from &quot;zustand&quot;
export const useStore = create((set) => ({
  waterLevel: 0.9,
}))
```

```jsx
const waterLevel = useStore((state) => state.waterLevel)

return (
  <mesh rotation-x={-Math.PI / 2} position-y={waterLevel}>
    <planeGeometry args={[256, 256]} />
    <meshStandardMaterial color=&quot;lightblue&quot; />
  </mesh>
)
```

```jsx
// Interactive color parameters
const { SAND_BASE_COLOR, GRASS_BASE_COLOR, UNDERWATER_BASE_COLOR } =
  useControls(&quot;Terrain&quot;, {
    SAND_BASE_COLOR: { value: &quot;#ff9900&quot;, label: &quot;Sand&quot; },
    GRASS_BASE_COLOR: { value: &quot;#85a02b&quot;, label: &quot;Grass&quot; },
    UNDERWATER_BASE_COLOR: { value: &quot;#118a4f&quot;, label: &quot;Underwater&quot; }
  })

// Convert color hex values to Three.js Color objects
const GRASS_COLOR = useMemo(
  () => new THREE.Color(GRASS_BASE_COLOR),
  [GRASS_BASE_COLOR]
)
const UNDERWATER_COLOR = useMemo(
  () => new THREE.Color(UNDERWATER_BASE_COLOR),
  [UNDERWATER_BASE_COLOR]
)

// Material
const materialRef = useRef()

// Update shader uniforms whenever control values change
useEffect(() => {
  if (!materialRef.current) return

  materialRef.current.uniforms.uGrassColor.value = GRASS_COLOR
  materialRef.current.uniforms.uUnderwaterColor.value = UNDERWATER_COLOR
  materialRef.current.uniforms.uWaterLevel.value = waterLevel
}, [
  GRASS_COLOR,
  UNDERWATER_COLOR,
  waterLevel
])
```

```jsx
<mesh geometry={nodes.plane.geometry} receiveShadow>
  <CustomShaderMaterial
    ref={materialRef}
    baseMaterial={THREE.MeshStandardMaterial}
    color={SAND_BASE_COLOR}
    vertexShader={vertexShader}
    fragmentShader={fragmentShader}
    uniforms={{
      uTime: { value: 0 },
      uGrassColor: { value: GRASS_COLOR },
      uUnderwaterColor: { value: UNDERWATER_COLOR },
      uWaterLevel: { value: waterLevel }
    }}
  />
</mesh>
```

```jsx
<mesh
  rotation-x={-Math.PI / 2}
  position={[0, -0.01, 0]} 
  receiveShadow
>
  <planeGeometry args={[256, 256]} />
  <meshStandardMaterial color={UNDERWATER_BASE_COLOR} />
</mesh>
```

```cpp
// Vertex Shader

varying vec3 csm_vPositionW;
void main() {
  csm_vPositionW = (modelMatrix * vec4(position, 1.0)).xyz;
}
```

```cpp
// Fragment Shader

varying vec3 csm_vPositionW;
uniform float uWaterLevel;
uniform vec3 uGrassColor;
uniform vec3 uUnderwaterColor;


void main() {
   
    // Set the current color as the base color
    vec3 baseColor = csm_DiffuseColor.rgb;


    // Darken the base color at lower Y values to simulate wet sand
    float heightFactor = smoothstep(uWaterLevel + 1.0, uWaterLevel, csm_vPositionW.y);
    baseColor = mix(baseColor, baseColor * 0.5, heightFactor);
   
    // Blend underwater color with base planeMesh to add depth to the ocean bottom
    float oceanFactor = smoothstep(min(uWaterLevel - 0.4, 0.2), 0.0, csm_vPositionW.y);
    baseColor = mix(baseColor, uUnderwaterColor, oceanFactor);


    // Add grass to the higher areas of the terrain
    float grassFactor = smoothstep(uWaterLevel + 0.8, max(uWaterLevel + 1.6, 3.0), csm_vPositionW.y);
    baseColor = mix(baseColor, uGrassColor, grassFactor);
   
    // Output the final color
    csm_DiffuseColor = vec4(baseColor, 1.0);  
}
```

```cpp
varying vec3 csm_vPositionW;

uniform float uWaterLevel;
uniform vec3 uMossColor;

void main() {
    
    // Set the current color as the base color
    vec3 baseColor = csm_DiffuseColor.rgb;

    // Paint lower Y with a different color to simulate moss
    float mossFactor = smoothstep(uWaterLevel + 0.3, uWaterLevel - 0.05, csm_vPositionW.y);
    baseColor = mix(baseColor, uMossColor, mossFactor);

    // Output the final color
    csm_DiffuseColor = vec4(baseColor, 1.0);  
}
```

```jsx
// useStore.js
import { create } from &quot;zustand&quot;

export const useStore = create((set) => ({
  waterLevel: 0.9,
  waveSpeed: 1.2,
  waveAmplitude: 0.1
}))
```

```jsx
// Global states
const waterLevel = useStore((state) => state.waterLevel)
const waveSpeed = useStore((state) => state.waveSpeed)
const waveAmplitude = useStore((state) => state.waveAmplitude)

// Interactive water parameters
const {
  COLOR_BASE_NEAR, WATER_LEVEL, WAVE_SPEED, WAVE_AMPLITUDE
} = useControls(&quot;Water&quot;, {
  COLOR_BASE_NEAR: { value: &quot;#00fccd&quot;, label: &quot;Near&quot; },
  WATER_LEVEL: { value: waterLevel, min: 0.5, max: 5.0, step: 0.1, label: &quot;Water Level&quot; },
  WAVE_SPEED: { value: waveSpeed, min: 0.5, max: 2.0, step: 0.1, label: &quot;Wave Speed&quot; },
  WAVE_AMPLITUDE: { value: waveAmplitude, min: 0.05, max: 0.5, step: 0.05, label: &quot;Wave Amplitude&quot; },
})
```

```jsx
<CustomShaderMaterial
  ref={materialRef}
  baseMaterial={THREE.MeshStandardMaterial}
  vertexShader={vertexShader}
  fragmentShader={fragmentShader}
  uniforms={{
    uTime: { value: 0 },
    uWaveSpeed: { value: WAVE_SPEED },
    uWaveAmplitude: { value: WAVE_AMPLITUDE }
  }}
  color={COLOR_BASE_NEAR}
  transparent
  opacity={0.4}
/>
```

```jsx
// Update shader uniforms whenever control values change
useEffect(() => {
  if (!materialRef.current) return
  materialRef.current.uniforms.uWaveSpeed.value = WAVE_SPEED
  materialRef.current.uniforms.uWaveAmplitude.value = WAVE_AMPLITUDE
}, [WAVE_SPEED, WAVE_AMPLITUDE])

// Update shader time
useFrame(({ clock }) => {
  if (!materialRef.current) return
  materialRef.current.uniforms.uTime.value = clock.getElapsedTime()
})
```

```jsx
// Update global states
useEffect(() => {
  useStore.setState(() => ({
    waterLevel: WATER_LEVEL,
    waveSpeed: WAVE_SPEED,
    waveAmplitude: WAVE_AMPLITUDE
  }))
}, [WAVE_SPEED, WAVE_AMPLITUDE, WATER_LEVEL])
```

```cpp
varying vec2 csm_vUv;

uniform float uTime;
uniform float uWaveSpeed;
uniform float uWaveAmplitude;

void main() {
  // Send the uv coordinates to fragmentShader
  csm_vUv = uv;

  // Modify the y position based on sine function, oscillating up and down over time
  float sineOffset = sin(uTime * uWaveSpeed) * uWaveAmplitude;

  // Apply the sine offset to the y component of the position
  vec3 modifiedPosition = position;
  modifiedPosition.z += sineOffset; // z used as y because element is rotated
 
  csm_Position = modifiedPosition;
}
```

```cpp
varying vec2 csm_vUv;

uniform float uTime;
uniform vec3 uColorNear;
uniform vec3 uColorFar;
uniform float uTextureSize;

vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }

float snoise(vec2 v) {
    ...
    // The Perlin noise code is a bit lengthy, so I’ve omitted it here. 
    // You can find the full code by the wizard Patricio Gonzalez Vivo at
    // https://thebookofshaders.com/edit.php#11/lava-lamp.frag
}
```

```cpp
// Generate noise for the base texture
float noiseBase = snoise(csm_vUv);

// Normalize the values
vec3 colorWaves = noiseBase * 0.5 + 0.5;

// Apply smoothstep for wave thresholding
vec3 waveEffect = 1.0 - (smoothstep(0.53, 0.532, colorWaves) + smoothstep(0.5, 0.49, colorWaves));
```

```cpp
void main() {

    // Set the current color as the base color.
    vec3 finalColor = csm_FragColor.rgb;
    
    // Set an initial alpha value
    vec3 alpha = vec3(1.0);

    // Invert texture size
    float textureSize = 100.0 - uTextureSize;

    // Generate noise for the base texture
    float noiseBase = snoise(csm_vUv * (textureSize * 2.8) + sin(uTime * 0.3));
    noiseBase = noiseBase * 0.5 + 0.5;
    vec3 colorBase = vec3(noiseBase);

    // Calculate foam effect using smoothstep and thresholding
    vec3 foam = smoothstep(0.08, 0.001, colorBase);
    foam = step(0.5, foam);  // binary step to create foam effect

    // Generate additional noise for waves
    float noiseWaves = snoise(csm_vUv * textureSize + sin(uTime * -0.1));
    noiseWaves = noiseWaves * 0.5 + 0.5;
    vec3 colorWaves = vec3(noiseWaves);

    // Apply smoothstep for wave thresholding
    // Threshold for waves oscillates between 0.6 and 0.61
    float threshold = 0.6 + 0.01 * sin(uTime * 2.0); 
    vec3 waveEffect = 1.0 - (smoothstep(threshold + 0.03, threshold + 0.032, colorWaves) + 
                             smoothstep(threshold, threshold - 0.01, colorWaves));

    // Binary step to increase the wave pattern thickness
    waveEffect = step(0.5, waveEffect);

    // Combine wave and foam effects
    vec3 combinedEffect = min(waveEffect + foam, 1.0);

    // Applying a gradient based on distance
    float vignette = length(csm_vUv - 0.5) * 1.5;
    vec3 baseEffect = smoothstep(0.1, 0.3, vec3(vignette));
    vec3 baseColor = mix(finalColor, uColorFar, baseEffect);

    combinedEffect = min(waveEffect + foam, 1.0);
    combinedEffect = mix(combinedEffect, vec3(0.0), baseEffect);

    // Sample foam to maintain constant alpha of 1.0
    vec3 foamEffect = mix(foam, vec3(0.0), baseEffect);
    
    // Set the final color
    finalColor = (1.0 - combinedEffect) * baseColor + combinedEffect;
    
    // Managing the alpha based on the distance
    alpha = mix(vec3(0.2), vec3(1.0), foamEffect);
    alpha = mix(alpha, vec3(1.0), vignette + 0.5);

    // Output the final color
    csm_FragColor = vec4(finalColor, alpha);
    
}
```

```cpp
// We use uTime to make the Perlin noise texture move
float noiseWaves = snoise(csm_vUv * textureSize + sin(uTime * -0.1));

...

// We can also use uTime to make the pattern shape dynamic
float threshold = 0.6 + 0.01 * sin(uTime * 2.0); 
vec3 waveEffect = 1.0 - (smoothstep(threshold + 0.03, threshold + 0.032, colorWaves) + 
                         smoothstep(threshold, threshold - 0.01, colorWaves));
```

```cpp
import { create } from &quot;zustand&quot;

export const useStore = create((set) => ({
  waterLevel: 0.9,
  waveSpeed: 1.2,
  waveAmplitude: 0.1,
  foamDepth: 0.05,
}))
```

```cpp
// Foam Effect
// Get the y position based on sine function, oscillating up and down over time
float sineOffset = sin(uTime * uWaveSpeed) * uWaveAmplitude;

// The current dynamic water height
float currentWaterHeight = uWaterLevel + sineOffset;
```

```cpp
float stripe = smoothstep(currentWaterHeight + 0.01, currentWaterHeight - 0.01, csm_vPositionW.y)
               - smoothstep(currentWaterHeight + uFoamDepth + 0.01, currentWaterHeight + uFoamDepth - 0.01, csm_vPositionW.y);

vec3 stripeColor = vec3(1.0, 1.0, 1.0); // White stripe

// Apply the foam strip to baseColor    
vec3 finalColor = mix(baseColor - stripe, stripeColor, stripe);

// Output the final color
csm_DiffuseColor = vec4(finalColor, 1.0);
```

```jsx
<group position={[0, 0, 0]}>
  <PositionalAudio
    autoplay
    loop
    url=&quot;/sounds/waves.mp3&quot;
    distance={50}
  />
</group>

<group position={[-65, 35, -55]}>
  <PositionalAudio
    autoplay
    loop
    url=&quot;/sounds/birds.mp3&quot;
    distance={30}
  />
</group>
```

```jsx
import { create } from &quot;zustand&quot;

export const useStore = create((set) => ({
  ...
  audioEnabled: false,

  setAudioEnabled: (enabled) => set(() => ({ audioEnabled: enabled })),
  setReady: (ready) => set(() => ({ ready: ready }))
}))
```

```jsx
const audioEnabled = useStore((state) => state.audioEnabled)
const setAudioEnabled = useStore((state) => state.setAudioEnabled)

const handleSound = () => {
  setAudioEnabled(!audioEnabled)
}

return <button onClick={() => handleSound()}>Enable sound</button>
```

```jsx
const audioEnabled = useStore((state) => state.audioEnabled)

return (
  audioEnabled && (
    <>
      <group position={[0, 0, 0]}>
        <PositionalAudio
          autoplay
          loop
          url=&quot;/sounds/waves.mp3&quot;
          distance={50}
        />
      </group>

      <group position={[-65, 35, -55]}>
        <PositionalAudio
          autoplay
          loop
          url=&quot;/sounds/birds.mp3&quot;
          distance={30}
        />
      </group>
    </>
  )
)
```