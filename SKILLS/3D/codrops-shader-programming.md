---
name: codrops-shader-programming
description: >
  GLSL and TSL shader patterns from real Codrops demos: ordered dithering shader
  (Bayer matrix + GPU pass), OGL ASCII shader (glyph-mapped GLSL character
  generator), and WebGPU/WebGL Gommage dissolution (MSDF text dissolve + particle).
  Covers fragment shader scaffolding, buffer imports, post-processing passes, and
  shader uniform state drivers.
---

# Shader Programming & Visual Effects (Codrops Pattern Library)

## When to Use

- "glsl shader"
- "dithering shader"
- "bordered"
- "bayer matrix"
- "ogl ascii"
- "webgpu" / "TSL" / "Three Shading Language"
- "postprocessing effect"
- "dissolve shader"
- "perlin noise shader"
- "raymarching"
- "fragment shader visual effect"

---

## Key Libraries

```
OGL (fragment/vertex shaders):  https://unpkg.com/ogl@0.0.89/dist/ogl.module.js
Three.js (WebGPU/R3F):          https://unpkg.com/three@0.162/build/three.module.js
React Three Fiber:              https://unpkg.com/@react-three/fiber@8/dist/react-three-fiber.min.js
@react-three/postprocessing:    https://unpkg.com/@react-three/postprocessing@2/index.js
```

---

## Pattern 1 — Dithering Shader (Bayer Matrix + Post-Processing Pass)

**Source demo:** Dithering Shader, circa 2025

Two-pass pattern: (1) Bayer threshold lookup, (2) ordered-dither pixel division applied to an input buffer.

```glsl
// Bayer lookup — 4×4 threshold table
const mat4 bayer = mat4(
   0.0/17.0, 8.0/17.0, 2.0/17.0, 10.0/17.0,
   12.0/17.0, 4.0/17.0, 14.0/17.0, 6.0/17.0,
   3.0/17.0, 11.0/17.0, 1.0/17.0, 9.0/17.0,
   15.0/17.0, 7.0/17.0, 13.0/17.0, 5.0/17.0
);

bool getValue(float brightness, vec2 pos) {
  if (brightness > 16.0/17.0) return false;
  if (brightness < 1.0/17.0) return true;
  vec2 pixel = floor(mod(pos.xy / gridSize, 4.0));
  int x = int(pixel.x);
  int y = int(pixel.y);
  return brightness < bayer[x][y];
}
```

Apply this bool as a **color switch** (black/white or 2-color dither):

```glsl
float pixelSize = gridSize * pixelSizeRatio;
vec2 pixelatedUV = floor(fragCoord / pixelSize) * pixelSize;

vec4 baseColor = texture2D(inputBuffer, pixelatedUV).rgb;
float brightness = dot(baseColor.rgb, vec3(0.299, 0.587, 0.114));
bool dark = getValue(brightness, gl_FragCoord.xy);
```

---

## Pattern 2 — TypeScript Dither Effect Class (R3F)

```typescript
// TS class that conforms to R3F/EffectComposer interface
export class DitheringEffect extends Effect {
  uniforms: Map<string, THREE.Uniform<number | THREE.Vector2>>;

  constructor({
    time = 0,
    resolution = new THREE.Vector2(1, 1),
    gridSize = 4.0,
    luminanceMethod = 0,
    invertColor = false,
    pixelSizeRatio = 1,
    ...
  }) { ... bind uniforms to this.uniforms; }
}
```

**Use in React (declarative):**

```jsx
<Canvas>
  {/* your scene */}
  <EffectComposer>
    <Bloom intensity={0.5} />
    <Dithering pixelSize={2} grayscale />
  </EffectComposer>
</Canvas>
```

---

## Pattern 3 — OGL ASCII Shader

**Source demo:** Creating an ASCII Shader using OGL

Screen → ASCII character matrix by mapping intensity to a character texture.

**Setup OGL:**

```bash
npm init && npm i ogl resolve-lygia tweakpane vite && touch index.html
```

```javascript
// index.html — import from module entry point
import { Camera, Mesh, Plane, Program, Renderer } from "ogl";
import { glsl } from "reactive-glsl";

const renderer = new Renderer();
const gl = renderer.gl;
document.body.appendChild(gl.canvas);

const camera = new Camera(gl, { near: 0.1, far: 100 });
camera.position.set(0, 0, 3);

const geometry = new Plane(gl);
// Vertex shader: pass UV
// Fragment shader: decode GLSL rule heuristics + glyph lookup
const program = new Program(gl, {
  vertex: /* simple two-tri quad vs */,
  fragment: /* lookup intensity → char | indices → composite */
});
const mesh = new Mesh(gl, { geometry, program });
```

**ASCII lookup in the fragment** (key GLSL concept):

- Pass a `fontTexture` uniform, a 2D texture containing ASCII glyph characters
- `uv` → pixel coordinate → grid row/col
- `intensity = texture2D(fontTexture, cellUV).a`
- `threshold = someThresholdTable[index]`
- `inColor = (intensity > threshold) ? black : white`

Step 1: noise shader → feed result into ASCII shader as `inputBuffer` texture.

---

## Pro Tips

| Issue | Fix |
|---|---|
| Shader variable bounds drift on mobile (WebGL vs WebGPU) | use `ifdef GL_ES` — `precision mediump float` for WebGL1 |
| `glsl` error `'baseFrequency': reserved keyword name` | rename or wrap in hex string `0.02` (hex code interpretation) |
| Dither wrong colors even though the types match | Invert by `invertColor: true` boolean check; apply alpha after comparison |
| OGL `import { Camera, Mesh, Plane, Program, Renderer } from "ogl"` fails | Use `"ogl"` dist package — confirm that WebGL2 context is supported before loading
| WebGPU Gommage dissolves text incorrectly | Ensure glyph is bounding-box tightly — i.e. `GlyphLayout` before `CSG` — return after `load` resolves |

---

## References

- `codrops-canvas-webgl` (WebGL2 raw pipelines), `codrops-shader_programming` (advanced OGL pipelines), `codrops-threejs-basic` (Three.js scene foundation)

## Additional Reference Blocks (85 patterns)


```clike
bool getValue(float brightness, vec2 pos) {

// Early return for extreme values
if (brightness > 16.0 / 17.0) return false;
if (brightness < 1.0 / 17.0) return true;

// Calculate position in 4x4 dither matrix
vec2 pixel = floor(mod(pos.xy / gridSize, 4.0));
int x = int(pixel.x);
int y = int(pixel.y);

// 4x4 Bayer matrix threshold map
// ... threshold comparisons based on matrix position

}
```

```clike
float pixelSize = gridSize * pixelSizeRatio;
vec2 pixelatedUV = floor(fragCoord / pixelSize) * pixelSize / resolution;
baseColor = texture2D(inputBuffer, pixelatedUV).rgb;
```

```typescript
export class DitheringEffect extends Effect {
  uniforms: Map<string, THREE.Uniform<number | THREE.Vector2>>;

  constructor({
    time = 0,
    resolution = new THREE.Vector2(1, 1),
    gridSize = 4.0,
    luminanceMethod = 0,
    invertColor = false,
    pixelSizeRatio = 1,
    grayscaleOnly = false
  }: DitheringEffectOptions = {}) {
    const uniforms = new Map<string, THREE.Uniform<number | THREE.Vector2>>([
      [&quot;time&quot;, new THREE.Uniform(time)],
      [&quot;resolution&quot;, new THREE.Uniform(resolution)],
      [&quot;gridSize&quot;, new THREE.Uniform(gridSize)],
      [&quot;luminanceMethod&quot;, new THREE.Uniform(luminanceMethod)],
      [&quot;invertColor&quot;, new THREE.Uniform(invertColor ? 1 : 0)],
      [&quot;ditheringEnabled&quot;, new THREE.Uniform(1)],
      [&quot;pixelSizeRatio&quot;, new THREE.Uniform(pixelSizeRatio)],
      [&quot;grayscaleOnly&quot;, new THREE.Uniform(grayscaleOnly ? 1 : 0)]
    ]);

    super(&quot;DitheringEffect&quot;, ditheringShader, { uniforms });
    this.uniforms = uniforms;
  }

 ...

}
```

