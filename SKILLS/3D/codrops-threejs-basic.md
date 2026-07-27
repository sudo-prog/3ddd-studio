---
name: codrops-threejs-basic
description: >
  Three.js fundamentals: scene/camera/renderer setup, class-based Canvas architecture,
  mouse-follow trails, 3D text gallery (MSDF), WebGL snake game animation, and
  responsive resize handling. Foundation for all 3D Codrops demos.
---

# Three.js Basics (Codrops Pattern Library)

## When to Use

- "three.js" + not specifically R3F / shader / WebGPU
- "webgl scene"
- "3d sphere / cube / plane"
- "3d text" (Three.js, not CSS)
- "mouse trail three.js"
- "webgl snake"
- foundational 3D setup questions

---

## Key Libraries

```
Three.js:        https://unpkg.com/three@0.160/build/three.module.js
three-msdf-text: https://unpkg.com/three-msdf-text-utils@1.2.1/dist/three-msdf-text.js
lil-gui:         https://unpkg.com/lil-gui@0.19/dist/lil-gui.esm.min.js
auto-bind:       https://unpkg.com/auto-bind@4.0.0/auto-bind.js
normalize-wheel: https://unpkg.com/normalize-wheel@1.0.0/dist/normalize-wheel.esm.js
```

---

## Pattern 1 — Class-Based Canvas Entry Point

**Source demos:** 3 demos (circle text, skeleton fluid reveal, snake animation)

```javascript
// main.js
import NormalizeWheel from "normalize-wheel";
import AutoBind from "auto-bind";
import Canvas from "./components/canvas.js";

class App {
  constructor() {
    this.canvas = new Canvas();
    this.canvas.eventName = "AppLoaded";
    window.addEventListener("resize", NormalizeWheel.addEventListener("wheel", this.onWheel));
  }
}
// or: window.addEventListener("wheel", (e) => ... using normalize-wheel inside)
new App();
```

**Canvas class skeleton:**

```javascript
// canvas.js
import * as THREE from "three";
import GUI from "lil-gui";

export default class Canvas {
  constructor() {
    this.element = document.getElementById("webgl");
    this.renderer = null;
    this.scene = null;
    this.camera = null;
  }
  async init() { this.createRenderer(); this.createCamera(); this.createScene(); this.addObjects(); }
  createRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.element,
      antialias: true,
      alpha: true
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
  createCamera() {
    this.camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.01, 10);
    this.camera.position.set(0, 0, 1);
  }
  createScene() { this.scene = new THREE.Scene(); }
  addObjects() { /* add meshes here */ }
  onResize() { ... }
  render(time) { requestAnimationFrame(t => this.render(t)); this.renderer.render(this.scene, this.camera); }
  dispose() { this.renderer.dispose(); this.scene.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); }
}
```

---

## Pattern 2 — Mouse Trail on Canvas

```javascript
export default class MouseTrail {
  #initCanvas(w, h) {
    this.canvas = document.createElement("canvas");
    this.canvas.width = w; this.canvas.height = h;
    this.ctx = this.canvas.getContext("2d");
    document.body.appendChild(this.canvas);
  }
  update(mouseX, mouseY) {
    this.targetX = mouseX * this.canvas.width;
    this.targetY = mouseY * this.canvas.height;
    this.lx += (this.targetX - this.lx) * 0.08;
    this.ly += (this.targetY - this.ly) * 0.08;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    // Draw trail
  }
}
```

---

## Pattern 3 — 3D Text with MSDF (Three.js)

MSDF (Multi-channel Signed Distance Field) enables crisp text rendering on 3D planes.

**Generate font atlas:**
```bash
# msdf-bmfont (CLI tool)
msdf-bmfont Cinzel-Regular.ttf \
  -f json \
  -o Cinzel.png \
  --font-size 64 \
  --distance-range 16 \
  --texture-padding 8 \
  --border 2 \
  --smart-size
```

**Load and render:**

```javascript
import { MSDFTextGeometry } from "three-msdf-text-utils";
import { FontLoader } from "three/addons/loaders/FontLoader.js";

new FontLoader().load("font.json", (font) => {
  const geometry = new MSDFTextGeometry({ font, text: "HELLO" });
  const material = new TextSpriteMaterial({ map: texture, color: 0xffffff });
  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);
});
```

---

## Pro Tips

| Issue | Fix |
|---|---|
| Canvas `alpha: true` → transparent BG, need solid | set `renderer.setClearColor(0x000000)` |
| `renderer.setPixelRatio` exceeds display DPR | cap `Math.min(window.devicePixelRatio, 2)` |
| Resize called before scene init | guard: `if (!this.camera) return;` |
| MSDF font renders empty | Ensure `.png` and `.json` are in same folder, or pass both URLs |
| FPS drops on mouse updates | throttle updates to `requestAnimationFrame` |

---

## References

- `codrops-shader-programming` (custom vertex/fragment shaders in Three.js)
- `codrops-threejs-basic` (extended Three.js foundation)
- `codrops-r3f-advanced` (Three.js in React)

## Additional Reference Blocks (74 patterns)


