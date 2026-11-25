import * as THREE from 'three';
import { WorldThemeSpec } from '../types/game';

/**
 * Atmospheric world backdrops: gradient sky dome with sun/moon/stars,
 * lit-window city skylines, sunset fields, harbor sea and moonlit canyons.
 * Everything is instanced or a single mesh with small canvas textures so it
 * stays cheap on phones.
 */

type UpdateFn = (dt: number, camera: THREE.Camera) => void;

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvasTexture(
  w: number,
  h: number,
  draw: (ctx: CanvasRenderingContext2D) => void,
  repeat?: [number, number],
): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  draw(ctx);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  if (repeat) {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeat[0], repeat[1]);
  }
  return tex;
}

// ---------------------------------------------------------------- Sky dome

interface SkyOptions {
  top: string;
  horizon: string;
  bottom: string;
  sunColor: string;
  sunDir: THREE.Vector3;
  sunSize: number; // angular radius in radians
  sunGlow: number;
  stars: number;
}

function buildSkyDome(o: SkyOptions): THREE.Mesh {
  const geo = new THREE.SphereGeometry(400, 32, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uTop: { value: new THREE.Color(o.top) },
      uHorizon: { value: new THREE.Color(o.horizon) },
      uBottom: { value: new THREE.Color(o.bottom) },
      uSunColor: { value: new THREE.Color(o.sunColor) },
      uSunDir: { value: o.sunDir.clone().normalize() },
      uSunCos: { value: Math.cos(o.sunSize) },
      uSunGlow: { value: o.sunGlow },
      uStars: { value: o.stars },
      uTime: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = position;
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uTop, uHorizon, uBottom, uSunColor, uSunDir;
      uniform float uSunCos, uSunGlow, uStars, uTime;
      varying vec3 vDir;
      float hash(vec3 p) {
        p = fract(p * 0.3183099 + 0.1);
        p *= 17.0;
        return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
      }
      void main() {
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 col = h > 0.0
          ? mix(uHorizon, uTop, pow(clamp(h, 0.0, 1.0), 0.5))
          : mix(uHorizon, uBottom, pow(clamp(-h * 4.0, 0.0, 1.0), 0.6));
        float s = max(dot(d, normalize(uSunDir)), 0.0);
        float disc = smoothstep(uSunCos - 0.0012, uSunCos + 0.0004, s);
        float glow = pow(s, 6.0) * 0.35 + pow(s, 48.0) * 0.6;
        col += uSunColor * (disc * 1.6 + glow * uSunGlow);
        if (uStars > 0.0 && h > 0.02) {
          vec3 g = floor(d * 260.0);
          float r = hash(g);
          float tw = 0.65 + 0.35 * sin(uTime * 2.0 + r * 40.0);
          float st = step(0.9972, r) * smoothstep(0.02, 0.35, h) * tw;
          col += vec3(st) * uStars;
        }
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'SkyDome';
  mesh.frustumCulled = false;
  mesh.renderOrder = -1000;
  return mesh;
}

// ---------------------------------------------------------------- Buildings

interface CityOptions {
  rng: () => number;
  courseLength: number;
  facade: string;
  windowDark: string;
  litColors: string[];
  litRatio: number;
  emissiveIntensity: number;
  baseY: number;
  count: number;
  nearX: number;
  farX: number;
  minH: number;
  maxH: number;
  roofBeacons: boolean;
}

function makeWindowTextures(
  rng: () => number,
  rows: number,
  cols: number,
  o: CityOptions,
): { map: THREE.CanvasTexture; emissive: THREE.CanvasTexture } {
  const cell = 8;
  const w = cols * cell;
  const h = rows * cell;
  const lit: (string | null)[] = [];
  for (let i = 0; i < rows * cols; i++) {
    lit.push(
      rng() < o.litRatio ? o.litColors[Math.floor(rng() * o.litColors.length)] : null,
    );
  }
  const map = canvasTexture(w, h, (ctx) => {
    ctx.fillStyle = o.facade;
    ctx.fillRect(0, 0, w, h);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        ctx.fillStyle = lit[r * cols + c] ?? o.windowDark;
        ctx.fillRect(c * cell + 2, r * cell + 2, 5, 5);
      }
    }
  });
  const emissive = canvasTexture(w, h, (ctx) => {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, w, h);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const col = lit[r * cols + c];
        if (col) {
          ctx.fillStyle = col;
          ctx.fillRect(c * cell + 2, r * cell + 2, 5, 5);
        }
      }
    }
  });
  return { map, emissive };
}