```tsx
<Canvas>
  {/* ... your scene ... */}
  <EffectComposer>
    <Bloom intensity={0.5} />
    <Dithering pixelSize={2} grayscale />
  </EffectComposer>
</Canvas>
```

```bash
npm init
npm i ogl resolve-lygia tweakpane vite
touch index.html
```

```json
&quot;scripts&quot;: {
	&quot;dev&quot;: &quot;vite&quot;
}
```

```html
<!DOCTYPE html>
<html lang=&quot;en&quot;>

<head>
  <meta charset=&quot;UTF-8&quot;>
  <meta name=&quot;viewport&quot; content=&quot;width=device-width, initial-scale=1.0&quot;>
  <title>Document</title>
  <style>
    body {
      margin: 0;
    }
    
    canvas {
	    display: block;
    }
  </style>
</head>

<body>
  <script type=&quot;module&quot; src=&quot;./main.mjs&quot;></script>
</body>
</html>
```

```javascript
import {
	Camera,
	Mesh,
	Plane,
	Program,
	Renderer,
} from &quot;ogl&quot;;
```

```javascript
const renderer = new Renderer();
const gl = renderer.gl;
document.body.appendChild(gl.canvas);
```

```javascript
const camera = new Camera(gl, { near: 0.1, far: 100 });
camera.position.set(0, 0, 3);
```

```javascript
function resize() {
	renderer.setSize(window.innerWidth, window.innerHeight);
	camera.perspective({ aspect: gl.canvas.width / gl.canvas.height });
}

window.addEventListener(&quot;resize&quot;, resize);
resize();
```

```javascript
const program = new Program(gl, {
	vertex: `#version 300 es

in vec2 uv;
in vec2 position;

out vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.f, 1.f);
}`,
	fragment: `#version 300 es

precision mediump float;

uniform float uTime;

in vec2 vUv;

out vec4 fragColor;

void main() {
  float hue = sin(uTime) * 0.5f + 0.5f;

  vec3 color = vec3(hue, 0.0f, hue);

  fragColor = vec4(color, 1.0f);
}
`,
	uniforms: {
		uTime: { value: 0 },
	},
});
```

```javascript
const geometry = new Plane(gl, {
  width: 2,
  height: 2,
});
```

```javascript
const mesh = new Mesh(gl, { geometry, program });
```

```javascript
function update(t) {
	requestAnimationFrame(update);
	
	const elapsedTime = t * 0.001;
	program.uniforms.uTime.value = elapsedTime;

	renderer.render({ scene: mesh, camera })
}
requestAnimationFrame(update);
```

```javascript
import fragment from &quot;./fragment.glsl?raw&quot;;
import vertex from &quot;./vertex.glsl?raw&quot;;
```

```javascript
const program = new Program(gl, {
	vertex,
	fragment,
	uniforms: {
		uTime: { value: 0 },
	},
});
```

```diff
const program = new Program(gl, {
	vertex,
	fragment,
	uniforms: {
		uTime: { value: 0 },
+		uFrequency: { value: 5.0 },
+		uBrightness: { value: 0.5 },
+		uSpeed: { value: 0.75 },
+		uValue: { value: 1 },
	},
});
```

```clike
#version 300 es

precision mediump float;

uniform float uFrequency;
uniform float uTime;
uniform float uSpeed;
uniform float uValue;

in vec2 vUv;

out vec4 fragColor;

#include &quot;lygia/generative/cnoise.glsl&quot;

vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0f, 2.0f / 3.0f, 1.0f / 3.0f, 3.0f);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0f - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0f, 1.0f), c.y);
}

void main() {
  float hue = abs(cnoise(vec3(vUv * uFrequency, uTime * uSpeed)));

  vec3 rainbowColor = hsv2rgb(vec3(hue, 1.0f, uValue));

  fragColor = vec4(rainbowColor, 1.0f);
}
```

```javascript
import { resolveLygia } from &quot;resolve-lygia&quot;;

// rest of code

const program = new Program(gl, {
	fragment: resolveLygia(fragment),
	// rest of options
});
```

```clike
#version 300 es

in vec2 uv;
in vec2 position;

out vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position, 0., 1.);
}
```

```clike
#version 300 es

precision highp float;

uniform vec2 uResolution;
uniform sampler2D uTexture;

out vec4 fragColor;

float character(int n, vec2 p) {
  p = floor(p * vec2(-4.0f, 4.0f) + 2.5f);
  if(clamp(p.x, 0.0f, 4.0f) == p.x) {
    if(clamp(p.y, 0.0f, 4.0f) == p.y) {
      int a = int(round(p.x) + 5.0f * round(p.y));
      if(((n >> a) & 1) == 1)
        return 1.0f;
    }
  }
  return 0.0f;
}

void main() {
  vec2 pix = gl_FragCoord.xy;
  vec3 col = texture(uTexture, floor(pix / 16.0f) * 16.0f / uResolution.xy).rgb;

  float gray = 0.3f * col.r + 0.59f * col.g + 0.11f * col.b;

  int n = 4096;

  if(gray > 0.2f)
    n = 65600;    // :
  if(gray > 0.3f)
    n = 163153;   // *
  if(gray > 0.4f)
    n = 15255086; // o 
  if(gray > 0.5f)
    n = 13121101; // &
  if(gray > 0.6f)
    n = 15252014; // 8
  if(gray > 0.7f)
    n = 13195790; // @
  if(gray > 0.8f)
    n = 11512810; // #

  vec2 p = mod(pix / 8.0f, 2.0f) - vec2(1.0f);
	col = col * character(n, p);
	fragColor = vec4(col, 1.0f);
}
```

```javascript
import asciiVertex from &#039;./ascii-vertex.glsl?raw&#039;;
import asciiFragment from &#039;./ascii-fragment.glsl?raw&#039;;

const asciiShaderProgram = new Program(gl, {
	vertex: asciiVertex,
	fragment: asciiFragment,
});

const asciiMesh = new Mesh(gl, { geometry, program: asciiShaderProgram }); 

// Rest of code
function update(t) {
	// existing rendering logic
	
	const width = gl.canvas.width;
	const height = gl.canvas.height;

	asciiShaderProgram.uniforms.uResolution = {
		value: [width, height],
	};

	renderer.render({ scene: asciiMesh, camera });
}
```

```diff
import {
	// other imports
	RenderTarget,
} from &quot;ogl&quot;;

// Renderer setup

const renderTarget = new RenderTarget(gl);

const asciiShaderProgram = new Program(gl, {
	vertex: asciiVertex,
	fragment: asciiFragment,
+	uniforms: {
+		uTexture: {
+			value: renderTarget.texture,
+		},
+	},
});

function update(t) {
	// existing code
	
-	renderer.render({ scene: mesh, camera });
+	renderer.render({ scene: mesh, camera, target: renderTarget });

	// existing code
}
```

```javascript
import { Pane } from &#039;tweakpane&#039;;

// Just before the update loop
const pane = new Pane();

pane.addBinding(program.uniforms.uFrequency, &quot;value&quot;, {
	min: 0,
	max: 10,
	label: &quot;Frequency&quot;,
});

pane.addBinding(program.uniforms.uSpeed, &quot;value&quot;, {
	min: 0,
	max: 2,
	label: &quot;Speed&quot;,
});

pane.addBinding(program.uniforms.uValue, &quot;value&quot;, {
	min: 0,
	max: 1,
	label: &quot;Lightness&quot;,
});
```

```text
console.log(&quot;hello world&quot;)
```

```text
Fragment shader is not compiled
```

```text
Error: 0:6: &#039;in&#039; : syntax error
```

```text
vec2 color = vec3(hue, 0.0f, hue);
```

```bash
npm install -D vite
npm i three@0.181.0
```

```html
//index.html

<script type=&quot;module&quot; src=&quot;/src/experience.js&quot;></script>
```

```css
// base.css

canvas {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}
```

