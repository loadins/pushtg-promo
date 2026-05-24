/* ═════════════════════════════════════════════════════════════════════
   PUSHTG — promo / scene.js
   Lusion-inspired: displaced blob + bloom + floating fragments.
   ═════════════════════════════════════════════════════════════════════ */

console.log('[PUSHTG·3D] booting scene module');

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

console.log('[PUSHTG·3D] modules loaded · THREE r' + THREE.REVISION);

const RM = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const COLORS = {
  blue:   new THREE.Color(0x4F7AFF),
  violet: new THREE.Color(0x7C3AED),
  cyan:   new THREE.Color(0x22D3EE),
  pink:   new THREE.Color(0xEC4899),
  red:    new THREE.Color(0xEF4444),
  amber:  new THREE.Color(0xF59E0B),
};

// ──────────────────────────────────────────────────────────────────────
// shaders
// ──────────────────────────────────────────────────────────────────────
const BLOB_VERT = `
  uniform float uTime;
  uniform float uDistort;
  uniform float uJitter;
  varying vec3 vNormal;
  varying vec3 vPos;
  varying float vNoise;

  // classic 3d simplex noise (Ashima) — compact form
  vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
  vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
  float snoise(vec3 v){
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    i = mod(i, 289.0);
    vec4 p = permute(permute(permute(
      i.z + vec4(0.0, i1.z, i2.z, 1.0))
      + i.y + vec4(0.0, i1.y, i2.y, 1.0))
      + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 1.0/7.0;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z *ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ *ns.x + ns.yyyy;
    vec4 y = y_ *ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0)*2.0 + 1.0;
    vec4 s1 = floor(b1)*2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
  }

  void main(){
    vec3 p = position;
    float t = uTime * 0.4;
    float n = snoise(p * 1.2 + vec3(t, t * 0.7, -t * 0.5));
    float n2 = snoise(p * 2.4 + vec3(-t, t, t));
    float disp = n * uDistort + n2 * uJitter * 0.5;
    p += normal * disp;
    vNoise = n;
    vNormal = normalize(normalMatrix * normal);
    vPos = (modelMatrix * vec4(p, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const BLOB_FRAG = `
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform vec3 uColorRim;
  uniform float uTime;
  varying vec3 vNormal;
  varying vec3 vPos;
  varying float vNoise;

  void main(){
    // gradient based on noise + view
    float mixT = clamp(vNoise * 0.5 + 0.5, 0.0, 1.0);
    vec3 base = mix(uColorA, uColorB, mixT);

    // fresnel rim
    vec3 viewDir = normalize(cameraPosition - vPos);
    float rim = 1.0 - max(dot(viewDir, vNormal), 0.0);
    rim = pow(rim, 2.2);
    vec3 col = base + uColorRim * rim * 1.2;

    // subtle pulse
    col *= 0.85 + 0.15 * sin(uTime * 0.6);

    gl_FragColor = vec4(col, 1.0);
  }
