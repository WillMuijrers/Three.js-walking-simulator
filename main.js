import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeNAW } from './naw.js';

// ---------- Instellingen ----------
const COUNT = 1000;        // aantal mensen
const EYE = 1.6;           // ooghoogte in meters
const SCROLL_SPEED = 0.01; // meters per scroll-eenheid
// De 6 kleuren waaruit ieder persoon er willekeurig één krijgt
const PERSON_COLORS = ['#e63946', '#f4a261', '#e9c46a', '#2a9d8f', '#3d5a80', '#9d4edd']
  .map((c) => new THREE.Color(c));
const WHITE = new THREE.Color('#ffffff');

// ---------- Renderer, scene, camera ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const horizon = new THREE.Color('#efe7dd');
scene.background = horizon;
scene.fog = new THREE.Fog(horizon, 4, 55);

const camera = new THREE.PerspectiveCamera(65, innerWidth / innerHeight, 0.1, 170);
camera.rotation.order = 'YXZ';

scene.add(new THREE.HemisphereLight('#f4f1ec', '#b8a896', 2.2));
const sun = new THREE.DirectionalLight('#fff1dc', 1.5);
sun.position.set(-30, 40, 15);
scene.add(sun);

// Lucht: zachte verloop-koepel die met de camera meebeweegt
const sky = new THREE.Mesh(
  new THREE.SphereGeometry(150, 32, 16),
  new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color('#a9bccb') },
      horizon: { value: horizon },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 top;
      uniform vec3 horizon;
      varying vec3 vDir;
      void main() {
        gl_FragColor = vec4(mix(horizon, top, smoothstep(0.0, 0.55, vDir.y)), 1.0);
        #include <colorspace_fragment>
      }`,
  })
);
sky.renderOrder = -1;
scene.add(sky);

// Vaste "random" zodat de scene elke keer hetzelfde is
let seed = 12345;
const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

// ---------- Looppad (onzichtbaar, alleen voor de camera) ----------
const pathPoints = [];
for (let i = 0; i <= 16; i++) {
  pathPoints.push(new THREE.Vector3(Math.sin(i * 0.7) * 8, 0, 10 - i * 20));
}
const path = new THREE.CatmullRomCurve3(pathPoints);
const PATH_LENGTH = path.getLength();
const pathSamples = path.getSpacedPoints(300);
const distToPath = (x, z) => {
  let m = Infinity;
  for (const p of pathSamples) m = Math.min(m, (p.x - x) ** 2 + (p.z - z) ** 2);
  return Math.sqrt(m);
};

// ---------- Abstract landschap ----------
const stone = (c) => new THREE.MeshLambertMaterial({ color: c, flatShading: true });

// Effen, warme ondergrond
{
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(600, 800), new THREE.MeshLambertMaterial({ color: '#e6ded3' }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.z = -150;
  scene.add(floor);
}

// Obstakels (pilaren, banken) — mensen mogen hier niet staan
const obstacles = new Map();
const CELL = 4;
const cellKey = (x, z) => `${Math.floor(x / CELL)},${Math.floor(z / CELL)}`;
function isFree(x, z, r) {
  const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
    const list = obstacles.get(`${cx + i},${cz + j}`);
    if (list) for (const o of list) if (Math.hypot(o.x - x, o.z - z) < r + o.r) return false;
  }
  return true;
}
function occupy(x, z, r, data = {}) {
  const o = { x, z, r, ...data };
  const k = cellKey(x, z);
  if (!obstacles.has(k)) obstacles.set(k, []);
  obstacles.get(k).push(o);
  return o;
}

const dummy = new THREE.Object3D();
function instanced(geo, mat, items) {
  const mesh = new THREE.InstancedMesh(geo, mat, items.length);
  items.forEach((it, i) => {
    dummy.position.set(it.x, it.y ?? 0, it.z);
    dummy.rotation.set(it.rx ?? 0, it.rot ?? 0, it.rz ?? 0);
    dummy.scale.set(it.sx ?? 1, it.sy ?? 1, it.sz ?? 1);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  });
  mesh.computeBoundingSphere();
  scene.add(mesh);
  return mesh;
}

// Verspreid iets op een vrije plek, op minstens `minPath` meter van het pad
function scatter(n, { spread = 120, minPath = 4, radius }) {
  const items = [];
  for (let tries = 0; items.length < n && tries < n * 50; tries++) {
    const r = radius();
    const x = (rand() - 0.5) * spread, z = 15 - rand() * 345;
    if (distToPath(x, z) < minPath + r || !isFree(x, z, r)) continue;
    occupy(x, z, r);
    items.push({ x, z, r });
  }
  return items;
}

// Grote, half verzonken koepels in de verte (silhouetten in de mist)
instanced(new THREE.IcosahedronGeometry(1, 1), stone('#d8cfc4'),
  scatter(18, { spread: 220, minPath: 35, radius: () => 8 + rand() * 14 }).map((it) => ({
    ...it, y: -it.r * 0.35, rot: rand() * 6, sx: it.r, sy: it.r * (0.5 + rand() * 0.4), sz: it.r,
  })));

// Losse keien
instanced(new THREE.IcosahedronGeometry(1, 0), stone('#d3cabe'),
  scatter(150, { radius: () => 0.3 + Math.pow(rand(), 2) * 2.5 }).map((it) => ({
    ...it, y: it.r * 0.25, rot: rand() * 6, rx: rand() * 6, rz: rand() * 6,
    sx: it.r, sy: it.r * (0.5 + rand() * 0.5), sz: it.r * (0.7 + rand() * 0.4),
  })));

// Slanke, licht scheve zuilen (obelisken)
instanced(new THREE.CylinderGeometry(0.22, 0.5, 1, 4).translate(0, 0.5, 0), stone('#c8bfb3'),
  scatter(60, { minPath: 6, radius: () => 0.6 }).map((it) => ({
    ...it, rot: rand() * 6, rx: (rand() - 0.5) * 0.12, rz: (rand() - 0.5) * 0.12,
    sx: 0.8 + rand() * 0.6, sy: 3 + rand() * 9, sz: 0.8 + rand() * 0.6,
  })));

// ---------- Rode, facetachtige mens ----------
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);

// Cilinder met weinig zijden van punt a naar b (= hoekige ledemaat)
function limb(a, b, ra, rb, sides = 5) {
  const len = a.distanceTo(b);
  const g = new THREE.CylinderGeometry(rb, ra, len, sides, 1).toNonIndexed();
  g.translate(0, len / 2, 0);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, b.clone().sub(a).normalize()));
  g.translate(a.x, a.y, a.z);
  return g;
}
function blob(geo, pos, scale, rotX = 0) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  g.scale(scale.x, scale.y, scale.z);
  g.rotateX(rotX);
  g.translate(pos.x, pos.y, pos.z);
  return g;
}

// pose: posities van elleboog/pols/handpunt per kant, en knie/enkel
function buildPerson(pose) {
  const parts = [];
  for (const s of [-1, 1]) {
    const L = pose[s < 0 ? 'left' : 'right'];
    const m = (v) => V(v[0] * s, v[1], v[2]);
    // been
    const hip = V(0.1 * s, 0.95, 0);
    const knee = m(L.knee), ankle = m(L.ankle);
    parts.push(limb(hip, knee, 0.085, 0.06, 5));
    parts.push(limb(knee, ankle, 0.058, 0.04, 5));
    parts.push(blob(new THREE.BoxGeometry(0.09, 0.07, 0.22), V(ankle.x, 0.035, ankle.z + 0.06), V(1, 1, 1)));
    // arm
    const shoulder = V(0.2 * s, 1.42, 0);
    const elbow = m(L.elbow), wrist = m(L.wrist), hand = m(L.hand);
    parts.push(limb(shoulder, elbow, 0.055, 0.042, 5));
    parts.push(limb(elbow, wrist, 0.042, 0.03, 5));
    parts.push(limb(wrist, hand, 0.035, 0.02, 4));
  }
  // romp
  parts.push(blob(limb(V(0, 0.88, 0), V(0, 1.04, 0), 0.15, 0.16, 6), V(0, 0, 0), V(1, 1, 0.75)));
  parts.push(blob(limb(V(0, 1.02, 0), V(0, 1.47, 0), 0.15, 0.22, 6), V(0, 0, 0), V(1, 1, 0.6)));
  parts.push(limb(V(0, 1.44, 0), V(0, 1.58, 0.01), 0.05, 0.045, 5));
  // hoofd: uitgerekte icosaëder
  parts.push(blob(new THREE.IcosahedronGeometry(0.11, 0), V(0, 1.69, 0.015), V(0.82, 1.22, 0.95)));
  return mergeGeometries(parts);
}

const legs = { left: { knee: [0.11, 0.5, 0.02], ankle: [0.11, 0.08, -0.02] }, right: null };
const wide = { knee: [0.16, 0.5, 0.0], ankle: [0.2, 0.08, 0.0] };
const poses = [
  // armen langs het lichaam
  {
    left: { ...legs.left, elbow: [0.25, 1.12, -0.02], wrist: [0.27, 0.86, 0.03], hand: [0.28, 0.76, 0.04] },
    right: { ...legs.left, elbow: [0.25, 1.12, -0.02], wrist: [0.27, 0.86, 0.03], hand: [0.28, 0.76, 0.04] },
  },
  // handen voor het lichaam (zoals op de referentie)
  {
    left: { ...legs.left, elbow: [0.25, 1.14, -0.04], wrist: [0.16, 1.02, 0.24], hand: [0.12, 1.0, 0.34] },
    right: { ...legs.left, elbow: [0.24, 1.15, -0.04], wrist: [0.2, 1.06, 0.26], hand: [0.18, 1.06, 0.36] },
  },
  // één hand in de zij, brede stand
  {
    left: { ...wide, elbow: [0.25, 1.12, -0.02], wrist: [0.27, 0.86, 0.03], hand: [0.28, 0.76, 0.04] },
    right: { ...wide, elbow: [0.38, 1.15, -0.04], wrist: [0.19, 1.0, -0.02], hand: [0.13, 0.98, -0.03] },
  },
];
const personGeos = poses.map(buildPerson);
const personMat = new THREE.MeshLambertMaterial({ color: '#ffffff', flatShading: true });

// Subtiele idle-beweging, helemaal in de vertex shader (kost de CPU niets).
// Iedere persoon krijgt een eigen fase op basis van zijn positie.
const timeUniform = { value: 0 };
personMat.onBeforeCompile = (shader) => {
  shader.uniforms.uTime = timeUniform;
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nuniform float uTime;')
    .replace('#include <begin_vertex>', /* glsl */ `
      #include <begin_vertex>
      vec3 ip = vec3(instanceMatrix[3]);
      float ph = ip.x * 1.73 + ip.z * 2.31;
      float speed = 1.4 + fract(ph * 0.37) * 0.5;
      float t = uTime * speed;
      float y = transformed.y;
      float h = clamp(y / 1.8, 0.0, 1.0);

      // gewicht verplaatsen / licht wiegen (vanuit de enkels)
      transformed.x += sin(t * 0.7 + ph) * 0.09 * h * h;
      transformed.z += sin(t * 0.5 + ph * 1.3) * 0.05 * h * h;

      // ademhaling: borst zet iets uit
      float chest = smoothstep(1.0, 1.3, y) * (1.0 - smoothstep(1.42, 1.5, y)) * step(abs(transformed.x), 0.23);
      transformed.xz *= 1.0 + chest * 0.06 * sin(t * 1.6 + ph);

      // armen zwaaien een klein beetje mee
      float arm = step(0.23, abs(transformed.x)) * step(y, 1.45) * step(0.7, y);
      transformed.z += arm * (1.45 - y) * 0.3 * sin(t * 0.9 + ph + sign(transformed.x));

      // af en toe het hoofd draaien
      float head = smoothstep(1.56, 1.6, y);
      float look = sin(t * 0.3 + ph * 0.7);
      float ang = head * 1.0 * look * look * look;
      vec2 hz = vec2(transformed.x, transformed.z - 0.015);
      transformed.x = mix(transformed.x, hz.x * cos(ang) - hz.y * sin(ang), head);
      transformed.z = mix(transformed.z, hz.x * sin(ang) + hz.y * cos(ang) + 0.015, head);
    `);
};

// Blob-schaduw: zachte blauwgrijze vlek onder elke persoon
const blobTex = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(70,100,115,0.35)');
  grad.addColorStop(1, 'rgba(70,100,115,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
})();
const blobGeo = new THREE.PlaneGeometry(0.9, 0.9);
blobGeo.rotateX(-Math.PI / 2);

// ---------- Mensen verspreiden ----------
const people = [];
function addPerson(x, z, rot, pose) {
  if (people.length >= COUNT || distToPath(x, z) < 1.6 || !isFree(x, z, 0.35)) return;
  const p = occupy(x, z, 0.35, { rot, pose, id: people.length, naw: makeNAW(rand) });
  people.push(p);
}
function pointBeside(t, offset) {
  const p = path.getPointAt(t);
  const tan = path.getTangentAt(t);
  return { x: p.x - tan.z * offset, z: p.z + tan.x * offset };
}
for (let tries = 0; people.length < COUNT && tries < 100000; tries++) {
  const t = rand();
  const side = rand() < 0.5 ? -1 : 1;
  if (rand() < 0.3) {
    // groepje dat naar elkaar toe staat
    const c = pointBeside(t, side * (3 + rand() * 18));
    const n = 3 + Math.floor(rand() * 3);
    const r = 0.65 + rand() * 0.35;
    const a0 = rand() * Math.PI * 2;
    for (let i = 0; i < n; i++) {
      const a = a0 + (i / n) * Math.PI * 2;
      const x = c.x + Math.cos(a) * r, z = c.z + Math.sin(a) * r;
      addPerson(x, z, Math.atan2(c.x - x, c.z - z), rand() < 0.6 ? 1 : Math.floor(rand() * 3));
    }
  } else {
    const c = pointBeside(t, side * (1.8 + Math.pow(rand(), 1.5) * 26));
    addPerson(c.x, c.z, rand() * Math.PI * 2, Math.floor(rand() * 3));
  }
}

// Eén InstancedMesh per houding
const personMeshes = personGeos.map((geo, poseIdx) => {
  const group = people.filter((p) => p.pose === poseIdx);
  const mesh = new THREE.InstancedMesh(geo, personMat, Math.max(group.length, 1));
  mesh.count = group.length;
  mesh.userData.people = group;
  group.forEach((p, i) => {
    p.mesh = mesh;
    p.index = i;
    p.color = PERSON_COLORS[Math.floor(rand() * PERSON_COLORS.length)];
    const h = 0.95 + rand() * 0.13;
    const w = h * (0.94 + rand() * 0.12);
    dummy.position.set(p.x, 0, p.z);
    dummy.rotation.set(0, p.rot, 0);
    dummy.scale.set(w, h, w);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    mesh.setColorAt(i, p.color);
  });
  mesh.computeBoundingSphere();
  scene.add(mesh);
  return mesh;
});

const blobs = new THREE.InstancedMesh(
  blobGeo,
  new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false }),
  people.length
);
people.forEach((p, i) => {
  dummy.position.set(p.x, 0.02, p.z);
  dummy.rotation.set(0, 0, 0);
  dummy.scale.set(1, 1, 1);
  dummy.updateMatrix();
  blobs.setMatrixAt(i, dummy.matrix);
});
blobs.computeBoundingSphere();
scene.add(blobs);

// ---------- Hover: naam tonen ----------
const raycaster = new THREE.Raycaster();
raycaster.far = 45;
const pointer = new THREE.Vector2(-10, -10);
let pointerPx = { x: 0, y: 0 };
let pointerInside = false;
let hovered = null;
const tooltip = document.getElementById('tooltip');

function setHovered(p) {
  if (p === hovered) return;
  if (hovered) {
    hovered.mesh.setColorAt(hovered.index, hovered.color);
    hovered.mesh.instanceColor.needsUpdate = true;
  }
  hovered = p;
  if (p) {
    p.mesh.setColorAt(p.index, p.color.clone().lerp(WHITE, 0.5));
    p.mesh.instanceColor.needsUpdate = true;
    const n = p.naw;
    tooltip.style.borderLeftColor = p.color.getStyle();
    tooltip.innerHTML = `<strong>${n.naam}</strong><span>${n.adres}<br>${n.postcode} ${n.woonplaats}</span>`;
  }
  tooltip.style.opacity = p ? 1 : 0;
  document.body.style.cursor = p ? 'pointer' : '';
}

function updateHover() {
  if (!pointerInside) return setHovered(null);
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObjects(personMeshes, false)[0];
  setHovered(hit ? hit.object.userData.people[hit.instanceId] : null);
  if (hovered) tooltip.style.transform = `translate(${pointerPx.x + 16}px, ${pointerPx.y + 16}px)`;
}

// ---------- Invoer: scrollen = lopen ----------
let target = 0, current = 0;
let lookX = 0, lookY = 0;
const clampDist = (d) => Math.max(0, Math.min(PATH_LENGTH, d));
const hint = document.getElementById('hint');
const hideHint = () => (hint.style.opacity = 0);

addEventListener('wheel', (e) => {
  e.preventDefault();
  const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? innerHeight : 1;
  target = clampDist(target + e.deltaY * unit * SCROLL_SPEED);
  hideHint();
}, { passive: false });

let touchY = null;
addEventListener('touchstart', (e) => (touchY = e.touches[0].clientY));
addEventListener('touchmove', (e) => {
  const y = e.touches[0].clientY;
  target = clampDist(target + (touchY - y) * 0.04);
  touchY = y;
  hideHint();
});
addEventListener('keydown', (e) => {
  if (['ArrowUp', 'w', 'W'].includes(e.key)) target = clampDist(target + 2);
  if (['ArrowDown', 's', 'S'].includes(e.key)) target = clampDist(target - 2);
});
addEventListener('pointermove', (e) => {
  pointer.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  pointerPx = { x: e.clientX, y: e.clientY };
  pointerInside = true;
  if (e.pointerType !== 'mouse') return;
  lookX = (e.clientX / innerWidth - 0.5) * 2;
  lookY = (e.clientY / innerHeight - 0.5) * 2;
});
document.addEventListener('pointerleave', () => (pointerInside = false));
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ---------- Render-loop ----------
const statsEl = document.getElementById('stats');
const progressEl = document.getElementById('progress');
const clock = new THREE.Clock();
let yaw = 0, pitch = 0, fpsAcc = 0, fpsFrames = 0, fps = 0;

function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  timeUniform.value += dt;

  // Vertraagd meebewegen naar de scroll-positie
  current += (target - current) * (1 - Math.exp(-dt * 3));
  const t = current / PATH_LENGTH;
  const p = path.getPointAt(t);
  const dir = path.getTangentAt(t);

  // Hoofdbeweging tijdens het lopen (een "stap" per 0,7 m)
  const speed = Math.min(Math.abs(target - current), 1);
  const bob = Math.abs(Math.sin((current * Math.PI) / 0.7)) * 0.04 * speed;
  camera.position.set(p.x, EYE + bob, p.z);

  // Rondkijken met de muis (zwakker, zodat je rustig kunt hoveren)
  const targetYaw = Math.atan2(-dir.x, -dir.z) - lookX * 0.45;
  const targetPitch = -lookY * 0.18;
  const k = 1 - Math.exp(-dt * 4);
  yaw += (targetYaw - yaw) * k;
  pitch += (targetPitch - pitch) * k;
  camera.rotation.set(pitch, yaw, 0);
  camera.updateMatrixWorld();
  sky.position.copy(camera.position);

  updateHover();
  renderer.render(scene, camera);

  fpsAcc += dt; fpsFrames++;
  if (fpsAcc > 0.5) { fps = Math.round(fpsFrames / fpsAcc); fpsAcc = 0; fpsFrames = 0; }
  const info = renderer.info.render;
  statsEl.textContent =
    `${fps} fps\n${people.length} mensen\n${info.calls} draw calls\n${(info.triangles / 1000).toFixed(0)}k driehoeken`;
  progressEl.style.width = `${t * 100}%`;

  requestAnimationFrame(frame);
}
frame();