```javascript
//experience.js

import * as THREE from &quot;three/webgpu&quot;;

export class Experience {

  #threejs = null;
  #scene = null;
  #camera = null;
  #cube = null;

  constructor() {}

  async initialize(container) {
    await this.#setupProject(container);
    window.addEventListener(&quot;resize&quot;,  this.#onWindowResize_.bind(this), false);
    this.#raf();
  }

  async #setupProject(container) {
    this.#threejs = new THREE.WebGPURenderer({ antialias: true });
    await this.#threejs.init();

    this.#threejs.shadowMap.enabled = false;
    this.#threejs.toneMapping = THREE.ACESFilmicToneMapping;
    this.#threejs.setClearColor(0x111111, 1);
    this.#threejs.setSize(window.innerWidth, window.innerHeight);
    this.#threejs.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(this.#threejs.domElement);

    // Camera Setup !
    const fov = 45;
    const aspect = window.innerWidth / window.innerHeight;
    const near = 0.1;
    const far = 25;
    this.#camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
    this.#camera.position.set(0, 0, 5);
    this.#scene = new THREE.Scene();

    this.createCube();
  }

  createCube() {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    this.#cube = new THREE.Mesh(geometry, material);
    this.#scene.add(this.#cube);
  }

  #onWindowResize_() {
    this.#camera.aspect = window.innerWidth / window.innerHeight;
    this.#camera.updateProjectionMatrix();
    this.#threejs.setSize(window.innerWidth, window.innerHeight);
  }


  #render() {
    this.#threejs.render(this.#scene, this.#camera);
  }


  #raf() {
    requestAnimationFrame(t => {
      this.#cube.rotation.x += 0.001;
      this.#cube.rotation.y += 0.001;
      this.#render();
      this.#raf();
    });
  }
}

new Experience().initialize(document.querySelector(&quot;#canvas-container&quot;));
```

```text
msdf-bmfont Cinzel-Regular.ttf \
-f json \
-o Cinzel.png \
--font-size 64 \
--distance-range 16 \
--texture-padding 8 \
--border 2 \
--smart-size
```

```bash
npm i three-msdf-text-utils@^1.2.1
```

```javascript
//msdfText.js

import * as THREE from &quot;three/webgpu&quot;;
import { MSDFTextGeometry, MSDFTextNodeMaterial } from &quot;three-msdf-text-utils&quot;;

export default class MSDFText {
constructor() {
}

async initialize(text = &quot;WebGPU Gommage Effect&quot;, position = new THREE.Vector3(0, 0, 0)) {
  // Load font data
  const response = await fetch(&quot;/fonts/Cinzel/Cinzel.json&quot;);
  const fontData = await response.json();

  // Load font atlas
  const textureLoader = new THREE.TextureLoader();
  const fontAtlasTexture = await textureLoader.loadAsync(&quot;/fonts/Cinzel/Cinzel.png&quot;);
  fontAtlasTexture.colorSpace = THREE.NoColorSpace;
  fontAtlasTexture.minFilter = THREE.LinearFilter;
  fontAtlasTexture.magFilter = THREE.LinearFilter;
  fontAtlasTexture.wrapS = THREE.ClampToEdgeWrapping;
  fontAtlasTexture.wrapT = THREE.ClampToEdgeWrapping;
  fontAtlasTexture.generateMipmaps = false;

  // Create text geometry
  const textGeometry = new MSDFTextGeometry({
      text,
      font: fontData,
      width: 1000,
      align: &quot;center&quot;,
  });

  const textMaterial = new MSDFTextNodeMaterial({
      map: fontAtlasTexture,
  });
  // Adjust to remove visual artifacts
  textMaterial.alphaTest = 0.1;
  const mesh = new THREE.Mesh(textGeometry, textMaterial);

  // With this we make the height of lineHeight 0.3 world units
  const targetLineHeight = 0.3;
  const lineHeightPx = fontData.common.lineHeight;
  let textScale = targetLineHeight / lineHeightPx;

  mesh.scale.set(textScale, textScale, textScale);
  const meshOffset = -(textGeometry.layout.width / 2) * textScale;
  mesh.position.set(position.x + meshOffset, position.y, position.z);
  mesh.rotation.x = Math.PI;
  return mesh;

  }
}
```

```javascript
//experience.js

...
async #setupProject(container) {
  ...
  const MSDFTextEntity = new MSDFText();
  const msdfText = await MSDFTextEntity.initialize();
  this.#scene.add(msdfText);
}
...
```

```javascript
//experience.js
...  
#onWindowResize_() {
  const HORIZONTAL_FOV_TARGET = THREE.MathUtils.degToRad(45);
  this.#camera.aspect = window.innerWidth / window.innerHeight;
  const verticalFov = 2 * Math.atan(Math.tan(HORIZONTAL_FOV_TARGET / 2) / this.#camera.aspect);
  this.#camera.fov = THREE.MathUtils.radToDeg(verticalFov);
  this.#camera.updateProjectionMatrix();
  this.#threejs.setSize(window.innerWidth, window.innerHeight);
}
```

```javascript
//experience.js

...
async #setupProject(container) {
  ...
  this.#onWindowResize_();
  this.#scene = new THREE.Scene();
  ...
}
...
```

```javascript
//gommageOrchestrator.js

import * as THREE from &quot;three/webgpu&quot;;
import MSDFText from &quot;./msdfText.js&quot;;
export default class GommageOrchestrator {
  constructor() {
  }

  async initialize(scene) {
      const MSDFTextEntity = new MSDFText();
      const msdfText = await MSDFTextEntity.initialize(&quot;WebGPU Gommage Effect&quot;, new THREE.Vector3(0, 0, 0));
      scene.add(msdfText);
  }
}
```

```javascript
//experience.js

...
async #setupProject(container) {
  ...
  // const MSDFTextEntity = new MSDFText();
  // const msdfText = await MSDFTextEntity.initialize();
  // this.#scene.add(msdfText);
  const gommageOrchestratorEntity = new GommageOrchestrator();
  await gommageOrchestratorEntity.initialize(this.#scene)
}
...
```

```javascript
//msdfText.js

...
async initialize(text = &quot;WebGPU Gommage Effect&quot;, position = new THREE.Vector3(0, 0, 0)) {
  ...
  const perlinTexture = await textureLoader.loadAsync(&quot;/textures/perlin.webp&quot;);
  perlinTexture.colorSpace = THREE.NoColorSpace;
  perlinTexture.minFilter = THREE.LinearFilter;
  perlinTexture.magFilter = THREE.LinearFilter;
  perlinTexture.wrapS = THREE.RepeatWrapping;
  perlinTexture.wrapT = THREE.RepeatWrapping;
  perlinTexture.generateMipmaps = false;
  
  // Create text geometry
  ...
```

```javascript
//msdfText.js
 
...
async initialize(text = &quot;WebGPU Gommage Effect&quot;, position = new THREE.Vector3(0, 0, 0)) {
    ...
    const textMaterial = this.createTextMaterial(fontAtlasTexture, perlinTexture)
    ...
  }
...
createTextMaterial(fontAtlasTexture, perlinTexture) {
    const textMaterial = new MSDFTextNodeMaterial({
        map: fontAtlasTexture,
    });

    return textMaterial;
}
...
```

```javascript
//msdfText.js

...
createTextMaterial(fontAtlasTexture, perlinTexture) {
    const textMaterial = new MSDFTextNodeMaterial({
        map: fontAtlasTexture,
    });

    const glyphUv = attribute(&quot;glyphUv&quot;, &quot;vec2&quot;);

    const perlinTextureNode = texture(perlinTexture, glyphUv);
    const boostedPerlin = pow(perlinTextureNode, 4);

    textMaterial.colorNode = boostedPerlin;

    return textMaterial;
}
...
```

```javascript
// debug.js

import { Pane } from &quot;tweakpane&quot;;

export const DEBUG_FOLDERS = {
  MSDF_TEXT: &quot;MSDFText&quot;,
};

class Debug {
  static instance = null;
  static ENABLED = true;

  #pane = null;
  #baseFolder = null;
  #folders = new Map();

  static getInstance() {
      if (Debug.instance === null) {
          Debug.instance = new Debug();
      }
      return Debug.instance;
  }
  constructor() {
    if (Debug.ENABLED) {
      this.#pane = new Pane();
      this.#baseFolder = this.#pane.addFolder({ title: &quot;Debug&quot; });
      this.#baseFolder.expanded = false;
    }
  }
  createNoOpProxy() {
    const handler = {
      get: () => (..._args) => this.createNoOpProxy(),
    };
    return new Proxy({}, handler);
  }

  getFolder(name) {
    if (!Debug.ENABLED) {
      return this.createNoOpProxy();
    }
    const existing = this.#folders.get(name);
    if (existing) {
      return existing;
    }
    const folder = this.#baseFolder.addFolder({ title: name });
    this.#folders.set(name, folder);
    return folder;
  }
}

export default Debug;
```

