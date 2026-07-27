---
name: codrops-canvas-webgl
description: >
  WebGL / OGL-based canvas animations — infinite rotating image galleries with
  perspective, 2D metaballs using WebGL2 quads, post-processing effects,
  WebGL shader pipelines, 3D card scenes with Canvas, and HTML-in-Canvas (
  the native Canvas drawElement experiment).
---

# Canvas & WebGL Effects (Codrops Pattern Library)

## When to Use

- "webgl gallery"
- "ogl shader"
- "webgl2 metaball"
- "canvas distortion"
- "rotate image gallery"
- "postprocessing webgl"
- "html in canvas"

---

## Key Libraries

```
OGL:              https://unpkg.com/ogl@0.0.89/dist/ogl.module.js
Three.js:         https://unpkg.com/three@0.162/build/three.module.js
WebGL2:           built-in browser API
```

---

## Pattern 1 — OGL Infinite Rotating Gallery

Rotating image strip. Each image is a textured plane rendered from within a 3D camera. Scroll drives rotation angle.

**File: `canvas.js`**

```javascript
import { Renderer, Camera, Transform, Plane } from "ogl";
import Media from "./Media.js";
import NormalizeWheel from "normalize-wheel";
import { lerp } from "../utils/math";
import AutoBind from "../utils/bind";

export default class Canvas {
  constructor() {
    this.images = ["img/1.jpg", "img/2.jpg", ...];
    this.scroll = { ease: 0.01, current: 0, target: 0, last: 0 };
    this.renderer = new Renderer({ canvas, alpha: true, antialias: true, dpr: clampDpr() });
  }

  onResize() {
    this.screen = { w: innerWidth, h: innerHeight };
    this.renderer.setSize(this.screen.w, this.screen.h);
    this.camera.perspective({ aspect: w / h, fov: 75 });
  }
}
```

**File: `Media.js`** — wraps image texture + plane geometry:

```javascript
import { GlTexture, Plane } from "ogl";
export default class Media {
  constructor({ gl, image, width = 1, height = 1, ...meshArgs }) {
    this.gl = gl;
    const geometry = new Plane(gl, { width, height, ...meshArgs });
    this.texture = GlTexture.from(gl, { image });
    this.mesh = new Mesh(gl, { geometry, program, uniforms });
  }
  updateScroll(scroll, index, total) {
    // perspective transform per index within ring
  }
}
```

**Scroll handler (infinite loop):**

```javascript
this.images.forEach((src, i) => {
  this.media[i] = new Media({ gl: this.gl, image: this.loader.load(src), ... });
});

addEventListeners() {
  window.addEventListener("wheel", this.onWheel);
  window.addEventListener("resize", () => this.onResize());
}

onWheel(e) { this.scroll.target += normalizeWheel(e).spinY; }

onFrame() {
  this.scroll.current += (this.scroll.target - this.scroll.current) * 0.01;
  this.media.forEach((m, i) => m.updateScroll(this.scroll.current, i, this.images.length));
  this.renderer.render({ scene: this.scene, camera: this.camera });
}
```

**`lerp` utility:**

```js
export const lerp = (a, b, t) => a + (b - a) * t;
```

---

## Pattern 2 — Drawing Metaballs with WebGL2

**Source demo:** Drawing 2D Metaballs with WebGL2, Georgi Nikolov

Pure WebGL2 (no framework). Uses a two-pass approach:
1. Render `N` circles onto the screen with alpha
2. Apply a fragment shader that thresholds the combined sum of their alpha; generates the metaball effect

**Single-pass GLSL (fragment):**

```
precision highp float;
in vec2 v_uv;
out vec4 outColor;
void main() {
  float sum = 0.0;
  // accumulate all circle contributions (unrolled loop)
  sum += radius1 / distanceBetweenPoints(uv, center1);
  // ...
  float t = smoothstep(threshold - smooth, threshold + smooth, sum);
  outColor = vec4(mix(insideColor, outsideColor, t), 1.0);
}
```

**JavaScript -> circle quads**

- Render each circle as a 2-triangle quad with its position and radius uniform
- Applyable: one uniform per circle (`uN_cx`, `uN_cy`, `uN_radius`) in GLSL

**Setup:**

```
const gl = canvas.getContext('webgl2');
// Shader compilation utility
function compileShader(type, src) { ... }
const program = gl.createProgram();
// ... attach vertex + fragment shaders. bind loop.
```

Each circle → one VAO/GLSL uniform set → translated by cam matrix

---

## Pro Tips

| Pitfall | Fix |
|---|---|
| `ogl` loader doesn't pre-load | Preload textures; start `renderLoop` only after all images loaded |
| WebGL2 metro can be toggled — develop with | may still require user permission; always check `!gl → warn/fallback` |
| Metaball threshold visible as hard edge | Use `smoothstep(threshold-0.05, threshold+0.05, sum)` — debounce edge; bleeding artifact |
| Memory / fatal crash: too many simultaneous textures | Use Texture2D array or texture-atlas if you need >20 image CODEC |

---

## References

- `codrops-shader-programming` (GLSL patterns), `codrops-custom-cursor`, `codrops-r3f-advanced`

## Additional Reference Blocks (42 patterns)


```html
<canvas id=&quot;gl&quot;></canvas>
```