```javascript
// main.js

import NormalizeWheel from &quot;normalize-wheel&quot;;
import AutoBind from &quot;auto-bind&quot;;

import Canvas from &quot;./components/canvas&quot;;

class App {
  constructor() {
    AutoBind(this);

    this.init();
    this.update();
    this.onResize();
    this.addEventListeners();
  }

  init() {
    this.canvas = new Canvas();
  }

  update() {
    this.canvas.update();
    requestAnimationFrame(this.update.bind(this));
  }

  onResize() {
    window.requestAnimationFrame(() => {
      if (this.canvas && this.canvas.onResize) {
        this.canvas.onResize();
      }
    });
  }

  onTouchDown(event) {
    event.stopPropagation();
    if (this.canvas && this.canvas.onTouchDown) {
      this.canvas.onTouchDown(event);
    }
  }

  onTouchMove(event) {
    event.stopPropagation();
    if (this.canvas && this.canvas.onTouchMove) {
      this.canvas.onTouchMove(event);
    }
  }

  onTouchUp(event) {
    event.stopPropagation();

    if (this.canvas && this.canvas.onTouchUp) {
      this.canvas.onTouchUp(event);
    }
  }

  onWheel(event) {
    const normalizedWheel = NormalizeWheel(event);

    if (this.canvas && this.canvas.onWheel) {
      this.canvas.onWheel(normalizedWheel);
    }
  }

  addEventListeners() {
    window.addEventListener(&quot;resize&quot;, this.onResize, { passive: true });
    window.addEventListener(&quot;mousedown&quot;, this.onTouchDown, {
      passive: true,
    });
    window.addEventListener(&quot;mouseup&quot;, this.onTouchUp, { passive: true });
    window.addEventListener(&quot;pointermove&quot;, this.onTouchMove, {
      passive: true,
    });
    window.addEventListener(&quot;touchstart&quot;, this.onTouchDown, {
      passive: true,
    });
    window.addEventListener(&quot;touchmove&quot;, this.onTouchMove, {
      passive: true,
    });
    window.addEventListener(&quot;touchend&quot;, this.onTouchUp, { passive: true });
    window.addEventListener(&quot;wheel&quot;, this.onWheel, { passive: true });
  }
}

export default new App();
```

```javascript
// canvas.js 

import * as THREE from &quot;three&quot;;
import GUI from &quot;lil-gui&quot;;

export default class Canvas {
  constructor() {
    this.element = document.getElementById(&quot;webgl&quot;);
    this.time = 0;

    this.y = {
      start: 0,
      distance: 0,
      end: 0,
    };

    this.createClock();
    this.createDebug();

    this.createScene();
    this.createCamera();
    this.createRenderer();
    this.onResize();
  }

  createDebug() {
    this.gui = new GUI();
    this.debug = {};
  }

  createClock() {
    this.clock = new THREE.Clock();
  }

  createScene() {
    this.scene = new THREE.Scene();
  }

  createCamera() {
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.camera.position.z = 5;
  }

  createRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.element,
      alpha: true,
      antialias: true,
    });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  onTouchDown(event) {
    this.isDown = true;
    this.y.start = event.touches ? event.touches[0].clientY : event.clientY;
  }

  onTouchMove(event) {
    if (!this.isDown) return;

    this.y.end = event.touches ? event.touches[0].clientY : event.clientY;
  }

  onTouchUp(event) {
    this.isDown = false;

    this.y.end = event.changedTouches
      ? event.changedTouches[0].clientY
      : event.clientY;
  }

  onWheel(event) {}

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const fov = this.camera.fov * (Math.PI / 180);
    const height = 2 * Math.tan(fov / 2) * this.camera.position.z;
    const width = height * this.camera.aspect;

    this.sizes = {
      width,
      height,
    };
  }

  update() {
    this.renderer.render(this.scene, this.camera);
  }
}
```

```javascript
// gallery.js

import * as THREE from &quot;three&quot;;

import { data } from &quot;../utils/data&quot;;
import Text from &quot;./text&quot;;

export default class Gallery {
  constructor({ renderer, scene, camera, sizes, gui }) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.sizes = sizes;
    this.gui = gui;

    this.group = new THREE.Group();
    this.createText();
    this.show();
  }

  createText() {
    this.texts = data.map((element, index) => {
      return new Text({
        element,
        scene: this.group,
        sizes: this.sizes,
        length: data.length,
        index,
      });
    });
  }

  show() {
    this.scene.add(this.group);
  }

  onTouchDown() {}

  onTouchMove() {}

  onTouchUp() {}

  onWheel() {}

  onResize({ sizes }) {
    this.sizes = sizes;
  }

  update() {}
}
```

```javascript
// utils/data.js

export const data = [
  { id: 1, title: &quot;Aurora&quot; },
  { id: 2, title: &quot;Bungalow&quot; },
  { id: 3, title: &quot;Chatoyant&quot; },
  { id: 4, title: &quot;Demure&quot; },
  { id: 5, title: &quot;Denouement&quot; },
  { id: 6, title: &quot;Felicity&quot; },
  { id: 7, title: &quot;Idyllic&quot; },
  { id: 8, title: &quot;Labyrinth&quot; },
  { id: 9, title: &quot;Lagoon&quot; },
  { id: 10, title: &quot;Lullaby&quot; },
  { id: 11, title: &quot;Aurora&quot; },
  { id: 12, title: &quot;Bungalow&quot; },
  { id: 13, title: &quot;Chatoyant&quot; },
  { id: 14, title: &quot;Demure&quot; },
  { id: 15, title: &quot;Denouement&quot; },
  { id: 16, title: &quot;Felicity&quot; },
  { id: 17, title: &quot;Idyllic&quot; },
  { id: 18, title: &quot;Labyrinth&quot; },
  { id: 19, title: &quot;Lagoon&quot; },
  { id: 20, title: &quot;Lullaby&quot; },
];
```