```javascript
//msdfText.js
...
import Debug, { DEBUG_FOLDERS } from &quot;./debug.js&quot;;
...

createTextMaterial(fontAtlasTexture, perlinTexture) {
  const debugFolder = Debug.getInstance().getFolder(DEBUG_FOLDERS.MSDF_TEXT);

  const textMaterial = new MSDFTextNodeMaterial({
      map: fontAtlasTexture,
      transparent: true,
  });

  const glyphUv = attribute(&quot;glyphUv&quot;, &quot;vec2&quot;);

  const uProgress = uniform(0.0);

  debugFolder.addBinding(uProgress, &quot;value&quot;, {
      min: 0,
      max: 1,
      label: &quot;progress&quot;,
  });
  
  const perlinTextureNode = texture(perlinTexture, glyphUv);
  const boostedPerlin = pow(perlinTextureNode, 2);
  const dissolve = step(uProgress, boostedPerlin);

  textMaterial.colorNode = boostedPerlin;
  const msdfOpacity = textMaterial.opacityNode;
  textMaterial.opacityNode = msdfOpacity.mul(dissolve);


  return textMaterial;
}
```

```javascript
//msdfText.js
...
createTextMaterial(fontAtlasTexture, perlinTexture) {
  const textMaterial = new MSDFTextNodeMaterial({
      map: fontAtlasTexture,
      transparent: true,
  });

  const glyphUv = attribute(&quot;glyphUv&quot;, &quot;vec2&quot;);
  const center = attribute(&quot;center&quot;, &quot;vec2&quot;);

  const uProgress = uniform(0.0);
  const uCenterScale = uniform(0.05);
  const uGlyphScale  = uniform(0.75);
  
  const customUv = center.mul(uCenterScale).add(glyphUv.mul(uGlyphScale));
  
  const debugFolder = Debug.getInstance().getFolder(DEBUG_FOLDERS.MSDF_TEXT);
  debugFolder.addBinding(uProgress, &quot;value&quot;, {
      min: 0,
      max: 1,
      label: &quot;progress&quot;,
  });
  debugFolder.addBinding(uCenterScale, &quot;value&quot;, {
      min: 0,
      max: 1,
      label: &quot;centerScale&quot;,
  });
  debugFolder.addBinding(uGlyphScale, &quot;value&quot;, {
      min: 0,
      max: 1,
      label: &quot;glyphScale&quot;,
  });

  const perlinTextureNode = texture(perlinTexture, customUv);
  const dissolve = step(uProgress, perlinTextureNode);

  textMaterial.colorNode = perlinTextureNode;
  const msdfOpacity = textMaterial.opacityNode;
  textMaterial.opacityNode = msdfOpacity.mul(dissolve);


  return textMaterial;
}
...
```

```javascript
//gommageOrchestrator.js
...
export default class GommageOrchestrator {
  constructor() {
  }

  async initialize(scene) {
      const uProgress = uniform(0.0);
      const msdfText = await MSDFTextEntity.initialize(&quot;WebGPU Gommage Effect&quot;, new THREE.Vector3(0, 0, 0), uProgress);
      scene.add(msdfText);
  }
}
```

```javascript
//msdfText.js
...
export default class MSDFText {
  constructor() {
  }

  async initialize(text = &quot;WebGPU Gommage Effect&quot;, position = new THREE.Vector3(0, 0, 0), uProgress) {
    ....
    const textMaterial = this.createTextMaterial(fontAtlasTexture, perlinTexture, uProgress);
    ...
  }
  createTextMaterial(fontAtlasTexture, perlinTexture, uProgress) {
    // Delete the uProgress declaration inside the function
    // We can also remove the other debug params
  }
```

```javascript
//gommageOrchestrator.js
...
async initialize(scene) {
    ...
  const GommageButton = debugFolder.addButton({
      title: &quot;GOMMAGE&quot;,
  });
  const ResetButton = debugFolder.addButton({
      title: &quot;RESET&quot;,
  });
  GommageButton.on(&quot;click&quot;, () => {
      this.triggerGommage();
  });
  ResetButton.on(&quot;click&quot;, () => {
      this.resetGommage();
  });
}

triggerGommage() {
    gsap.to(this.#uProgress, {
        value: 1,
        duration: 4,
        ease: &quot;linear&quot;,
    });
}

resetGommage() {
    this.#uProgress.value = 0;
}
```

```javascript
//dustParticles.js

import * as THREE from &quot;three/webgpu&quot;;

export default class DustParticles {
  constructor() { }

  #spawnPos;
  #birthLifeSeedScale;
  #currentDustIndex = 0;
  #dustMesh;
  #MAX_DUST = 100;

  async initialize(perlinTexture, dustParticleTexture) {
    
    const dustGeometry = new THREE.PlaneGeometry(0.02, 0.02);
    this.#spawnPos = new Float32Array(this.#MAX_DUST * 3);
    // Combined 4 attributes into one to not go above the 9 attribute limit for webgpu
    this.#birthLifeSeedScale = new Float32Array(this.#MAX_DUST * 4);
    this.#currentDustIndex = 0;

    dustGeometry.setAttribute(
        &quot;aSpawnPos&quot;,
        new THREE.InstancedBufferAttribute(this.#spawnPos, 3)
    );
    dustGeometry.setAttribute(
        &quot;aBirthLifeSeedScale&quot;,
        new THREE.InstancedBufferAttribute(this.#birthLifeSeedScale, 4)
    );

    const material = this.createDustMaterial(perlinTexture, dustParticleTexture);
    this.#dustMesh = new THREE.InstancedMesh(dustGeometry, material, this.#MAX_DUST);
    return this.#dustMesh;
  }

  createDustMaterial(perlinTexture, dustTexture) {
    const material = new THREE.MeshBasicMaterial({
      map: dustTexture,
      transparent: true,
      depthWrite: false,
      depthTest: false,
    });

    return material;
  }
}
```

```javascript
//gommageOrchestrator.js
...
export default class GommageOrchestrator {
  ...
  async initialize(scene) {
    const { perlinTexture, dustParticleTexture, fontAtlasTexture } = await this.loadTextures();

    const debugFolder = Debug.getInstance().getFolder(DEBUG_FOLDERS.MSDF_TEXT);
    const MSDFTextEntity = new MSDFText();
    // /!\ Pass the perlinTexture as parameters and remove the previous texture load
    const msdfText = await MSDFTextEntity.initialize(&quot;WebGPU Gommage Effect&quot;, new THREE.Vector3(0, 0, 0), this.#uProgress, perlinTexture, fontAtlasTexture);
    scene.add(msdfText);

    const DustParticlesEntity = new DustParticles();
    const dustParticles = await DustParticlesEntity.initialize(perlinTexture, dustParticleTexture);
    scene.add(dustParticles);

    const GommageButton = debugFolder.addButton({
        title: &quot;GOMMAGE&quot;,
    });
    const ResetButton = debugFolder.addButton({
        title: &quot;RESET&quot;,
    });
    GommageButton.on(&quot;click&quot;, () => {
        this.triggerGommage();
    });
    ResetButton.on(&quot;click&quot;, () => {
        this.resetGommage();
    });
  }
  ...
  async loadTextures() {
    const textureLoader = new THREE.TextureLoader();

    const dustParticleTexture = await textureLoader.loadAsync(&quot;/textures/dustParticle.png&quot;);
    dustParticleTexture.colorSpace = THREE.NoColorSpace;
    dustParticleTexture.minFilter = THREE.LinearFilter;
    dustParticleTexture.magFilter = THREE.LinearFilter;
    dustParticleTexture.generateMipmaps = false;

    const perlinTexture = await textureLoader.loadAsync(&quot;/textures/perlin.webp&quot;);
    perlinTexture.colorSpace = THREE.NoColorSpace;
    perlinTexture.minFilter = THREE.LinearFilter;
    perlinTexture.magFilter = THREE.LinearFilter;
    perlinTexture.wrapS = THREE.RepeatWrapping;
    perlinTexture.wrapT = THREE.RepeatWrapping;
    perlinTexture.generateMipmaps = false;

    const fontAtlasTexture = await textureLoader.loadAsync(&quot;/fonts/Cinzel/Cinzel.png&quot;);
    fontAtlasTexture.colorSpace = THREE.NoColorSpace;
    fontAtlasTexture.minFilter = THREE.LinearFilter;
    fontAtlasTexture.magFilter = THREE.LinearFilter;
    fontAtlasTexture.wrapS = THREE.ClampToEdgeWrapping;
    fontAtlasTexture.wrapT = THREE.ClampToEdgeWrapping;
    fontAtlasTexture.generateMipmaps = false;

    return { perlinTexture, dustParticleTexture, fontAtlasTexture };
  }
  ...
}
```

