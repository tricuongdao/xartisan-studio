/* Volta — an original 3D scooter built from extruded body panels.
   No external model file: geometry is generated at runtime so the paint can be
   changed and the whole thing stays self-contained. */

import * as THREE from "../vendor/three.module.min.js";
import { GLTFLoader } from "../vendor/loaders/GLTFLoader.js";
import { DRACOLoader } from "../vendor/loaders/DRACOLoader.js";

export const PAINT_3D = {
  cobalt:   { name: "Cobalt",   hex: "#1f43e6" },
  graphite: { name: "Graphite", hex: "#2c3136" },
  bone:     { name: "Bone",     hex: "#e7e1d3" },
  sage:     { name: "Sage",     hex: "#9aab93" },
  clay:     { name: "Clay",     hex: "#b25a3d" },
};

const V3 = (x, y, z = 0) => new THREE.Vector3(x, y, z);

function extrude(shape, depth, bevel = 0.022) {
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelSegments: 5,
    bevelSize: bevel,
    bevelThickness: bevel,
    curveSegments: 32,
  });
  geo.translate(0, 0, -depth / 2);
  geo.computeVertexNormals();
  return geo;
}

/* The main body: leg shield, step-through floor and rear pod as one silhouette. */
function bodyShape() {
  const s = new THREE.Shape();
  s.moveTo(-0.80, 0.70);
  s.bezierCurveTo(-0.86, 0.66, -0.875, 0.575, -0.845, 0.52);
  s.bezierCurveTo(-0.80, 0.53, -0.72, 0.52, -0.62, 0.52);
  s.bezierCurveTo(-0.52, 0.52, -0.44, 0.53, -0.40, 0.545);
  s.bezierCurveTo(-0.37, 0.47, -0.34, 0.40, -0.30, 0.385);
  s.lineTo(0.26, 0.35);
  s.bezierCurveTo(0.35, 0.345, 0.40, 0.385, 0.43, 0.48);
  s.bezierCurveTo(0.465, 0.60, 0.48, 0.77, 0.462, 0.865);
  s.bezierCurveTo(0.452, 0.95, 0.405, 1.00, 0.33, 1.008);
  s.bezierCurveTo(0.25, 1.016, 0.208, 0.965, 0.198, 0.87);
  s.bezierCurveTo(0.188, 0.76, 0.176, 0.60, 0.166, 0.45);
  s.lineTo(0.16, 0.39);
  s.bezierCurveTo(0.05, 0.377, -0.06, 0.377, -0.085, 0.39);
  s.bezierCurveTo(-0.115, 0.47, -0.135, 0.57, -0.175, 0.64);
  s.bezierCurveTo(-0.225, 0.72, -0.35, 0.745, -0.51, 0.745);
  s.bezierCurveTo(-0.65, 0.745, -0.775, 0.735, -0.80, 0.70);
  return s;
}

function seatShape() {
  const s = new THREE.Shape();
  s.moveTo(-0.60, 0.735);
  s.bezierCurveTo(-0.42, 0.75, -0.16, 0.755, 0.02, 0.745);
  s.bezierCurveTo(0.10, 0.74, 0.14, 0.755, 0.145, 0.785);
  s.bezierCurveTo(0.15, 0.815, 0.12, 0.83, 0.04, 0.832);
  s.bezierCurveTo(-0.16, 0.838, -0.40, 0.83, -0.58, 0.805);
  s.bezierCurveTo(-0.64, 0.795, -0.65, 0.765, -0.60, 0.735);
  return s;
}

function fenderShape() {
  const s = new THREE.Shape();
  const cx = 0.62, cy = 0.235, ro = 0.282, ri = 0.253;
  const a0 = Math.PI * 0.76, a1 = Math.PI * 0.04;
  s.absarc(cx, cy, ro, a0, a1, true);
  s.absarc(cx, cy, ri, a1, a0, false);
  s.closePath();
  return s;
}