```javascript
// gallery.js

createGallery() {
    this.gallery = new Gallery({
      renderer: this.renderer,
      scene: this.scene,
      camera: this.camera,
      sizes: this.sizes,
      gui: this.gui,
    });
  }
```

```javascript
// gallery.js

onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const fov = this.camera.fov * (Math.PI / 180);
    const height = 2 * Math.tan(fov / 2) * this.camera.position.z;
    const width = height * this.camera.aspect;

    this.sizes = {
      width,
      height,
    };

    if (this.gallery)
      this.gallery.onResize({
        sizes: this.sizes,
      });
  }

  update() {
    if (this.gallery) this.gallery.update();

    this.renderer.render(this.scene, this.camera);
  }
```

```javascript
// gallery.js

createText() {
    this.texts = data.map((element, index) => {
      return new Text({
        element,
        scene: this.group,
        sizes: this.sizes,
        length: data.length,
        index,
      });
    });
  }
```

```javascript
// text.js

loadFontAtlas(path) {
    const promise = new Promise((resolve, reject) => {
      const loader = new THREE.TextureLoader();
      loader.load(path, resolve);
    });

    return promise;
  }
```

```javascript
// text.js

import atlasURL from &quot;../assets/Neuton-Regular.png&quot;;
import fnt from &quot;../assets/Neuton-Regular-msdf.json&quot;;

load() {
    Promise.all([this.loadFontAtlas(atlasURL)]).then(([atlas]) => {
      const geometry = new MSDFTextGeometry({
        text: this.element.title,
        font: fnt,
      });

      const material = new THREE.ShaderMaterial({
        side: THREE.DoubleSide,
        opacity: 0.5,
        transparent: true,
        defines: {
          IS_SMALL: false,
        },
        extensions: {
          derivatives: true,
        },
        uniforms: {
          // Common
          ...uniforms.common,
          // Rendering
          ...uniforms.rendering,
          // Strokes
          ...uniforms.strokes,
        },
        vertexShader: vertex,
        fragmentShader: fragment,
      });
      material.uniforms.uMap.value = atlas;

      this.mesh = new THREE.Mesh(geometry, material);
      this.scene.add(this.mesh);
      this.createBounds({
        sizes: this.sizes,
      });
    });
  }
```

```javascript
// vite.config.js

import glsl from &quot;vite-plugin-glsl&quot;;
import { defineConfig } from &quot;vite&quot;;

export default defineConfig({
  plugins: [glsl()],
  root: &quot;&quot;,
  base: &quot;./&quot;,
});
```

```clike
// shaders/text-fragment.glsl

// Varyings
varying vec2 vUv;

// Uniforms: Common
uniform float uOpacity;
uniform float uThreshold;
uniform float uAlphaTest;
uniform vec3 uColor;
uniform sampler2D uMap;

// Uniforms: Strokes
uniform vec3 uStrokeColor;
uniform float uStrokeOutsetWidth;
uniform float uStrokeInsetWidth;

// Utils: Median
float median(float r, float g, float b) {
    return max(min(r, g), min(max(r, g), b));
}

void main() {
    // Common
    // Texture sample
    vec3 s = texture2D(uMap, vUv).rgb;

    // Signed distance
    float sigDist = median(s.r, s.g, s.b) - 0.5;

    float afwidth = 1.4142135623730951 / 2.0;

    #ifdef IS_SMALL
        float alpha = smoothstep(uThreshold - afwidth, uThreshold + afwidth, sigDist);
    #else
        float alpha = clamp(sigDist / fwidth(sigDist) + 0.5, 0.0, 1.0);
    #endif

    // Strokes
    // Outset
    float sigDistOutset = sigDist + uStrokeOutsetWidth * 0.5;

    // Inset
    float sigDistInset = sigDist - uStrokeInsetWidth * 0.5;

    #ifdef IS_SMALL
        float outset = smoothstep(uThreshold - afwidth, uThreshold + afwidth, sigDistOutset);
        float inset = 1.0 - smoothstep(uThreshold - afwidth, uThreshold + afwidth, sigDistInset);
    #else
        float outset = clamp(sigDistOutset / fwidth(sigDistOutset) + 0.5, 0.0, 1.0);
        float inset = 1.0 - clamp(sigDistInset / fwidth(sigDistInset) + 0.5, 0.0, 1.0);
    #endif

    // Border
    float border = outset * inset;

    // Alpha Test
    if (alpha < uAlphaTest) discard;
    // Output: Common
    vec4 filledFragColor = vec4(uColor, uOpacity * alpha);

    // Output: Strokes
    vec4 strokedFragColor = vec4(uStrokeColor, uOpacity * border);

    gl_FragColor = filledFragColor;
}
```

