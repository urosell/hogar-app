/**
 * gatas.js — Gatas cartoon procedurales para Three.js
 * ----------------------------------------------------
 * Sin texturas ni modelos externos: todo se genera con geometría + colores por vértice,
 * sombreado toon y contorno de "dibujo animado" (inverted hull).
 *
 * Uso básico:
 *   import { createCat } from './gatas.js';
 *   const negra  = createCat('negra');
 *   const calico = createCat('calico');
 *   scene.add(negra.group, calico.group);
 *   negra.setFriend(calico); calico.setFriend(negra);   // para que a veces se acurruquen juntas
 *   negra.autonomous = true;                            // vida propia
 *   // en tu loop:  negra.update(dt); calico.update(dt);
 *
 * Acciones: 'stand' | 'sit' | 'loaf' | 'walk' | 'zoomies' | 'stretch' | 'groom' | 'sleep' | 'nap' | 'surprise'
 *   cat.play('sleep', { duration: 20 })
 *   cat.walkTo(x, z, { run: false, then: 'loaf' })
 *   cat.poke()                      // susto cómico (para cuando el usuario la toca)
 *   cat.onAction = (name) => {}     // callback cuando cambia de acción
 */
import * as THREE from 'three';

const TAU = Math.PI * 2;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const rand = (a, b) => a + Math.random() * (b - a);
const bump = (t, a, b) => { // 0→1→0 entre a y b
  if (t < a || t > b) return 0;
  return Math.sin(((t - a) / (b - a)) * Math.PI);
};

// ---------- ruido ----------
function hash3(x, y, z) {
  const h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return h - Math.floor(h);
}
function vnoise(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  let r = 0;
  for (let dx = 0; dx < 2; dx++) for (let dy = 0; dy < 2; dy++) for (let dz = 0; dz < 2; dz++) {
    const wt = (dx ? u : 1 - u) * (dy ? v : 1 - v) * (dz ? w : 1 - w);
    r += wt * hash3(xi + dx, yi + dy, zi + dz);
  }
  return r;
}
const fbm = (x, y, z) => vnoise(x, y, z) * 0.62 + vnoise(x * 2.1 + 5, y * 2.1, z * 2.1) * 0.28 + vnoise(x * 4.3, y * 4.3 + 9, z * 4.3) * 0.1;
const n1 = (t, seed = 0) => vnoise(t, seed * 17.3, seed * 3.1) * 2 - 1;

// ---------- presets (colores sacados de las fotos) ----------
export const CAT_PRESETS = {
  negra: {
    label: 'Negra',
    pattern: 'solid',
    fur: 0x2a2833, sheen: 0x4b4859,
    eye: 0xcfdc4e, eyeRim: 0x8a9a22,
    nose: 0x3a3037, earIn: 0x6e3e4d, mouthLine: 0x14121a, whisker: 0xe9e5ec,
    dims: { sx: 0.26, sy: 0.265, sz: 0.62 },
    headR: 0.24, headScale: [1.04, 0.94, 1.0],
    earSize: [0.105, 0.255],
    legR: 0.042, pawR: 0.058,
    tailR: [0.052, 0.03], tailLen: 0.92,
    rim: 0x8c86b8, rimStrength: 0.28,
    lidRest: 0.30,   // mirada de "te estoy juzgando"
    pupil: 0.30,
    seed: 1,
  },
  calico: {
    label: 'Calico',
    pattern: 'calico',
    white: 0xf7f2ea, orange: 0xe58b3a, orangeDark: 0xb15e27, black: 0x2b2527,
    eye: 0xc6d38c, eyeRim: 0x7c8a4a,
    nose: 0xf2a0ab, earIn: 0xf4b3bb, mouthLine: 0x8a5a52, whisker: 0xffffff,
    dims: { sx: 0.31, sy: 0.29, sz: 0.62 },
    headR: 0.255, headScale: [1.1, 0.96, 1.0],
    earSize: [0.1, 0.2],
    legR: 0.048, pawR: 0.062,
    tailR: [0.06, 0.034], tailLen: 0.84,
    rim: 0xfff0dc, rimStrength: 0.1,
    lidRest: 0.14,
    pupil: 0.42,
    seed: 2,
  },
};

// ---------- materiales compartidos ----------
const OUTLINE_COLOR = 0x241818;
let _shared = null;
function shared() {
  if (_shared) return _shared;
  const d = new Uint8Array([80, 80, 80, 255, 170, 170, 170, 255, 255, 255, 255, 255]);
  const grad = new THREE.DataTexture(d, 3, 1);
  grad.minFilter = grad.magFilter = THREE.NearestFilter;
  grad.needsUpdate = true;
  _shared = {
    grad,
    toon: new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: grad }),
    toonDouble: new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: grad, side: THREE.DoubleSide }),
    outline: new THREE.MeshBasicMaterial({ color: OUTLINE_COLOR, side: THREE.BackSide }),
    black: new THREE.MeshBasicMaterial({ color: 0x0c0a0b }),
    white: new THREE.MeshBasicMaterial({ color: 0xffffff }),
    zzz: makeZzzTexture(),
    shadow: makeShadowTexture(),
  };
  return _shared;
}

let CUR = null; // materiales de la gata que se está construyendo
function addRim(mat, color, strength) {
  mat.userData.rim = { color: { value: new THREE.Color(color) }, strength: { value: strength } };
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.rimColor = mat.userData.rim.color; sh.uniforms.rimStrength = mat.userData.rim.strength;
    sh.fragmentShader = 'uniform vec3 rimColor; uniform float rimStrength;\n' + sh.fragmentShader.replace(
      '#include <opaque_fragment>',
      `float fres = 1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0);
       outgoingLight += rimColor * rimStrength * smoothstep(0.62, 0.72, fres);
       #include <opaque_fragment>`);
  };
  mat.customProgramCacheKey = () => 'cat-rim';
  return mat;
}
function makeCatMats(cfg) {
  const S = shared();
  const rc = cfg.rim ?? 0x9a93c0, rs = cfg.rimStrength ?? 0.12;
  return {
    toon: addRim(new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: S.grad }), rc, rs),
    toonDouble: addRim(new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: S.grad, side: THREE.DoubleSide }), rc, rs),
    map: (tex) => addRim(new THREE.MeshToonMaterial({ map: tex, gradientMap: S.grad }), rc, rs),
  };
}

function makeZzzTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  g.font = 'bold 52px "Comic Sans MS", "Chalkboard SE", sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 8; g.strokeStyle = '#241818'; g.strokeText('z', 32, 34);
  g.fillStyle = '#fffaf0'; g.fillText('z', 32, 34);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function makeShadowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(32, 32, 4, 32, 32, 32);
  r.addColorStop(0, 'rgba(40,20,10,0.42)'); r.addColorStop(0.6, 'rgba(40,20,10,0.22)'); r.addColorStop(1, 'rgba(40,20,10,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

// ---------- utilidades de geometría ----------
const _v = new THREE.Vector3(), _n = new THREE.Vector3(), _c = new THREE.Color();
function colorize(geo, fn) {
  const p = geo.attributes.position, nrm = geo.attributes.normal;
  const arr = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    _v.fromBufferAttribute(p, i); _n.fromBufferAttribute(nrm, i);
    fn(_v, _c, _n);
    arr[i * 3] = _c.r; arr[i * 3 + 1] = _c.g; arr[i * 3 + 2] = _c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}
function inflate(geo, t) {
  const g = geo.clone();
  g.deleteAttribute('color');
  const p = g.attributes.position, nrm = g.attributes.normal;
  for (let i = 0; i < p.count; i++) {
    p.setXYZ(i, p.getX(i) + nrm.getX(i) * t, p.getY(i) + nrm.getY(i) * t, p.getZ(i) + nrm.getZ(i) * t);
  }
  return g;
}
const solid = (hex) => (v, c) => c.setHex(hex);
// Textura "pintada" en 3D para esferas escaladas: evalúa la función de color en cada texel.
function paintedSphere(geo, sx, sy, sz, colorFn, W = 512, H = 256, outline = 0.012) {
  const S = shared();
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d'); const img = ctx.createImageData(W, H);
  const v = new THREE.Vector3(), n = new THREE.Vector3(), c = new THREE.Color();
  for (let y = 0; y < H; y++) {
    const th = (y + 0.5) / H * Math.PI; // fila 0 = polo superior (flipY)
    const st = Math.sin(th), ct = Math.cos(th);
    for (let x = 0; x < W; x++) {
      const ph = (x + 0.5) / W * TAU;
      const ux = -Math.cos(ph) * st, uy = ct, uz = Math.sin(ph) * st;
      v.set(ux * sx, uy * sy, uz * sz);
      n.set(ux / sx, uy / sy, uz / sz).normalize();
      colorFn(v, c, n);
      const hex = c.getHex(), k = (y * W + x) * 4;
      img.data[k] = hex >> 16; img.data[k + 1] = (hex >> 8) & 255; img.data[k + 2] = hex & 255; img.data[k + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const mat = CUR.map(tex);
  const m = new THREE.Mesh(geo, mat);
  if (outline > 0) m.add(new THREE.Mesh(inflate(geo, outline), S.outline));
  return m;
}
function part(geo, colorFn, outline = 0.01, mat) {
  const S = shared();
  colorize(geo, colorFn);
  const m = new THREE.Mesh(geo, mat || CUR.toon);
  if (outline > 0) m.add(new THREE.Mesh(inflate(geo, outline), S.outline));
  return m;
}

// Tubo deformable (cola) con transporte paralelo
class Tube {
  constructor(N, R, material, colorFn) {
    this.N = N; this.R = R;
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(N * R * 3);
    this.nor = new Float32Array(N * R * 3);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(this.nor, 3));
    if (colorFn) {
      const col = new Float32Array(N * R * 3);
      for (let i = 0; i < N; i++) {
        colorFn(i / (N - 1), _c);
        for (let j = 0; j < R; j++) { const k = (i * R + j) * 3; col[k] = _c.r; col[k + 1] = _c.g; col[k + 2] = _c.b; }
      }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    }
    const idx = [];
    for (let i = 0; i < N - 1; i++) for (let j = 0; j < R; j++) {
      const a = i * R + j, b = i * R + (j + 1) % R, c = (i + 1) * R + j, d = (i + 1) * R + (j + 1) % R;
      idx.push(a, b, c, b, d, c);
    }
    g.setIndex(idx);
    this.geo = g;
    this.mesh = new THREE.Mesh(g, material);
    this.mesh.frustumCulled = false;
    this._t = new THREE.Vector3(); this._nn = new THREE.Vector3(); this._b = new THREE.Vector3();
  }
  update(pts, radii) {
    const { N, R, pos, nor } = this;
    const T = this._t, nv = this._nn, bv = this._b;
    for (let i = 0; i < N; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(N - 1, i + 1)];
      T.subVectors(b, a).normalize();
      if (i === 0) {
        const ref = Math.abs(T.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
        nv.copy(ref).addScaledVector(T, -ref.dot(T)).normalize();
      } else {
        nv.addScaledVector(T, -nv.dot(T)).normalize();
      }
      bv.crossVectors(T, nv);
      const r = radii[i], p = pts[i];
      for (let j = 0; j < R; j++) {
        const th = (j / R) * TAU, cs = Math.cos(th), sn = Math.sin(th);
        const nx = nv.x * cs + bv.x * sn, ny = nv.y * cs + bv.y * sn, nz = nv.z * cs + bv.z * sn;
        const k = (i * R + j) * 3;
        nor[k] = nx; nor[k + 1] = ny; nor[k + 2] = nz;
        pos[k] = p.x + nx * r; pos[k + 1] = p.y + ny * r; pos[k + 2] = p.z + nz * r;
      }
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.normal.needsUpdate = true;
    this.geo.computeBoundingSphere();
  }
}

// ---------- pintura por gata ----------
function makePaint(cfg) {
  const { sx, sy, sz } = cfg.dims;
  const hr = cfg.headR, hs = cfg.headScale;
  if (cfg.pattern !== 'calico') {
    const F = cfg.fur, SH = cfg.sheen;
    const fur = solid(F);
    return {
      body: (v, c, n) => { // brillo satinado en el lomo, como en las fotos
        const k = smooth((n.y - 0.55) / 0.4) * (1 - smooth((Math.abs(v.z / sz) - 0.6) / 0.3));
        c.setHex(F).lerp(_tmpC.setHex(SH), k);
      },
      head: (v, c, n) => { c.setHex(F).lerp(_tmpC.setHex(SH), smooth((n.y - 0.6) / 0.35) * 0.8); },
      muzzle: fur, chin: fur, ear: fur, legFront: fur, legBack: fur, paw: fur,
      tail: (s, c) => c.setHex(F),
      lid: () => fur,
    };
  }
  const W = cfg.white, O = cfg.orange, OD = cfg.orangeDark, B = cfg.black;
  const sd = cfg.seed * 3.7;
  return {
    body: (v, c) => {
      const nx = v.x / sx, ny = v.y / sy, nz = v.z / sz;
      // pecho y barriga blancos
      if (ny < -0.28 + Math.max(0, nz) * 0.25 || (nz > 0.55 && ny < 0.35) || nz > 0.8) return c.setHex(W);
      // manchita blanca en el lomo junto al hombro
      const dx = nx - 0.32, dy = ny - 0.82, dz = nz - 0.25;
      if (dx * dx + dy * dy + dz * dz < 0.035) return c.setHex(W);
      const f = fbm(v.x * 3.2 + sd, v.y * 3.2, v.z * 3.2);
      if (f > 0.5) { // zona naranja con rayas atigradas
        const s = Math.sin(v.z * 30 + fbm(v.x * 6, v.y * 6 + sd, v.z * 6) * 9 + v.y * 5);
        return c.setHex(s > 0.45 ? OD : O);
      }
      const g = fbm(v.x * 9 + 3, v.y * 9, v.z * 9 + sd);
      return c.setHex(g > 0.7 ? OD : B);
    },
    head: (v, c) => {
      const nx = v.x / (hr * hs[0]), ny = v.y / (hr * hs[1]), nz = v.z / (hr * hs[2]);
      const blaze = 0.05 + Math.max(0, 0.62 - ny) * 0.32 + Math.max(0, -0.1 - ny) * 0.6;
      if ((nz > 0.3 && Math.abs(nx) < blaze && ny < 0.62) || (ny < -0.32 && nz > -0.15)) return c.setHex(W);
      if (nx > 0) { // lado izquierdo de la gata: parche negro sobre el ojo
        if (nz > 0.15 && ny > -0.45 && ny < 0.48) return c.setHex(B);
        if (ny > 0.45 && nz > -0.2) return c.setHex(O);
        return c.setHex(fbm(v.x * 8, v.y * 8, v.z * 8 + sd) > 0.55 ? O : B);
      }
      // lado derecho: mejilla naranja, frente negra
      if (ny > 0.5) return c.setHex(fbm(v.x * 9, v.y * 9 + sd, v.z * 9) > 0.6 ? O : B);
      if (nz > -0.1) return c.setHex(O);
      return c.setHex(fbm(v.x * 8 + sd, v.y * 8, v.z * 8) > 0.5 ? O : B);
    },
    muzzle: solid(W), chin: solid(W),
    ear: solid(B),
    legFront: solid(W),
    legBack: (v, c) => c.setHex(v.y > 0.05 ? O : W),
    paw: solid(W),
    tail: (s, c) => {
      if (s > 0.9) return c.setHex(O);
      const b = Math.sin(s * TAU * 3.4 + 0.5);
      return c.setHex(b > 0.25 ? O : b > -0.1 ? OD : B);
    },
    lid: (side) => solid(side > 0 ? B : O),
  };
}
const _tmpC = new THREE.Color();

// ============================================================
//  Clase Cat
// ============================================================
let _uid = 0;
export class Cat {
  constructor(preset = 'negra', overrides = {}) {
    const base = typeof preset === 'string' ? CAT_PRESETS[preset] : preset;
    if (!base) throw new Error(`Preset de gata desconocido: ${preset}`);
    this.cfg = { ...base, ...overrides, dims: { ...base.dims, ...(overrides.dims || {}) } };
    this.id = ++_uid;
    this.name = this.cfg.label;
    this.group = new THREE.Group();
    this.group.name = `cat-${this.name}`;
    this.group.userData.cat = this;
    this.d = this.cfg.dims;
    this.d.standY = 0.44;

    this.autonomous = false;
    this.bounds = { minX: -2, maxX: 2, minZ: -2, maxZ: 2 };
    this.friend = null;
    this.onAction = null;

    this.time = Math.random() * 100;
    this.gait = 0;
    this.state = 'stand';
    this.stateTime = 0;
    this.blendT = 1; this.blendDur = 0.45;
    this.target = null; this.queue = [];
    this.actionLeft = 2;
    this.nextBlink = rand(1, 4); this.blinkT = -1;
    this.nextTwitch = rand(2, 6); this.twitchT = -1; this.twitchSide = 1;

    this._build();
    this.pose = this.P({});
    this.fromPose = clonePose(this.pose);
    this._apply(this.pose);
  }

  // ---------- construcción del modelo ----------
  _build() {
    const S = shared(), cfg = this.cfg, { sx, sy, sz } = this.d;
    const paint = this.paint = makePaint(cfg);
    CUR = this.mats = makeCatMats(cfg);
    const root = this.group;

    // sombra
    this.shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: S.shadow, transparent: true, depthWrite: false }));
    this.shadow.rotation.x = -Math.PI / 2; this.shadow.position.y = 0.003; this.shadow.renderOrder = -1;
    root.add(this.shadow);

    // cuerpo
    this.body = new THREE.Group();
    root.add(this.body);
    const bodyGeo = new THREE.SphereGeometry(1, 64, 40); bodyGeo.scale(sx, sy, sz);
    this.body.add(paintedSphere(bodyGeo, sx, sy, sz, paint.body, 512, 256, 0.016));

    this.anchors = {
      neck: new THREE.Vector3(0, sy * 0.55, sz * 0.72),
      hips: [
        new THREE.Vector3(sx * 0.5, -sy * 0.35, sz * 0.5),   // FL
        new THREE.Vector3(-sx * 0.5, -sy * 0.35, sz * 0.5),  // FR
        new THREE.Vector3(sx * 0.55, -sy * 0.3, -sz * 0.55), // BL
        new THREE.Vector3(-sx * 0.55, -sy * 0.3, -sz * 0.55),// BR
      ],
      tail: new THREE.Vector3(0, sy * 0.3, -sz * 0.9),
    };

    // patas (cilindros "fideo" + almohadilla)
    this.legs = []; this.paws = [];
    for (let i = 0; i < 4; i++) {
      const g = new THREE.CylinderGeometry(cfg.legR, cfg.legR * 0.92, 1, 14, 6, true);
      const leg = part(g, i < 2 ? paint.legFront : paint.legBack, 0.011);
      root.add(leg); this.legs.push(leg);
      const pg = new THREE.SphereGeometry(cfg.pawR, 18, 12); pg.scale(1, 0.62, 1.25);
      const paw = part(pg, paint.paw, 0.009);
      root.add(paw); this.paws.push(paw);
    }

    // cabeza
    this.head = new THREE.Group();
    root.add(this.head);
    this._buildHead();

    // cola
    const tailSegs = 26;
    this.tail = new Tube(tailSegs, 12, CUR.toon, paint.tail);
    this.tailOutline = new Tube(tailSegs, 12, S.outline, null);
    this.body.add(this.tail.mesh, this.tailOutline.mesh);
    const tipGeo = new THREE.SphereGeometry(1, 14, 10);
    this.tailTip = part(tipGeo, (v, c) => paint.tail(1, c), 0);
    this.tailTipOutline = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), S.outline);
    this.body.add(this.tailTip, this.tailTipOutline);
    this._tailPts = Array.from({ length: tailSegs }, () => new THREE.Vector3());
    this._tailR = new Array(tailSegs).fill(0);
    this._tailRO = new Array(tailSegs).fill(0);

    // Zzz
    this.zzz = [];
    for (let i = 0; i < 3; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: S.zzz, transparent: true, depthWrite: false }));
      sp.visible = false; root.add(sp); this.zzz.push(sp);
    }

    root.traverse((o) => { if (o.isMesh) o.userData.cat = this; });
  }

  _buildHead() {
    const S = shared(), cfg = this.cfg, paint = this.paint, H = this.head;
    const hr = cfg.headR, hs = cfg.headScale;
    const hg = new THREE.SphereGeometry(hr, 56, 40); hg.scale(...hs);
    H.add(paintedSphere(hg, hr * hs[0], hr * hs[1], hr * hs[2], paint.head, 512, 256, 0.013));

    // morrito
    for (const s of [-1, 1]) {
      const g = new THREE.SphereGeometry(hr * 0.27, 20, 14); g.scale(1, 0.82, 0.85);
      const m = part(g, paint.muzzle, 0.006);
      m.position.set(s * hr * 0.2, -hr * 0.3, hr * 0.8);
      H.add(m);
    }
    const chinG = new THREE.SphereGeometry(hr * 0.17, 16, 12);
    this.chin = part(chinG, paint.chin, 0.006);
    this.chin.position.set(0, -hr * 0.47, hr * 0.7);
    H.add(this.chin);

    // boca (bostezo) + lengua
    const mouthG = new THREE.SphereGeometry(hr * 0.17, 18, 12);
    this.mouth = part(mouthG, solid(0x5a1d2a), 0.006);
    this.mouth.position.set(0, -hr * 0.45, hr * 0.86);
    H.add(this.mouth);
    const tongueG = new THREE.SphereGeometry(hr * 0.11, 16, 10); tongueG.scale(1, 0.45, 1.35);
    this.tongue = part(tongueG, solid(0xf08a9c), 0.005);
    this.tongue.position.set(0, -hr * 0.47, hr * 0.92);
    H.add(this.tongue);

    // nariz
    const ng = new THREE.SphereGeometry(hr * 0.085, 16, 10); ng.scale(1.35, 0.75, 0.8);
    const nose = part(ng, solid(cfg.nose), 0.005);
    nose.position.set(0, -hr * 0.14, hr * 0.99);
    H.add(nose);

    // boquita "ω"
    const mlMat = new THREE.MeshBasicMaterial({ color: cfg.mouthLine });
    for (const s of [-1, 1]) {
      const tg = new THREE.TorusGeometry(hr * 0.075, hr * 0.014, 6, 16, Math.PI);
      const t = new THREE.Mesh(tg, mlMat);
      t.rotation.z = Math.PI; t.rotation.y = s * 0.25;
      t.position.set(s * hr * 0.075, -hr * 0.31, hr * 1.025);
      H.add(t);
    }

    // bigotes
    const wp = [];
    for (const s of [-1, 1]) for (let k = 0; k < 3; k++) {
      wp.push(s * hr * 0.32, -hr * (0.28 + k * 0.05), hr * 0.9,
        s * hr * 1.25, -hr * (0.18 + k * 0.13), hr * 0.72);
    }
    const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute(wp, 3));
    H.add(new THREE.LineSegments(wg, new THREE.LineBasicMaterial({ color: cfg.whisker })));

    // ojos
    this.eyes = [];
    const er = hr * 0.3;
    for (const s of [1, -1]) {
      const eye = new THREE.Group();
      eye.position.set(s * hr * 0.4, hr * 0.1, hr * 0.74);
      eye.rotation.y = s * 0.22;
      const ball = new THREE.Group(); eye.add(ball);
      const ig = new THREE.SphereGeometry(er, 26, 18);
      const irisCol = new THREE.Color(cfg.eye), rimCol = new THREE.Color(cfg.eyeRim);
      ball.add(part(ig, (v, c) => c.copy(rimCol).lerp(irisCol, smooth((v.z / er - 0.2) / 0.6)), 0.007));
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(er, 20, 14), S.black);
      pupil.position.z = er * 0.72; ball.add(pupil);
      const sh1 = new THREE.Mesh(new THREE.SphereGeometry(er * 0.17, 10, 8), S.white);
      sh1.position.set(-er * 0.33, er * 0.37, er * 0.72); ball.add(sh1);
      const sh2 = new THREE.Mesh(new THREE.SphereGeometry(er * 0.08, 8, 6), S.white);
      sh2.position.set(er * 0.3, -er * 0.25, er * 0.86); ball.add(sh2);
      const lg = new THREE.SphereGeometry(er * 1.08, 26, 12, 0, TAU, 0, Math.PI / 2);
      const lid = part(lg, paint.lid(s), 0.007, CUR.toonDouble);
      const lidPivot = new THREE.Group(); lidPivot.add(lid); eye.add(lidPivot);
      H.add(eye);
      this.eyes.push({ side: s, eye, ball, pupil, lid, lidPivot });
    }

    // orejas
    this.ears = [];
    const [ebr, eh] = cfg.earSize;
    for (const s of [1, -1]) {
      const pivot = new THREE.Group();
      pivot.position.set(s * hr * 0.55, hr * 0.6, -hr * 0.05);
      const og = new THREE.ConeGeometry(ebr, eh, 18, 1, false); og.translate(0, eh / 2, 0); og.scale(1, 1, 0.5);
      pivot.add(part(og, this.paint.ear, 0.009));
      const ig = new THREE.ConeGeometry(ebr * 0.66, eh * 0.76, 16, 1, false); ig.translate(0, eh * 0.38, 0); ig.scale(1, 1, 0.3);
      const inner = part(ig, solid(cfg.earIn), 0);
      inner.position.set(0, eh * 0.04, ebr * 0.2);
      pivot.add(inner);
      H.add(pivot);
      this.ears.push({ side: s, pivot });
    }
  }

  // ---------- helpers de pose ----------
  standFeet() {
    const { sx, sz } = this.d;
    return [[sx * 0.5, 0, sz * 0.5], [-sx * 0.5, 0, sz * 0.5], [sx * 0.55, 0, -sz * 0.55], [-sx * 0.55, 0, -sz * 0.55]];
  }
  P(o) {
    const c = this.cfg;
    return Object.assign({
      bodyY: this.d.standY, bodyZ: 0, bodyPitch: 0, bodyRoll: 0, squash: 1, stretch: 1,
      breath: 0.018, breathFreq: 0.55,
      headX: 0, headY: 0.13, headZ: 0.08, headPitch: 0, headYaw: 0, headRoll: 0,
      lid: c.lidRest, lidTilt: 0, lookX: 0, lookY: 0, pupil: c.pupil, mouth: 0, tongue: 0,
      earSpread: 0, earBack: 0,
      tailPitch: 0.6, tailYaw: 0, tailCurl: 0, tailLift: 0.05, tailAmp: 0.25, tailFreq: 0.7, puff: 1,
      feet: this.standFeet(), zzz: 0, shadow: 1, blinkOK: 1,
    }, o);
  }
  /** punto del cuerpo (coords locales) → coords de la gata, para una pose dada */
  rootPoint(p, local) {
    return local.clone().applyEuler(new THREE.Euler(p.bodyPitch, 0, p.bodyRoll)).add(new THREE.Vector3(0, p.bodyY, p.bodyZ));
  }
  /** altura del centro para que el cuerpo toque el suelo con esa inclinación */
  groundY(pitch, roll) {
    const e = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(pitch, 0, roll)).elements;
    const { sx, sy, sz } = this.d;
    return Math.sqrt((e[1] * sx) ** 2 + (e[5] * sy) ** 2 + (e[9] * sz) ** 2);
  }
  slowBlink(t, period = 7) { // parpadeo lento = "te quiero" en idioma gato
    return bump(t % period, period - 1.6, period - 0.3);
  }

  // ---------- API ----------
  get position() { return this.group.position; }
  setFriend(cat) { this.friend = cat; return this; }
  setBounds(minX, maxX, minZ, maxZ) { this.bounds = { minX, maxX, minZ, maxZ }; return this; }

  play(name, opts = {}) {
    if (!STATES[name]) { console.warn('Acción desconocida', name); return this; }
    this.fromPose = clonePose(this.pose);
    this.state = name; this.stateTime = 0; this.blendT = 0;
    this.blendDur = opts.blend ?? STATES[name].blend ?? 0.45;
    if (!STATES[name].move) this.target = null;
    const dr = DURATIONS[name];
    this.actionLeft = opts.duration ?? (dr ? rand(dr[0], dr[1]) : 5);
    this.onAction?.(name, this);
    return this;
  }
  /** lista de acciones encadenadas: cat.sequence(['stretch', ['sleep', {duration: 10}], 'sit']) */
  sequence(list) {
    this.queue = list.slice(1).map((x) => Array.isArray(x) ? x : [x, {}]);
    const [n, o] = Array.isArray(list[0]) ? list[0] : [list[0], {}];
    return this.play(n, o);
  }
  walkTo(x, z, opts = {}) {
    const b = this.bounds;
    this.target = new THREE.Vector3(clamp(x, b.minX, b.maxX), 0, clamp(z, b.minZ, b.maxZ));
    this.afterWalk = opts.then ? (Array.isArray(opts.then) ? opts.then : [opts.then, {}]) : null;
    this.faceAfter = opts.face ?? null;
    if (this.state !== (opts.run ? 'zoomies' : 'walk')) this.play(opts.run ? 'zoomies' : 'walk');
    return this;
  }
  poke() {
    if (this.state === 'surprise') return this;
    this.target = null;
    this.queue = [['sit', { duration: rand(2, 4) }]];
    return this.play('surprise', { blend: 0.12 });
  }

  _finish() {
    if (this.queue.length) { const [n, o] = this.queue.shift(); return this.play(n, o); }
    if (this.autonomous) return this._decide();
    return this.play('sit', { duration: 1e9 });
  }

  _decide() {
    const prev = this.state, b = this.bounds;
    if ((prev === 'sleep' || prev === 'nap') && Math.random() < 0.75) return this.play('stretch');
    const f = this.friend;
    const opts = [
      ['sit', 3], ['loaf', 2.5], ['wander', 4], ['groom', 1.6], ['sleep', 1.4], ['nap', 0.7],
      ['zoomies', 0.5], ['stretch', 0.5], ['stand', 0.6],
      ['cuddle', f && !STATES[f.state].move ? 1.2 : 0],
    ];
    let tot = opts.reduce((a, o) => a + o[1], 0), r = Math.random() * tot, pick = 'sit';
    for (const [n, w] of opts) { if ((r -= w) <= 0) { pick = n; break; } }
    if (pick === 'wander') return this.walkTo(rand(b.minX, b.maxX), rand(b.minZ, b.maxZ));
    if (pick === 'zoomies') {
      this.queue = [];
      return this.walkTo(rand(b.minX, b.maxX), rand(b.minZ, b.maxZ), { run: true, then: ['sit', { duration: rand(2, 4) }] });
    }
    if (pick === 'cuddle') {
      const fy = f.group.rotation.y, side = Math.random() < 0.5 ? 1 : -1;
      const off = new THREE.Vector3(Math.cos(fy) * side, 0, -Math.sin(fy) * side).multiplyScalar(f.d.sx + this.d.sx + 0.12);
      const tp = f.group.position.clone().add(off);
      return this.walkTo(tp.x, tp.z, { then: [Math.random() < 0.6 ? 'sleep' : 'loaf', {}], face: fy });
    }
    return this.play(pick);
  }

  // ---------- update ----------
  update(dt) {
    dt = Math.min(dt, 0.1);
    this.time += dt; this.stateTime += dt;
    const st = STATES[this.state];

    // locomoción
    if (st.move) {
      this.gait += dt * st.gait;
      if (this.target) {
        const g = this.group, dx = this.target.x - g.position.x, dz = this.target.z - g.position.z;
        const dist = Math.hypot(dx, dz);
        const want = Math.atan2(dx, dz);
        let diff = ((want - g.rotation.y + Math.PI) % TAU + TAU) % TAU - Math.PI;
        g.rotation.y += clamp(diff, -st.turn * dt, st.turn * dt);
        if (Math.abs(diff) < 0.9) {
          const step = Math.min(dist, st.speed * dt * (1 - Math.abs(diff) / 0.9 * 0.6));
          g.position.x += Math.sin(g.rotation.y) * step;
          g.position.z += Math.cos(g.rotation.y) * step;
        }
        if (dist < 0.06) {
          this.target = null;
          if (this.faceAfter != null) { this._faceTo = this.faceAfter; this.faceAfter = null; }
          if (this.afterWalk) { const [n, o] = this.afterWalk; this.afterWalk = null; this.play(n, o); }
          else this._finish();
        }
      } else this._finish();
    }
    if (this._faceTo != null && !st.move) { // girarse suavemente al llegar
      const g = this.group;
      let diff = ((this._faceTo - g.rotation.y + Math.PI) % TAU + TAU) % TAU - Math.PI;
      g.rotation.y += diff * Math.min(1, dt * 3);
      if (Math.abs(diff) < 0.02) this._faceTo = null;
    }

    // duración de la acción
    if (st.dur) { if (this.stateTime >= st.dur) this._finish(); }
    else if (!st.move) { this.actionLeft -= dt; if (this.actionLeft <= 0) this._finish(); }

    // pose
    const cur = STATES[this.state];
    const target = cur.pose(this, this.stateTime);
    this.blendT += dt;
    const k = smooth(this.blendT / this.blendDur);
    this.pose = k >= 1 ? target : lerpPose(this.fromPose, target, k);

    // capas: parpadeo, oreja que se mueve
    const p = this.pose;
    this.nextBlink -= dt;
    if (this.nextBlink <= 0) { this.blinkT = 0; this.nextBlink = rand(2.2, 6); }
    if (this.blinkT >= 0) {
      this.blinkT += dt;
      if (p.blinkOK > 0.5) p.lid = Math.max(p.lid, bump(this.blinkT, 0, 0.18));
      if (this.blinkT > 0.18) this.blinkT = -1;
    }
    this.nextTwitch -= dt;
    if (this.nextTwitch <= 0) { this.twitchT = 0; this.twitchSide = Math.random() < 0.5 ? 1 : -1; this.nextTwitch = rand(2.5, 8); }
    this._twitch = 0;
    if (this.twitchT >= 0) { this.twitchT += dt; this._twitch = bump(this.twitchT, 0, 0.22); if (this.twitchT > 0.22) this.twitchT = -1; }

    this._apply(p);
  }

  _apply(p) {
    const { body, head, cfg } = this;
    const hr = cfg.headR;
    const br = 1 + p.breath * Math.sin(this.time * p.breathFreq * TAU);
    const pf = 1 + (p.puff - 1) * 0.12;
    body.position.set(0, p.bodyY, p.bodyZ);
    body.rotation.set(p.bodyPitch, 0, p.bodyRoll);
    body.scale.set(pf * (1 + (br - 1) * 0.6), pf * p.squash * br, p.stretch);
    body.updateMatrix(); body.matrixWorldNeedsUpdate = true;

    // cabeza
    const neck = this.anchors.neck.clone().applyMatrix4(body.matrix);
    head.position.set(neck.x + p.headX, neck.y + p.headY, neck.z + p.headZ);
    head.rotation.set(p.headPitch, p.headYaw, p.headRoll, 'YXZ');
    for (const e of this.eyes) {
      e.lidPivot.rotation.x = lerp(-1.05, 1.62, clamp(p.lid, 0, 1));
      e.lidPivot.rotation.z = -e.side * p.lidTilt;
      e.ball.rotation.set(-p.lookY * 0.45, p.lookX * 0.55, 0);
      const pw = lerp(0.16, 0.78, clamp(p.pupil, 0, 1));
      e.pupil.scale.set(pw, lerp(0.6, 0.66, p.pupil), 0.3);
    }
    for (const ear of this.ears) {
      const tw = ear.side === this.twitchSide ? this._twitch : 0;
      ear.pivot.rotation.set(-0.12 - p.earBack * 0.9 - tw * 0.35, 0, -ear.side * (0.3 + p.earSpread * 0.6 + p.earBack * 0.5 + tw * 0.25));
    }
    const mo = clamp(p.mouth, 0, 1);
    this.mouth.visible = mo > 0.02;
    this.mouth.scale.set(0.9 + mo * 0.2, mo * 1.1, 0.6);
    this.chin.position.y = -hr * (0.47 + mo * 0.28);
    const tg = clamp(p.tongue, 0, 1);
    this.tongue.visible = tg > 0.02;
    this.tongue.position.z = hr * (0.84 + tg * 0.14);
    this.tongue.position.y = -hr * (0.45 + mo * 0.12);
    this.tongue.scale.setScalar(0.4 + tg * 0.6);

    // patas
    const up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < 4; i++) {
      const hip = this.anchors.hips[i].clone().applyMatrix4(body.matrix);
      const f = p.feet[i];
      const foot = new THREE.Vector3(f[0], f[1] + cfg.pawR * 0.55, f[2]);
      const dir = foot.clone().sub(hip); const len = dir.length();
      const leg = this.legs[i];
      leg.visible = len > 0.02;
      leg.position.copy(hip).add(foot).multiplyScalar(0.5);
      leg.quaternion.setFromUnitVectors(up, dir.divideScalar(Math.max(len, 1e-4)));
      leg.scale.set(1, Math.max(len, 0.001), 1);
      this.paws[i].position.copy(foot);
    }

    // cola (en coords del cuerpo)
    this._updateTail(p);

    // Zzz
    for (let i = 0; i < 3; i++) {
      const z = this.zzz[i];
      const ph = ((this.time * 0.45 + i / 3) % 1);
      z.visible = p.zzz > 0.05;
      if (!z.visible) continue;
      z.material.opacity = p.zzz * Math.sin(ph * Math.PI);
      const s = 0.09 + ph * 0.1;
      z.scale.set(s, s, s);
      z.position.set(head.position.x + 0.12 + ph * 0.18 + Math.sin(ph * 8 + i) * 0.03, head.position.y + 0.2 + ph * 0.45, head.position.z - 0.05);
    }

    // sombra
    const sh = p.shadow;
    this.shadow.scale.set((this.d.sx * 2.6 + 0.1) * sh, (this.d.sz * 2.4) * (0.9 + 0.1 * sh), 1);
    this.shadow.position.z = p.bodyZ;
    this.shadow.material.opacity = clamp(1.25 - p.bodyY * 0.6, 0.35, 1);
  }

  _updateTail(p) {
    const cfg = this.cfg, nSeg = 8, L = cfg.tailLen / nSeg;
    let pitch = p.tailPitch, yaw = p.tailYaw;
    const pos = this.anchors.tail.clone();
    const ctrl = [pos.clone()];
    const t = this.time;
    for (let k = 0; k < nSeg; k++) {
      yaw += p.tailCurl + p.tailAmp * 0.35 * Math.sin(t * p.tailFreq * TAU - k * 0.55);
      pitch += p.tailLift;
      pos.x += Math.sin(yaw) * Math.cos(pitch) * L;
      pos.y += Math.sin(pitch) * L;
      pos.z += -Math.cos(yaw) * Math.cos(pitch) * L;
      ctrl.push(pos.clone());
    }
    const curve = new THREE.CatmullRomCurve3(ctrl);
    const N = this._tailPts.length;
    const [r0, r1] = cfg.tailR;
    const m = this.body.matrix, inv = this._invM || (this._invM = new THREE.Matrix4());
    inv.copy(m).invert();
    const tmp = new THREE.Vector3();
    for (let i = 0; i < N; i++) {
      const s = i / (N - 1);
      curve.getPoint(s, this._tailPts[i]);
      const r = lerp(r0, r1, s) * (1 + (p.puff - 1) * 1.1) * (s < 0.08 ? 1.15 : 1);
      // que no atraviese el suelo
      if (i > 2) {
        tmp.copy(this._tailPts[i]).applyMatrix4(m);
        if (tmp.y < r) { tmp.y = r; this._tailPts[i].copy(tmp.applyMatrix4(inv)); }
      }
      this._tailR[i] = r; this._tailRO[i] = r + 0.011;
    }
    this.tail.update(this._tailPts, this._tailR);
    this.tailOutline.update(this._tailPts, this._tailRO);
    const tip = this._tailPts[N - 1], rt = this._tailR[N - 1];
    this.tailTip.position.copy(tip); this.tailTip.scale.setScalar(rt);
    this.tailTipOutline.position.copy(tip); this.tailTipOutline.scale.setScalar(rt + 0.011);
  }

  dispose() {
    this.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    this.group.removeFromParent();
  }
}