function boxWithPlainRoof(): THREE.BoxGeometry {
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const uv = geo.attributes.uv as THREE.BufferAttribute;
  // Faces: +x, -x, +y, -y, +z, -z (4 verts each). Point the roof & floor at a
  // facade-only pixel so roofs don't show windows.
  for (let v = 8; v < 16; v++) uv.setXY(v, 0.004, 0.004);
  uv.needsUpdate = true;
  return geo;
}

function buildCity(group: THREE.Group, o: CityOptions) {
  const classes = [
    { rows: 10, cols: 6, hMin: o.minH, hMax: o.minH + (o.maxH - o.minH) * 0.35 },
    { rows: 18, cols: 7, hMin: o.minH + (o.maxH - o.minH) * 0.35, hMax: o.minH + (o.maxH - o.minH) * 0.7 },
    { rows: 28, cols: 8, hMin: o.minH + (o.maxH - o.minH) * 0.7, hMax: o.maxH },
  ];
  const geo = boxWithPlainRoof();
  const dummy = new THREE.Object3D();
  const tint = new THREE.Color();
  const beaconPositions: THREE.Vector3[] = [];

  classes.forEach((cls, ci) => {
    const { map, emissive } = makeWindowTextures(o.rng, cls.rows, cls.cols, o);
    const mat = new THREE.MeshStandardMaterial({
      map,
      emissiveMap: emissive,
      emissive: new THREE.Color('#ffffff'),
      emissiveIntensity: o.emissiveIntensity,
      roughness: 0.78,
      metalness: 0.15,
    });
    const n = Math.floor(o.count / 3);
    const mesh = new THREE.InstancedMesh(geo, mat, n);
    for (let i = 0; i < n; i++) {
      const side = (i + ci) % 2 === 0 ? -1 : 1;
      const xDist = o.nearX + o.rng() * (o.farX - o.nearX);
      const zPos = 60 - o.rng() * (o.courseLength + 300);
      const h = cls.hMin + o.rng() * (cls.hMax - cls.hMin);
      const w = 10 + o.rng() * 14;
      const d = 10 + o.rng() * 14;
      dummy.position.set(side * xDist, o.baseY + h / 2, zPos);
      dummy.scale.set(w, h, d);
      dummy.rotation.set(0, (o.rng() - 0.5) * 0.3, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      tint.setScalar(0.75 + o.rng() * 0.35);
      mesh.setColorAt(i, tint);
      if (o.roofBeacons && ci === 2 && o.rng() < 0.6) {
        beaconPositions.push(new THREE.Vector3(side * xDist, o.baseY + h + 1.2, zPos));
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
    group.add(mesh);
  });

  if (beaconPositions.length) {
    const bGeo = new THREE.SphereGeometry(0.9, 8, 6);
    const bMat = new THREE.MeshBasicMaterial({ color: '#ff3b3b' });
    const beacons = new THREE.InstancedMesh(bGeo, bMat, beaconPositions.length);
    beaconPositions.forEach((p, i) => {
      dummy.position.copy(p);
      dummy.scale.setScalar(1);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      beacons.setMatrixAt(i, dummy.matrix);
    });
    beacons.computeBoundingSphere();
    group.add(beacons);
    let t = 0;
    addUpdate(group, (dt) => {
      t += dt;
      bMat.color.setRGB(0.4 + 0.6 * (Math.sin(t * 3) > 0 ? 1 : 0.15), 0.08, 0.08);
    });
  }
}

function cityGround(
  courseLength: number,
  y: number,
  base: string,
  block: string,
  light: string,
): THREE.Mesh {
  const draw = (emissiveOnly: boolean) => (ctx: CanvasRenderingContext2D) => {
    ctx.fillStyle = emissiveOnly ? '#000' : base;
    ctx.fillRect(0, 0, 128, 128);
    if (!emissiveOnly) {
      ctx.fillStyle = block;
      ctx.fillRect(8, 8, 52, 52);
      ctx.fillRect(68, 8, 52, 52);
      ctx.fillRect(8, 68, 52, 52);
      ctx.fillRect(68, 68, 52, 52);
    }
    ctx.fillStyle = light;
    for (let i = 0; i < 128; i += 8) {
      ctx.fillRect(i + 2, 3, 2, 2);
      ctx.fillRect(i + 2, 63, 2, 2);
      ctx.fillRect(3, i + 2, 2, 2);
      ctx.fillRect(63, i + 2, 2, 2);
    }
  };
  const rep: [number, number] = [14, Math.ceil((courseLength + 800) / 64)];
  const map = canvasTexture(128, 128, draw(false), rep);
  const em = canvasTexture(128, 128, draw(true), rep);
  const mat = new THREE.MeshStandardMaterial({
    map,
    emissiveMap: em,
    emissive: new THREE.Color('#ffffff'),
    emissiveIntensity: 1.1,
    roughness: 0.95,
  });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(900, courseLength + 800), mat);
  plane.rotation.x = -Math.PI / 2;
  plane.position.set(0, y, -courseLength / 2);
  return plane;
}

// ---------------------------------------------------------------- Nature

function fieldsGround(courseLength: number, y: number, rng: () => number): THREE.Mesh {
  const palette = ['#c9a227', '#d9b23a', '#8a9a2b', '#6f8a2a', '#b9852c', '#a3b13a', '#d6a24a'];
  const map = canvasTexture(
    256,
    256,
    (ctx) => {
      // Patchwork of crop fields with row stripes
      for (let gx = 0; gx < 4; gx++) {
        for (let gy = 0; gy < 4; gy++) {
          const col = palette[Math.floor(rng() * palette.length)];
          ctx.fillStyle = col;
          ctx.fillRect(gx * 64, gy * 64, 64, 64);
          ctx.fillStyle = 'rgba(60,40,10,0.18)';
          const vertical = rng() < 0.5;
          for (let k = 0; k < 64; k += 6) {
            if (vertical) ctx.fillRect(gx * 64 + k, gy * 64, 2, 64);
            else ctx.fillRect(gx * 64, gy * 64 + k, 64, 2);
          }
          ctx.fillStyle = 'rgba(40,60,20,0.55)';
          ctx.fillRect(gx * 64, gy * 64, 64, 2);
          ctx.fillRect(gx * 64, gy * 64, 2, 64);
        }
      }
    },
    [6, Math.ceil((courseLength + 800) / 150)],
  );
  const mat = new THREE.MeshStandardMaterial({ map, roughness: 1 });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(900, courseLength + 800), mat);
  plane.rotation.x = -Math.PI / 2;
  plane.position.set(0, y, -courseLength / 2);
  return plane;
}

function addHills(
  group: THREE.Group,
  rng: () => number,
  courseLength: number,
  y: number,
  colors: string[],
  count: number,
  near: number,
  far: number,
) {
  const geo = new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2);
  const mat = new THREE.MeshStandardMaterial({ roughness: 1, flatShading: false });
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  const dummy = new THREE.Object3D();
  const c = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    dummy.position.set(
      side * (near + rng() * (far - near)),
      y - 2,
      60 - rng() * (courseLength + 400),
    );
    const r = 40 + rng() * 70;
    dummy.scale.set(r, 12 + rng() * 30, r * (0.7 + rng() * 0.6));
    dummy.rotation.set(0, rng() * Math.PI, 0);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    mesh.setColorAt(i, c.set(colors[Math.floor(rng() * colors.length)]));
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingSphere();
  group.add(mesh);
}