```clike
// shaders/text-vertex.glsl

// Attribute
attribute vec2 layoutUv;

attribute float lineIndex;

attribute float lineLettersTotal;
attribute float lineLetterIndex;

attribute float lineWordsTotal;
attribute float lineWordIndex;

attribute float wordIndex;

attribute float letterIndex;

// Varyings
varying vec2 vUv;
varying vec2 vLayoutUv;
varying vec3 vViewPosition;
varying vec3 vNormal;

varying float vLineIndex;

varying float vLineLettersTotal;
varying float vLineLetterIndex;

varying float vLineWordsTotal;
varying float vLineWordIndex;

varying float vWordIndex;

varying float vLetterIndex;

void main() {

    // Varyings
    vUv = uv;
    vLayoutUv = layoutUv;
    vec4 mvPosition = vec4(position, 1.0);
    vViewPosition = -mvPosition.xyz;
    vNormal = normal;

    vLineIndex = lineIndex;

    vLineLettersTotal = lineLettersTotal;
    vLineLetterIndex = lineLetterIndex;

    vLineWordsTotal = lineWordsTotal;
    vLineWordIndex = lineWordIndex;

    vWordIndex = wordIndex;

    vLetterIndex = letterIndex;
    
    // Output
    mvPosition = modelViewMatrix * mvPosition;
    gl_Position = projectionMatrix * mvPosition;
}
```

```javascript
// text.js

import * as THREE from &quot;three&quot;;
import { MSDFTextGeometry, uniforms } from &quot;three-msdf-text-utils&quot;;

import atlasURL from &quot;../assets/Neuton-Regular.png&quot;;
import fnt from &quot;../assets/Neuton-Regular-msdf.json&quot;;

import vertex from &quot;../shaders/text-vertex.glsl&quot;;
import fragment from &quot;../shaders/text-fragment.glsl&quot;;

export default class Text {
  constructor({ element, scene, sizes, index, length }) {
    this.element = element;
    this.scene = scene;
    this.sizes = sizes;
    this.index = index;

    this.scale = 0.008;

    this.load();
  }

  load() {
    Promise.all([this.loadFontAtlas(atlasURL)]).then(([atlas]) => {
      const geometry = new MSDFTextGeometry({
        text: this.element.title,
        font: fnt,
      });

      const material = new THREE.ShaderMaterial({
        side: THREE.DoubleSide,
        opacity: 0.5,
        transparent: true,
        defines: {
          IS_SMALL: false,
        },
        extensions: {
          derivatives: true,
        },
        uniforms: {
          // Common
          ...uniforms.common,
          // Rendering
          ...uniforms.rendering,
          // Strokes
          ...uniforms.strokes,
        },
        vertexShader: vertex,
        fragmentShader: fragment,
      });
      material.uniforms.uMap.value = atlas;

      this.mesh = new THREE.Mesh(geometry, material);
      this.scene.add(this.mesh);
      this.createBounds({
        sizes: this.sizes,
      });
    });
  }

  loadFontAtlas(path) {
    const promise = new Promise((resolve, reject) => {
      const loader = new THREE.TextureLoader();
      loader.load(path, resolve);
    });

    return promise;
  }

  createBounds({ sizes }) {
    if (this.mesh) {
      this.updateScale();
    }
  }

  updateScale() {
    this.mesh.scale.set(this.scale, this.scale, this.scale);
  }

  onResize(sizes) {
    this.sizes = sizes;
    this.createBounds({
      sizes: this.sizes,
    });
  }
}
```

```javascript
// text.js

uniforms: {

  // custom
  uColorBlack: { value: new THREE.Vector3(0.133, 0.133, 0.133) },

  // Common
  ...uniforms.common,
  // Rendering
  ...uniforms.rendering,
  // Strokes
  ...uniforms.strokes,
},
```

```clike
// shaders/text-fragment.glsl

uniform vec3 uColorBlack;

// Output: Common
vec4 filledFragColor = vec4(uColorBlack, uOpacity * alpha);
```

```javascript
// text.js
createBounds({ sizes }) {
    if (this.mesh) {
      this.updateScale();
      this.updateY();
    }
  }
  updateY() {
    this.mesh.position.y = this.index * 0.5;
  }
```

```javascript
// text.js
 
updateScale() {
    this.mesh.scale.set(this.scale, -this.scale, this.scale);
  }
```

```javascript
// canvas.js

onTouchDown(event) {
    this.isDown = true;
    this.y.start = event.touches ? event.touches[0].clientY : event.clientY;

    if (this.gallery) this.gallery.onTouchDown({ y: this.y.start });
  }

  onTouchMove(event) {
    if (!this.isDown) return;

    this.y.end = event.touches ? event.touches[0].clientY : event.clientY;

    if (this.gallery) this.gallery.onTouchMove({ y: this.y });
  }

  onTouchUp(event) {
    this.isDown = false;

    this.y.end = event.changedTouches
      ? event.changedTouches[0].clientY
      : event.clientY;

    if (this.gallery) this.gallery.onTouchUp({ y: this.y });
  }

  onWheel(event) {
    if (this.gallery) this.gallery.onWheel(event);
  }
```

```javascript
// gallery.js

    this.y = {
      current: 0,
      target: 0,
      lerp: 0.1,
    };

    this.scrollCurrent = {
      y: 0,
      // x: 0
    };
    this.scroll = {
      y: 0,
      // x: 0
    };
```