function buildBike(materials) {
  const bike = new THREE.Group();

  /* ---------- wheels ---------- */
  const wheelGeo = new THREE.TorusGeometry(0.19, 0.045, 18, 56);
  const rimGeo = new THREE.CylinderGeometry(0.148, 0.148, 0.052, 40);
  rimGeo.rotateX(Math.PI / 2);
  const hubGeo = new THREE.CylinderGeometry(0.036, 0.036, 0.075, 20);
  hubGeo.rotateX(Math.PI / 2);
  const spokeGeo = new THREE.BoxGeometry(0.022, 0.235, 0.022);
  const discGeo = new THREE.CylinderGeometry(0.112, 0.112, 0.006, 32);
  discGeo.rotateX(Math.PI / 2);

  const makeWheel = (x) => {
    const g = new THREE.Group();
    g.position.set(x, 0.235, 0);
    g.add(new THREE.Mesh(wheelGeo, materials.tyre));
    const rim = new THREE.Mesh(rimGeo, materials.rim);
    rim.position.z = 0.01;
    g.add(rim);
    const hub = new THREE.Mesh(hubGeo, materials.chrome);
    g.add(hub);
    for (let i = 0; i < 5; i++) {
      const spoke = new THREE.Mesh(spokeGeo, materials.chrome);
      spoke.rotation.z = (i / 5) * Math.PI * 2;
      spoke.position.z = 0.012;
      g.add(spoke);
    }
    const disc = new THREE.Mesh(discGeo, materials.chrome);
    disc.position.z = 0.045;
    g.add(disc);
    g.children.forEach((c) => { c.castShadow = true; c.receiveShadow = true; });
    return g;
  };
  bike.add(makeWheel(0.62), makeWheel(-0.62));

  /* fork and swingarm */
  [-1, 1].forEach((side) => {
    const fork = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.019, 0.30, 12), materials.black);
    fork.position.set(0.592, 0.37, side * 0.062);
    fork.rotation.z = -0.34;
    bike.add(fork);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.035, 0.035), materials.black);
    arm.position.set(-0.50, 0.275, side * 0.105);
    arm.rotation.z = 0.35;
    bike.add(arm);
  });

  /* ---------- bodywork ---------- */
  const bodyGeo = extrude(bodyShape(), 0.31, 0.028);
  const body = new THREE.Mesh(bodyGeo, materials.paint);
  body.castShadow = true; body.receiveShadow = true;
  bike.add(body);

  /* side accent: a slim inset panel in a slightly darker paint */
  const accentShape = new THREE.Shape();
  accentShape.moveTo(-0.66, 0.56);
  accentShape.bezierCurveTo(-0.50, 0.60, -0.34, 0.61, -0.22, 0.60);
  accentShape.lineTo(-0.22, 0.66);
  accentShape.bezierCurveTo(-0.38, 0.675, -0.54, 0.66, -0.66, 0.63);
  accentShape.closePath();
  const accentGeo = extrude(accentShape, 0.335, 0.006);
  const accent = new THREE.Mesh(accentGeo, materials.trim);
  accent.castShadow = false;
  bike.add(accent);

  const seat = new THREE.Mesh(extrude(seatShape(), 0.30, 0.03), materials.seat);
  seat.castShadow = true; seat.receiveShadow = true;
  bike.add(seat);

  const fender = new THREE.Mesh(extrude(fenderShape(), 0.10, 0.006), materials.paint);
  fender.castShadow = true;
  bike.add(fender);
  [-1, 1].forEach((side) => {
    const strut = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.014, 0.012), materials.rim);
    strut.position.set(0.585, 0.39, side * 0.055);
    strut.rotation.z = 0.5;
    bike.add(strut);
  });

  /* lower rocker trim */
  const rockerShape = new THREE.Shape();
  rockerShape.moveTo(-0.30, 0.352);
  rockerShape.lineTo(0.28, 0.352);
  rockerShape.lineTo(0.30, 0.392);
  rockerShape.lineTo(-0.30, 0.392);
  rockerShape.closePath();
  const rocker = new THREE.Mesh(extrude(rockerShape, 0.318, 0.004), materials.black);
  bike.add(rocker);

  /* ---------- floorboard ---------- */
  const deck = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.035, 0.29), materials.deck);
  deck.position.set(0.06, 0.385, 0);
  deck.castShadow = true; deck.receiveShadow = true;
  bike.add(deck);
  const strip = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.006, 0.26), materials.chrome);
  strip.position.set(0.06, 0.405, 0);
  strip.scale.z = 0.9;
  bike.add(strip);

  /* ---------- front apron detail ---------- */
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.085, 24, 18), materials.headlight);
  nose.scale.set(0.55, 1.25, 1.35);
  nose.position.set(0.478, 0.80, 0);
  bike.add(nose);
  const bezel = new THREE.Mesh(new THREE.CylinderGeometry(0.098, 0.098, 0.02, 32), materials.black);
  bezel.rotation.z = Math.PI / 2;
  bezel.position.set(0.472, 0.80, 0);
  bezel.scale.set(1, 1, 1.35);
  bike.add(bezel);
  const noseRing = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.012, 12, 32), materials.chrome);
  noseRing.rotation.y = Math.PI / 2;
  noseRing.position.set(0.492, 0.80, 0);
  noseRing.scale.set(1, 1.35, 1);
  bike.add(noseRing);

  /* apron details: vent slats + chrome blade */
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.44, 0.014), materials.chrome);
  blade.position.set(0.483, 0.66, 0);
  blade.rotation.z = -0.035;
  bike.add(blade);

  /* ---------- cockpit ---------- */
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.042, 0.24, 16), materials.black);
  stem.position.set(0.318, 1.005, 0);
  stem.scale.y = 0.82;
  stem.rotation.z = 0.16;
  bike.add(stem);

  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.62, 14), materials.chrome);
  bar.rotation.x = Math.PI / 2;
  bar.position.set(0.313, 1.09, 0);
  bar.castShadow = true;
  bike.add(bar);

  const gripGeo = new THREE.CylinderGeometry(0.026, 0.026, 0.115, 14);
  gripGeo.rotateX(Math.PI / 2);
  [-0.245, 0.245].forEach((z) => {
    const grip = new THREE.Mesh(gripGeo, materials.black);
    grip.position.set(0.313, 1.09, z);
    bike.add(grip);
  });

  const dash = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.055, 0.17), materials.black);
  dash.position.set(0.362, 1.062, 0);
  dash.rotation.z = 0.28;
  dash.castShadow = true;
  bike.add(dash);
  const screen = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.055, 0.13), materials.glass);
  screen.position.set(0.432, 1.105, 0);
  screen.rotation.z = 0.28;
  bike.add(screen);

  /* mirrors */
  [-1, 1].forEach((side) => {
    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.009, 0.18, 10), materials.black);
    stalk.position.set(0.30, 1.20, side * 0.235);
    stalk.rotation.z = 0.12;
    bike.add(stalk);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.052, 18, 14), materials.black);
    head.scale.set(0.32, 0.62, 1.15);
    head.position.set(0.30, 1.295, side * 0.245);
    head.castShadow = true;
    bike.add(head);
    const mirror = new THREE.Mesh(new THREE.CircleGeometry(0.040, 20), materials.glass);
    mirror.scale.set(1, 0.78, 1);
    mirror.position.set(0.283, 1.295, side * 0.245);
    mirror.rotation.y = -Math.PI / 2;
    bike.add(mirror);
  });

  /* ---------- rear details ---------- */
  [-1, 1].forEach((side) => {
    const badge = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.006, 20), materials.chrome);
    badge.rotation.x = Math.PI / 2;
    badge.position.set(-0.56, 0.60, side * 0.158);
    bike.add(badge);
  });
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.05, 0.16), materials.tail);
  tail.position.set(-0.795, 0.625, 0);
  bike.add(tail);

  const rackShape = new THREE.Shape();
  rackShape.moveTo(-0.66, 0.735);
  rackShape.lineTo(-0.30, 0.735);
  const rackGeo = new THREE.TubeGeometry(
    new THREE.CatmullRomCurve3([V3(-0.66, 0.74, -0.10), V3(-0.50, 0.80, -0.13), V3(-0.36, 0.80, -0.13)]),
    12, 0.013, 8, false
  );
  bike.add(new THREE.Mesh(rackGeo, materials.chrome));

  /* ---------- kickstand ---------- */
  const kick = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.30, 8), materials.black);
  kick.position.set(-0.12, 0.185, 0.105);
  kick.rotation.x = 0.35;
  kick.rotation.z = 0.20;
  bike.add(kick);

  /* ---------- underbody ---------- */
  bike.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
  return bike;
}