```javascript
//dustParticles.js
...
spawnDust(spawnPos) {
  if (this.#currentDustIndex === this.#MAX_DUST) this.#currentDustIndex = 0;
  const id = this.#currentDustIndex;
  this.#currentDustIndex = this.#currentDustIndex + 1;
  this.#spawnPos[id * 3 + 0] = spawnPos.x;
  this.#spawnPos[id * 3 + 1] = spawnPos.y;
  this.#spawnPos[id * 3 + 2] = spawnPos.z;
  this.#birthLifeSeedScale[id * 4 + 0] = performance.now() * 0.001; // Birth time
  this.#birthLifeSeedScale[id * 4 + 1] = 4; // Life duration
  this.#birthLifeSeedScale[id * 4 + 2] = Math.random(); // Random seed
  this.#birthLifeSeedScale[id * 4 + 3] = Math.random() * 0.5 + 0.5; // Random Scale

  this.#dustMesh.geometry.attributes.aSpawnPos.needsUpdate = true;
  this.#dustMesh.geometry.attributes.aBirthLifeSeedScale.needsUpdate = true;
}
...
```

```javascript
//dustParticles.js
...
createDustMaterial(perlinTexture, dustTexture) {
  const material = new THREE.MeshBasicMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: false,
  });

  const aSpawnPos = attribute(&quot;aSpawnPos&quot;, &quot;vec3&quot;);
  const aBirthLifeSeedScale = attribute(&quot;aBirthLifeSeedScale&quot;, &quot;vec4&quot;);
  const aBirth = aBirthLifeSeedScale.x;
  const aLife = aBirthLifeSeedScale.y;
  const aSeed = aBirthLifeSeedScale.z;
  const aScale = aBirthLifeSeedScale.w;

  const dustSample = texture(dustTexture, uv());


  const uDustColor = uniform(new THREE.Color(&quot;#8A8A8A&quot;));
  material.colorNode = vec4(uDustColor, dustSample.a);
  material.positionNode = aSpawnPos.add(positionLocal);

  return material;
}
...
```

```javascript
//dustParticles.js
...
debugSpawnDust() {
  for (let i = 0; i < 10; i++) {
    this.spawnDust(
      new THREE.Vector3(
        (Math.random() * 2 - 1) * 0.5,
        (Math.random() * 2 - 1) * 0.5,
        0,
      )
    );
  }
}
...
```

```javascript
//gommageOrchestrator.js
...
export default class GommageOrchestrator {
  ...
  async initialize(scene) {
    ...
    const GommageButton = debugFolder.addButton({
        title: &quot;GOMMAGE&quot;,
    });
    const ResetButton = debugFolder.addButton({
        title: &quot;RESET&quot;,
    });
    const DustButton = debugFolder.addButton({
        title: &quot;DUST&quot;,
    });
    GommageButton.on(&quot;click&quot;, () => {
        this.triggerGommage();
    });
    ResetButton.on(&quot;click&quot;, () => {
        this.resetGommage();
    });
    DustButton.on(&quot;click&quot;, () => {
        DustParticlesEntity.debugSpawnDust();
    });
  }
  ...
}
```

```javascript
//dustParticles.js
...
createDustMaterial(perlinTexture, dustTexture) {
  ...
  const uRiseSpeed = uniform(0.1);
  ...
  const windImpulse = uWindDirection.mul(uWindStrength).mul(dustAge);
  const rise = vec3(0.0, dustAge.mul(uRiseSpeed), 0.0);
  const driftMovement = windImpulse.add(rise);
  ...
}
...
```

```javascript
//dustParticles.js
...
createDustMaterial(perlinTexture, dustTexture) {
  ...
  material.positionNode = aSpawnPos
    .add(driftMovement)
    .add(positionLocal.mul(aScale));
  ...
}
...
```

```javascript
//dustParticles.js
...
createDustMaterial(perlinTexture, dustTexture) {
  ...
  const driftMovement = windImpulse.add(rise);
  // 0 at creation, 1 at death
  const lifeInterpolation = clamp(dustAge.div(aLife), 0, 1);
  ...
}
...
```

```javascript
//dustParticles.js
...
createDustMaterial(perlinTexture, dustTexture) {
  ...
  const lifeInterpolation = clamp(dustAge.div(aLife), 0, 1);
  const scaleFactor = smoothstep(float(0), float(0.05), lifeInterpolation);
  const fadingOut = float(1.0).sub(
    smoothstep(float(0.8), float(1.0), lifeInterpolation)
  );
  ...
  material.positionNode = aSpawnPos
    .add(driftMovement)
    .add(positionLocal.mul(aScale.mul(scaleFactor)));
  material.opacityNode = fadingOut;
  ...
}
...
```

```javascript
//dustParticles.js
...
createDustMaterial(perlinTexture, dustTexture) {
  ...
  const uNoiseScale = uniform(30.0);
  const uNoiseSpeed = uniform(0.015);
  ...
  const randomSeed = vec2(aSeed.mul(1230.4), aSeed.mul(5670.8));
  
  const noiseUv = aSpawnPos.xz
    .add(randomSeed)
    .add(uWindDirection.xz.mul(dustAge.mul(uNoiseSpeed)));
  const noiseSample = texture(perlinTexture, noiseUv).x;
  ...
}
...
```

```javascript
//dustParticles.js
...
createDustMaterial(perlinTexture, dustTexture) {
  ...
  const uWobbleAmp = uniform(0.6);
  ...
  const noiseSample = texture(perlinTexture, noiseUv).x;
  const noiseSampleBis = texture(perlinTexture, noiseUv.add(vec2(13.37, 7.77))).x;
  
  // Convert to turbulence values between -1 and 1.
  const turbulenceX = noiseSample.sub(0.5).mul(2);
  const turbulenceY = noiseSampleBis.sub(0.5).mul(2);
  
  const swirl = vec3(clamp(turbulenceX.mul(lifeInterpolation), 0, 1.0), turbulenceY.mul(lifeInterpolation), 0.0).mul(uWobbleAmp);
  ...
}
...
```

```javascript
//dustParticles.js
...    
createDustMaterial(perlinTexture, dustTexture) {
const material = new THREE.MeshBasicMaterial({
  transparent: true,
  depthWrite: false,
  depthTest: false,
});

const aSpawnPos = attribute(&quot;aSpawnPos&quot;, &quot;vec3&quot;);
const aBirthLifeSeedScale = attribute(&quot;aBirthLifeSeedScale&quot;, &quot;vec4&quot;);
const aBirth = aBirthLifeSeedScale.x;
const aLife = aBirthLifeSeedScale.y;
const aSeed = aBirthLifeSeedScale.z;
const aScale = aBirthLifeSeedScale.w;

const uDustColor = uniform(new THREE.Color(&quot;#8A8A8A&quot;));
const uWindDirection = uniform(new THREE.Vector3(-1, 0, 0).normalize());
const uWindStrength = uniform(0.3);
const uRiseSpeed = uniform(0.1); // constant lift
const uNoiseScale = uniform(30.0); // start small (frequency)
const uNoiseSpeed = uniform(0.015); // scroll speed
const uWobbleAmp = uniform(0.6); // vertical wobble amplitude

// Age of the dust in seconds
const dustAge = time.sub(aBirth);
// 0 at creation, 1 at death
const lifeInterpolation = clamp(dustAge.div(aLife), 0, 1);

// Use noise
const randomSeed = vec2(aSeed.mul(123.4), aSeed.mul(567.8));
const noiseUv = aSpawnPos.xz
  .mul(uNoiseScale)
  .add(randomSeed)
  .add(uWindDirection.xz.mul(dustAge.mul(uNoiseSpeed)));

  // Return a value between 0 and 1.
const noiseSample = texture(perlinTexture, noiseUv).x;
const noiseSampleBis = texture(perlinTexture, noiseUv.add(vec2(13.37, 7.77))).x;

// Convert to turbulence values between -1 and 1.
const turbulenceX = noiseSample.sub(0.5).mul(2);
const turbulenceY = noiseSampleBis.sub(0.5).mul(2);

const swirl = vec3(clamp(turbulenceX.mul(lifeInterpolation), 0., 1.0), turbulenceY.mul(lifeInterpolation), 0.0).mul(uWobbleAmp);

const windImpulse = uWindDirection.mul(uWindStrength).mul(dustAge);
const riseFactor = clamp(noiseSample, 0.3, 1.0);
const rise = vec3(0.0, dustAge.mul(uRiseSpeed).mul(riseFactor), 0.0);
const driftMovement = windImpulse.add(rise).add(swirl);

const scaleFactor = smoothstep(float(0), float(0.05), lifeInterpolation);
const fadingOut = float(1.0).sub(
  smoothstep(float(0.8), float(1.0), lifeInterpolation)
);

const dustSample = texture(dustTexture, uv());
material.colorNode = vec4(uDustColor, dustSample.a);
material.positionNode = aSpawnPos
.add(driftMovement)
.add(positionLocal.mul(aScale.mul(scaleFactor)));
material.opacityNode = fadingOut;

return material;
}
...
```