```javascript
// gallery.js 

onTouchDown({ y }) {
    this.scrollCurrent.y = this.scroll.y;
  }

  onTouchMove({ y }) {
    const yDistance = y.start - y.end;

    this.y.target = this.scrollCurrent.y - yDistance;
  }

  onTouchUp({ y }) {}

  onWheel({ pixelY }) {
    this.y.target -= pixelY;
  }
```

```javascript
// gallery.js

update() {
    this.y.current = lerp(this.y.current, this.y.target, this.y.lerp);

    this.scroll.y = this.y.current;
  }
```

```javascript
// text.js

updateY(y = 0) {
    this.mesh.position.y = this.index * 0.5 - y;
}

update(scroll) {
  if (this.mesh) {
    this.updateY(scroll.y * 0.005);
  }
}
```

```javascript
// text.js

this.numberOfText = this.length;
this.angleCalc = ((this.numberOfText / 10) * Math.PI) / this.numberOfText;
```

```javascript
this.angleCalc = (2 * Math.PI) / this.numberOfText;
```

```javascript
this.angleCalc = ((this.numberOfText / 10) * Math.PI) / this.numberOfText;
```

```javascript
// text.js
  
updateZ() {
  this.mesh.rotation.z = (this.index / this.numberOfText) * 2 * Math.PI;
}
```

```javascript
// text.js

updateX() {
  this.angleX = this.index * this.angleCalc;
  this.mesh.position.x = Math.cos(this.angleX);
}
```

```javascript
// text.js

updateY(y = 0) {
  // this.mesh.position.y = this.index * 0.5 - y;

  this.angleY = this.index * this.angleCalc;
  this.mesh.position.y = Math.sin(this.angleY);
}
```

```javascript
// text.js

updateZ(z = 0) {
    this.mesh.rotation.z = (this.index / this.numberOfText) * 2 * Math.PI - z;
  }

  updateX(x = 0) {
    this.angleX = this.index * this.angleCalc - x;
    this.mesh.position.x = Math.cos(this.angleX);
  }

  updateY(y = 0) {
    this.angleY = this.index * this.angleCalc - y;
    this.mesh.position.y = Math.sin(this.angleY);
  }

  update(scroll) {
    if (this.mesh) {
      this.updateY(scroll.y * 0.005);
      this.updateX(scroll.y * 0.005);
      this.updateZ(scroll.y * 0.005);
    }
  }
```

```javascript
// gallery.js

this.speed = {
   current: 0,
   target: 0,
   lerp: 0.1,
};
```

```javascript
// gallery.js

uniforms: {
   // custom
   uColorBlack: { value: new THREE.Vector3(0.133, 0.133, 0.133) },
   // speed
   uSpeed: { value: 0.0 },
   uAmplitude: { value: this.amplitude },
   // Common
   ...uniforms.common,
   // Rendering
   ...uniforms.rendering,
   // Strokes
   ...uniforms.strokes,
},
```

```javascript
// gallery.js

update(scroll, speed) {
    if (this.mesh) {
      this.mesh.material.uniforms.uSpeed.value = speed;
      this.updateY(scroll.y * this.circleSpeed);
      this.updateX(scroll.y * this.circleSpeed);
      this.updateZ(scroll.y * this.circleSpeed);
    }
  }
```

```clike
vec4 mvPosition = vec4(newPosition, 1.0);
```

```clike
newPosition = rotate(newPosition, vec3(0.0, 0.0, 1.0), uSpeed * position.x);
```

```clike
uniform float uSpeed;
uniform float uAmplitude;

newPosition = rotate(newPosition, vec3(0.0, 0.0, 1.0), uSpeed * position.x * uAmplitude);
```

```javascript
// gallery.js

this.amplitude = 0.004;
this.gui.add(this, &quot;amplitude&quot;).min(0).max(0.01).step(0.001);

update() {
    this.y.current = lerp(this.y.current, this.y.target, this.y.lerp);

    this.scroll.y = this.y.current;

    this.speed.target = (this.y.target - this.y.current) * 0.001;
    this.speed.current = lerp(
      this.speed.current,
      this.speed.target,
      this.speed.lerp
    );

    this.texts.map((text) =>
      text.update(
        this.scroll,
        this.speed.current,
        this.amplitude
      )
    );
  }
```

```javascript
// text.js

update(scroll, circleSpeed, speed, amplitude) {
    this.circleSpeed = circleSpeed;
    if (this.mesh) {
      this.mesh.material.uniforms.uSpeed.value = speed;

      // our amplitude here
      this.mesh.material.uniforms.uAmplitude.value = amplitude;
      this.updateY(scroll.y * this.circleSpeed);
      this.updateX(scroll.y * this.circleSpeed);
      this.updateZ(scroll.y * this.circleSpeed);
    }
  }
```

```javascript
this.group.position.x = -this.sizes.width / 2;
```

```javascript
// gallery.js

  show() {
    this.scene.add(this.group);

    this.timeline = gsap.timeline();

    this.timeline
      .fromTo(
        this.group.position,
        {
          x: -this.sizes.width * 2, // outside of the screen
        },
        {
          duration: 0.8,
          ease: easing,
          x: -this.sizes.width / 2, // final position
        }
      )
      .fromTo(
        this.y,
        {
          // small calculation to be minimum - 1500 to have at least a small movement and randomize it to have a different effect on every landing
          target: Math.min(-1500, -Math.random() * window.innerHeight * 6),
        },
        {
          target: 0,
          duration: 0.8,
          ease: easing,
        },
        &quot;<&quot; // at the same time of the first animation
      );
  }
```