function addTrees(
  group: THREE.Group,
  rng: () => number,
  courseLength: number,
  y: number,
  count: number,
  crownColors: string[],
) {
  const trunkGeo = new THREE.CylinderGeometry(0.35, 0.5, 1, 6);
  trunkGeo.translate(0, 0.5, 0);
  const crownGeo = new THREE.IcosahedronGeometry(1, 0);
  const trunk = new THREE.InstancedMesh(
    trunkGeo,
    new THREE.MeshStandardMaterial({ color: '#4a2f1b', roughness: 1 }),
    count,
  );
  const crown = new THREE.InstancedMesh(
    crownGeo,
    new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true }),
    count,
  );
  const dummy = new THREE.Object3D();
  const c = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const side = rng() < 0.5 ? -1 : 1;
    const x = side * (18 + Math.pow(rng(), 0.7) * 170);
    const z = 60 - rng() * (courseLength + 300);
    const s = 2.2 + rng() * 2.8;
    dummy.position.set(x, y, z);
    dummy.rotation.set(0, rng() * Math.PI, 0);
    dummy.scale.set(s, s * 1.6, s);
    dummy.updateMatrix();
    trunk.setMatrixAt(i, dummy.matrix);
    dummy.position.set(x, y + s * 1.6 + s * 0.9, z);
    dummy.scale.set(s * 1.5, s * 1.7, s * 1.5);
    dummy.updateMatrix();
    crown.setMatrixAt(i, dummy.matrix);
    crown.setColorAt(i, c.set(crownColors[Math.floor(rng() * crownColors.length)]));
  }
  [trunk, crown].forEach((m) => {
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
    group.add(m);
  });
}