```javascript
import { Renderer, Camera, Transform, Plane } from &quot;ogl&quot;;
import Media from &quot;./Media.js&quot;;
import NormalizeWheel from &quot;normalize-wheel&quot;;
import { lerp } from &quot;../utils/math&quot;;
import AutoBind from &quot;../utils/bind&quot;;

export default class Canvas {
  constructor() {
    this.images = [
      &quot;/img/11.webp&quot;,
      &quot;/img/2.webp&quot;,
      &quot;/img/3.webp&quot;,
      &quot;/img/4.webp&quot;,
      &quot;/img/5.webp&quot;,
      &quot;/img/6.webp&quot;,
      &quot;/img/7.webp&quot;,
      &quot;/img/8.webp&quot;,
      &quot;/img/9.webp&quot;,
      &quot;/img/10.webp&quot;,
    ];

    this.scroll = {
      ease: 0.01,
      current: 0,
      target: 0,
      last: 0,
    };

    AutoBind(this);

    this.createRenderer();
    this.createCamera();
    this.createScene();

    this.onResize();

    this.createGeometry();
    this.createMedias();

    this.update();

    this.addEventListeners();
    this.createPreloader();
  }

  createPreloader() {
    Array.from(this.images).forEach((source) => {
      const image = new Image();

      this.loaded = 0;

      image.src = source;
      image.onload = (_) => {
        this.loaded += 1;

        if (this.loaded === this.images.length) {
          document.documentElement.classList.remove(&quot;loading&quot;);
          document.documentElement.classList.add(&quot;loaded&quot;);
        }
      };
    });
  }

  createRenderer() {
    this.renderer = new Renderer({
      canvas: document.querySelector(&quot;#gl&quot;),
      alpha: true,
      antialias: true,
      dpr: Math.min(window.devicePixelRatio, 2),
    });

    this.gl = this.renderer.gl;
  }
  createCamera() {
    this.camera = new Camera(this.gl);
    this.camera.fov = 45;
    this.camera.position.z = 20;
  }
  createScene() {
    this.scene = new Transform();
  }
  createGeometry() {
    this.planeGeometry = new Plane(this.gl, {
      heightSegments: 1,
      widthSegments: 100,
    });
  }
  createMedias() {
    this.medias = this.images.map((image, index) => {
      return new Media({
        gl: this.gl,
        geometry: this.planeGeometry,
        scene: this.scene,
        renderer: this.renderer,
        screen: this.screen,
        viewport: this.viewport,
        image,
        length: this.images.length,
        index,
      });
    });
  }
  onResize() {
    this.screen = {
      width: window.innerWidth,
      height: window.innerHeight,
    };

    this.renderer.setSize(this.screen.width, this.screen.height);

    this.camera.perspective({
      aspect: this.gl.canvas.width / this.gl.canvas.height,
    });

    const fov = this.camera.fov * (Math.PI / 180);
    const height = 2 * Math.tan(fov / 2) * this.camera.position.z;
    const width = height * this.camera.aspect;

    this.viewport = {
      height,
      width,
    };
    if (this.medias) {
      this.medias.forEach((media) =>
        media.onResize({
          screen: this.screen,
          viewport: this.viewport,
        })
      );
    }
  }
  easeInOut(t) {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
  }

  onTouchDown(event) {
    this.isDown = true;

    this.scroll.position = this.scroll.current;
    this.start = event.touches ? event.touches[0].clientY : event.clientY;
  }

  onTouchMove(event) {
    if (!this.isDown) return;

    const y = event.touches ? event.touches[0].clientY : event.clientY;
    const distance = (this.start - y) * 0.1;

    this.scroll.target = this.scroll.position + distance;
  }

  onTouchUp(event) {
    this.isDown = false;
  }

  onWheel(event) {
    const normalized = NormalizeWheel(event);
    const speed = normalized.pixelY;

    this.scroll.target += speed * 0.005;
  }

  update() {
    this.scroll.current = lerp(
      this.scroll.current,
      this.scroll.target,
      this.scroll.ease
    );

    if (this.scroll.current > this.scroll.last) {
      this.direction = &quot;up&quot;;
    } else {
      this.direction = &quot;down&quot;;
    }

    if (this.medias) {
      this.medias.forEach((media) => media.update(this.scroll, this.direction));
    }

    this.renderer.render({
      scene: this.scene,
      camera: this.camera,
    });

    this.scroll.last = this.scroll.current;

    window.requestAnimationFrame(this.update);
  }
  addEventListeners() {
    window.addEventListener(&quot;resize&quot;, this.onResize);
    window.addEventListener(&quot;wheel&quot;, this.onWheel);
    window.addEventListener(&quot;mousewheel&quot;, this.onWheel);

    window.addEventListener(&quot;mousedown&quot;, this.onTouchDown);
    window.addEventListener(&quot;mousemove&quot;, this.onTouchMove);
    window.addEventListener(&quot;mouseup&quot;, this.onTouchUp);

    window.addEventListener(&quot;touchstart&quot;, this.onTouchDown);
    window.addEventListener(&quot;touchmove&quot;, this.onTouchMove);
    window.addEventListener(&quot;touchend&quot;, this.onTouchUp);
  }
}
```

```javascript
import { Renderer, Camera, Transform, Plane } from &quot;ogl&quot;;

createRenderer() {
    this.renderer = new Renderer({
      canvas: document.querySelector(&quot;#gl&quot;), //canvas element
      alpha: true,
      antialias: true,
      dpr: Math.min(window.devicePixelRatio, 2),
    });

    this.gl = this.renderer.gl;
  }
  createCamera() {
    this.camera = new Camera(this.gl);
    this.camera.fov = 45;
    this.camera.position.z = 20;
  }
  createScene() {
    this.scene = new Transform();
  }

update() {
    this.renderer.render({
      scene: this.scene,
      camera: this.camera,
    });

    window.requestAnimationFrame(this.update.bind(this));
  }
```

```javascript
onResize() {
    this.screen = {
      width: window.innerWidth,
      height: window.innerHeight,
    };

    this.renderer.setSize(this.screen.width, this.screen.height);

    this.camera.perspective({
      aspect: this.gl.canvas.width / this.gl.canvas.height,
    });

    const fov = this.camera.fov * (Math.PI / 180);
    const height = 2 * Math.tan(fov / 2) * this.camera.position.z;
    const width = height * this.camera.aspect;

    this.viewport = {
      height,
      width,
    };
  }
```

```javascript
this.images = [
      &quot;/img/11.webp&quot;,
      &quot;/img/2.webp&quot;,
      &quot;/img/3.webp&quot;,
      &quot;/img/4.webp&quot;,
      &quot;/img/5.webp&quot;,
      &quot;/img/6.webp&quot;,
      &quot;/img/7.webp&quot;,
      &quot;/img/8.webp&quot;,
      &quot;/img/9.webp&quot;,
      &quot;/img/10.webp&quot;,
    ];

createPreloader() {
    Array.from(this.images).forEach((source) => {
      const image = new Image();

      this.loaded = 0;

      image.src = source;
      image.onload = (_) => {
        this.loaded += 1;

        if (this.loaded === this.images.length) {
          document.documentElement.classList.remove(&quot;loading&quot;);
          document.documentElement.classList.add(&quot;loaded&quot;);
        }
      };
    });
  }

 createMedias() {
    this.medias = this.images.map((image, index) => {
      return new Media({
        gl: this.gl,
        geometry: this.planeGeometry,
        scene: this.scene,
        renderer: this.renderer,
        screen: this.screen,
        viewport: this.viewport,
        image,
        length: this.images.length,
        index,
      });
    });
  }
```

```javascript
// declare an initial scroll value that we&#039;re going to update with the listener functions
 this.scroll = {
      ease: 0.01,
      current: 0,
      target: 0,
      last: 0,
 };

addEventListeners() {
    window.addEventListener(&quot;wheel&quot;, this.onWheel);
    window.addEventListener(&quot;mousewheel&quot;, this.onWheel);

    window.addEventListener(&quot;mousedown&quot;, this.onTouchDown);
    window.addEventListener(&quot;mousemove&quot;, this.onTouchMove);
    window.addEventListener(&quot;mouseup&quot;, this.onTouchUp);

    window.addEventListener(&quot;touchstart&quot;, this.onTouchDown);
    window.addEventListener(&quot;touchmove&quot;, this.onTouchMove);
    window.addEventListener(&quot;touchend&quot;, this.onTouchUp);
  }
}

onTouchDown(event) {
    this.isDown = true;

    this.scroll.position = this.scroll.current;
    this.start = event.touches ? event.touches[0].clientY : event.clientY;
  }

  onTouchMove(event) {
    if (!this.isDown) return;

    const y = event.touches ? event.touches[0].clientY : event.clientY;
    const distance = (this.start - y) * 0.1;

    this.scroll.target = this.scroll.position + distance;
  }

  onTouchUp(event) {
    this.isDown = false;
  }

  onWheel(event) {
    const normalized = NormalizeWheel(event);
    const speed = normalized.pixelY;

    this.scroll.target += speed * 0.005;
  }

// update function
 update() {
    this.scroll.current = lerp(
      this.scroll.current,
      this.scroll.target,
      this.scroll.ease
    );

    if (this.scroll.current > this.scroll.last) {
      this.direction = &quot;up&quot;;
    } else {
      this.direction = &quot;down&quot;;
    }

    if (this.medias) {
      this.medias.forEach((media) => media.update(this.scroll, this.direction));
    }

    this.renderer.render({
      scene: this.scene,
      camera: this.camera,
    });

    this.scroll.last = this.scroll.current;

    window.requestAnimationFrame(this.update);
  }
```