```text
a b c d e f g h i j k l m n o p q r s t u v w x y z A B C D E F G H I J K L M N O P Q R S T U V W X Y Z 0 1 2 3 4 5 6 7 8 9
```

```javascript
export default class MouseTrail { ...
	
	#createCanvas(width, height) {
		this.canvas = document.createElement(&quot;canvas&quot;);
		this.canvas.width = width;
		this.canvas.height = height;
		this.ctx = this.canvas.getContext(&quot;2d&quot;);
		this.lineWidth = Math.max(width * 0.2, 100);

		this.ctx.fillStyle = &quot;white&quot;;
		this.ctx.fillRect(0, 0, width, height);
	}

	#createTexture() {
		this.texture = new THREE.CanvasTexture(this.canvas);
		this.texture.minFilter = THREE.LinearFilter;
		this.texture.magFilter = THREE.LinearFilter;
		this.texture.generateMipmaps = false;
	}
	// ...
}
```

```javascript
export default class MouseTrail { ...
	
	update(mouseX, mouseY) {
		const targetX = mouseX * this.canvas.width;
		const targetY = mouseY * this.canvas.height;

		if (this.currentX === null) {
			this.currentX = targetX;
			this.currentY = targetY;
			this.lastX = targetX;
			this.lastY = targetY;
			return;
		}

		this.#lerp(targetX, targetY);
		this.#updateOpacity();
		this.#draw();

		this.lastX = this.currentX;
		this.lastY = this.currentY;
		this.texture.needsUpdate = true;
	}

	#draw() {
		const { canvas, ctx, lineWidth } = this;

		ctx.fillStyle = &quot;white&quot;;
		ctx.fillRect(0, 0, canvas.width, canvas.height);

		if (this.opacity > 0.01) {
			ctx.beginPath();
			ctx.moveTo(this.lastX, this.lastY);
			ctx.lineTo(this.currentX, this.currentY);
			ctx.lineCap = &quot;round&quot;;
			ctx.lineWidth = lineWidth;
			ctx.strokeStyle = `rgba(0, 0, 0, ${this.opacity})`;
			ctx.stroke();
		}
	}
	// ...
}
```

```javascript
export default class FluidSim { ...

	#createRenderTargets() {
		const opts = {
			minFilter: THREE.LinearFilter,
			magFilter: THREE.LinearFilter,
			depthBuffer: false,
			stencilBuffer: false,
		};
		this.targetA = new THREE.RenderTarget(this.width, this.height, opts);
		this.targetB = new THREE.RenderTarget(this.width, this.height, opts);

		this.prevNode = texture(this.targetA.texture);
		this.maskNode = texture(this.targetA.texture);
	}

	#createFBOScene() {
		this.fboScene = new THREE.Scene();
		this.fboCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, -1, 1);

		this.inputNode = texture(new THREE.Texture());

		const material = new MeshBasicNodeMaterial();
		material.colorNode = this.#createFluidShader();

		const geo = new THREE.PlaneGeometry(2, 2);
		// Flip geometry UVs Y so render target read-back is self-consistent in WebGPU
		const uvAttr = geo.attributes.uv;
		for (let i = 0; i < uvAttr.count; i++) {
			uvAttr.setY(i, 1.0 - uvAttr.getY(i));
		}
		this.fboQuad = new THREE.Mesh(geo, material);
		this.fboScene.add(this.fboQuad);
	}

	update(renderer, trailTexture) {
		this.prevNode.value = this.targetA.texture;
		this.inputNode.value = trailTexture;

		renderer.setRenderTarget(this.targetB);
		renderer.render(this.fboScene, this.fboCamera);
		renderer.setRenderTarget(null);

		// Update mask to read from the just-rendered target
		this.maskNode.value = this.targetB.texture;

		// Swap
		const temp = this.targetA;
		this.targetA = this.targetB;
		this.targetB = temp;
	}
	// ...

}
```

```javascript
#createFluidShader() { ...

	const aspect = this.height / this.width;
	const aspectVec = this.width < this.height ? vec2(1.0, 1.0 / aspect) : vec2(aspect, 1.0);

	return Fn(() => { ...
		const uvCoord = uv();
		const disp = mul(mul(fbm(mul(uvCoord, 20.0), float(4)), aspectVec), 0.01);
		// ...
	}

}
```

```javascript
#createFluidShader() { ...

	const blendDarken = Fn(([base, blend]) => min(blend, base));

	return Fn(() => { ...
		const texel  = this.prevNode.sample(uvCoord);
		const texel2 = this.prevNode.sample(vec2(add(uvCoord.x, disp.x), uvCoord.y));
		const texel3 = this.prevNode.sample(vec2(sub(uvCoord.x, disp.x), uvCoord.y));
		const texel4 = this.prevNode.sample(vec2(uvCoord.x, add(uvCoord.y, disp.y)));
		const texel5 = this.prevNode.sample(vec2(uvCoord.x, sub(uvCoord.y, disp.y)));

		const floodcolor = texel.rgb.toVar();
		floodcolor.assign(blendDarken(floodcolor, texel2.rgb));
		floodcolor.assign(blendDarken(floodcolor, texel3.rgb));
		floodcolor.assign(blendDarken(floodcolor, texel4.rgb));
		floodcolor.assign(blendDarken(floodcolor, texel5.rgb));
		// ...
	}
}
```

