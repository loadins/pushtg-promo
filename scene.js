/* ═════════════════════════════════════════════════════════════════════
 PUSHTG — promo / scene.js
 Lusion-inspired: displaced blob + bloom + floating fragments.
 ═════════════════════════════════════════════════════════════════════ \*/

console.log('\[PUSHTG·3D\] booting scene module');

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';

console.log('\[PUSHTG·3D\] modules loaded · THREE r' + THREE.REVISION);

const RM = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const COLORS = {
 blue: new THREE.Color(0x4F7AFF),
 violet: new THREE.Color(0x7C3AED),
 cyan: new THREE.Color(0x22D3EE),
 pink: new THREE.Color(0xEC4899),
 red: new THREE.Color(0xEF4444),
 amber: new THREE.Color(0xF59E0B),
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
 vec3 i = floor(v + dot(v, C.yyy));
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
 vec3 col = base + uColorRim * rim * 0.72;

 // subtle pulse
 col *= 0.51 + 0.09 * sin(uTime * 0.6);

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

 this.bloomStrength = 0.54;
 this.bloomTarget = 0.54;

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
 console.log('\[PUSHTG·3D\] scene initialised · objects:', this.scene.children.length);

 // kick off async load of real Telegram brand SVGs — fragments
 // start as placeholder shapes and get swapped in once SVGs arrive
 this.loadTelegramIcons();

 // always render once for static / RM
 this.renderStatic();
 if (!RM) this.tick();
 } catch (err) {
 console.error('\[PUSHTG·3D\] init failed:', err);
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
 console.warn('\[PUSHTG·3D\] WebGL failed, retrying without WebGL2:', e);
 this.renderer = new THREE.WebGLRenderer({
 canvas: this.canvas,
 antialias: false,
 alpha: false,
 failIfMajorPerformanceCaveat: false,
 });
 }
 const gl = this.renderer.getContext();
 console.log('\[PUSHTG·3D\] renderer:', gl.getParameter(gl.RENDERER));
 this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
 this.renderer.setSize(window.innerWidth, window.innerHeight, false);
 this.renderer.setClearColor(0x04060F, 1);
 this.renderer.outputColorSpace = THREE.SRGBColorSpace;
 this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
 this.renderer.toneMappingExposure = 2;
 }

 setupCamera() {
 this.scene = new THREE.Scene();
 this.scene.fog = new THREE.FogExp2(0x04060F, 0.045);

 this.camera = new THREE.PerspectiveCamera(
 52, window.innerWidth / window.innerHeight, 0.1, 100
 );
 this.camera.position.set(0, 0, this.camDist);

 // minimal lighting — geometry uses custom shader, but fragments use standard mats
 this.scene.add(new THREE.AmbientLight(0xffffff, 0.3));
 const pt = new THREE.PointLight(0x4F7AFF, 1.2, 12);
 pt.position.set(3, 2, 4);
 this.scene.add(pt);
 const pt2 = new THREE.PointLight(0x7C3AED, 0.84, 14);
 pt2.position.set(-3, -1, 3);
 this.scene.add(pt2);
 }

 // main object — atom (nucleus + 3 elliptical electron orbits)
 buildBlob() {
 this.atom = new THREE.Group();
 this.atom.position.set(0.6, -0.15, 0);

 // ── nucleus: glowing core sphere
 const nucGeo = new THREE.IcosahedronGeometry(0.55, 4);
 this.blobMat = new THREE.MeshPhysicalMaterial({
 color: 0x1a2d5e,
 emissive: 0x4F7AFF,
 emissiveIntensity: 0.96,
 metalness: 0.4,
 roughness: 0.15,
 clearcoat: 0.6,
 clearcoatRoughness: 0.2,
 envMapIntensity: 0.48,
 });
 this.nucleus = new THREE.Mesh(nucGeo, this.blobMat);
 this.atom.add(this.nucleus);

 // small wire shell for tech feel
 const wireGeo = new THREE.IcosahedronGeometry(0.62, 1);
 const wireMat = new THREE.MeshBasicMaterial({
 wireframe: true,
 transparent: true,
 opacity: 0.15,
 color: 0x4F7AFF,
 depthWrite: false,
 });
 this.blobWire = new THREE.Mesh(wireGeo, wireMat);
 this.atom.add(this.blobWire);

 // ── electron orbits: 3 ellipse rings at different angles
 this.orbits = [];
 this.electrons = [];
 const orbitConfigs = [
 { a: 1.8, b: 1.2, rotX: 0, rotY: 0, rotZ: 0, speed: 1.2 },
 { a: 1.7, b: 1.3, rotX: Math.PI/3, rotY: Math.PI/4, rotZ: 0, speed: -1.6 },
 { a: 1.9, b: 1.1, rotX: -Math.PI/4, rotY: Math.PI/2, rotZ: Math.PI/6, speed: 0.9 },
 ];

 orbitConfigs.forEach((cfg, i) => {
 // ring (ellipse) — built from points to allow non-circular shape
 const pts = [];
 const segs = 128;
 for (let s = 0; s <= segs; s++) {
 const t = (s / segs) * Math.PI * 2;
 pts.push(new THREE.Vector3(Math.cos(t) * cfg.a, Math.sin(t) * cfg.b, 0));
 }
 const ringGeo = new THREE.BufferGeometry().setFromPoints(pts);
 const ringMat = new THREE.LineBasicMaterial({
 color: 0x4F7AFF,
 transparent: true,
 opacity: 0.24,
 });
 const ring = new THREE.Line(ringGeo, ringMat);
 ring.rotation.set(cfg.rotX, cfg.rotY, cfg.rotZ);
 ring.userData = cfg;
 this.atom.add(ring);
 this.orbits.push(ring);

 // electron — small glowing sphere following the ellipse
 const eGeo = new THREE.SphereGeometry(0.09, 16, 16);
 const eMat = new THREE.MeshStandardMaterial({
 color: 0xffffff,
 emissive: 0x4F7AFF,
 emissiveIntensity: 1.5,
 });
 const electron = new THREE.Mesh(eGeo, eMat);
 electron.userData = { ...cfg, phase: i * 1.5 };
 this.atom.add(electron);
 this.electrons.push(electron);
 });

 this.scene.add(this.atom);

 // alias so legacy update code that touches this.blob still works
 this.blob = this.nucleus;
 }

 // ── Telegram icon shape builders (2D silhouettes → 3D extruded) ──
 makePaperPlaneShape() {
 // simplified TG paper plane silhouette
 const s = new THREE.Shape();
 s.moveTo(-0.5, 0.0);
 s.lineTo( 0.5, 0.45);
 s.lineTo( 0.15, 0.05);
 s.lineTo( 0.5, -0.45);
 s.lineTo(-0.5, 0.0);
 return s;
 }
 makePremiumStarShape() {
 // 5-point star — Telegram Premium emblem
 const s = new THREE.Shape();
 const spikes = 5;
 const outer = 0.45;
 const inner = 0.19;
 for (let i = 0; i < spikes * 2; i++) {
 const r = i % 2 === 0 ? outer : inner;
 const a = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
 const x = Math.cos(a) * r;
 const y = Math.sin(a) * r;
 if (i === 0) s.moveTo(x, y); else s.lineTo(x, y);
 }
 return s;
 }
 makeCheckShape() {
 // verified checkmark — thick stroke as polygon
 const s = new THREE.Shape();
 s.moveTo(-0.35, -0.02);
 s.lineTo(-0.10, -0.30);
 s.lineTo( 0.40, 0.25);
 s.lineTo( 0.30, 0.36);
 s.lineTo(-0.12, -0.06);
 s.lineTo(-0.26, 0.10);
 s.lineTo(-0.35, -0.02);
 return s;
 }
 makeCircleShape(r=0.32) {
 // chat bubble dot / avatar
 const s = new THREE.Shape();
 s.absarc(0, 0, r, 0, Math.PI * 2, false);
 return s;
 }
 makeChatBubbleShape() {
 // rounded bubble with tail (very stylised)
 const s = new THREE.Shape();
 const w = 0.5, h = 0.35, r = 0.12;
 s.moveTo(-w + r, -h);
 s.lineTo( w - r, -h);
 s.quadraticCurveTo( w, -h, w, -h + r);
 s.lineTo( w, h - r);
 s.quadraticCurveTo( w, h, w - r, h);
 s.lineTo(-w + r, h);
 s.quadraticCurveTo(-w, h, -w, h - r);
 s.lineTo(-w, -h + r + 0.12);
 s.lineTo(-w - 0.18, -h); // tail
 s.lineTo(-w, -h + 0.04);
 s.lineTo(-w, -h + r);
 s.quadraticCurveTo(-w, -h, -w + r, -h);
 return s;
 }

 // floating Telegram emblems orbiting in the void (replaces abstract fragments)
 buildFragments() {
 this.fragments = new THREE.Group();
 const count = 14;

 // build geometries once
 const extrudeOpts = { depth: 0.08, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2, curveSegments: 12 };
 const shapes = [
 new THREE.ExtrudeGeometry(this.makePaperPlaneShape(), extrudeOpts),
 new THREE.ExtrudeGeometry(this.makePremiumStarShape(), extrudeOpts),
 new THREE.ExtrudeGeometry(this.makeCheckShape(), extrudeOpts),
 new THREE.ExtrudeGeometry(this.makeChatBubbleShape(), extrudeOpts),
 new THREE.ExtrudeGeometry(this.makeCircleShape(0.28), extrudeOpts),
 ];
 // center each geometry on its own pivot
 shapes.forEach(g => g.center());

 // Telegram brand-aligned palette
 const tgColors = [
 0x2AABEE, // Telegram blue
 0x229ED9, // darker TG blue
 0xFFC93A, // Premium gold
 0xFFFFFF, // verified white
 0x7C3AED, // accent violet
 ];

 for (let i = 0; i < count; i++) {
 const g = shapes[i % shapes.length];
 const c = tgColors[i % tgColors.length];
 const m = new THREE.MeshStandardMaterial({
 color: c,
 emissive: c,
 emissiveIntensity: 0.33,
 roughness: 0.3,
 metalness: 0.5,
 });
 const mesh = new THREE.Mesh(g, m);
 const r = 2.6 + Math.random() * 2.4;
 const a = (i / count) * Math.PI * 2 + Math.random() * 0.6;
 const h = (Math.random() - 0.5) * 2.4;
 mesh.position.set(Math.cos(a) * r, h, Math.sin(a) * r);
 mesh.scale.setScalar(0.7 + Math.random() * 0.5);
 mesh.userData = {
 baseY: h,
 speed: 0.3 + Math.random() * 0.4,
 phase: Math.random() * Math.PI * 2,
 rotSpeed: new THREE.Vector3(
 (Math.random() - 0.5) * 0.5,
 (Math.random() - 0.5) * 0.6,
 (Math.random() - 0.5) * 0.4,
 ),
 // mark some as "branded" so they don't get color-overridden in tick()
 branded: i % 5 < 3,
 };
 this.fragments.add(mesh);
 }
 this.scene.add(this.fragments);
 }

 // ── load REAL brand SVGs from iconify CDN (CORS-enabled) and swap geometry ──
 // sources: iconify.design (huge open icon DB), simpleicons via iconify alias.
 // we fetch a small set, parse with three's SVGLoader, extrude into 3D, then
 // replace placeholder geometries on the fragments in-place.
 loadTelegramIcons() {
 // chosen iconify ids:
 // logos:telegram — official Telegram brand mark (paper plane in circle)
 // mdi:send — bare paper plane outline
 // mdi:star-four-points — premium-like 4-point star
 // mdi:check-decagram — verified badge (decagon + check)
 // mdi:bell — notification bell
 // mdi:account-circle — avatar circle
 const ids = [
 'logos:telegram',
 'mdi:send',
 'mdi:star-four-points',
 'mdi:check-decagram',
 'mdi:bell',
 'mdi:account-circle',
 ];
 const urls = ids.map(id => `https://api.iconify.design/${id.replace(':', '/')}.svg`);

 const loader = new SVGLoader();

 Promise.all(urls.map((url, i) =>
 fetch(url)
 .then(r => {
 if (!r.ok) throw new Error('HTTP ' + r.status);
 return r.text();
 })
 .then(svgText => {
 // SVGLoader.parse() returns { paths, xml }
 const data = loader.parse(svgText);
 return { id: ids[i], data };
 })
 .catch(err => {
 console.warn('\[PUSHTG·3D\] icon load failed:', ids[i], err.message);
 return null;
 })
 ))
 .then(results => {
 const ok = results.filter(Boolean);
 if (!ok.length) {
 console.warn('\[PUSHTG·3D\] no icons loaded, keeping placeholders');
 return;
 }
 console.log('\[PUSHTG·3D\] icons loaded:', ok.map(o => o.id).join(', '));

 // build extruded geometries from each loaded icon
 const extrudeOpts = {
 depth: 6, // raw SVG coords are big (~24px viewBox), we scale later
 bevelEnabled: true,
 bevelThickness: 1.2,
 bevelSize: 1.0,
 bevelSegments: 2,
 curveSegments: 12,
 };

 const iconGeos = ok.map(({ id, data }) => {
 const geos = [];
 data.paths.forEach(path => {
 // shapes: SVGLoader gives ready-to-use THREE.Shape objects per path
 const shapes = SVGLoader.createShapes(path);
 shapes.forEach(shape => {
 try {
 const g = new THREE.ExtrudeGeometry(shape, extrudeOpts);
 geos.push(g);
 } catch (e) { /* skip malformed shape */ }
 });
 });
 if (!geos.length) return null;

 // merge into single geometry (THREE has no built-in merge w/o BufferGeometryUtils,
 // so we just take the largest one — works fine for icons with one main path)
 let main = geos[0];
 let maxVerts = main.attributes.position.count;
 for (let i = 1; i < geos.length; i++) {
 if (geos[i].attributes.position.count > maxVerts) {
 main = geos[i];
 maxVerts = geos[i].attributes.position.count;
 }
 }
 // dispose extras
 geos.forEach(g => { if (g !== main) g.dispose(); });

 // SVG y-axis is flipped relative to three's coords → flip back
 main.scale(1, -1, 1);
 // center on origin
 main.center();
 // normalize so the biggest dimension == 1, then scale to taste
 main.computeBoundingBox();
 const bb = main.boundingBox;
 const size = Math.max(
 bb.max.x - bb.min.x,
 bb.max.y - bb.min.y,
 );
 if (size > 0) {
 const s = 0.7 / size; // target ~0.7 world units
 main.scale(s, s, s);
 }
 // need normals for lighting after all those transforms
 main.computeVertexNormals();
 return { id, geo: main };
 }).filter(Boolean);

 if (!iconGeos.length) return;

 // brand-aligned colors keyed by icon id
 const colorMap = {
 'logos:telegram': 0x2AABEE,
 'mdi:send': 0x229ED9,
 'mdi:star-four-points': 0xFFC93A,
 'mdi:check-decagram': 0x2AABEE,
 'mdi:bell': 0xFFFFFF,
 'mdi:account-circle': 0x7C3AED,
 };

 // swap placeholder fragments' geometry & material with the real ones
 this.fragments.children.forEach((mesh, i) => {
 const pick = iconGeos[i % iconGeos.length];
 // dispose placeholder geometry to free GPU memory
 if (mesh.geometry) mesh.geometry.dispose();
 mesh.geometry = pick.geo;
 const c = colorMap[pick.id] ?? 0x2AABEE;
 mesh.material.color.setHex(c);
 mesh.material.emissive.setHex(c);
 mesh.userData.branded = true; // keep TG identity colors, don't repaint
 });
 });
 }

 // particle field — additive bright points
 buildParticles() {
 const count = 600;
 const positions = new Float32Array(count * 3);
 const speeds = new Float32Array(count);
 const phases = new Float32Array(count);
 for (let i = 0; i < count; i++) {
 const r = 2.0 + Math.random() * 8.0;
 const theta = Math.random() * Math.PI * 2;
 const phi = Math.acos(2 * Math.random() - 1);
 positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
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
 opacity: 0.51,
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
 a = pow(a, 2.0) * 0.33;
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
 this.bloomStrength, // strength
 0.85, // radius
 0.22, // threshold
 );
 this.composer.addPass(this.bloom);
 this.composer.addPass(new OutputPass());
 this.composer.setSize(window.innerWidth, window.innerHeight);
 this.composer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
 } catch (e) {
 console.warn('\[PUSHTG·3D\] composer/bloom failed, fallback to basic render:', e);
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
 this.bloomTarget = 0.54;
 break;
 case 'pain':
 this.distortTarget = 0.6;
 this.jitterTarget = 1.0;
 this.camDistTarget = 4.4;
 this.camYTarget = -0.4;
 this.bloomTarget = 0.84;
 break;
 case 'shift':
 this.distortTarget = 0.35;
 this.jitterTarget = 0.2;
 this.camDistTarget = 5.0;
 this.camYTarget = 0.1;
 this.bloomTarget = 0.66;
 break;
 case 'solution':
 this.distortTarget = 0.22;
 this.jitterTarget = 0;
 this.camDistTarget = 5.6;
 this.camYTarget = 0.2;
 this.bloomTarget = 0.57;
 break;
 case 'numbers':
 this.distortTarget = 0.18;
 this.jitterTarget = 0;
 this.camDistTarget = 7.0;
 this.camYTarget = 0.3;
 this.bloomTarget = 0.48;
 break;
 case 'cta':
 this.distortTarget = 0.4;
 this.jitterTarget = 0;
 this.camDistTarget = 3.6;
 this.camYTarget = 0;
 this.bloomTarget = 0.9;
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

 // atom: rotate whole group + animate nucleus material
 if (this.atom) {
 this.atom.rotation.x = this.time * 0.12 + this.mouse.y * 0.25;
 this.atom.rotation.y = this.time * 0.18 + this.mouse.x * 0.35;
 }
 if (this.blob) {
 // nucleus inner spin for extra life
 this.blob.rotation.y = this.time * 0.5;
 if (this.blobMat) {
 this.blobMat.color.lerp(this.colorA, 0.03);
 this.blobMat.emissive.lerp(this.colorA, 0.03);
 }
 if (this.blobWire && this.blobWire.material) {
 this.blobWire.material.color.lerp(this.colorA, 0.03);
 }
 }

 // electrons travelling along their elliptical orbits
 if (this.electrons) {
 this.electrons.forEach((e, i) => {
 const u = e.userData;
 const t = this.time * u.speed + u.phase;
 // local-space position on ellipse
 const lx = Math.cos(t) * u.a;
 const ly = Math.sin(t) * u.b;
 // rotate by orbit's euler to put electron onto the tilted plane
 const v = new THREE.Vector3(lx, ly, 0);
 v.applyEuler(new THREE.Euler(u.rotX, u.rotY, u.rotZ));
 e.position.copy(v);
 // tint electron with current accent
 if (e.material) e.material.emissive.lerp(this.colorA, 0.04);
 });
 // tint orbit rings
 if (this.orbits) {
 this.orbits.forEach(o => {
 if (o.material) o.material.color.lerp(this.colorA, 0.03);
 });
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
 // only non-branded fragments follow the palette swap;
 // TG-branded icons (plane, star, check) keep their identity colors
 if (!u.branded) {
 const c = i % 2 === 0 ? this.colorA : this.colorB;
 m.material.color.lerp(c, 0.02);
 m.material.emissive.lerp(c, 0.02);
 }
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
 parr[p] = pbase[p] + Math.sin(this.time * sp + ph) * 0.05;
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
 setScene: (n) => { instance.setScene(n); if (RM) instance.renderStatic(); },
 setMode: (m) => { instance.setMode(m); if (RM) instance.renderStatic(); },
 };
 console.log('\[PUSHTG·3D\] boot complete · PromoScene exposed');
 } catch (err) {
 console.error('\[PUSHTG·3D\] boot error:', err);
 window.PromoScene = { setScroll(){}, setScene(){}, setMode(){} };
 }
} else {
 console.warn('\[PUSHTG·3D\] canvas #scene not found');
 window.PromoScene = { setScroll(){}, setScene(){}, setMode(){} };
}