```javascript
import { Mesh, Program, Texture } from &quot;ogl&quot;;
import vertex from &quot;../../shaders/vertex.glsl&quot;;
import fragment from &quot;../../shaders/fragment.glsl&quot;;
import { map } from &quot;../utils/math&quot;;

export default class Media {
  constructor({
    gl,
    geometry,
    scene,
    renderer,
    screen,
    viewport,
    image,
    length,
    index,
  }) {
    this.extra = 0;

    this.gl = gl;
    this.geometry = geometry;
    this.scene = scene;
    this.renderer = renderer;
    this.screen = screen;
    this.viewport = viewport;
    this.image = image;
    this.length = length;
    this.index = index;

    this.createShader();
    this.createMesh();

    this.onResize();
  }
  createShader() {
    const texture = new Texture(this.gl, {
      generateMipmaps: false,
    });

    this.program = new Program(this.gl, {
      depthTest: false,
      depthWrite: false,
      fragment,
      vertex,
      uniforms: {
        tMap: { value: texture },
        uPosition: { value: 0 },
        uPlaneSize: { value: [0, 0] },
        uImageSize: { value: [0, 0] },
        uSpeed: { value: 0 },
        rotationAxis: { value: [0, 1, 0] },
        distortionAxis: { value: [1, 1, 0] },
        uDistortion: { value: 3 },
        uViewportSize: { value: [this.viewport.width, this.viewport.height] },
        uTime: { value: 0 },
      },
      cullFace: false,
    });

    const image = new Image();

    image.src = this.image;
    image.onload = (_) => {
      texture.image = image;

      this.program.uniforms.uImageSize.value = [
        image.naturalWidth,
        image.naturalHeight,
      ];
    };
  }
  createMesh() {
    this.plane = new Mesh(this.gl, {
      geometry: this.geometry,
      program: this.program,
    });

    this.plane.setParent(this.scene);
  }

  setScale(x, y) {
    x = 320;
    y = 300;
    this.plane.scale.x = (this.viewport.width * x) / this.screen.width;
    this.plane.scale.y = (this.viewport.height * y) / this.screen.height;

    this.plane.program.uniforms.uPlaneSize.value = [
      this.plane.scale.x,
      this.plane.scale.y,
    ];
  }
  setX() {
    this.plane.position.x =
      -(this.viewport.width / 2) + this.plane.scale.x / 2 + this.x;
  }

  onResize({ screen, viewport } = {}) {
    if (screen) {
      this.screen = screen;
    }

    if (viewport) {
      this.viewport = viewport;
      this.plane.program.uniforms.uViewportSize.value = [
        this.viewport.width,
        this.viewport.height,
      ];
    }
    this.setScale();

    this.padding = 0.8;
    this.height = this.plane.scale.y + this.padding;

    this.heightTotal = this.height * this.length;

    this.y = this.height * this.index;
  }

  update(scroll, direction) {
    this.plane.position.y = this.y - scroll.current - this.extra;

    // map position from 5 to 15 depending on the scroll position
    const position = map(
      this.plane.position.y,
      -this.viewport.height,
      this.viewport.height,
      5,
      15
    );

    this.program.uniforms.uPosition.value = position;

    this.speed = scroll.current - scroll.last;

    this.program.uniforms.uTime.value += 0.04;
    this.program.uniforms.uSpeed.value = scroll.current;

    const planeOffset = this.plane.scale.y / 2;
    const viewportOffset = this.viewport.height;

    this.isBefore = this.plane.position.y + planeOffset < -viewportOffset;
    this.isAfter = this.plane.position.y - planeOffset > viewportOffset;

    if (direction === &quot;up&quot; && this.isBefore) {
      this.extra -= this.heightTotal;

      this.isBefore = false;
      this.isAfter = false;
    }

    if (direction === &quot;down&quot; && this.isAfter) {
      this.extra += this.heightTotal;

      this.isBefore = false;
      this.isAfter = false;
    }
  }
}
```

```javascript
createShader() {
    const texture = new Texture(this.gl, {
      generateMipmaps: false,
    });

    this.program = new Program(this.gl, {
      depthTest: false,
      depthWrite: false,
      fragment,
      vertex,
      uniforms: {
        tMap: { value: texture },
        uPosition: { value: 0 },
        uPlaneSize: { value: [0, 0] },
        uImageSize: { value: [0, 0] },
        uSpeed: { value: 0 },
        rotationAxis: { value: [0, 1, 0] },
        distortionAxis: { value: [1, 1, 0] },
        uDistortion: { value: 3 },
        uViewportSize: { value: [this.viewport.width, this.viewport.height] },
        uTime: { value: 0 },
      },
      cullFace: false,
    });

    const image = new Image();

    image.src = this.image;
    image.onload = (_) => {
      texture.image = image;

      this.program.uniforms.uImageSize.value = [
        image.naturalWidth,
        image.naturalHeight,
      ];
    };
  }
  createMesh() {
    this.plane = new Mesh(this.gl, {
      geometry: this.geometry,
      program: this.program,
    });

    this.plane.setParent(this.scene);
  }
```

```javascript
onResize({ screen, viewport } = {}) {
    if (screen) {
      this.screen = screen;
    }

    if (viewport) {
      this.viewport = viewport;
      this.plane.program.uniforms.uViewportSize.value = [
        this.viewport.width,
        this.viewport.height,
      ];
    }
    this.setScale();
  }

  setScale(x, y) {
    x = 320;
    y = 300;
    this.plane.scale.x = (this.viewport.width * x) / this.screen.width;
    this.plane.scale.y = (this.viewport.height * y) / this.screen.height;

    this.plane.program.uniforms.uPlaneSize.value = [
      this.plane.scale.x,
      this.plane.scale.y,
    ];
  }
```

```javascript
// the spacing between planes
this.padding = 0.8;

this.height = this.plane.scale.y + this.padding;
this.heightTotal = this.height * this.length;

// initial plane position
this.y = this.height * this.index;

// position the image in the center of the screen on the x axis
setX() {
    this.plane.position.x =
      -(this.viewport.width / 2) + this.plane.scale.x / 2 + this.x;
 }

update(scroll, direction) {
    this.plane.position.y = this.y - scroll.current - this.extra;
}
```

```javascript
update(scroll, direction) {
    this.plane.position.y = this.y - scroll.current - this.extra;

    // map position from 5 to 15 depending on the scroll position
    const position = map(
      this.plane.position.y,
      -this.viewport.height,
      this.viewport.height,
      5,
      15
    );

    this.program.uniforms.uPosition.value = position;

    this.speed = scroll.current - scroll.last;

    this.program.uniforms.uTime.value += 0.04;
    this.program.uniforms.uSpeed.value = scroll.current;

    const planeOffset = this.plane.scale.y / 2;
    const viewportOffset = this.viewport.height;

    this.isBefore = this.plane.position.y + planeOffset < -viewportOffset;
    this.isAfter = this.plane.position.y - planeOffset > viewportOffset;

    if (direction === &quot;up&quot; && this.isBefore) {
      this.extra -= this.heightTotal;

      this.isBefore = false;
      this.isAfter = false;
    }

    if (direction === &quot;down&quot; && this.isAfter) {
      this.extra += this.heightTotal;

      this.isBefore = false;
      this.isAfter = false;
    }
  }
```