```javascript
#createFluidShader() { ...

	return Fn(() => { ...
		const flippedUV = vec2(uvCoord.x, sub(float(1.0), uvCoord.y));
		const input = this.inputNode.sample(flippedUV);
		const combined = blendDarken(floodcolor, input.rgb);
		// ...
	}
	// ...
}
```

```javascript
#createFluidShader() { ...

	return Fn(() => { ...
		return min(vec3(1.0), add(combined, vec3(0.015)));
	}
	// ...
}
```

```javascript
export default class Scene { ...

	#createScene() {
		const scene = new THREE.Scene();
		scene.fog = new THREE.Fog(0x000000, 1, 3);
		scene.background = new THREE.Color(0x000000);
		scene.environment = this.envMap;
		scene.environmentIntensity = 0.1;

		const light = new THREE.PointLight(0xffffff, 0.75);
		light.position.set(1, 2, 1);
		scene.add(light);

		return scene;
	}
	// ...
}
```

```javascript
export default class InstancedModel { ...

	#setPositions(mesh) {
		const { count, spacing } = this;
		const gridSize = Math.ceil(Math.sqrt(count));
		const halfSize = ((gridSize - 1) * spacing) / 2;
		const spacingZ = spacing * 0.65;
		const halfSizeZ = ((gridSize - 1) * spacingZ) / 2;
		const dummy = new THREE.Object3D();

		for (let i = 0; i < count; i++) {
			const x = i % gridSize;
			const z = Math.floor(i / gridSize);
			const xOffset = z % 2 === 1 ? spacing / 2 : 0;

			dummy.position.set(
				x * spacing - halfSize + xOffset,
				0,
				z * spacingZ - halfSizeZ,
			);
			dummy.updateMatrix();
			mesh.setMatrixAt(i, dummy.matrix);
		}
		mesh.instanceMatrix.needsUpdate = true;
	}
	// ...
}
```

```javascript
export function createFresnelMaterial({
  heightMax = 1.0,
  roughness = 1.0,
  color = vec3(0.2, 0.6, 1.0),
  emissiveIntensity = 0.75,
}) {
  const material = new MeshStandardNodeMaterial({
    metalness: 0,
    roughness,
  });

  const fresnel = pow(
    sub(float(1.0), normalView.dot(positionViewDirection.negate())),
    float(1.0),
  );

  const coreColor = vec3(0.0, 0.05, 0.1);
  const fresnelColor = mix(coreColor, color, fresnel);

  const heightFade = smoothstep(0.5, heightMax, positionLocal.y);
  const finalColor = fresnelColor.mul(heightFade);

  material.colorNode = finalColor;
  material.emissiveNode = finalColor.mul(emissiveIntensity);

  return material;
}
```

```javascript
export default class PostProcessing { ...
	constructor(renderer, solidScene, wireScene, camera, fluidMaskNode) { ...
		this.pipeline = new THREE.RenderPipeline(renderer);
		this.#compose();
		// ...
	}

	#compose() { ...
		const solidPass = pass(this.solidScene, this.camera);
		const solidColor = solidPass.getTextureNode(&quot;output&quot;);

		const wirePass = pass(this.wireScene, this.camera);
		const wireColor = wirePass.getTextureNode(&quot;output&quot;);
		// ...
	}
}
```

```javascript
export default class PostProcessing { ...	
	#compose() { ...
		const bloomPass = bloom(solidColor.sample(screenUV), 0.4, 0.05);
		// ...
	}
	// ...
}
```

```javascript
export default class PostProcessing { ...	
	#compose() { ...
		const scanRaw = sin(mul(screenUV.y, float(1250.0)));
		const scanDarken = clamp(scanRaw, -1.0, 0.0).mul(-0.15);
		const scanLines = sub(float(1.0), scanDarken);
		const bloomWithScanLines = bloomPass.mul(scanLines);
		// ...
	}
	// ...
}
```

```javascript
export default class PostProcessing { ...	
	#compose() { ...
		const fluidMask = sub(float(1.0), this.fluidMaskNode.sample(screenUV).r);
		const blended = mix(
			bloomWithScanLines,
			wireColor.sample(screenUV),
			fluidMask,
		);
		// ...
	}
	// ...
}
```

```javascript
export default class PostProcessing { ...	
	#compose() { ...

		const noise = mx_noise_float(
			vec3(screenUV.mul(2000.0), time.mul(20.0)),
		).mul(0.015);

		const withEffects = blended.sub(noise);

		const luminance = dot(withEffects, vec3(0.299, 0.587, 0.114));

		const desaturated = mix(
			vec3(luminance, luminance, luminance),
			withEffects,
			float(0.985),
		);

		const lowContrast = mix(vec3(0.0, 0.0, 0.2), desaturated, float(0.9));

		this.pipeline.outputNode = lowContrast;
		// ...
	}
	// ...
}
```