```javascript
//msdfText.js
...
export default class MSDFText {
  ...
  #worldPositionBounds;
  ...
  async initialize(text = &quot;WebGPU Gommage Effect&quot;, position = new THREE.Vector3(0, 0, 0), uProgress, perlinTexture, fontAtlasTexture) {
    ....
    // Compute the world position bounds of our text
    textGeometry.computeBoundingBox();
    mesh.updateWorldMatrix(true, false);
    this.#worldPositionBounds = new THREE.Box3().setFromObject(mesh);
    return mesh;
  }
  ...
}
```

```javascript
//msdfText.js
...
export default class MSDFText {
  ...
  getRandomPositionInMesh() {
      const min = this.#worldPositionBounds.min;
      const max = this.#worldPositionBounds.max;
      const x = Math.random() * (max.x - min.x) + min.x;
      const y = Math.random() * (max.y - min.y) + min.y;
      const z = Math.random() * 0.5;
      return new THREE.Vector3(x, y, z);
    }
  ...
}
```

```javascript
//gommageOrchestrator.js
...
export default class GommageOrchestrator {
  ...
  async initialize(scene) {
  ...
    DustButton.on(&quot;click&quot;, () => {
      const randomPosition = MSDFTextEntity.getRandomPositionInMesh();
      DustParticlesEntity.spawnDust(randomPosition);
    });
  }
  ...
}
```

```javascript
//gommageOrchestrator.js
...
import { GLTFLoader } from &quot;three/addons/loaders/GLTFLoader.js&quot;;
...
export default class GommageOrchestrator {
  ...
  async initialize(scene) {
    const { perlinTexture, dustParticleTexture, fontAtlasTexture } = await this.loadTextures();
    const petalGeometry = await this.loadPetalGeometry();
    ...
  }
  ...
  async loadPetalGeometry() {
    const modelLoader = new GLTFLoader();
    const petalScene = await modelLoader.loadAsync(&quot;/models/petal.glb&quot;);
    const petalMesh = petalScene.scene.getObjectByName(&quot;PetalV2&quot;);
    return petalMesh.geometry;
  }
  ...
}
```

```javascript
//gommageOrchestrator.js
...
export default class GommageOrchestrator {
  ...
  #PetalParticlesEntity = null;
  ...
  async initialize(scene) {
    ...
    this.#PetalParticlesEntity = new PetalParticles();
    const petalParticles = await this.#PetalParticlesEntity.initialize(perlinTexture, petalGeometry);
    scene.add(petalParticles);
    ...
  }
  ...
}
```

```javascript
//petalParticles.js

import * as THREE from &quot;three/webgpu&quot;;
import { attribute, uniform, positionLocal, texture, vec4, uv, time, vec2, vec3, clamp, sin, smoothstep, float } from &quot;three/tsl&quot;;

export default class PetalParticles {
  constructor() { }

  #spawnPos;
  #birthLifeSeedScale;
  #currentPetalIndex = 0;
  #petalMesh;
  #MAX_PETAL = 400;

  async initialize(perlinTexture, petalGeometry) {

    const petalGeo = petalGeometry.clone();
    const scale = 0.15;
    petalGeo.scale(scale, scale, scale);

    this.#spawnPos = new Float32Array(this.#MAX_PETAL * 3);
    // Combined 4 attributes into one to not go above the 9 attribute limit for webgpu
    this.#birthLifeSeedScale = new Float32Array(this.#MAX_PETAL * 4);
    this.#currentPetalIndex = 0;

    petalGeo.setAttribute(
        &quot;aSpawnPos&quot;,
        new THREE.InstancedBufferAttribute(this.#spawnPos, 3)
    );
    petalGeo.setAttribute(
        &quot;aBirthLifeSeedScale&quot;,
        new THREE.InstancedBufferAttribute(this.#birthLifeSeedScale, 4)
    );
    const material = this.createPetalMaterial(perlinTexture);
    this.#petalMesh = new THREE.InstancedMesh(petalGeo, material, this.#MAX_PETAL);
    return this.#petalMesh;
  }

  debugSpawnPetal() {
    for (let i = 0; i < 10; i++) {
      this.spawnPetal(
        new THREE.Vector3(
          (Math.random() * 2 - 1) * 0.5,
          (Math.random() * 2 - 1) * 0.5,
          0,
        )
      );
    }
  }

  spawnPetal(spawnPos) {
    if (this.#currentPetalIndex === this.#MAX_PETAL) this.#currentPetalIndex = 0;
    const id = this.#currentPetalIndex;
    this.#currentPetalIndex = this.#currentPetalIndex + 1;
    this.#spawnPos[id * 3 + 0] = spawnPos.x;
    this.#spawnPos[id * 3 + 1] = spawnPos.y;
    this.#spawnPos[id * 3 + 2] = spawnPos.z;
    this.#birthLifeSeedScale[id * 4 + 0] = performance.now() * 0.001; // Birth time
    this.#birthLifeSeedScale[id * 4 + 1] = 6; // Life time
    this.#birthLifeSeedScale[id * 4 + 2] = Math.random(); // Random seed
    this.#birthLifeSeedScale[id * 4 + 3] = Math.random() * 0.5 + 0.5; // Scale

    this.#petalMesh.geometry.attributes.aSpawnPos.needsUpdate = true;
    this.#petalMesh.geometry.attributes.aBirthLifeSeedScale.needsUpdate = true;
  }

  createPetalMaterial(perlinTexture) {
    const material = new THREE.MeshBasicMaterial({
        transparent: true,
        side: THREE.DoubleSide,
    });

    const aSpawnPos = attribute(&quot;aSpawnPos&quot;, &quot;vec3&quot;);
    const aBirthLifeSeedScale = attribute(&quot;aBirthLifeSeedScale&quot;, &quot;vec4&quot;);
    const aBirth = aBirthLifeSeedScale.x;
    const aLife = aBirthLifeSeedScale.y;
    const aSeed = aBirthLifeSeedScale.z;
    const aScale = aBirthLifeSeedScale.w;

    const uDustColor = uniform(new THREE.Color(&quot;#8A8A8A&quot;));
    const uWindDirection = uniform(new THREE.Vector3(-1, 0, 0).normalize());
    const uWindStrength = uniform(0.3);
    const uRiseSpeed = uniform(0.1); // constant lift
    const uNoiseScale = uniform(30.0); // start small (frequency)
    const uNoiseSpeed = uniform(0.015); // scroll speed
    const uWobbleAmp = uniform(0.6); // vertical wobble amplitude

    // Age of the dust in seconds
    const dustAge = time.sub(aBirth);
    const lifeInterpolation = clamp(dustAge.div(aLife), 0, 1);

    // Use noise
    const randomSeed = vec2(aSeed.mul(123.4), aSeed.mul(567.8));
    const noiseUv = aSpawnPos.xz
        .mul(uNoiseScale)
        .add(randomSeed)
        .add(uWindDirection.xz.mul(dustAge.mul(uNoiseSpeed)));

    // Return a value between 0 and 1.
    const noiseSample = texture(perlinTexture, noiseUv).x;
    const noiseSammpleBis = texture(perlinTexture, noiseUv.add(vec2(13.37, 7.77))).x;

    // Convert to turbulence values between -1 and 1.
    const turbulenceX = noiseSample.sub(0.5).mul(2);
    const turbulenceY = noiseSammpleBis.sub(0.5).mul(2);

    const swirl = vec3(clamp(turbulenceX.mul(lifeInterpolation), 0., 1.0), turbulenceY.mul(lifeInterpolation), 0.0).mul(uWobbleAmp);

    const windImpulse = uWindDirection.mul(uWindStrength).mul(dustAge);

    const riseFactor = clamp(noiseSample, 0.3, 1.0);
    const rise = vec3(0.0, dustAge.mul(uRiseSpeed).mul(riseFactor), 0.0);
    const driftMovement = windImpulse.add(rise).add(swirl);

    // 0 at creation, 1 at death
    const scaleFactor = smoothstep(float(0), float(0.05), lifeInterpolation);
    const fadingOut = float(1.0).sub(
        smoothstep(float(0.8), float(1.0), lifeInterpolation)
    );

    material.colorNode = vec4(uDustColor, 1);
    material.positionNode = aSpawnPos
        .add(driftMovement)
        .add(positionLocal.mul(aScale.mul(scaleFactor)));
    material.opacityNode = fadingOut;

    return material;
  }
}
```