```clike
precision highp float;
 
uniform vec2 uImageSize;
uniform vec2 uPlaneSize;
uniform sampler2D tMap;
 
varying vec2 vUv;

void main() {
  vec2 ratio = vec2(
    min((uPlaneSize.x / uPlaneSize.y) / (uImageSize.x / uImageSize.y), 1.0),
    min((uPlaneSize.y / uPlaneSize.x) / (uImageSize.y / uImageSize.x), 1.0)
  );
 
  vec2 uv = vec2(
    vUv.x * ratio.x + (1.0 - ratio.x) * 0.5,
    vUv.y * ratio.y + (1.0 - ratio.y) * 0.5
  );
  

 
  gl_FragColor.rgb = texture2D(tMap, uv).rgb;
  gl_FragColor.a = 1.0;
}
```

```clike
float offset = ( dot(distortionAxis,position) +norm/2.)/norm;
```

```clike
float localprogress = clamp( (fract(uPosition * 5.0 * 0.01) - 0.01*uDistortion*offset)/(1. - 0.01*uDistortion),0.,2.);
```

```clike
localprogress = qinticInOut(localprogress)*PI;
```

```clike
precision highp float;
 
attribute vec3 position;
attribute vec2 uv;
attribute vec3 normal;
 
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform mat3 normalMatrix;

uniform float uPosition;
uniform float uTime;
uniform float uSpeed;
uniform vec3 distortionAxis;
uniform vec3 rotationAxis;
uniform float uDistortion;
 
varying vec2 vUv;
varying vec3 vNormal;


float PI = 3.141592653589793238;
mat4 rotationMatrix(vec3 axis, float angle) {
    axis = normalize(axis);
    float s = sin(angle);
    float c = cos(angle);
    float oc = 1.0 - c;
    
    return mat4(oc * axis.x * axis.x + c,           oc * axis.x * axis.y - axis.z * s,  oc * axis.z * axis.x + axis.y * s,  0.0,
                oc * axis.x * axis.y + axis.z * s,  oc * axis.y * axis.y + c,           oc * axis.y * axis.z - axis.x * s,  0.0,
                oc * axis.z * axis.x - axis.y * s,  oc * axis.y * axis.z + axis.x * s,  oc * axis.z * axis.z + c,           0.0,
                0.0,                                0.0,                                0.0,                                1.0);
}

vec3 rotate(vec3 v, vec3 axis, float angle) {
	mat4 m = rotationMatrix(axis, angle);
	return (m * vec4(v, 1.0)).xyz;
}
float qinticInOut(float t) {
  return t < 0.5
    ? +16.0 * pow(t, 5.0)
    : -0.5 * abs(pow(2.0 * t - 2.0, 5.0)) + 1.0;
}

 
void main() {
  vUv = uv;

  float norm = 0.5;
  
  vec3 newpos = position;
  float offset = ( dot(distortionAxis,position) +norm/2.)/norm;

  float localprogress = clamp( (fract(uPosition * 5.0 * 0.01) - 0.01*uDistortion*offset)/(1. - 0.01*uDistortion),0.,2.); 

  localprogress = qinticInOut(localprogress)*PI;

  newpos = rotate(newpos,rotationAxis,localprogress);
 
  gl_Position = projectionMatrix * modelViewMatrix * vec4(newpos, 1.0);
}
```

```html
<canvas layoutsubtree id=&quot;source&quot;>
  <div id=&quot;content&quot;>
    {...content}
  </div>
</canvas>
```

```javascript
const canvas = document.getElementById(&quot;source&quot;);
const content = document.getElementById(&quot;content&quot;);
const ctx = canvas.getContext(&quot;2d&quot;);

canvas.onpaint = () => {
  ctx.reset();
  ctx.drawElementImage(content, 0, 0);
};

canvas.requestPaint();
```

```tsx
import &quot;./styles.css&quot;;

import { Footer } from &quot;@/components/layout/footer&quot;;
import { Header } from &quot;@/components/layout/header&quot;;
import { GridBackground } from &quot;@/components/ui/grid-background&quot;;

import { ComputerScreen } from &quot;./components/computer-screen&quot;;
import { Scene } from &quot;./components/scene&quot;;

const BasicUI = () => (
  <>
    <Header />
    <GridBackground className=&quot;bg-codrops&quot; />
    <ComputerScreen />
    <Scene />
    <Footer />
  </>
);

export default BasicUI;
```

```tsx
export const ComputerScreen = () => {
  {...content}

  return (
    <div id=&quot;computer_screen&quot;>
      {...content}
    </div>
  );
};
```

```tsx
&quot;use client&quot;;

import { ContactShadows, Float, OrbitControls, Stage } from &quot;@react-three/drei&quot;;
import { Canvas, useFrame, useLoader, useThree } from &quot;@react-three/fiber&quot;;
import { Suspense, useEffect, useRef } from &quot;react&quot;;
import { HTMLTexture, Mesh, type ShaderMaterial } from &quot;three&quot;;
import { InteractionManager } from &quot;three/addons/interaction/InteractionManager.js&quot;;
import { GLTFLoader } from &quot;three/addons/loaders/GLTFLoader.js&quot;;

import { screenMaterial } from &quot;./crt-effect&quot;;

type ScreenMaterial = ShaderMaterial & { map: HTMLTexture | null };
const material = screenMaterial as ScreenMaterial;

const Mac = () => {
  const gltf = useLoader(GLTFLoader, &quot;/mac.glb&quot;);
  const { gl, camera } = useThree();
  const screenRef = useRef<Mesh>(null);

  const interactions = useRef<InteractionManager | null>(null);

  useEffect(() => {
    // We retrieve the element 
    const element = document.getElementById(&quot;computer_screen&quot;);
    if (!element) throw new Error(&quot;#computer_screen element not found&quot;);
    
    // We create a texture from that element using HTML-in-Canvas
    const texture = new HTMLTexture(element);

    // Create an Interaction Manager to forward pointer events from the 3D plane to the DOM element
    interactions.current = new InteractionManager();

    // We attach the texture to the computer screen plane
    material.uniforms.map.value = texture;
    material.map = texture;
    
    // Connect the interaction manager to the renderer and camera
    interactions.current.connect(gl, camera);

    // Register the screen plane mesh to receive pointer events
    if (screenRef.current) interactions.current.add(screenRef.current);

    window.dispatchEvent(new Event(&quot;mac-canvas-ready&quot;));
  }, [gl, camera]);

  useFrame(({ clock }) => {
    material.uniforms.uTime.value = clock.elapsedTime;
    interactions.current?.update();
  });

  return (
    <Float speed={2} rotationIntensity={0.1} floatIntensity={0.05}>
      <primitive object={gltf.scene} />
      <mesh
        ref={screenRef}
        position={[0, 0.102, 0.183]}
        rotation={[(-Math.PI / 180) * 6.5, 0, 0]}
        material={material}
      >
        <planeGeometry args={[562 * 0.00062, 408 * 0.00062]} />
      </mesh>
    </Float>
  );
};

export const Scene = () => (
  <main className=&quot;fixed inset-0 h-svh&quot;>
    <Canvas
      shadows
      dpr={[1, 2]}
      gl={{ antialias: true }}
      camera={{ position: [0.02, 0.01, 0.05], fov: 24, near: 0.1, far: 100 }}
    >
      <Suspense fallback={null}>
        <Stage
          intensity={0.5}
          environment=&quot;forest&quot;
          shadows={false}
          adjustCamera={false}
        >
          <Mac />
        </Stage>
      </Suspense>

      <ContactShadows
        position={[0, -0.35, 0]}
        opacity={0.5}
        blur={2}
        far={4}
        resolution={128}
      />

      <OrbitControls
        enableDamping
        enablePan={false}
        minDistance={2}
        maxDistance={8}
        minPolarAngle={Math.PI / 6}
        maxPolarAngle={Math.PI / 2}
      />
    </Canvas>
  </main>
);
```