function addFarmhouses(group: THREE.Group, rng: () => number, courseLength: number, y: number) {
  const n = 14;
  const body = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ color: '#9b2c2c', roughness: 0.9 }),
    n,
  );
  const roofGeo = new THREE.ConeGeometry(0.8, 0.6, 4);
  roofGeo.rotateY(Math.PI / 4);
  const roof = new THREE.InstancedMesh(
    roofGeo,
    new THREE.MeshStandardMaterial({ color: '#3f3a36', roughness: 0.9 }),
    n,
  );
  const win = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ color: '#ffcf7a' }),
    n,
  );
  const dummy = new THREE.Object3D();
  for (let i = 0; i < n; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const x = side * (40 + rng() * 120);
    const z = 40 - rng() * (courseLength + 200);
    const s = 6 + rng() * 4;
    dummy.rotation.set(0, 0, 0);
    dummy.position.set(x, y + s * 0.4, z);
    dummy.scale.set(s * 1.4, s * 0.8, s);
    dummy.updateMatrix();
    body.setMatrixAt(i, dummy.matrix);
    dummy.position.set(x, y + s * 0.8 + s * 0.3, z);
    dummy.scale.set(s * 1.4 * 1.25, s, s * 1.25);
    dummy.updateMatrix();
    roof.setMatrixAt(i, dummy.matrix);
    dummy.position.set(x, y + s * 0.4, z + s * 0.51);
    dummy.scale.set(s * 0.3, s * 0.25, 1);
    dummy.updateMatrix();
    win.setMatrixAt(i, dummy.matrix);
  }
  [body, roof, win].forEach((m) => {
    m.instanceMatrix.needsUpdate = true;
    m.computeBoundingSphere();
    group.add(m);
  });
}

function seaPlane(courseLength: number, y: number, deep: string, light: string): THREE.Mesh {
  const tex = canvasTexture(
    128,
    128,
    (ctx) => {
      ctx.fillStyle = deep;
      ctx.fillRect(0, 0, 128, 128);
      const r = mulberry32(99);
      for (let i = 0; i < 140; i++) {
        ctx.fillStyle = light;
        ctx.globalAlpha = 0.15 + r() * 0.35;
        ctx.fillRect(r() * 128, r() * 128, 6 + r() * 14, 1.5);
      }
      ctx.globalAlpha = 1;
    },
    [24, Math.ceil((courseLength + 800) / 40)],
  );
  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    roughness: 0.18,
    metalness: 0.35,
  });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(900, courseLength + 800), mat);
  plane.rotation.x = -Math.PI / 2;
  plane.position.set(0, y, -courseLength / 2);
  plane.userData.tex = tex;
  return plane;
}