```javascript
//petalParticles.js
...
export default class PetalParticles {
  ...
  createPetalMaterial(perlinTexture) {
    const material = new THREE.MeshBasicNodeMaterial({
      transparent: true,
      side: THREE.DoubleSide,
    });

    function rotX(a) {
      const c = cos(a);
      const s = sin(a);
      const ns = s.mul(-1.0);
      return mat3(1.0, 0.0, 0.0, 0.0, c, ns, 0.0, s, c);
    }
    function rotY(a) {
      const c = cos(a);
      const s = sin(a);
      const ns = s.mul(-1.0);
      return mat3(c, 0.0, s, 0.0, 1.0, 0.0, ns, 0.0, c);
    }

    function rotZ(a) {
      const c = cos(a);
      const s = sin(a);
      const ns = s.mul(-1.0);
      return mat3(c, ns, 0.0, s, c, 0.0, 0.0, 0.0, 1.0);
    }

    const aSpawnPos = attribute(&quot;aSpawnPos&quot;, &quot;vec3&quot;);
    ...
  }
}
```

```javascript
//petalParticles.js
...
export default class PetalParticles {
  ...
  createPetalMaterial(perlinTexture) {
    ...
    const uNoiseSpeed = uniform(0.015);
    const uWobbleAmp = uniform(0.6);

    const uBendAmount = uniform(2.5);
    const uBendSpeed = uniform(1.0);
    ...
  }
}
```

```javascript
const baseX = aSeed.mul(1.13).mod(1.0).mul(TWO_PI);
const baseY = aSeed.mul(2.17).mod(1.0).mul(TWO_PI);
const baseZ = aSeed.mul(3.31).mod(1.0).mul(TWO_PI);
```

```javascript
const spin = dustAge.mul(uSpinSpeed).mul(uSpinAmp);
const rx = baseX.add(spin.mul(0.9).mul(turbulenceX.add(1.5)));
const ry = baseY.add(spin.mul(1.2).mul(turbulenceY.add(1.5)));
const rz = baseZ.add(spin.mul(0.7).mul(turbulenceZ.add(1.5)));
```

```javascript
const R = rotY(ry).mul(rotX(rx)).mul(rotZ(rz));
...
const positionLocalUpdated = R.mul(B.mul(positionLocal));
```

```javascript
//petalParticles.js
...
export default class PetalParticles {
...
createPetalMaterial(perlinTexture) {
  const material = new THREE.MeshBasicNodeMaterial({
    transparent: true,
    side: THREE.DoubleSide,
  });

  function rotX(a) {
    const c = cos(a);
    const s = sin(a);
    const ns = s.mul(-1.0);
    return mat3(1.0, 0.0, 0.0, 0.0, c, ns, 0.0, s, c);
  }
  function rotY(a) {
    const c = cos(a);
    const s = sin(a);
    const ns = s.mul(-1.0);
    return mat3(c, 0.0, s, 0.0, 1.0, 0.0, ns, 0.0, c);
  }

  function rotZ(a) {
    const c = cos(a);
    const s = sin(a);
    const ns = s.mul(-1.0);
    return mat3(c, ns, 0.0, s, c, 0.0, 0.0, 0.0, 1.0);
  }

  const aSpawnPos = attribute(&quot;aSpawnPos&quot;, &quot;vec3&quot;);
  const aBirthLifeSeedScale = attribute(&quot;aBirthLifeSeedScale&quot;, &quot;vec4&quot;);
  const aBirth = aBirthLifeSeedScale.x;
  const aLife = aBirthLifeSeedScale.y;
  const aSeed = aBirthLifeSeedScale.z;
  const aScale = aBirthLifeSeedScale.w;

  const uDustColor = uniform(new THREE.Color(&quot;#8A8A8A&quot;));
  const uWindDirection = uniform(new THREE.Vector3(-1, 0, 0).normalize());
  const uWindStrength = uniform(0.3);
  const uRiseSpeed = uniform(0.1); // constant lift
  const uNoiseScale = uniform(30.0); // start small (frequency)
  const uNoiseSpeed = uniform(0.015); // scroll speed
  const uWobbleAmp = uniform(0.6); // vertical wobble amplitude

  const uBendAmount = uniform(2.5);
  const uBendSpeed = uniform(1.0);
  const uSpinSpeed = uniform(2.0);
  const uSpinAmp = uniform(0.45); // overall rotation amount

  // Age of the dust in seconds
  const dustAge = time.sub(aBirth);
  const lifeInterpolation = clamp(dustAge.div(aLife), 0, 1);

  // Use noise
  const randomSeed = vec2(aSeed.mul(123.4), aSeed.mul(567.8));
  const noiseUv = aSpawnPos.xz
      .mul(uNoiseScale)
      .add(randomSeed)
      .add(uWindDirection.xz.mul(dustAge.mul(uNoiseSpeed)));

  // Return a value between 0 and 1.
  const noiseSample = texture(perlinTexture, noiseUv).x;
  const noiseSammpleBis = texture(perlinTexture, noiseUv.add(vec2(13.37, 7.77))).x;

  // Convert to turbulence values between -1 and 1.
  const turbulenceX = noiseSample.sub(0.5).mul(2);
  const turbulenceY = noiseSammpleBis.sub(0.5).mul(2);
  const turbulenceZ = noiseSample.sub(0.5).mul(2);

  const swirl = vec3(clamp(turbulenceX.mul(lifeInterpolation), 0, 1.0), turbulenceY.mul(lifeInterpolation), 0.0).mul(uWobbleAmp);

  // Bending
  const y = uv().y;
  const bendWeight = pow(y, float(3.0));

  const bend = bendWeight.mul(uBendAmount).mul(sin(dustAge.mul(uBendSpeed.mul(noiseSample))));

  const B = rotX(bend);

  const windImpulse = uWindDirection.mul(uWindStrength).mul(dustAge);

  const riseFactor = clamp(noiseSample, 0.3, 1.0);
  const rise = vec3(0.0, dustAge.mul(uRiseSpeed).mul(riseFactor), 0.0);
  const driftMovement = windImpulse.add(rise).add(swirl);

  // Spin
  const baseX = aSeed.mul(1.13).mod(1.0).mul(TWO_PI);
  const baseY = aSeed.mul(2.17).mod(1.0).mul(TWO_PI);
  const baseZ = aSeed.mul(3.31).mod(1.0).mul(TWO_PI);

  const spin = dustAge.mul(uSpinSpeed).mul(uSpinAmp);
  const rx = baseX.add(spin.mul(0.9).mul(turbulenceX.add(1.5)));
  const ry = baseY.add(spin.mul(1.2).mul(turbulenceY.add(1.5)));
  const rz = baseZ.add(spin.mul(0.7).mul(turbulenceZ.add(1.5)));

  const R = rotY(ry).mul(rotX(rx)).mul(rotZ(rz));

  // 0 at creation, 1 at death
  const scaleFactor = smoothstep(float(0), float(0.05), lifeInterpolation);
  const fadingOut = float(1.0).sub(
      smoothstep(float(0.8), float(1.0), lifeInterpolation)
  );

  // Update local position
  const positionLocalUpdated = R.mul(B.mul(positionLocal));

  material.colorNode = vec4(uDustColor, 1);
  material.positionNode = aSpawnPos
      .add(driftMovement)
      .add(positionLocalUpdated.mul(aScale.mul(scaleFactor)));
  material.opacityNode = fadingOut;

  return material;
  }
}
```