// ---------- blending de poses ----------
function clonePose(p) { return { ...p, feet: p.feet.map((f) => f.slice()) }; }
function lerpPose(a, b, t) {
  const o = {};
  for (const k in b) {
    if (k === 'feet') o.feet = b.feet.map((f, i) => f.map((v, j) => lerp(a.feet[i][j], v, t)));
    else o[k] = lerp(a[k] ?? b[k], b[k], t);
  }
  return o;
}
function keyed(t, frames) {
  if (t <= frames[0][0]) return frames[0][1];
  for (let i = 0; i < frames.length - 1; i++) {
    const [t0, p0] = frames[i], [t1, p1] = frames[i + 1];
    if (t <= t1) return lerpPose(p0, p1, smooth((t - t0) / (t1 - t0)));
  }
  return frames[frames.length - 1][1];
}

// ============================================================
//  Estados / animaciones
// ============================================================
const DURATIONS = {
  stand: [2, 4], sit: [4, 9], loaf: [6, 12], groom: [5, 9], sleep: [12, 24], nap: [10, 18],
};

function sitPose(c, t) {
  const pitch = -0.75, d = c.d;
  const base = { bodyPitch: pitch, bodyRoll: 0, bodyY: c.groundY(pitch, 0) - 0.01, bodyZ: -0.12 };
  const sh = c.anchors.hips.map((h) => c.rootPoint(base, h));
  const feet = [
    [sh[0].x * 0.9, 0, sh[0].z + 0.05], [sh[1].x * 0.9, 0, sh[1].z + 0.05],
    [sh[2].x * 1.3, 0, sh[2].z + 0.22], [sh[3].x * 1.3, 0, sh[3].z + 0.22],
  ];
  return c.P({
    ...base, feet,
    headY: 0.1, headZ: 0.05,
    headYaw: 0.45 * n1(t * 0.25, c.id), headPitch: 0.08 + 0.1 * n1(t * 0.2, c.id + 5), headRoll: 0.12 * n1(t * 0.15, c.id + 9),
    lookX: 0.5 * n1(t * 0.5, c.id + 2), lookY: 0.2 * n1(t * 0.4, c.id + 3),
    lid: Math.max(c.cfg.lidRest, c.slowBlink(t) * 0.85),
    tailPitch: -0.35, tailYaw: 0.9, tailLift: 0.05, tailCurl: 0.24, tailAmp: 0.1, tailFreq: 0.5,
    breathFreq: 0.45,
  });
}
function loafPose(c, t, sleepy = 0) {
  const { sx, sy, sz } = c.d;
  return c.P({
    bodyY: sy * (0.92 - sleepy * 0.06), squash: 0.94, stretch: 0.97,
    feet: [[sx * 0.28, 0, sz * 0.84], [-sx * 0.28, 0, sz * 0.84], [sx * 0.62, 0, -sz * 0.22], [-sx * 0.62, 0, -sz * 0.22]],
    headY: 0.06, headZ: 0.08,
    headYaw: 0.25 * n1(t * 0.15, c.id), lookX: 0.4 * n1(t * 0.3, c.id + 1),
    lid: Math.max(0.5, c.slowBlink(t, 6) * 0.95),
    tailPitch: -0.5, tailYaw: 1.05, tailLift: 0.08, tailCurl: 0.2, tailAmp: 0.06, tailFreq: 0.4,
    breath: 0.025, breathFreq: 0.4, shadow: 1.05,
  });
}