function addBoats(group: THREE.Group, rng: () => number, courseLength: number, y: number) {
  const n = 22;
  const hullGeo = new THREE.BoxGeometry(1, 0.5, 2.6);
  const sailGeo = new THREE.ConeGeometry(0.9, 2.8, 3);
  const hull = new THREE.InstancedMesh(
    hullGeo,
    new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.5 }),
    n,
  );
  const sail = new THREE.InstancedMesh(
    sailGeo,
    new THREE.MeshStandardMaterial({ color: '#fff7ed', roughness: 0.7 }),
    n,
  );
  const dummy = new THREE.Object3D();
  const boats: { x: number; z: number; s: number; rot: number; speed: number }[] = [];
  for (let i = 0; i < n; i++) {
    boats.push({
      x: (i % 2 === 0 ? -1 : 1) * (25 + rng() * 160),
      z: 40 - rng() * (courseLength + 250),
      s: 2 + rng() * 2.5,
      rot: rng() * Math.PI * 2,
      speed: 1 + rng() * 2.5,
    });
  }
  const place = () => {
    boats.forEach((b, i) => {
      dummy.position.set(b.x, y + 0.2 * b.s, b.z);
      dummy.rotation.set(0, b.rot, 0);
      dummy.scale.setScalar(b.s);
      dummy.updateMatrix();
      hull.setMatrixAt(i, dummy.matrix);
      dummy.position.set(b.x, y + 1.8 * b.s, b.z);
      dummy.updateMatrix();
      sail.setMatrixAt(i, dummy.matrix);
    });
    hull.instanceMatrix.needsUpdate = true;
    sail.instanceMatrix.needsUpdate = true;
  };
  place();
  hull.frustumCulled = false;
  sail.frustumCulled = false;
  group.add(hull, sail);
  addUpdate(group, (dt) => {
    boats.forEach((b) => {
      b.x += Math.sin(b.rot) * b.speed * dt;
      b.z += Math.cos(b.rot) * b.speed * dt;
    });
    place();
  });
}