```javascript
//gommageOrchestrator.js
...
export default class GommageOrchestrator {
  ...
  #dustInterval = 0.125;
  #petalInterval = 0.05;
  #gommageTween = null;
  #spawnDustTween = null;
  #spawnPetalTween = null;
  ...
}
```

```javascript
//msdfText.js
...
getRandomPositionInMesh() {
  const min = this.#worldPositionBounds.min;
  const max = this.#worldPositionBounds.max;
  const x = Math.random() * (max.x - min.x) + min.x;
  const y = Math.random() * (max.y - min.y) + min.y;
  const z = Math.random() * 0.5;
  return new THREE.Vector3(x, y, z);
}
...
```

```javascript
//experience.js

import * as THREE from &quot;three/webgpu&quot;;
import GommageOrchestrator from &quot;./gommageOrchestrator.js&quot;;
import { float, mrt, pass, output } from &quot;three/tsl&quot;;
import { bloom } from &quot;three/examples/jsm/tsl/display/BloomNode.js&quot;;

export class Experience {

  #threejs = null;
  #scene = null;
  #camera = null;
  #webgpuComposer = null;

  constructor() {}

  async initialize(container) {
    await this.#setupProject(container);
    window.addEventListener(&quot;resize&quot;,  this.#onWindowResize_.bind(this), false);
    await this.#setupPostprocessing();
    this.#raf();
  }

  async #setupProject(container) {
    this.#threejs = new THREE.WebGPURenderer({ antialias: true });
    await this.#threejs.init();

    this.#threejs.shadowMap.enabled = false;
    this.#threejs.toneMapping = THREE.ACESFilmicToneMapping;
    this.#threejs.setClearColor(0x111111, 1);
    this.#threejs.setSize(window.innerWidth, window.innerHeight);
    this.#threejs.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(this.#threejs.domElement);

    // Camera Setup !
    const fov = 45;
    const aspect = window.innerWidth / window.innerHeight;
    const near = 0.1;
    const far = 25;
    this.#camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
    this.#camera.position.set(0, 0, 5);
    // Call window resize to compute FOV
    this.#onWindowResize_();
    this.#scene = new THREE.Scene();
    // Test MSDF Text
    const gommageOrchestratorEntity = new GommageOrchestrator();
    await gommageOrchestratorEntity.initialize(this.#scene);
  }

  async #setupPostprocessing() {
    this.#webgpuComposer = new THREE.PostProcessing(this.#threejs);
    const scenePass = pass(this.#scene, this.#camera);

    scenePass.setMRT(
      mrt({
        output,
        bloomIntensity: float(0),
      })
    );
    let outNode = scenePass;

    const outputPass = scenePass.getTextureNode();
    const bloomIntensityPass = scenePass.getTextureNode(&#039;bloomIntensity&#039;);
    const bloomPass = bloom(outputPass.mul(bloomIntensityPass), 0.8);
    outNode = outNode.add(bloomPass);

    this.#webgpuComposer.outputNode = outNode.renderOutput();
    this.#webgpuComposer.needsUpdate = true;
  }

  #onWindowResize_() {
    const HORIZONTAL_FOV_TARGET = THREE.MathUtils.degToRad(45);
    this.#camera.aspect = window.innerWidth / window.innerHeight;
    const verticalFov = 2 * Math.atan(Math.tan(HORIZONTAL_FOV_TARGET / 2) / this.#camera.aspect);
    this.#camera.fov = THREE.MathUtils.radToDeg(verticalFov);
    this.#camera.updateProjectionMatrix();
    this.#threejs.setSize(window.innerWidth, window.innerHeight);
  }

  #render() {
    //this.#threejs.render(this.#scene, this.#camera);
    this.#webgpuComposer.render();
  }

  #raf() {
    requestAnimationFrame(t => {
      this.#render();
      this.#raf();
    });
  }
}

new Experience().initialize(document.querySelector(&quot;#canvas-container&quot;));
```

```javascript
//msdfText.js
...
createTextMaterial(fontAtlasTexture, perlinTexture, uProgress) {
  const textMaterial = new MSDFTextNodeMaterial({
    map: fontAtlasTexture,
    transparent: true,
  });
  
  ...
  
  textMaterial.mrtNode = mrt({
    bloomIntensity: float(0.4).mul(dissolve),
  });

  return textMaterial;
}
```

```javascript
//petalParticles.js
...
createPetalMaterial(perlinTexture) {
  const material = new THREE.MeshBasicNodeMaterial({
      transparent: true,
      side: THREE.DoubleSide,
  });

  ....

  material.mrtNode = mrt({
      bloomIntensity: float(0.7).mul(fadingOut),
    });

  return material;
}
```

```css
@font-face {
  font-family: &#039;Cinzel&#039;;
  src: url(&#039;/fonts/Cinzel/Cinzel-Regular.ttf&#039;) format(&#039;truetype&#039;);
  font-weight: normal;
  font-style: normal;
}

#control-ui-container {
  position: fixed;
  bottom: 200px;
  z-index: 9999;
  width: 100%;
  left: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 24px;
  transform: translateX(-50%);
  --e33-color: #D5CBB2;
}

.E33-button {
  font-family: &#039;Cinzel&#039;, serif;
  padding: 12px 30px;
  cursor: pointer;
  background-color: rgba(0, 0, 0, 0.7);
  color: var(--e33-color);
  border: none;
  position: relative;
  clip-path: polygon(0% 50%,
          15px 0%,
          calc(100% - 15px) 0%,
          100% 50%,
          calc(100% - 15px) 100%,
          15px 100%);
  transition: transform 0.15s ease-out 0.05s;
  font-size: 2rem;
  transition: opacity 0.15s ease-out 0.05s;

  &.disabled {
      opacity: 0.4;
      cursor: default;
  }
}

.E33-button::before {
  content: &#039;&#039;;
  position: absolute;
  inset: 0;
  background: var(--e33-color);
  --borderSize: 1px;
  clip-path: polygon(0% 50%,
          15px 0%,
          calc(100% - 15px) 0%,
          100% 50%,
          calc(100% - 15px) 100%,
          15px 100%,
          0% 50%,

          var(--borderSize) 50%,
          calc(15px + 0.5px) calc(100% - var(--borderSize)),
          calc(100% - 15px - 0.5px) calc(100% - var(--borderSize)),
          calc(100% - var(--borderSize)) 50%,
          calc(100% - 15px - 0.5px) var(--borderSize),
          calc(15px + 0.5px) var(--borderSize),
          var(--borderSize) 50%);
  z-index: -1;
}
```

```html
<!DOCTYPE html>
<html lang=&quot;en&quot; class=&quot;no-js&quot;>
  <head>
	  ...
    <link rel=&quot;stylesheet&quot; type=&quot;text/css&quot; href=&quot;css/controlUI.css&quot; />
    ...
    </head>
      <div id=&quot;canvas-container&quot;></div>
      <div id=&quot;control-ui-container&quot;>
         <button class=&quot;E33-button&quot; id=&quot;gommage-button&quot;>Start</button>
      </div>
      ...
  </body>
</html>
```

```javascript
//gommageOrchestrator.js
...
async initialize(scene) {
  ...
  // Use HTML buttons
  const gommageButton = document.getElementById(&quot;gommage-button&quot;);
  gommageButton.addEventListener(&quot;click&quot;, () => {
      this.triggerGommage();
  });
  ...
}
...
```

```javascript
//debug.js
...
class Debug {
  static instance = null;
  static ENABLED = false;
...
```

```text
based on fontData.common.lineHeight
```