```text
chrome://flags/#canvas-draw-element
```

```text
/* Create our canvas and obtain it&#039;s WebGL2RenderingContext */
const canvas = document.createElement(&#039;canvas&#039;)
const gl = canvas.getContext(&#039;webgl2&#039;)

/* Handle error somehow if no WebGL2 support */
if (!gl) {
  // ...
}

/* Size our canvas and listen for resize events */
resizeCanvas()
window.addEventListener(&#039;resize&#039;, resizeCanvas)

/* Append our canvas to the DOM and set its background-color with CSS */
canvas.style.backgroundColor = &#039;black&#039;
document.body.appendChild(canvas)

/* Issue first frame paint */
requestAnimationFrame(updateFrame)

function updateFrame (timestampMs) {
   /* Set our program viewport to fit the actual size of our monitor with devicePixelRatio into account */
   gl.viewport(0, 0, canvas.width, canvas.height)
   /* Set the WebGL background colour to be transparent */
   gl.clearColor(0, 0, 0, 0)
   /* Clear the current canvas pixels */
   gl.clear(gl.COLOR_BUFFER_BIT)

   /* Issue next frame paint */
   requestAnimationFrame(updateFrame)
}

function resizeCanvas () {
   /*
      We need to account for devicePixelRatio when sizing our canvas.
      We will use it to obtain the actual pixel size of our viewport and size our canvas to match it.
      We will then downscale it back to CSS units so it neatly fills our viewport and we benefit from downsampling antialiasing
      We also need to limit it because it can really slow our program. Modern iPhones have devicePixelRatios of 3. This means rendering 9x more pixels each frame!

      More info: https://webglfundamentals.org/webgl/lessons/webgl-resizing-the-canvas.html 
   */
   const dpr = devicePixelRatio > 2 ? 2 : devicePixelRatio
   canvas.width = innerWidth * dpr
   canvas.height = innerHeight * dpr
   canvas.style.width = `${innerWidth}px`
   canvas.style.height = `${innerHeight}px`
}
```

```text
/*
  Pass in geometry position and tex coord from the CPU
*/
in vec4 a_position;
in vec2 a_uv;

/*
  Pass in global projection matrix for each vertex
*/
uniform mat4 u_projectionMatrix;

/*
  Specify varying variable to be passed to fragment shader
*/
out vec2 v_uv;

void main () {
  /*
   We need to convert our quad points positions from pixels to the normalized WebGL coordinate system
  */
  gl_Position = u_projectionMatrix * a_position;
  v_uv = a_uv;
}
```

```text
/*
  Set fragment shader float precision
*/
precision highp float;

/*
  Consume interpolated tex coord varying from vertex shader
*/
in vec2 v_uv;

/*
  Final color represented as a vector of 4 components - r, g, b, a
*/
out vec4 outColor;

void main () {
  /*
    This function will run on each each pixel generated by our quad geometry
  */
  /*
    Calculate the distance for each pixel from the center of the quad (0.5, 0.5)
  */
  float dist = distance(v_uv, vec2(0.5)) * 2.0;
  /*
    Invert and clamp our distance from 0.0 to 1.0
  */
  float c = clamp(1.0 - dist, 0.0, 1.0);
  /*
    Use the distance to generate the pixel opacity. We have to explicitly enable alpha blending in WebGL to see the correct result
  */
  outColor = vec4(vec3(1.0), c);
}
```

```text
/*
  Utility method to create a WebGLShader object and compile it on the device GPU
  https:&#047;&#047;developer.mozilla.org/en-US/docs/Web/API/WebGLShader
*/
function makeGLShader (shaderType, shaderSource) {
  /* Create a WebGLShader object with correct type */
  const shader = gl.createShader(shaderType)
  /* Attach the shaderSource string to the newly created shader */
  gl.shaderSource(shader, shaderSource)
  /* Compile our newly created shader */
  gl.compileShader(shader)
  const success = gl.getShaderParameter(shader, gl.COMPILE_STATUS)
  /* Return the WebGLShader if compilation was a success */
  if (success) {
    return shader
  }
  /* Otherwise log the error and delete the faulty shader */
  console.error(gl.getShaderInfoLog(shader))
  gl.deleteShader(shader)
}

/*
  Utility method to create a WebGLProgram object
  It will create both a vertex and fragment WebGLShader and link them into a program on the device GPU
  https://developer.mozilla.org/en-US/docs/Web/API/WebGLProgram
*/
function makeGLProgram (vertexShaderSource, fragmentShaderSource) {
  /* Create and compile vertex WebGLShader */
  const vertexShader = makeGLShader(gl.VERTEX_SHADER, vertexShaderSource)
  /* Create and compile fragment WebGLShader */
  const fragmentShader = makeGLShader(gl.FRAGMENT_SHADER, fragmentShaderSource)
  /* Create a WebGLProgram and attach our shaders to it */
  const program = gl.createProgram()
  gl.attachShader(program, vertexShader)
  gl.attachShader(program, fragmentShader)
  /* Link the newly created program on the device GPU */
  gl.linkProgram(program) 
  /* Return the WebGLProgram if linking was successfull */
  const success = gl.getProgramParameter(program, gl.LINK_STATUS)
  if (success) {
    return program
  }
  /* Otherwise log errors to the console and delete fauly WebGLProgram */
  console.error(gl.getProgramInfoLog(program))
  gl.deleteProgram(program)
}
```