function addLighthouse(group: THREE.Group, x: number, y: number, z: number) {
  const tower = new THREE.Mesh(
    new THREE.CylinderGeometry(3, 4.2, 30, 12),
    new THREE.MeshStandardMaterial({
      map: canvasTexture(16, 64, (ctx) => {
        for (let i = 0; i < 8; i++) {
          ctx.fillStyle = i % 2 === 0 ? '#f8fafc' : '#dc2626';
          ctx.fillRect(0, i * 8, 16, 8);
        }
      }),
      roughness: 0.6,
    }),
  );
  tower.position.set(x, y + 15, z);
  const lamp = new THREE.Mesh(
    new THREE.SphereGeometry(2.4, 12, 8),
    new THREE.MeshBasicMaterial({ color: '#fff3c4' }),
  );
  lamp.position.set(x, y + 32, z);
  const beamGeo = new THREE.ConeGeometry(6, 70, 16, 1, true);
  beamGeo.translate(0, -35, 0);
  beamGeo.rotateZ(Math.PI / 2);
  const beam = new THREE.Mesh(
    beamGeo,
    new THREE.MeshBasicMaterial({
      color: '#fff6d5',
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  beam.position.copy(lamp.position);
  group.add(tower, lamp, beam);
  addUpdate(group, (dt) => {
    beam.rotation.y += dt * 0.8;
  });
}

function addRockSpires(
  group: THREE.Group,
  rng: () => number,
  courseLength: number,
  y: number,
  colors: string[],
  count: number,
) {
  const geo = new THREE.CylinderGeometry(0.55, 1, 1, 7, 3);
  // Roughen the spire silhouette a little
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const r = mulberry32(7);
  for (let i = 0; i < pos.count; i++) {
    const k = 0.85 + r() * 0.3;
    pos.setX(i, pos.getX(i) * k);
    pos.setZ(i, pos.getZ(i) * k);
  }
  geo.computeVertexNormals();
  const mesh = new THREE.InstancedMesh(
    geo,
    new THREE.MeshStandardMaterial({ roughness: 0.95, flatShading: true }),
    count,
  );
  const dummy = new THREE.Object3D();
  const c = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const h = 40 + rng() * 110;
    const w = 10 + rng() * 22;
    dummy.position.set(
      side * (32 + rng() * 170),
      y + h / 2,
      60 - rng() * (courseLength + 300),
    );
    dummy.scale.set(w, h, w * (0.7 + rng() * 0.6));
    dummy.rotation.set(0, rng() * Math.PI, 0);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    mesh.setColorAt(i, c.set(colors[Math.floor(rng() * colors.length)]));
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingSphere();
  group.add(mesh);
}

function addFireflies(
  group: THREE.Group,
  rng: () => number,
  courseLength: number,
  color: string,
  count: number,
) {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (rng() - 0.5) * 120;
    positions[i * 3 + 1] = -30 + rng() * 40;
    positions[i * 3 + 2] = 40 - rng() * (courseLength + 120);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const sprite = canvasTexture(32, 32, (ctx) => {
    const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.4, 'rgba(255,255,255,0.5)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 32, 32);
  });
  const mat = new THREE.PointsMaterial({
    color,
    map: sprite,
    size: 0.9,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const pts = new THREE.Points(geo, mat);
  group.add(pts);
  let t = 0;
  addUpdate(group, (dt) => {
    t += dt;
    mat.opacity = 0.65 + 0.35 * Math.sin(t * 2.4);
    pts.position.y = Math.sin(t * 0.6) * 1.2;
  });
}

// ---------------------------------------------------------------- Photo panoramas

/**
 * Real 360° photos (CC0, Poly Haven), stored in /public/panoramas so the game
 * never depends on the original site. `yaw` turns the photo so its most
 * interesting part sits ahead of the player.
 */
const PANORAMAS: Partial<Record<WorldThemeSpec['id'], { file: string; yaw: number }>> = {
  skyline: { file: 'panoramas/night-city.jpg', yaw: 0.38 },
  overpass: { file: 'panoramas/dusk-city.jpg', yaw: 0.15 },
  sunset: { file: 'panoramas/sunset-fields.jpg', yaw: 0.35 },
  harbor: { file: 'panoramas/harbor.jpg', yaw: 0.3 },
  canyon: { file: 'panoramas/moonlit-desert.jpg', yaw: 0.7 },
};

const panoCache = new Map<string, Promise<{ tex: THREE.Texture; horizon: THREE.Color }>>();

function loadPanorama(file: string) {
  let p = panoCache.get(file);
  if (!p) {
    p = new Promise((resolve, reject) => {
      new THREE.TextureLoader().load(
        `${import.meta.env.BASE_URL}${file}`,
        (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.generateMipmaps = false;
          tex.minFilter = THREE.LinearFilter;
          tex.magFilter = THREE.LinearFilter;
          tex.wrapS = THREE.RepeatWrapping;
          // Average colour just above the horizon, used for fog so the far
          // track blends into the photo.
          const horizon = new THREE.Color('#888888');
          try {
            const img = tex.image as HTMLImageElement;
            const c = document.createElement('canvas');
            c.width = 64;
            c.height = 1;
            const ctx = c.getContext('2d')!;
            ctx.drawImage(img, 0, img.height * 0.47, img.width, img.height * 0.02, 0, 0, 64, 1);
            const d = ctx.getImageData(0, 0, 64, 1).data;
            let r = 0, g = 0, b = 0;
            for (let i = 0; i < 64; i++) {
              r += d[i * 4];
              g += d[i * 4 + 1];
              b += d[i * 4 + 2];
            }
            horizon.setRGB(r / 64 / 255, g / 64 / 255, b / 64 / 255, THREE.SRGBColorSpace);
          } catch {
            // keep default
          }
          resolve({ tex, horizon });
        },
        undefined,
        (err) => {
          panoCache.delete(file);
          reject(err);
        },
      );
    });
    panoCache.set(file, p);
  }
  return p;
}

function buildPanoramaDome(tex: THREE.Texture, yaw: number, fade: THREE.Color) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    transparent: true,
    fog: false,
    uniforms: {
      uMap: { value: tex },
      uYaw: { value: yaw },
      uFade: { value: fade },
      uOpacity: { value: 0 },
    },
    toneMapped: false,
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = position;
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      uniform float uYaw, uOpacity;
      uniform vec3 uFade;
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        float u = fract(atan(d.z, d.x) / 6.2831853 + 0.5 + uYaw);
        // Drop the photo's horizon a little below eye level so the track
        // feels like it floats above the scene
        float v = clamp((asin(clamp(d.y, -1.0, 1.0)) + 0.12) / 3.1415927 + 0.5, 0.001, 0.999);
        vec3 col = texture2D(uMap, vec2(u, v)).rgb;
        // Soften the ground far below so the floating track reads as high up
        float below = smoothstep(-0.3, -0.75, d.y);
        col = mix(col, uFade, below * 0.8);
        gl_FragColor = vec4(col, uOpacity);
        #include <colorspace_fragment>
      }
    `,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(390, 48, 24), mat);
  mesh.name = 'PanoramaDome';
  mesh.frustumCulled = false;
  mesh.renderOrder = -999;
  return mesh;
}

function attachPanorama(group: THREE.Group, themeId: WorldThemeSpec['id']) {
  const spec = PANORAMAS[themeId];
  if (!spec) return;
  loadPanorama(spec.file)
    .then(({ tex, horizon }) => {
      if (group.userData.disposed) return;
      const dome = buildPanoramaDome(tex, spec.yaw, horizon.clone().multiplyScalar(0.8));
      group.add(dome);
      group.userData.pano = dome;
      group.userData.fogColor = horizon;
      group.userData.panoTex = tex;
      group.userData.panoYaw = spec.yaw;
      const mat = dome.material as THREE.ShaderMaterial;
      let t = 0;
      addUpdate(group, (dt) => {
        if (t >= 1) return;
        t = Math.min(1, t + dt * 1.6);
        mat.uniforms.uOpacity.value = t;
        if (t >= 1) {
          // Photo fully in: hide the stylised props & sky underneath
          group.children.forEach((c) => {
            if (c !== dome) c.visible = false;
          });
          mat.transparent = false;
          mat.needsUpdate = true;
        }
      });
    })
    .catch(() => {
      // Offline or missing file: keep the stylised world
    });
}

// ---------------------------------------------------------------- Helpers

function addUpdate(group: THREE.Group, fn: UpdateFn) {
  const list: UpdateFn[] = group.userData.updates ?? (group.userData.updates = []);
  list.push(fn);
}

/** Call every frame: keeps the sky centred on the camera and animates details. */
export function updateWorldBackdrop(
  group: THREE.Group | undefined,
  dt: number,
  camera: THREE.Camera,
  scene?: THREE.Scene,
) {
  if (!group) return;
  const sky = group.userData.sky as THREE.Mesh | undefined;
  if (sky) {
    sky.position.copy(camera.position);
    (sky.material as THREE.ShaderMaterial).uniforms.uTime.value += dt;
  }
  const pano = group.userData.pano as THREE.Mesh | undefined;
  if (pano) pano.position.copy(camera.position);
  const fogColor = group.userData.fogColor as THREE.Color | undefined;
  if (scene && fogColor && !group.userData.fogApplied) {
    group.userData.fogApplied = true;
    if (scene.fog) (scene.fog as THREE.FogExp2).color.copy(fogColor);
    scene.background = fogColor.clone();
  }
  const list = group.userData.updates as UpdateFn[] | undefined;
  list?.forEach((fn) => fn(dt, camera));
}

// ---------------------------------------------------------------- Main

export function buildAtmosphericBackdrop(
  theme: WorldThemeSpec,
  courseLength: number,
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'WorldBackdrop';
  const rng = mulberry32(
    theme.id.split('').reduce((a, ch) => a * 31 + ch.charCodeAt(0), 7) +
      Math.round(courseLength),
  );
  const L = courseLength;

  let sky: THREE.Mesh;

  switch (theme.id) {
    case 'skyline': {
      // Night city: deep blue sky, moon, stars, glowing windows & street grid
      sky = buildSkyDome({
        top: '#030712',
        horizon: '#1e2a5a',
        bottom: '#0b1026',
        sunColor: '#e0e7ff',
        sunDir: new THREE.Vector3(0.45, 0.32, -1),
        sunSize: 0.035,
        sunGlow: 0.6,
        stars: 1.1,
      });
      group.add(cityGround(L, -85, '#0a0f1f', '#141b33', '#ffb347'));
      buildCity(group, {
        rng,
        courseLength: L,
        facade: '#1b2236',
        windowDark: '#0d1220',
        litColors: ['#ffd27a', '#ffe7b0', '#9fd8ff', '#ffc160'],
        litRatio: 0.42,
        emissiveIntensity: 1.6,
        baseY: -85,
        count: 150,
        nearX: 34,
        farX: 190,
        minH: 35,
        maxH: 165,
        roofBeacons: true,
      });
      break;
    }
    case 'overpass': {
      // Dusk downtown: purple-orange sky, lights coming on
      sky = buildSkyDome({
        top: '#2e1065',
        horizon: '#f97357',
        bottom: '#3b1d4a',
        sunColor: '#ffb070',
        sunDir: new THREE.Vector3(-0.3, 0.05, -1),
        sunSize: 0.05,
        sunGlow: 1.4,
        stars: 0.35,
      });
      group.add(cityGround(L, -85, '#1c1628', '#2a2236', '#ffcf86'));
      buildCity(group, {
        rng,
        courseLength: L,
        facade: '#3a3348',
        windowDark: '#231d30',
        litColors: ['#ffd58a', '#ffe9c2', '#ffb35c'],
        litRatio: 0.3,
        emissiveIntensity: 1.2,
        baseY: -85,
        count: 150,
        nearX: 34,
        farX: 190,
        minH: 30,
        maxH: 150,
        roofBeacons: true,
      });
      break;
    }
    case 'sunset': {
      // Sunset fields: golden patchwork farmland, hills, trees, huge sun
      sky = buildSkyDome({
        top: '#3b1a5a',
        horizon: '#ff8a3d',
        bottom: '#ffb46b',
        sunColor: '#ffd08a',
        sunDir: new THREE.Vector3(0.15, 0.06, -1),
        sunSize: 0.075,
        sunGlow: 1.8,
        stars: 0,
      });
      group.add(fieldsGround(L, -60, rng));
      addHills(group, rng, L, -60, ['#6b7a2a', '#7c6a2a', '#556b2f', '#8a6d3b'], 26, 120, 260);
      addTrees(group, rng, L, -60, Math.floor(90 + L * 0.25), ['#4d6b22', '#5f7d2a', '#3f5a1d', '#7a7a2a']);
      addFarmhouses(group, rng, L, -60);
      break;
    }
    case 'harbor': {
      // Bright harbor: sea with drifting sailboats, islands, a lighthouse
      sky = buildSkyDome({
        top: '#1d6fd1',
        horizon: '#cfe9ff',
        bottom: '#7cc4e8',
        sunColor: '#fff6d8',
        sunDir: new THREE.Vector3(-0.5, 0.55, -1),
        sunSize: 0.03,
        sunGlow: 0.9,
        stars: 0,
      });
      group.add(seaPlane(L, -60, '#0b5c7a', '#bfe9ff'));
      addHills(group, rng, L, -60, ['#3f7d3a', '#4f8f3f', '#e3cf96'], 16, 110, 260);
      addBoats(group, rng, L, -60);
      addLighthouse(group, 70, -60, -L * 0.55);
      buildCity(group, {
        rng,
        courseLength: L,
        facade: '#e7e2d6',
        windowDark: '#5b7a8f',
        litColors: ['#9fd3f5'],
        litRatio: 0.15,
        emissiveIntensity: 0.25,
        baseY: -60,
        count: 36,
        nearX: 200,
        farX: 260,
        minH: 15,
        maxH: 60,
        roofBeacons: false,
      });
      break;
    }
    case 'canyon':
    default: {
      // Moonlit canyon: rock spires, glowing river, stars and fireflies
      sky = buildSkyDome({
        top: '#020617',
        horizon: '#123a52',
        bottom: '#071a26',
        sunColor: '#dbeafe',
        sunDir: new THREE.Vector3(-0.4, 0.4, -1),
        sunSize: 0.045,
        sunGlow: 0.7,
        stars: 1.2,
      });
      const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(900, L + 800),
        new THREE.MeshStandardMaterial({ color: '#0b1a24', roughness: 1 }),
      );
      floor.rotation.x = -Math.PI / 2;
      floor.position.set(0, -85, -L / 2);
      group.add(floor);
      const river = new THREE.Mesh(
        new THREE.PlaneGeometry(36, L + 600),
        new THREE.MeshBasicMaterial({ color: '#00f5d4', transparent: true, opacity: 0.5 }),
      );
      river.rotation.x = -Math.PI / 2;
      river.position.set(15, -84.5, -L / 2);
      group.add(river);
      addRockSpires(group, rng, L, -85, ['#3b2f4a', '#4a3a3f', '#2e2a3d', '#55413b'], 70);
      addFireflies(group, rng, L, '#a7f3d0', 220);
      break;
    }
  }

  group.add(sky);
  group.userData.sky = sky;
  attachPanorama(group, theme.id);
  return group;
}