```javascript
class Three { ...
	#animate() {
		const delta = this.clock.getDelta();

		this.scene.animate(delta, this.clock.elapsedTime);

		// Update mouse trail → fluid sim
		this.mouseTrail.update(
			this.scene.cameraRig.mouseNormalized.x,
			this.scene.cameraRig.mouseNormalized.y,
		);

		this.fluidSim.update(this.context.renderer, this.mouseTrail.texture);

		// Render everything (scene passes + effects)
		this.postProcessing.render();

		requestAnimationFrame(() => this.#animate());
	}
	// ...
}
```

```typescript
if (dist > orbitRadius * 1.5) {
  desiredDir = targetDir
}
```

```typescript
const tangent = new Vector3(-targetDir.z, 0, targetDir.x)   // perpendicular on XZ plane
const radiusError = dist - orbitRadius
const radialStrength = radiusError * 0.1
desiredDir = coilTangent.clone().addScaledVector(targetDir, radialStrength).normalize()
```

```typescript
const coilY = coilAmplitude * coilFrequency * Math.cos(coilFrequency * orbitAngle) * coilActivation
const coilTangent = new Vector3(tangent.x, coilY, tangent.z)
desiredDir = coilTangent.clone().addScaledVector(targetDir, radialStrength).normalize()
```

```typescript
const wander = wanderForce(lastDir, noise2D, noiseTime, wanderStrength, tiltStrength)
const wanderDelta = wander.clone().sub(lastDir)
desiredDir.add(wanderDelta.multiplyScalar(wanderWeight))
```

```typescript
function limitTurnRate(current: Vector3, desired: Vector3, maxRate: number): Vector3 {
  const angle = current.angleTo(desired)
  if (angle <= maxRate) return desired.clone()       // small change, use as-is
  if (angle < 0.001) return current.clone()          // near-identical, skip

  const axis = new Vector3().crossVectors(current, desired)
  // ... handle degenerate parallel/anti-parallel case ...
  axis.normalize()

  return current.clone().applyAxisAngle(axis, maxRate)
}

const newDir = limitTurnRate(lastDir, desiredDir, maxTurnRate)
```

```typescript
// endpoint
const endPoint = lastPoint.clone().add(newDir.clone().multiplyScalar(length))
```

```typescript
// control points
const turnAngle = lastDir.angleTo(newDir)
const turnFactor = Math.min(1, turnAngle / (Math.PI / 2))
const controlDist = length * (0.33 + 0.34 * turnFactor)

const cp1 = lastPoint.clone().add(lastDir.clone().multiplyScalar(controlDist))
const cp2 = endPoint.clone().sub(newDir.clone().multiplyScalar(controlDist))

const curve = new CubicBezierCurve3(lastPoint, cp1, cp2, endPoint)
```

```typescript
this.distance += delta * this.config.speed
this.curve.configureStartEnd(this.distance, this.config.length)
```

```typescript
configureStartEnd(position: number, length: number): void {
  this.fillLength(position + length)     // generate ahead
  this.removeCurvesBefore(position)      // trim behind

  const localPos = this.localDistance(position)
  const totalLen = this.getLengthSafe()
  this.uStart = totalLen > 0 ? localPos / totalLen : 0
  this.uLength = totalLen > 0 ? length / totalLen : 1
}
```

```typescript
getPointAtLocal(u: number): Vector3 {
  return this.getPointAt(this.uStart + this.uLength * u)
}
```

```typescript
N = normalize(up - T * dot(up, T))
```

```typescript
private parallelTransport(
  prevNormal: Vector3,
  prevTangent: Vector3,
  newTangent: Vector3
): Vector3 {
  const dot = prevTangent.dot(newTangent)

  if (dot > 0.9999) return prevNormal.clone()

  const axis = new Vector3().crossVectors(prevTangent, newTangent).normalize()
  const angle = Math.acos(Math.max(-1, Math.min(1, dot)))

  const rotated = prevNormal.clone().applyAxisAngle(axis, angle)

  rotated.sub(newTangent.clone().multiplyScalar(rotated.dot(newTangent)))
  return rotated.normalize()
}
```

```typescript
return cache.normals[low]
  .clone()
  .lerp(cache.normals[high], t)
  .normalize()
```

```typescript
for (let i = 0; i < texturePoints; i++) {
  const u = i / (texturePoints - 1)
  const basis = this.curve.getBasisAtLocal(u)

  const idx = i * 4
  posData[idx] = basis.position.x
  posData[idx + 1] = basis.position.y
  posData[idx + 2] = basis.position.z
  posData[idx + 3] = 1.0

  // Encode normals as 0-1 range
  normData[idx] = basis.normal.x * 0.5 + 0.5
  normData[idx + 1] = basis.normal.y * 0.5 + 0.5
  normData[idx + 2] = basis.normal.z * 0.5 + 0.5
  normData[idx + 3] = 1.0
}
```

```text
spineU:  0.0 --------- 0.74 ---------- 0.85 ----- 0.95 ---- 1.0
         tail tip      body            neck       head      tip
         [ramp up]     [full thick]    [pinch]    [bulge]   [close]
```

```clike
float radiusNormal   = scale * u_radiusN; // vertical
float radiusBinormal = scale * u_radiusB; // horizontal
```

```clike
ringOffset += spineNormal * combinedThickness * u_zOffset;
```

```clike
float twistedTheta = theta + spineU * u_twistAmount;
```