```text
const canvas = document.createElement(&#039;canvas&#039;)
/* rest of code */

/* Enable WebGL alpha blending */
gl.enable(gl.BLEND)
gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)

/*
  Generate the Vertex Array Object and GLSL program
  we need to render our 2D quad
*/
const {
  quadProgram,
  quadVertexArrayObject,
} = makeQuad(innerWidth / 2, innerHeight / 2)

/* --------------- Utils ----------------- */

function makeQuad (positionX, positionY, width = 50, height = 50, drawType = gl.STATIC_DRAW) {
  /*
    Write our vertex and fragment shader programs as simple JS strings

    !!! Important !!!!
    
    WebGL2 requires GLSL 3.00 ES
    We need to declare this version on the FIRST LINE OF OUR PROGRAM
    Otherwise it would not work!
  */
  const vertexShaderSource = `#version 300 es
    /*
      Pass in geometry position and tex coord from the CPU
    */
    in vec4 a_position;
    in vec2 a_uv;
    
    /*
     Pass in global projection matrix for each vertex
    */
    uniform mat4 u_projectionMatrix;
    
    /*
      Specify varying variable to be passed to fragment shader
    */
    out vec2 v_uv;
    
    void main () {
      gl_Position = u_projectionMatrix * a_position;
      v_uv = a_uv;
    }
  `
  const fragmentShaderSource = `#version 300 es
    /*
      Set fragment shader float precision
    */
    precision highp float;
    
    /*
      Consume interpolated tex coord varying from vertex shader
    */
    in vec2 v_uv;
    
    /*
      Final color represented as a vector of 4 components - r, g, b, a
    */
    out vec4 outColor;
    
    void main () {
      float dist = distance(v_uv, vec2(0.5)) * 2.0;
      float c = clamp(1.0 - dist, 0.0, 1.0);
      outColor = vec4(vec3(1.0), c);
    }
  `
  /*
    Construct a WebGLProgram object out of our shader sources and link it on the GPU
  */
  const quadProgram = makeGLProgram(vertexShaderSource, fragmentShaderSource)
  
  /*
    Create a Vertex Array Object that will store a description of our geometry
    that we can reference later when rendering
  */
  const quadVertexArrayObject = gl.createVertexArray()
  
  /*
    1. Defining geometry positions
    
    Create the geometry points for our quad
        
    V6  _______ V5         V3
       |      /         /|
       |    /         /  |
       |  /         /    |
    V4 |/      V1 /______| V2
     
     We need two triangles to form a single quad
     As you can see, we end up duplicating vertices:
     V5 & V3 and V4 & V1 end up occupying the same position.
     
     There are better ways to prepare our data so we don&#039;t end up with
     duplicates, but let&#039;s keep it simple for this demo and duplicate them
     
     Unlike regular Javascript arrays, WebGL needs strongly typed data
     That&#039;s why we supply our positions as an array of 32 bit floating point numbers
  */
  const vertexArray = new Float32Array(&#091;
    /*
      First set of 3 points are for our first triangle
    */
    positionX - width / 2,  positionY + height / 2, // Vertex 1 (X, Y)
    positionX + width / 2,  positionY + height / 2, // Vertex 2 (X, Y)
    positionX + width / 2,  positionY - height / 2, // Vertex 3 (X, Y)
    /*
      Second set of 3 points are for our second triangle
    */
    positionX - width / 2, positionY + height / 2, // Vertex 4 (X, Y)
    positionX + width / 2, positionY - height / 2, // Vertex 5 (X, Y)
    positionX - width / 2, positionY - height / 2  // Vertex 6 (X, Y)
  ])

  /*
    Create a WebGLBuffer that will hold our triangles positions
  */
  const vertexBuffer = gl.createBuffer()
  /*
    Now that we&#039;ve created a GLSL program on the GPU we need to supply data to it
    We need to supply our 32bit float array to the a_position variable used by the GLSL program
    
    When you link a vertex shader with a fragment shader by calling gl.linkProgram(someProgram)
    WebGL (the driver/GPU/browser) decide on their own which index/location to use for each attribute
    
    Therefore we need to find the location of a_position from our program
  */
  const a_positionLocationOnGPU = gl.getAttribLocation(quadProgram, &#039;a_position&#039;)
  
  /*
    Bind the Vertex Array Object descriptior for this geometry
    Each geometry instruction from now on will be recorded under it
    
    To stop recording after we are done describing our geometry, we need to simply unbind it
  */
  gl.bindVertexArray(quadVertexArrayObject)

  /*
    Bind the active gl.ARRAY_BUFFER to our WebGLBuffer that describe the geometry positions
  */
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer)
  /*
    Feed our 32bit float array that describes our quad to the vertexBuffer using the
    gl.ARRAY_BUFFER global handle
  */
  gl.bufferData(gl.ARRAY_BUFFER, vertexArray, drawType)
  /*
    We need to explicitly enable our the a_position variable on the GPU
  */
  gl.enableVertexAttribArray(a_positionLocationOnGPU)
  /*
    Finally we need to instruct the GPU how to pull the data out of our
    vertexBuffer and feed it into the a_position variable in the GLSL program
  */
  /*
    Tell the attribute how to get data out of positionBuffer (ARRAY_BUFFER)
  */
  const size = 2           // 2 components per iteration
  const type = gl.FLOAT    // the data is 32bit floats
  const normalize = false  // don&#039;t normalize the data
  const stride = 0         // 0 = move forward size * sizeof(type) each iteration to get the next position
  const offset = 0         // start at the beginning of the buffer
  gl.vertexAttribPointer(a_positionLocationOnGPU, size, type, normalize, stride, offset)
  
  /*
    2. Defining geometry UV texCoords
    
    V6  _______ V5         V3
       |      /         /|
       |    /         /  |
       |  /         /    |
    V4 |/      V1 /______| V2
  */
  const uvsArray = new Float32Array(&#091;
    0, 0, // V1
    1, 0, // V2
    1, 1, // V3
    0, 0, // V4
    1, 1, // V5
    0, 1  // V6
  ])
  /*
    The rest of the code is exactly like in the vertices step above.
    We need to put our data in a WebGLBuffer, look up the a_uv variable
    in our GLSL program, enable it, supply data to it and instruct
    WebGL how to pull it out:
  */
  const uvsBuffer = gl.createBuffer()
  const a_uvLocationOnGPU = gl.getAttribLocation(quadProgram, &#039;a_uv&#039;)
  gl.bindBuffer(gl.ARRAY_BUFFER, uvsBuffer)
  gl.bufferData(gl.ARRAY_BUFFER, uvsArray, drawType)
  gl.enableVertexAttribArray(a_uvLocationOnGPU)
  gl.vertexAttribPointer(a_uvLocationOnGPU, 2, gl.FLOAT, false, 0, 0)
  
  /*
    Stop recording and unbind the Vertex Array Object descriptior for this geometry
  */
  gl.bindVertexArray(null)
  
  /*
    WebGL has a normalized viewport coordinate system which looks like this:
    
         Device Viewport
       ------- 1.0 ------  
      |         |         |
      |         |         |
    -1.0 --------------- 1.0
      |         |         | 
      |         |         |
       ------ -1.0 -------
       
     However as you can see, we pass the position and size of our quad in actual pixels
     To convert these pixels values to the normalized coordinate system, we will
     use the simplest 2D projection matrix.
     It will be represented as an array of 16 32bit floats
     
     You can read a gentle introduction to 2D matrices here
     https:&#047;&#047;webglfundamentals.org/webgl/lessons/webgl-2d-matrices.html
  */
  const projectionMatrix = new Float32Array(&#091;
    2 / innerWidth, 0, 0, 0,
    0, -2 / innerHeight, 0, 0,
    0, 0, 0, 0,
    -1, 1, 0, 1,
  ])
  
  /*
    In order to supply uniform data to our quad GLSL program, we first need to enable the GLSL program responsible for rendering our quad
  */
  gl.useProgram(quadProgram)
  /*
    Just like the a_position attribute variable earlier, we also need to look up
    the location of uniform variables in the GLSL program in order to supply them data
  */
  const u_projectionMatrixLocation = gl.getUniformLocation(quadProgram, &#039;u_projectionMatrix&#039;)
  /*
    Supply our projection matrix as a Float32Array of 16 items to the u_projection uniform
  */
  gl.uniformMatrix4fv(u_projectionMatrixLocation, false, projectionMatrix)
  /*
    We have set up our uniform variables correctly, stop using the quad program for now
  */
  gl.useProgram(null)

  /*
    Return our GLSL program and the Vertex Array Object descriptor of our geometry
    We will need them to render our quad in our updateFrame method
  */
  return {
    quadProgram,
    quadVertexArrayObject,
  }
}

/* rest of code */
function makeGLShader (shaderType, shaderSource) {}
function makeGLProgram (vertexShaderSource, fragmentShaderSource) {}
function updateFrame (timestampMs) {}
```