`;

// ──────────────────────────────────────────────────────────────────────
// scene class
// ──────────────────────────────────────────────────────────────────────
class Scene {
  constructor(canvas) {
    this.canvas = canvas;
    this.scroll = 0;
    this.scrollY = 0;
    this.sceneName = 'intro';
    this.mode = 'solution';
    this.time = 0;

    this.mouse = new THREE.Vector2(0, 0);
    this.mouseTarget = new THREE.Vector2(0, 0);

    // dynamic palette (lerped)
    this.colorA = COLORS.blue.clone();
    this.colorB = COLORS.violet.clone();
    this.colorRim = COLORS.cyan.clone();
    this.colorTargetA = this.colorA.clone();
    this.colorTargetB = this.colorB.clone();
    this.colorTargetRim = this.colorRim.clone();

    this.jitter = 0;
    this.jitterTarget = 0;
    this.distort = 0.25;
    this.distortTarget = 0.25;

    this.camDist = 5.2;
    this.camDistTarget = 5.2;
    this.camY = 0;
    this.camYTarget = 0;

    this.bloomStrength = 0.9;
    this.bloomTarget = 0.9;

    this.clock = new THREE.Clock();
    this.init();
  }

  init() {
    try {
      this.setupRenderer();
      this.setupCamera();
      this.buildBlob();
      this.buildFragments();
      this.buildParticles();
      this.buildHaloGlow();
      this.setupComposer();
      this.setupListeners();

      this.canvas.classList.add('is-ready');
      console.log('[PUSHTG·3D] scene initialised · objects:', this.scene.children.length);

      // always render once for static / RM
      this.renderStatic();
      if (!RM) this.tick();
    } catch (err) {
      console.error('[PUSHTG·3D] init failed:', err);
      const t = document.getElementById('loaderStatus');
      if (t) t.textContent = '3d init err — ' + err.message.slice(0, 40);
    }
  }

  setupRenderer() {
    try {
      this.renderer = new THREE.WebGLRenderer({
        canvas: this.canvas,
        antialias: true,
        alpha: false,
        failIfMajorPerformanceCaveat: false,
      });
    } catch (e) {
      console.warn('[PUSHTG·3D] WebGL failed, retrying without WebGL2:', e);
      this.renderer = new THREE.WebGLRenderer({
        canvas: this.canvas,
        antialias: false,
        alpha: false,
        failIfMajorPerformanceCaveat: false,
      });
    }
    const gl = this.renderer.getContext();
    console.log('[PUSHTG·3D] renderer:', gl.getParameter(gl.RENDERER));
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.renderer.setClearColor(0x04060F, 1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
  }

  setupCamera() {
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x04060F, 0.045);

    this.camera = new THREE.PerspectiveCamera(
      52, window.innerWidth / window.innerHeight, 0.1, 100
    );
    this.camera.position.set(0, 0, this.camDist);

    // minimal lighting — geometry uses custom shader, but fragments use standard mats
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const pt = new THREE.PointLight(0x4F7AFF, 2.0, 12);
    pt.position.set(3, 2, 4);
    this.scene.add(pt);
    const pt2 = new THREE.PointLight(0x7C3AED, 1.4, 14);
    pt2.position.set(-3, -1, 3);
    this.scene.add(pt2);
  }

  // main blob — the centrepiece (standard material for cross-browser compat)
  buildBlob() {
    const geo = new THREE.IcosahedronGeometry(1.5, 64);
    this.blobMat = new THREE.MeshPhysicalMaterial({
      color: 0x1a2d5e,
      emissive: 0x4F7AFF,
      emissiveIntensity: 0.5,
      metalness: 0.4,
      roughness: 0.15,
      clearcoat: 0.5,
      clearcoatRoughness: 0.2,
      envMapIntensity: 0.8,
    });
    this.blob = new THREE.Mesh(geo, this.blobMat);
    this.blob.position.set(0.6, -0.15, 0);
    this.scene.add(this.blob);

    // wireframe overlay for tech feel
    const wireGeo = new THREE.IcosahedronGeometry(1.55, 2);
    const wireMat = new THREE.MeshBasicMaterial({
      wireframe: true,
      transparent: true,
      opacity: 0.12,
      color: 0x4F7AFF,
      depthWrite: false,
    });
    this.blobWire = new THREE.Mesh(wireGeo, wireMat);
    this.blobWire.position.copy(this.blob.position);
    this.scene.add(this.blobWire);
  }

  // floating accent fragments — small geometry pieces orbiting in the void
  buildFragments() {
    this.fragments = new THREE.Group();
    const count = 14;
    const shapes = [
      new THREE.OctahedronGeometry(0.18, 0),
      new THREE.TetrahedronGeometry(0.22, 0),
      new THREE.BoxGeometry(0.22, 0.22, 0.22),
      new THREE.TorusGeometry(0.2, 0.05, 12, 24),
    ];
    for (let i = 0; i < count; i++) {
      const g = shapes[i % shapes.length];
      const m = new THREE.MeshStandardMaterial({
        color: i % 2 === 0 ? 0x4F7AFF : 0x7C3AED,
        emissive: i % 2 === 0 ? 0x4F7AFF : 0x7C3AED,
        emissiveIntensity: 0.4,
        roughness: 0.25,
        metalness: 0.6,
      });
      const mesh = new THREE.Mesh(g, m);
      const r = 2.6 + Math.random() * 2.4;
      const a = (i / count) * Math.PI * 2 + Math.random() * 0.6;
      const h = (Math.random() - 0.5) * 2.4;
      mesh.position.set(Math.cos(a) * r, h, Math.sin(a) * r);
      mesh.userData = {
        baseY: h,
        speed: 0.3 + Math.random() * 0.4,
        phase: Math.random() * Math.PI * 2,
        rotSpeed: new THREE.Vector3(
          (Math.random() - 0.5) * 0.5,
          (Math.random() - 0.5) * 0.6,
          (Math.random() - 0.5) * 0.4,
        ),
      };
      this.fragments.add(mesh);
    }
    this.scene.add(this.fragments);
  }

  // particle field — additive bright points
  buildParticles() {
    const count = 1800;
    const positions = new Float32Array(count * 3);
    const speeds = new Float32Array(count);
    const phases = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const r = 2.0 + Math.random() * 8.0;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
      speeds[i] = 0.2 + Math.random() * 0.6;
      phases[i] = Math.random() * Math.PI * 2;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.04,
      color: 0xffffff,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });
    this.particles = new THREE.Points(geo, mat);
    this.particleBase = positions.slice();
    this.particleSpeeds = speeds;
    this.particlePhases = phases;
    this.scene.add(this.particles);
  }

  // radial glow plane behind blob — adds atmospheric bloom anchor
  buildHaloGlow() {
    const geo = new THREE.PlaneGeometry(10, 10, 1, 1);
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uColor: { value: this.colorA.clone() },
      },
      vertexShader: `
        varying vec2 vUv;
        void main(){
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        varying vec2 vUv;
        void main(){
          float d = distance(vUv, vec2(0.5));
          float a = smoothstep(0.5, 0.0, d);
          a = pow(a, 2.0) * 0.55;
          gl_FragColor = vec4(uColor, a);
        }
      `,
    });
    this.halo = new THREE.Mesh(geo, mat);
    this.halo.position.set(0.6, -0.15, -2.5);
    this.scene.add(this.halo);
  }

  setupComposer() {
    try {
      this.composer = new EffectComposer(this.renderer);
      this.composer.addPass(new RenderPass(this.scene, this.camera));

      this.bloom = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        this.bloomStrength,  // strength
        0.85,                // radius
        0.22,                // threshold
      );
      this.composer.addPass(this.bloom);
      this.composer.addPass(new OutputPass());
      this.composer.setSize(window.innerWidth, window.innerHeight);
      this.composer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    } catch (e) {
      console.warn('[PUSHTG·3D] composer/bloom failed, fallback to basic render:', e);
      this.composer = null;
      this.bloom = null;
    }
  }

  setupListeners() {
    window.addEventListener('resize', () => this.onResize());
    if (!('ontouchstart' in window)) {
      window.addEventListener('mousemove', (e) => {
        this.mouseTarget.x = (e.clientX / window.innerWidth) * 2 - 1;
        this.mouseTarget.y = -(e.clientY / window.innerHeight) * 2 + 1;
      });
    }
  }

  onResize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
    if (this.composer) this.composer.setSize(w, h);
    if (this.bloom) this.bloom.setSize(w, h);
  }

  setScroll(progress, scrollY) {
    this.scroll = progress;
    this.scrollY = scrollY;
  }

  setScene(name) {
    this.sceneName = name;
    switch (name) {
      case 'intro':
        this.distortTarget = 0.25;
        this.jitterTarget = 0;
        this.camDistTarget = 5.2;
        this.camYTarget = 0;
        this.bloomTarget = 0.9;
        break;
      case 'pain':
        this.distortTarget = 0.6;
        this.jitterTarget = 1.0;
        this.camDistTarget = 4.4;
        this.camYTarget = -0.4;
        this.bloomTarget = 1.4;
        break;
      case 'shift':
        this.distortTarget = 0.35;
        this.jitterTarget = 0.2;
        this.camDistTarget = 5.0;
        this.camYTarget = 0.1;
        this.bloomTarget = 1.1;
        break;
      case 'solution':
        this.distortTarget = 0.22;
        this.jitterTarget = 0;
        this.camDistTarget = 5.6;
        this.camYTarget = 0.2;
        this.bloomTarget = 0.95;
        break;
      case 'numbers':
        this.distortTarget = 0.18;
        this.jitterTarget = 0;
        this.camDistTarget = 7.0;
        this.camYTarget = 0.3;
        this.bloomTarget = 0.8;
        break;
      case 'cta':
        this.distortTarget = 0.4;
        this.jitterTarget = 0;
        this.camDistTarget = 3.6;
        this.camYTarget = 0;
        this.bloomTarget = 1.5;
        break;
    }
  }

  setMode(mode) {
    this.mode = mode;
    if (mode === 'pain') {
      this.colorTargetA = COLORS.red.clone();
      this.colorTargetB = COLORS.amber.clone();
      this.colorTargetRim = COLORS.pink.clone();
    } else {
      this.colorTargetA = COLORS.blue.clone();
      this.colorTargetB = COLORS.violet.clone();
      this.colorTargetRim = COLORS.cyan.clone();
    }
  }

  renderStatic() {
    if (this.composer) {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }

  tick() {
    requestAnimationFrame(() => this.tick());
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.time += dt;

    // lerp mouse + dynamic state
    this.mouse.x += (this.mouseTarget.x - this.mouse.x) * 0.06;
    this.mouse.y += (this.mouseTarget.y - this.mouse.y) * 0.06;
    this.jitter += (this.jitterTarget - this.jitter) * 0.04;
    this.distort += (this.distortTarget - this.distort) * 0.03;
    this.camDist += (this.camDistTarget - this.camDist) * 0.03;
    this.camY += (this.camYTarget - this.camY) * 0.03;
    this.bloomStrength += (this.bloomTarget - this.bloomStrength) * 0.04;
    this.colorA.lerp(this.colorTargetA, 0.035);
    this.colorB.lerp(this.colorTargetB, 0.035);
    this.colorRim.lerp(this.colorTargetRim, 0.035);

    // camera dolly + parallax
    this.camera.position.x = this.mouse.x * 0.6;
    this.camera.position.y = this.mouse.y * 0.4 + this.camY - this.scroll * 0.5;
    this.camera.position.z = this.camDist + Math.sin(this.time * 0.18) * 0.12;
    this.camera.lookAt(0, this.camY * 0.4, 0);

    // blob: rotate + colour animate
    if (this.blob) {
      this.blob.rotation.x = this.time * 0.12 + this.mouse.y * 0.25;
      this.blob.rotation.y = this.time * 0.18 + this.mouse.x * 0.35;
      if (this.blobMat) {
        this.blobMat.color.lerp(this.colorA, 0.03);
        this.blobMat.emissive.lerp(this.colorA, 0.03);
      }
      this.blobWire.rotation.copy(this.blob.rotation);
      if (this.blobWire.material) {
        this.blobWire.material.color.lerp(this.colorA, 0.03);
      }
    }

    if (this.halo) {
      this.halo.material.uniforms.uColor.value.copy(this.colorA);
      this.halo.lookAt(this.camera.position);
    }

    // fragments — orbit + rotate
    if (this.fragments) {
      this.fragments.rotation.y = this.time * 0.05;
      this.fragments.children.forEach((m, i) => {
        const u = m.userData;
        m.position.y = u.baseY + Math.sin(this.time * u.speed + u.phase) * 0.3;
        m.rotation.x += u.rotSpeed.x * dt;
        m.rotation.y += u.rotSpeed.y * dt;
        m.rotation.z += u.rotSpeed.z * dt;
        // color match palette
        const c = i % 2 === 0 ? this.colorA : this.colorB;
        m.material.color.lerp(c, 0.02);
        m.material.emissive.lerp(c, 0.02);
      });
    }

    // particles — drift
    if (this.particles) {
      const ppos = this.particles.geometry.attributes.position;
      const parr = ppos.array;
      const pbase = this.particleBase;
      for (let i = 0; i < parr.length / 3; i++) {
        const p = i * 3;
        const sp = this.particleSpeeds[i];
        const ph = this.particlePhases[i];
        parr[p]     = pbase[p]     + Math.sin(this.time * sp + ph) * 0.05;
        parr[p + 1] = pbase[p + 1] + Math.cos(this.time * sp * 0.9 + ph) * 0.05;
        parr[p + 2] = pbase[p + 2] + Math.sin(this.time * sp * 0.7 + ph) * 0.04;
      }
      ppos.needsUpdate = true;
      this.particles.rotation.y = this.time * 0.02;
    }

    // bloom dynamic
    if (this.bloom) this.bloom.strength = this.bloomStrength;

    // render via composer (bloom!) or fallback to straight render
    if (this.composer) {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }
}

// ──────────────────────────────────────────────────────────────────────
// boot
// ──────────────────────────────────────────────────────────────────────
const canvas = document.getElementById('scene');
if (canvas) {
  try {
    const instance = new Scene(canvas);
    window.PromoScene = {
      setScroll: (p, y) => instance.setScroll(p, y),
      setScene:  (n)    => { instance.setScene(n); if (RM) instance.renderStatic(); },
      setMode:   (m)    => { instance.setMode(m);  if (RM) instance.renderStatic(); },
    };
    console.log('[PUSHTG·3D] boot complete · PromoScene exposed');
  } catch (err) {
    console.error('[PUSHTG·3D] boot error:', err);
    window.PromoScene = { setScroll(){}, setScene(){}, setMode(){} };
  }
} else {
  console.warn('[PUSHTG·3D] canvas #scene not found');
  window.PromoScene = { setScroll(){}, setScene(){}, setMode(){} };
}