function buildMaterials(paintHex) {
  const paint = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(paintHex),
    metalness: 0.45,
    roughness: 0.3,
    clearcoat: 0.9,
    clearcoatRoughness: 0.12,
    envMapIntensity: 0.85,
  });
  const trim = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(paintHex).multiplyScalar(0.72),
    metalness: 0.6, roughness: 0.3, clearcoat: 0.6, envMapIntensity: 1.2,
  });
  return {
    paint,
    trim,
    tyre: new THREE.MeshStandardMaterial({ color: 0x141617, roughness: 0.92, metalness: 0.05 }),
    rim: new THREE.MeshStandardMaterial({ color: 0x24282b, roughness: 0.4, metalness: 0.7 }),
    chrome: new THREE.MeshStandardMaterial({ color: 0xdfe3e2, roughness: 0.16, metalness: 1 }),
    black: new THREE.MeshStandardMaterial({ color: 0x1b1e20, roughness: 0.55, metalness: 0.25 }),
    seat: new THREE.MeshStandardMaterial({ color: 0x191b1d, roughness: 0.62, metalness: 0.08 }),
    deck: new THREE.MeshStandardMaterial({ color: 0x202427, roughness: 0.8, metalness: 0.1 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0xf4f7fa, roughness: 0.05, metalness: 0, clearcoat: 1, transparent: true, opacity: 0.55 }),
    headlight: new THREE.MeshPhysicalMaterial({ color: 0xffffff, emissive: 0xfff3d6, emissiveIntensity: 0.85, roughness: 0.1, clearcoat: 1 }),
    tail: new THREE.MeshStandardMaterial({ color: 0xd2352b, emissive: 0x8e1a12, emissiveIntensity: 0.6, roughness: 0.3 }),
  };
}