```text
function updateFrame (timestampMs) {
   /* rest of our code */

  /*
    Bind the Vertex Array Object descriptor of our quad we generated earlier
  */
  gl.bindVertexArray(quadVertexArrayObject)
  /*
    Use our quad GLSL program
  */
  gl.useProgram(quadProgram)
  /*
    Issue a render command to paint our quad triangles
  */
  {
    const drawPrimitive = gl.TRIANGLES
    const vertexArrayOffset = 0
    const numberOfVertices = 6 // 6 vertices = 2 triangles = 1 quad
    gl.drawArrays(drawPrimitive, vertexArrayOffset, numberOfVertices)
  }
  /*     
    After a successful render, it is good practice to unbind our 
GLSL program and Vertex Array Object so we keep WebGL state clean.
    We will bind them again anyway on the next render
  */
  gl.useProgram(null)
  gl.bindVertexArray(null)

  /* Issue next frame paint */
  requestAnimationFrame(updateFrame)
}
```

```text
const vertexArray = new Float32Array(&#091;/* ... */])
const vertexBuffer = gl.createBuffer()
/* Bind our vertexBuffer to the global binding WebGL bind point gl.ARRAY_BUFFER */
gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer)
/* At this point, gl.ARRAY_BUFFER represents vertexBuffer */
/* Supply data to our vertexBuffer using the gl.ARRAY_BUFFER binding point */
gl.bufferData(gl.ARRAY_BUFFER, vertexArray, gl.STATIC_DRAW)
/* Do a bunch of other stuff with the active gl.ARRAY_BUFFER (vertexBuffer) here */
// ...

/* After you have done your work, unbind it */
gl.bindBuffer(gl.ARRAY_BUFFER, null)
```

```text
const vertexBuffer = gl.createBuffer()
vertexBuffer.addData(vertexArray)
vertexBuffer.setDrawOperation(gl.STATIC_DRAW)
// etc.
```

```text
/* rest of code */

/* How many quads we want rendered */
const QUADS_COUNT = 1000
/*
  Array to store our quads positions
  We need to layout our array as a continuous set
  of numbers, where each pair represents the X and Y
  or a single 2D position.
  
  Hence for 1000 quads we need an array of 2000 items
  or 1000 pairs of X and Y
*/
const quadsPositions = new Float32Array(QUADS_COUNT * 2)
for (let i = 0; i < QUADS_COUNT; i++) {
  /*
    Generate a random X and Y position
  */
  const randX = Math.random() * innerWidth
  const randY = Math.random() * innerHeight
  /*
    Set the correct X and Y for each pair in our array
  */
  quadsPositions&#091;i * 2 + 0] = randX
  quadsPositions&#091;i * 2 + 1] = randY
}

/*
  We also need to augment our makeQuad() method
  It no longer expects a single position, rather an array of positions
*/
const {
  quadProgram,
  quadVertexArrayObject,
} = makeQuad(quadsPositions)

/* rest of code */
```

```text
function makeQuad (quadsPositions, width = 70, height = 70, drawType = gl.STATIC_DRAW) {
  /* rest of code */

  /*
    Add offset positions for our individual instances
    They are declared and used in exactly the same way as
    &quot;a_position&quot; and &quot;a_uv&quot; above
  */
  const offsetsBuffer = gl.createBuffer()
  const a_offsetLocationOnGPU = gl.getAttribLocation(quadProgram, &#039;a_offset&#039;)
  gl.bindBuffer(gl.ARRAY_BUFFER, offsetsBuffer)
  gl.bufferData(gl.ARRAY_BUFFER, quadsPositions, drawType)
  gl.enableVertexAttribArray(a_offsetLocationOnGPU)
  gl.vertexAttribPointer(a_offsetLocationOnGPU, 2, gl.FLOAT, false, 0, 0)
  /*
    HOWEVER, we must add an additional WebGL call to set this attribute to only
    change per instance, instead of per vertex like a_position and a_uv above
  */
  const instancesDivisor = 1
  gl.vertexAttribDivisor(a_offsetLocationOnGPU, instancesDivisor)
  
  /*
    Stop recording and unbind the Vertex Array Object descriptor for this geometry
  */
  gl.bindVertexArray(null)

  /* rest of code */
}
```

```text
const vertexArray = new Float32Array(&#091;
  /*
    First set of 3 points are for our first triangle
  */
 -width / 2,  height / 2, // Vertex 1 (X, Y)
  width / 2,  height / 2, // Vertex 2 (X, Y)
  width / 2, -height / 2, // Vertex 3 (X, Y)
  /*
    Second set of 3 points are for our second triangle
  */
 -width / 2,  height / 2, // Vertex 4 (X, Y)
  width / 2, -height / 2, // Vertex 5 (X, Y)
 -width / 2, -height / 2  // Vertex 6 (X, Y)
])
```

```text
const vertexShaderSource = `#version 300 es
  /* rest of GLSL code */
  /*
    This input vector will change once per instance
  */
  in vec4 a_offset;

  void main () {
     /* Account a_offset in the final geometry posiiton */
     vec4 newPosition = a_position + a_offset;
     gl_Position = u_projectionMatrix * newPosition;
  }
  /* rest of GLSL code */
`
```

```text
function updateFrame (timestampMs) {
   /* rest of code */
   {
     const drawPrimitive = gl.TRIANGLES
     const vertexArrayOffset = 0
     const numberOfVertices = 6 // 6 vertices = 2 triangles = 1 quad
     gl.drawArraysInstanced(drawPrimitive, vertexArrayOffset, numberOfVertices, QUADS_COUNT)
   }
   /* rest of code */
}
```

```text
/* rest of code */

const renderTexture = makeTexture()
const framebuffer = makeFramebuffer(renderTexture)

function makeTexture (textureWidth = canvas.width, textureHeight = canvas.height) {
  /*
    Create the texture that we will use to render to
  */
  const targetTexture = gl.createTexture()
  /*
    Just like everything else in WebGL up until now, we need to bind it
    so we can configure it. We will unbind it once we are done with it.
  */
  gl.bindTexture(gl.TEXTURE_2D, targetTexture)

  /*
    Define texture settings
  */
  const level = 0
  const internalFormat = gl.RGBA
  const border = 0
  const format = gl.RGBA
  const type = gl.UNSIGNED_BYTE
  /*
    Notice how data is null. That&#039;s because we don&#039;t have data for this texture just yet
    We just need WebGL to allocate the texture
  */
  const data = null
  gl.texImage2D(gl.TEXTURE_2D, level, internalFormat, textureWidth, textureHeight, border, format, type, data)

  /*
    Set the filtering so we don&#039;t need mips
  */
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  
  return renderTexture
}

function makeFramebuffer (texture) {
  /*
    Create and bind the framebuffer
  */
  const fb = gl.createFramebuffer()
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb)
 
  /*
    Attach the texture as the first color attachment
  */
  const attachmentPoint = gl.COLOR_ATTACHMENT0
  gl.framebufferTexture2D(gl.FRAMEBUFFER, attachmentPoint, gl.TEXTURE_2D, targetTexture, level)
}
```