const STATES = {
  stand: {
    pose: (c, t) => c.P({
      headYaw: 0.35 * n1(t * 0.35, c.id), headPitch: 0.06 * n1(t * 0.3, c.id + 4),
      lookX: 0.5 * n1(t * 0.6, c.id + 2), tailAmp: 0.3, tailPitch: 0.75, tailLift: 0.05,
    }),
  },
  walk: {
    move: true, speed: 0.52, gait: 7.5, turn: 4,
    pose: (c) => {
      const ph = c.gait, st = 0.11, lift = 0.075, offs = [0, Math.PI, Math.PI, 0];
      const feet = c.standFeet().map((f, i) => {
        const s = ph + offs[i];
        return [f[0], lift * Math.max(0, Math.cos(s)), f[2] + st * Math.sin(s)];
      });
      return c.P({
        feet, bodyY: c.d.standY + 0.014 * Math.cos(2 * ph), bodyRoll: 0.04 * Math.sin(ph),
        headY: 0.13 + 0.012 * Math.cos(2 * ph + 0.6), headPitch: 0.06, headRoll: -0.04 * Math.sin(ph),
        tailPitch: 0.95, tailLift: 0.11, tailAmp: 0.18, tailFreq: 0.9, lookX: 0,
      });
    },
  },
  zoomies: {
    move: true, speed: 1.75, gait: 16, turn: 6,
    pose: (c) => {
      const ph = c.gait, st = 0.17, lift = 0.11, offs = [0, 0.45, Math.PI, Math.PI + 0.45];
      const feet = c.standFeet().map((f, i) => {
        const s = ph + offs[i];
        return [f[0], lift * Math.max(0, Math.cos(s)), f[2] + st * Math.sin(s)];
      });
      return c.P({
        feet, bodyY: c.d.standY - 0.03 + 0.035 * Math.abs(Math.sin(ph)), bodyPitch: 0.12 * Math.sin(ph),
        stretch: 1.12, squash: 0.95,
        headY: 0.08, headZ: 0.12, headPitch: -0.05, earBack: 1, pupil: 1, lid: 0,
        tailPitch: 0.35, tailLift: -0.02, tailAmp: 0.15, tailFreq: 2.5, blinkOK: 0,
      });
    },
  },
  sit: { pose: sitPose },
  loaf: { pose: (c, t) => loafPose(c, t) },
  groom: {
    pose: (c, t) => {
      const p = sitPose(c, 0);
      const hr = c.cfg.headR;
      const neck = c.rootPoint(p, c.anchors.neck);
      const head = neck.add(new THREE.Vector3(-0.02, 0.06, 0.08));
      const cyc = t % 6;
      if (cyc < 3.2) { // lamer la pata
        p.feet[1] = [head.x - 0.04, head.y - hr * 0.62 - c.cfg.pawR * 0.55, head.z + hr * 1.1];
        p.headPitch = 0.3 + 0.08 * Math.sin(t * 9); p.headYaw = -0.15; p.headY = 0.06; p.headZ = 0.08; p.headX = -0.02;
        p.tongue = 0.5 + 0.5 * Math.sin(t * 9);
        p.lid = 0.85; p.lookX = 0; p.lookY = 0;
      } else { // frotarse la cara
        const w = (cyc - 3.2) * 4.5;
        p.feet[1] = [head.x - hr * 0.35 + 0.05 * Math.cos(w), head.y - c.cfg.pawR * 0.55 + 0.1 * Math.sin(w), head.z + hr * 0.55];
        p.headPitch = 0.2; p.headRoll = 0.4; p.headYaw = -0.35; p.headY = 0.06; p.headZ = 0.08; p.headX = -0.02;
        p.lid = 1; p.earSpread = 0.3 + 0.2 * Math.sin(w);
      }
      p.blinkOK = 0;
      return p;
    },
  },
  sleep: {
    pose: (c, t) => {
      const p = loafPose(c, t, 1);
      return Object.assign(p, {
        headX: 0.05, headY: -0.16, headZ: 0.14, headYaw: 0.5, headRoll: 0.4, headPitch: 0.32,
        lid: 1, lookX: 0, earSpread: 0.35, breath: 0.04, breathFreq: 0.28,
        tailCurl: 0.22, tailAmp: 0.03, zzz: 1, blinkOK: 0,
      });
    },
  },
  nap: { // panza arriba / de lado, patas fuera (modo croqueta)
    pose: (c, t) => {
      const roll = 1.5, hr = c.cfg.headR;
      const base = { bodyPitch: 0, bodyRoll: roll, bodyY: c.groundY(0, roll) - 0.02, bodyZ: 0 };
      const dir = new THREE.Vector3(Math.sin(roll), -Math.cos(roll), 0);
      const tw = Math.max(0, n1(t * 0.8, c.id + 7)) * 0.05;
      const feet = c.anchors.hips.map((h, i) => {
        const hp = c.rootPoint(base, h);
        const f = hp.addScaledVector(dir, 0.24 + (i < 2 ? 0.02 : 0));
        f.z += i < 2 ? 0.12 + Math.sin(t * 11 + i) * tw : -0.08;
        f.y -= c.cfg.pawR * 0.55;
        return [f.x, f.y, f.z];
      });
      const neck = c.rootPoint(base, c.anchors.neck);
      return c.P({
        ...base, feet,
        headX: 0.06, headY: hr * 0.92 - neck.y, headZ: 0.1, headRoll: 1.25, headYaw: 0.15, headPitch: -0.1,
        lid: 1, tongue: 0.55, earSpread: 0.4,
        tailPitch: -0.1, tailLift: 0.0, tailCurl: -0.06, tailAmp: 0.08, tailFreq: 0.3,
        breath: 0.04, breathFreq: 0.3, zzz: 1, blinkOK: 0, shadow: 1.35,
      });
    },
  },
  stretch: {
    dur: 4.0,
    pose: (c, t) => {
      if (!c._stretchFrames || c._stretchFor !== c.id) {
        const d = c.d, sf = c.standFeet();
        const s0 = c.P({});
        const dog = c.P({
          bodyPitch: 0.42, bodyY: 0.36, bodyZ: -0.04,
          feet: [[sf[0][0], 0, sf[0][2] + 0.4], [sf[1][0], 0, sf[1][2] + 0.45], sf[2], sf[3]],
          headY: -0.02, headZ: 0.12, headPitch: -0.25, lid: 0.95, mouth: 1, tongue: 0.4,
          earBack: 0.6, tailPitch: 0.7, tailLift: 0.03, tailAmp: 0.05, blinkOK: 0,
        });
        const dog2 = { ...clonePose(dog), headPitch: -0.4, mouth: 0.9 };
        const back = c.P({
          bodyPitch: -0.1, bodyY: 0.42, bodyZ: 0.12,
          feet: [[sf[0][0], 0, sf[0][2] + 0.14], [sf[1][0], 0, sf[1][2] + 0.14], [sf[2][0] * 1.1, 0.1, sf[2][2] - 0.32], sf[3]],
          lid: 0.55, tailPitch: 0.2, tailLift: 0.02, tailAmp: 0.05, earBack: 0.2, blinkOK: 0,
        });
        c._stretchFrames = [[0, s0], [1.0, dog], [2.0, dog2], [2.9, back], [3.4, back], [4.0, s0]];
        c._stretchFor = c.id;
      }
      return keyed(t, c._stretchFrames);
    },
  },
  surprise: {
    dur: 1.3, blend: 0.1,
    pose: (c, t) => {
      const sf = c.standFeet();
      const startled = {
        lid: 0, pupil: 1, earBack: 1, tailPitch: 1.5, tailLift: 0, tailAmp: 0, tailCurl: 0, blinkOK: 0, mouth: 0.35,
      };
      const crouch = c.P({ ...startled, bodyY: 0.33, squash: 0.85, headY: 0.06, puff: 1.2 });
      const air = c.P({
        ...startled, bodyY: 0.82, squash: 1.12, puff: 1.8, headY: 0.18,
        feet: sf.map((f) => [f[0] * 1.3, 0.34, f[2] * 1.1]),
      });
      const land = c.P({ ...startled, bodyY: 0.47, squash: 1.1, puff: 1.7, headY: 0.15, mouth: 0.2 });
      const calm = c.P({ puff: 1.05, lid: 0.2, pupil: 0.7 });
      return keyed(t, [[0, crouch], [0.12, crouch], [0.42, air], [0.66, land], [1.0, land], [1.3, calm]]);
    },
  },
};

export const ACTIONS = Object.keys(STATES);

export function createCat(preset, overrides) { return new Cat(preset, overrides); }

/** busca a qué gata pertenece un objeto (para raycasting al tocar) */
export function catFromObject(obj) {
  while (obj) { if (obj.userData?.cat) return obj.userData.cat; obj = obj.parent; }
  return null;
}