function environmentTexture() {
  const c = document.createElement("canvas");
  c.width = 1024; c.height = 512;
  const g = c.getContext("2d");
  const grad = g.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, "#ffffff");
  grad.addColorStop(0.38, "#eef2f5");
  grad.addColorStop(0.52, "#d5dbe0");
  grad.addColorStop(0.62, "#aeb6bc");
  grad.addColorStop(1, "#5d6367");
  g.fillStyle = grad;
  g.fillRect(0, 0, 1024, 512);
  const glow = g.createRadialGradient(300, 150, 10, 300, 150, 220);
  glow.addColorStop(0, "rgba(255,255,255,1)");
  glow.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = glow;
  g.fillRect(0, 0, 1024, 512);
  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function shadowTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(128, 128, 4, 128, 128, 124);
  grad.addColorStop(0, "rgba(16,22,32,.55)");
  grad.addColorStop(0.45, "rgba(16,22,32,.28)");
  grad.addColorStop(1, "rgba(16,22,32,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}


const MODEL_URL = new URL("../models/volta-one-s.glb", import.meta.url).href;

function loadModel(materials, onReady, onFail) {
  const draco = new DRACOLoader();
  draco.setDecoderPath(new URL("../vendor/draco/", import.meta.url).href);
  const loader = new GLTFLoader();
  loader.setDRACOLoader(draco);
  loader.load(MODEL_URL, (gltf) => {
    const obj = gltf.scene;
    obj.traverse((o) => {
      if (!o.isMesh) return;
      const n = o.name || o.parent?.name || "";
      if (/tire|tyre/i.test(n)) o.material = materials.tyre;
      else if (/disk|disc|brake|rim/i.test(n)) o.material = materials.chrome;
      else if (/seat|sedlo/i.test(n)) o.material = materials.seat;
      else if (/plastic|trim|mirror/i.test(n)) o.material = materials.black;
      else o.material = materials.paint;
      o.castShadow = true;
      o.receiveShadow = true;
    });
    const box = new THREE.Box3().setFromObject(obj);
    const size = box.getSize(new THREE.Vector3());
    const centre = box.getCenter(new THREE.Vector3());
    const scale = 1.9 / Math.max(size.x, size.z);
    obj.scale.setScalar(scale);
    obj.position.set(-centre.x * scale, -box.min.y * scale, -centre.z * scale);
    const holder = new THREE.Group();
    holder.rotation.y = Math.PI;
    holder.add(obj);
    onReady(holder, size);
  }, undefined, (err) => { console.warn("3D model failed, using procedural fallback", err); onFail(); });
}

export function mountScooter3D(container, opts = {}) {
  if (!container) return null;
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  } catch (e) {
    return null;
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.06;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.setAttribute("aria-hidden", "true");
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.environment = environmentTexture();

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 30);

  /* lights */
  scene.add(new THREE.HemisphereLight(0xffffff, 0x5a5f63, 1.15));
  const key = new THREE.DirectionalLight(0xffffff, 2.4);
  key.position.set(3.2, 5.0, 3.4);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 1; key.shadow.camera.far = 12;
  key.shadow.camera.left = -2.4; key.shadow.camera.right = 2.4;
  key.shadow.camera.top = 2.4; key.shadow.camera.bottom = -2.4;
  key.shadow.bias = -0.0008;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xdfe9ff, 1.1);
  fill.position.set(-3.5, 2.6, 1.2);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffffff, 1.6);
  rim.position.set(-1.5, 3.0, -3.5);
  scene.add(rim);

  const materials = buildMaterials(PAINT_3D[opts.paint]?.hex || PAINT_3D.cobalt.hex);
  const pivot = new THREE.Group();
  scene.add(pivot);
  const bike = buildBike(materials);
  bike.visible = false;
  pivot.add(bike);
  let usingGlb = false;

  loadModel(materials, (holder) => {
    usingGlb = true;
    bike.visible = false;
    pivot.add(holder);
    target.set(0, 0.62, 0);
    frame();
  }, () => {
    bike.visible = true;
  });

  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(2.9, 2.9),
    new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false, opacity: 0.9 })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.002;
  scene.add(shadow);

  /* framing */
  const state = { yaw: -0.52, pitch: 0, targetYaw: -0.52, dragging: false, lastX: 0, lastY: 0, idle: 0, visible: true };
  const target = new THREE.Vector3(0, 0.72, 0);

  function frame() {
    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const base = (usingGlb ? 5.05 : 4.35) * (opts.zoom || 1);
    const dist = w / h < 0.85 ? base * 1.38 : base;
    camera.position.set(dist * 0.50, 1.22 + (w / h < 0.85 ? 0.3 : 0), dist * 0.84);
    camera.lookAt(target);
    camera.updateProjectionMatrix();
  }
  frame();
  const ro = new ResizeObserver(frame);
  ro.observe(container);

  const canvas = renderer.domElement;
  canvas.style.touchAction = "pan-y";
  const down = (e) => {
    state.dragging = true; state.lastX = e.clientX; state.lastY = e.clientY;
    state.idle = 0; canvas.setPointerCapture?.(e.pointerId);
    canvas.style.cursor = "grabbing";
  };
  const move = (e) => {
    if (!state.dragging) return;
    const dx = e.clientX - state.lastX;
    const dy = e.clientY - state.lastY;
    state.lastX = e.clientX; state.lastY = e.clientY;
    state.targetYaw += dx * 0.007;
    state.pitch = THREE.MathUtils.clamp(state.pitch + dy * 0.0022, -0.10, 0.16);
  };
  const up = () => { state.dragging = false; state.idle = 0; canvas.style.cursor = "grab"; };
  canvas.style.cursor = "grab";
  canvas.addEventListener("pointerdown", down);
  canvas.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);

  const io = new IntersectionObserver(([en]) => { state.visible = en.isIntersecting; }, { threshold: 0.02 });
  io.observe(container);

  let raf = 0, last = performance.now();
  const paint = { from: new THREE.Color(PAINT_3D[opts.paint]?.hex || PAINT_3D.cobalt.hex), to: null, t: 1 };

  function tick(now) {
    raf = requestAnimationFrame(tick);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!state.visible) return;

    if (!state.dragging) {
      state.idle += dt;
      if (!reduce && state.idle > 2.2) state.targetYaw += dt * 0.16;
    }
    state.yaw += (state.targetYaw - state.yaw) * Math.min(1, dt * 6);
    pivot.rotation.y = state.yaw;
    pivot.rotation.x = state.pitch;

    if (paint.to && paint.t < 1) {
      paint.t = Math.min(1, paint.t + dt * 2.4);
      const c = paint.from.clone().lerp(paint.to, paint.t);
      materials.paint.color.copy(c);
      materials.trim.color.copy(c).multiplyScalar(0.72);
    }
    renderer.render(scene, camera);
  }
  raf = requestAnimationFrame(tick);

  return {
    setPaint(key) {
      const hex = PAINT_3D[key]?.hex;
      if (!hex) return;
      paint.from.copy(materials.paint.color);
      paint.to = new THREE.Color(hex);
      paint.t = 0;
    },
    destroy() {
      cancelAnimationFrame(raf);
      ro.disconnect(); io.disconnect();
      window.removeEventListener("pointerup", up);
      renderer.dispose();
      container.innerHTML = "";
    },
  };
}