```text
function updateFrame () {
  gl.viewport(0, 0, canvas.width, canvas.height)
  gl.clearColor(0, 0, 0, 0)
  gl.clear(gl.COLOR_BUFFER_BIT)

  /*
    Bind the framebuffer we created
    From now on until we unbind it, each WebGL draw command will render in it
  */
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)
  
  /* Set the offscreen framebuffer background color to be transparent */
  gl.clearColor(0.2, 0.2, 0.2, 1.0)
  /* Clear the offscreen framebuffer pixels */
  gl.clear(gl.COLOR_BUFFER_BIT)

  /*
    Code for rendering our instanced quads here
  */

  /*
    We have successfully rendered to the framebuffer at this point
    In order to render to the screen next, we need to unbind it
  */
  gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  
  /* Issue next frame paint */
  requestAnimationFrame(updateFrame)
}
```

```text
/* rename our instanced quads program & VAO */
const {
  quadProgram: instancedQuadsProgram,
  quadVertexArrayObject: instancedQuadsVAO,
} = makeQuad({
  instancedOffsets: quadsPositions,
  /*
    We need different set of vertex and fragment shaders
    for the different quads we need to render, so pass them from outside
  */
  vertexShaderSource: instancedQuadVertexShader,
  fragmentShaderSource: instancedQuadFragmentShader,
  /*
    support optional instancing
  */
  isInstanced: true,
})
```

```text
const fullscreenQuadVertexShader = `#version 300 es
   in vec4 a_position;
   in vec2 a_uv;
   
   uniform mat4 u_projectionMatrix;
   
   out vec2 v_uv;
   
   void main () {
    gl_Position = u_projectionMatrix * a_position;
    v_uv = a_uv;
   }
`
const fullscreenQuadFragmentShader = `#version 300 es
  precision highp float;
  
  /*
    Pass our texture we render to as an uniform
  */
  uniform sampler2D u_texture;
  
  in vec2 v_uv;
  
  out vec4 outputColor;
  
  void main () {
    /*
      Use our interpolated UVs we assigned in Javascript to lookup
      texture color value at each pixel
    */
    vec4 inputColor = texture(u_texture, v_uv);
    
    /*
      0.5 is our alpha threshold we use to decide if
      pixel should be discarded or painted
    */
    float cutoffThreshold = 0.5;
    /*
      &quot;cutoff&quot; will be 0 if pixel is below 0.5 or 1 if above
      
      step() docs - https://thebookofshaders.com/glossary/?search=step
    */
    float cutoff = step(cutoffThreshold, inputColor.a);
    
    /*
      Let&#039;s use mix() GLSL method instead of if statement
      if cutoff is 0, we will discard the pixel by using empty color with no alpha
      otherwise, let&#039;s use black with alpha of 1
      
      mix() docs - https://thebookofshaders.com/glossary/?search=mix
    */
    vec4 emptyColor = vec4(0.0);
    /* Render base metaballs shapes */
    vec4 borderColor = vec4(1.0, 0.0, 0.0, 1.0);
    outputColor = mix(
      emptyColor,
      borderColor,
      cutoff
    );
    
    /*
      Increase the treshold and calculate new cutoff, so we can render smaller shapes again, this time in different color and with smaller radius
    */
    cutoffThreshold += 0.05;
    cutoff = step(cutoffThreshold, inputColor.a);
    vec4 fillColor = vec4(1.0, 1.0, 0.0, 1.0);
    /*
      Add new smaller metaballs color on top of the old one
    */
    outputColor = mix(
      outputColor,
      fillColor,
      cutoff
    );
  }
`
```

```text
const {
  quadProgram: fullscreenQuadProgram,
  quadVertexArrayObject: fullscreenQuadVAO,
} = makeQuad({
  vertexShaderSource: fullscreenQuadVertexShader,
  fragmentShaderSource: fullscreenQuadFragmentShader,
  isInstanced: false,
  width: innerWidth,
  height: innerHeight
})
/*
  Unlike our instances GLSL program, here we need to pass an extra uniform - a &quot;u_texture&quot;!
  Tell the shader to use texture unit 0 for u_texture
*/
gl.useProgram(fullscreenQuadProgram)
const u_textureLocation = gl.getUniformLocation(fullscreenQuadProgram, &#039;u_texture&#039;)
gl.uniform1i(u_textureLocation, 0)
gl.useProgram(null)
```

```text
function updateFrame () {
 gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)
 /* render instanced quads here */
 gl.bindFramebuffer(gl.FRAMEBUFFER, null)
 
 /*
   Render our fullscreen quad
 */
 gl.bindVertexArray(fullscreenQuadVAO)
 gl.useProgram(fullscreenQuadProgram)
 /*
  Bind the texture we render to as active TEXTURE_2D
 */
 gl.bindTexture(gl.TEXTURE_2D, renderTexture)
 {
   const drawPrimitive = gl.TRIANGLES
   const vertexArrayOffset = 0
   const numberOfVertices = 6 // 6 vertices = 2 triangles = 1 quad
   gl.drawArrays(drawPrimitive, vertexArrayOffset, numberOfVertices)
 }
 /*
   Just like everything else, unbind our texture once we are done rendering
 */
 gl.bindTexture(gl.TEXTURE_2D, null)
 gl.useProgram(null)
 gl.bindVertexArray(null)
 requestAnimationFrame(updateFrame)
}
```

```text
function makeTexture (textureWidth = canvas.width, textureHeight = canvas.height) { 
  /*
   Initialize internal format & texture type to default values
  */
  let internalFormat = gl.RGBA
  let type = gl.UNSIGNED_BYTE
  
  /*
    Check if optional extensions are present on device
  */
  const rgba32fSupported = gl.getExtension(&#039;EXT_color_buffer_float&#039;) && gl.getExtension(&#039;OES_texture_float_linear&#039;)
  
  if (rgba32fSupported) {
    internalFormat = gl.RGBA32F
    type = gl.FLOAT
  } else {
    /*
      Check if optional fallback extensions are present on device
    */
    const rgba16fSupported = gl.getExtension(&#039;EXT_color_buffer_half_float&#039;) && gl.getExtension(&#039;OES_texture_half_float_linear&#039;)
    if (rgba16fSupported) {
      internalFormat = gl.RGBA16F
      type = gl.HALF_FLOAT
    }
  }

  /* rest of code */
  
  /*
    Pass in correct internalFormat and textureType to texImage2D call 
  */
  gl.texImage2D(gl.TEXTURE_2D, level, internalFormat, textureWidth, textureHeight, border, format, type, data)

  /* rest of code */
}
```