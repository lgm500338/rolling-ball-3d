import * as THREE from 'three';
import {
  BallSkinSpec,
  CourseObstacle,
  GeneratedCourse,
  TrackNode,
  WorldThemeSpec,
} from '../types/game';
import { SLICE_STEP } from './courseGenerator';
import {
  createBallSkinTexture,
  createFinishCheckeredTexture,
  createHazardStripeTexture,
  createTrackSurfaceTexture,
} from './textures';

/**
 * Interpolates the TrackNode at any world Z coordinate along the course.
 */
export function sampleTrackAtZ(nodes: TrackNode[], z: number): TrackNode {
  if (nodes.length === 0) {
    return {
      z: 0,
      xCenter: 0,
      yCenter: 0,
      width: 7.4,
      profile: 'flat',
      hasLeftRail: true,
      hasRightRail: true,
      uPipeDepth: 0,
      isGap: false,
      bankAngle: 0,
    };
  }

  const floatIdx = Math.max(0, -z / SLICE_STEP);
  const idx0 = Math.min(nodes.length - 1, Math.floor(floatIdx));
  const idx1 = Math.min(nodes.length - 1, idx0 + 1);
  const alpha = floatIdx - idx0;

  const n0 = nodes[idx0];
  const n1 = nodes[idx1];

  return {
    z,
    xCenter: THREE.MathUtils.lerp(n0.xCenter, n1.xCenter, alpha),
    yCenter: THREE.MathUtils.lerp(n0.yCenter, n1.yCenter, alpha),
    width: THREE.MathUtils.lerp(n0.width, n1.width, alpha),
    profile: alpha < 0.5 ? n0.profile : n1.profile,
    hasLeftRail: alpha < 0.5 ? n0.hasLeftRail : n1.hasLeftRail,
    hasRightRail: alpha < 0.5 ? n0.hasRightRail : n1.hasRightRail,
    uPipeDepth: THREE.MathUtils.lerp(n0.uPipeDepth, n1.uPipeDepth, alpha),
    isGap: n0.isGap || n1.isGap,
    bankAngle: THREE.MathUtils.lerp(n0.bankAngle, n1.bankAngle, alpha),
  };
}

/**
 * Computes exact surface elevation Y and unit normal (nx, ny) for a given localX offset from track center.
 * Supports flat roads, banked turns, and smooth U-shaped half-pipes (U자 보드).
 */
export function getSurfaceHeightAndNormal(
  node: TrackNode,
  localX: number,
): { y: number; nx: number; ny: number } {
  const halfW = node.width * 0.5;
  const clampedU = THREE.MathUtils.clamp(localX / Math.max(0.1, halfW), -1.15, 1.15);

  // Banking height offset + U-pipe parabolic/circular wall rise
  const bankY = Math.sin(node.bankAngle) * localX;
  const uCurveY = node.uPipeDepth * Math.pow(Math.abs(clampedU), 2.2);

  // Derivative dy/dx for exact normal vector on the U-pipe wall
  const dyDx =
    Math.sin(node.bankAngle) +
    (node.uPipeDepth > 0.01
      ? (2.2 * node.uPipeDepth * Math.sign(clampedU) * Math.pow(Math.abs(clampedU), 1.2)) /
        halfW
      : 0);

  // Normal to y = f(x) is (-dy/dx, 1) normalized
  const len = Math.hypot(dyDx, 1);
  return {
    y: node.yCenter + bankY + uCurveY,
    nx: -dyDx / len,
    ny: 1 / len,
  };
}

export interface BuiltCourseMeshes {
  root: THREE.Group;
  animatedObstacles: Array<{
    data: CourseObstacle;
    group: THREE.Group;
    movingPart?: THREE.Object3D;
    baseY: number;
    xCenter: number;
  }>;
  coinMeshes: Map<number, THREE.Object3D>;
}

/**
 * Builds the complete 3D track geometry (including curved U-shaped half-pipes,
 * yellow/black striped guardrails, finish gate, obstacles, and coins).
 */
export function buildCourseMeshes(
  course: GeneratedCourse,
  theme: WorldThemeSpec,
  maxAnisotropy: number,
): BuiltCourseMeshes {
  const root = new THREE.Group();
  root.name = `Course_${course.courseNumber}`;

  const trackTex = createTrackSurfaceTexture(theme.trackSurface, maxAnisotropy);
  const hazardTex = createHazardStripeTexture(maxAnisotropy);
  const finishTex = createFinishCheckeredTexture(maxAnisotropy);

  const trackMat = new THREE.MeshStandardMaterial({
    map: trackTex,
    side: THREE.DoubleSide,
    roughness: theme.trackSurface === 'asphalt' ? 0.72 : 0.42,
    metalness: theme.trackSurface === 'copper' ? 0.35 : 0.08,
  });

  const trimMat = new THREE.MeshStandardMaterial({
    color: theme.railTrimColor,
    roughness: 0.35,
    metalness: 0.45,
  });

  const railMat = new THREE.MeshStandardMaterial({
    map: hazardTex,
    roughness: 0.4,
    metalness: 0.2,
  });

  // Build continuous ribbon geometry with cross-sectional subdivision for smooth U-pipes
  const crossSegments = 16;
  const nodes = course.nodes;

  const buildContiguousTrackChunk = (startIdx: number, endIdx: number) => {
    const sliceCount = endIdx - startIdx + 1;
    if (sliceCount < 2) return;

    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    // Top deck + underside thickness
    const thickness = 0.55;

    for (let i = 0; i < sliceCount; i++) {
      const node = nodes[startIdx + i];
      const halfW = node.width * 0.5;
      const vCoord = ((startIdx + i) * SLICE_STEP) / 6.0;

      // Top surface vertices (0 .. crossSegments)
      for (let c = 0; c <= crossSegments; c++) {
        const u = c / crossSegments; // 0 .. 1
        const localX = (u - 0.5) * node.width;
        const surf = getSurfaceHeightAndNormal(node, localX);
        positions.push(node.xCenter + localX, surf.y, node.z);
        uvs.push(u, vCoord);
      }

      // Bottom / side skirt vertices (crossSegments + 1 .. 2 * crossSegments + 1)
      for (let c = 0; c <= crossSegments; c++) {
        const u = c / crossSegments;
        const localX = (u - 0.5) * (node.width + 0.35);
        const surf = getSurfaceHeightAndNormal(node, (u - 0.5) * node.width);
        positions.push(node.xCenter + localX, surf.y - thickness, node.z);
        uvs.push(u, vCoord);
      }
    }

    const vertsPerSlice = (crossSegments + 1) * 2;
    for (let i = 0; i < sliceCount - 1; i++) {
      const rowA = i * vertsPerSlice;
      const rowB = (i + 1) * vertsPerSlice;

      // Top road surface triangles
      for (let c = 0; c < crossSegments; c++) {
        const a = rowA + c;
        const b = rowA + c + 1;
        const d = rowB + c;
        const e = rowB + c + 1;
        indices.push(a, d, b);
        indices.push(b, d, e);
      }

      // Left outer side wall
      const lTopA = rowA;
      const lBotA = rowA + (crossSegments + 1);
      const lTopB = rowB;
      const lBotB = rowB + (crossSegments + 1);
      indices.push(lTopA, lBotA, lTopB);
      indices.push(lBotA, lBotB, lTopB);

      // Right outer side wall
      const rTopA = rowA + crossSegments;
      const rBotA = rowA + (crossSegments + 1) + crossSegments;
      const rTopB = rowB + crossSegments;
      const rBotB = rowB + (crossSegments + 1) + crossSegments;
      indices.push(rTopA, rTopB, rBotA);
      indices.push(rBotA, rTopB, rBotB);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();

    const mesh = new THREE.Mesh(geo, trackMat);
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    root.add(mesh);

    // Add colored side trim rails along chunk
    [-1, 1].forEach((side) => {
      const trimPts: THREE.Vector3[] = [];
      for (let i = startIdx; i <= endIdx; i++) {
        const n = nodes[i];
        const lx = side * (n.width * 0.5 + 0.14);
        const surf = getSurfaceHeightAndNormal(n, side * n.width * 0.5);
        trimPts.push(new THREE.Vector3(n.xCenter + lx, surf.y - 0.18, n.z));
      }
      if (trimPts.length >= 2) {
        const curve = new THREE.CatmullRomCurve3(trimPts);
        const tubeGeo = new THREE.TubeGeometry(
          curve,
          trimPts.length * 2,
          0.16,
          6,
          false,
        );
        const tube = new THREE.Mesh(tubeGeo, trimMat);
        root.add(tube);
      }
    });

    // Build Yellow/Black Striped Guardrails where enabled (Screenshot 1, 2, 4, 5, 6)
    (['left', 'right'] as const).forEach((railSide) => {
      const sign = railSide === 'left' ? -1 : 1;
      let segStart = -1;

      for (let i = startIdx; i <= endIdx; i++) {
        const hasRail =
          railSide === 'left' ? nodes[i].hasLeftRail : nodes[i].hasRightRail;
        if (hasRail && segStart === -1) {
          segStart = i;
        } else if ((!hasRail || i === endIdx) && segStart !== -1) {
          const segEnd = hasRail ? i : i - 1;
          if (segEnd - segStart >= 1) {
            const railPts: THREE.Vector3[] = [];
            for (let k = segStart; k <= segEnd; k++) {
              const nk = nodes[k];
              const lx = sign * (nk.width * 0.5 - 0.12);
              const surf = getSurfaceHeightAndNormal(nk, lx);
              railPts.push(new THREE.Vector3(nk.xCenter + lx, surf.y + 0.34, nk.z));
            }
            const railCurve = new THREE.CatmullRomCurve3(railPts);
            const railGeo = new THREE.TubeGeometry(
              railCurve,
              railPts.length * 2,
              0.16,
              8,
              false,
            );
            const railMesh = new THREE.Mesh(railGeo, railMat);
            railMesh.castShadow = true;
            root.add(railMesh);
          }
          segStart = -1;
        }
      }
    });
  };

  // Split track at abyss gaps so floating islands are visibly separated over the void
  let chunkStart = 0;
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i].isGap) {
      if (i - 1 > chunkStart) {
        buildContiguousTrackChunk(chunkStart, i - 1);
      }
      chunkStart = i + 1;
    }
  }
  if (chunkStart < nodes.length - 1) {
    buildContiguousTrackChunk(chunkStart, nodes.length - 1);
  }

  // Build Grand Finish Arch at the final node
  const endNode = nodes[nodes.length - 5] || nodes[nodes.length - 1];
  const finishArch = buildFinishGate(endNode, finishTex, theme);
  root.add(finishArch);

  // Build Obstacles
  const animatedObstacles: BuiltCourseMeshes['animatedObstacles'] = [];
  for (const obs of course.obstacles) {
    const node = sampleTrackAtZ(nodes, obs.z);
    const surf = getSurfaceHeightAndNormal(node, obs.localX);
    const built = buildObstacleGroup(obs, node, surf.y, hazardTex);
    root.add(built.group);
    animatedObstacles.push({
      data: obs,
      group: built.group,
      movingPart: built.movingPart,
      baseY: surf.y,
      xCenter: node.xCenter,
    });
  }

  // Build Collectible Gold Coins
  const coinMeshes = new Map<number, THREE.Object3D>();
  const coinOuterGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.12, 20);
  coinOuterGeo.rotateX(Math.PI / 2);
  const coinRimGeo = new THREE.TorusGeometry(0.42, 0.06, 8, 20);
  const coinStarGeo = new THREE.OctahedronGeometry(0.22, 0);

  const coinGoldMat = new THREE.MeshPhysicalMaterial({
    color: '#facc15',
    emissive: '#ca8a04',
    emissiveIntensity: 0.35,
    metalness: 0.92,
    roughness: 0.15,
    clearcoat: 0.8,
  });
  const coinCoreMat = new THREE.MeshStandardMaterial({
    color: '#fef08a',
    emissive: '#eab308',
    emissiveIntensity: 0.5,
    metalness: 0.8,
    roughness: 0.2,
  });

  for (const coin of course.coins) {
    const node = sampleTrackAtZ(nodes, coin.z);
    const surf = getSurfaceHeightAndNormal(node, coin.localX);

    const coinGroup = new THREE.Group();
    const disc = new THREE.Mesh(coinOuterGeo, coinGoldMat);
    const rim = new THREE.Mesh(coinRimGeo, coinGoldMat);
    const star = new THREE.Mesh(coinStarGeo, coinCoreMat);
    coinGroup.add(disc, rim, star);

    coinGroup.position.set(
      node.xCenter + coin.localX,
      surf.y + coin.heightOffset,
      coin.z,
    );
    root.add(coinGroup);
    coinMeshes.set(coin.id, coinGroup);
  }

  return {
    root,
    animatedObstacles,
    coinMeshes,
  };
}

/**
 * Builds the 5-part composite Player Ball Group with customizable skin, glow core, and trim ring.
 */
export function buildPlayerBallGroup(
  skin: BallSkinSpec,
  customAccentHex: string,
  glowBoost: number,
  maxAnisotropy: number,
  isSoftwareGl: boolean,
): {
  ballRoot: THREE.Group;
  spinGroup: THREE.Group;
  shadowMesh: THREE.Mesh;
  pointLight: THREE.PointLight;
} {
  const ballRoot = new THREE.Group();
  const spinGroup = new THREE.Group();
  ballRoot.add(spinGroup);

  const radius = 0.55;
  const tex = createBallSkinTexture(skin.id, customAccentHex, maxAnisotropy);

  // 1. Primary Sphere Shell
  const sphereGeo = new THREE.SphereGeometry(radius, 36, 36);
  const sphereMat = new THREE.MeshPhysicalMaterial({
    map: tex,
    color: '#ffffff',
    emissive: new THREE.Color(customAccentHex || skin.emissiveColor),
    emissiveIntensity: skin.emissiveIntensity * glowBoost,
    metalness: skin.metalness,
    roughness: skin.roughness,
    clearcoat: isSoftwareGl ? 0 : skin.clearcoat,
    clearcoatRoughness: 0.12,
  });
  const mainSphere = new THREE.Mesh(sphereGeo, sphereMat);
  mainSphere.castShadow = true;
  spinGroup.add(mainSphere);

  // 2. Equatorial Raised Metallic/Neon Trim Ring
  const ringGeo = new THREE.TorusGeometry(radius * 1.008, 0.028, 12, 36);
  const ringMat = new THREE.MeshStandardMaterial({
    color: customAccentHex || skin.accentColor,
    emissive: customAccentHex || skin.emissiveColor,
    emissiveIntensity: Math.max(0.4, skin.emissiveIntensity * glowBoost),
    metalness: 0.85,
    roughness: 0.2,
  });
  const eqRing = new THREE.Mesh(ringGeo, ringMat);
  spinGroup.add(eqRing);

  // 3. Polar Hub Caps (Left & Right rotational visual anchors so rolling spin is unmistakably visible)
  const capGeo = new THREE.CylinderGeometry(0.18, 0.22, radius * 2.03, 16);
  capGeo.rotateZ(Math.PI / 2);
  const capMat = new THREE.MeshStandardMaterial({
    color: skin.id === 'royal-gold' ? '#fef08a' : '#e2e8f0',
    metalness: 0.9,
    roughness: 0.25,
  });
  const polarCaps = new THREE.Mesh(capGeo, capMat);
  spinGroup.add(polarCaps);

  // 4. Soft Contact Shadow Plane underneath the ball (stays grounded on track surface)
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = 128;
  shadowCanvas.height = 128;
  const sctx = shadowCanvas.getContext('2d')!;
  const grad = sctx.createRadialGradient(64, 64, 8, 64, 64, 60);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.68)');
  grad.addColorStop(0.6, 'rgba(0, 0, 0, 0.28)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  sctx.fillStyle = grad;
  sctx.fillRect(0, 0, 128, 128);

  const shadowTex = new THREE.CanvasTexture(shadowCanvas);
  const shadowGeo = new THREE.PlaneGeometry(1.55, 1.55);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: shadowTex,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
  ballRoot.add(shadowMesh);

  // 5. Dynamic Aura PointLight for Glow Balls & Golden Balls
  const pointLight = new THREE.PointLight(
    customAccentHex || skin.accentColor,
    skin.category === 'Glow' ? 2.4 * glowBoost : 0.8 * glowBoost,
    7.5,
  );
  pointLight.position.set(0, 0.3, 0);
  ballRoot.add(pointLight);

  return { ballRoot, spinGroup, shadowMesh, pointLight };
}

function buildFinishGate(
  node: TrackNode,
  finishTex: THREE.CanvasTexture,
  theme: WorldThemeSpec,
): THREE.Group {
  const group = new THREE.Group();
  group.position.set(node.xCenter, node.yCenter, node.z);

  const halfW = node.width * 0.5;
  const pillarMat = new THREE.MeshStandardMaterial({
    color: theme.railTrimColor,
    metalness: 0.65,
    roughness: 0.25,
  });
  const bannerMat = new THREE.MeshStandardMaterial({
    map: finishTex,
    roughness: 0.3,
    metalness: 0.1,
  });
  const goldMat = new THREE.MeshStandardMaterial({
    color: '#facc15',
    emissive: '#ca8a04',
    emissiveIntensity: 0.4,
    metalness: 0.9,
    roughness: 0.15,
  });

  // Left & Right Arch Towers
  [-1, 1].forEach((side) => {
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.45, 0.55, 0.6, 16),
      goldMat,
    );
    base.position.set(side * (halfW - 0.2), 0.3, 0);

    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.32, 5.2, 16),
      pillarMat,
    );
    pillar.position.set(side * (halfW - 0.2), 2.9, 0);

    const crown = new THREE.Mesh(new THREE.OctahedronGeometry(0.55, 0), goldMat);
    crown.position.set(side * (halfW - 0.2), 5.8, 0);

    group.add(base, pillar, crown);
  });

  // Checkered Overhead Banner
  const banner = new THREE.Mesh(
    new THREE.BoxGeometry(node.width + 0.4, 1.15, 0.35),
    bannerMat,
  );
  banner.position.set(0, 4.9, 0);
  group.add(banner);

  // Floor Checkered Strip (offset +0.03 on Y to avoid Z-fighting)
  const floorStrip = new THREE.Mesh(
    new THREE.BoxGeometry(node.width - 0.4, 0.05, 1.8),
    bannerMat,
  );
  floorStrip.position.set(0, 0.03, 0);
  group.add(floorStrip);

  return group;
}

function buildObstacleGroup(
  obs: CourseObstacle,
  node: TrackNode,
  surfaceY: number,
  hazardTex: THREE.CanvasTexture,
): { group: THREE.Group; movingPart?: THREE.Object3D } {
  const group = new THREE.Group();

  if (obs.type === 'hammer') {
    // Screenshot 2: Overhead gantry truss + swinging purple/orange pendulum hammer
    group.position.set(node.xCenter, node.yCenter, obs.z);
    const halfW = node.width * 0.5 + 0.6;

    const steelMat = new THREE.MeshStandardMaterial({
      color: '#94a3b8',
      metalness: 0.75,
      roughness: 0.3,
    });
    const blueClampMat = new THREE.MeshStandardMaterial({
      color: '#2563eb',
      metalness: 0.4,
      roughness: 0.35,
    });
    const hammerBodyMat = new THREE.MeshStandardMaterial({
      color: '#7e22ce',
      metalness: 0.3,
      roughness: 0.35,
    });
    const hammerCapMat = new THREE.MeshStandardMaterial({
      color: '#f97316',
      emissive: '#ea580c',
      emissiveIntensity: 0.25,
      metalness: 0.4,
      roughness: 0.3,
    });

    // Left & Right Steel Truss Towers
    [-1, 1].forEach((side) => {
      const tower = new THREE.Mesh(
        new THREE.BoxGeometry(0.45, 6.2, 0.45),
        steelMat,
      );
      tower.position.set(side * halfW, 3.1, 0);
      group.add(tower);
    });

    // Overhead Horizontal Bar
    const crossbar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.16, halfW * 2.1, 12),
      steelMat,
    );
    crossbar.rotation.z = Math.PI / 2;
    crossbar.position.set(0, 5.8, 0);
    group.add(crossbar);

    // Swinging Pendulum Pivot at (0, 5.8, 0)
    const pivot = new THREE.Group();
    pivot.position.set(0, 5.8, 0);

    const clamp = new THREE.Mesh(
      new THREE.BoxGeometry(0.65, 0.55, 0.55),
      blueClampMat,
    );
    const arm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.12, 4.1, 12),
      blueClampMat,
    );
    arm.position.set(0, -2.05, 0);

    const headGroup = new THREE.Group();
    headGroup.position.set(0, -4.25, 0);

    const drum = new THREE.Mesh(
      new THREE.CylinderGeometry(0.62, 0.62, 1.65, 20),
      hammerBodyMat,
    );
    drum.rotation.x = Math.PI / 2;

    const capFront = new THREE.Mesh(
      new THREE.CylinderGeometry(0.66, 0.66, 0.22, 20),
      hammerCapMat,
    );
    capFront.rotation.x = Math.PI / 2;
    capFront.position.z = 0.78;

    const capBack = capFront.clone();
    capBack.position.z = -0.78;

    headGroup.add(drum, capFront, capBack);
    pivot.add(clamp, arm, headGroup);
    group.add(pivot);

    return { group, movingPart: pivot };
  }

  if (obs.type === 'saw') {
    // Screenshot 2: Giant Rotating Toothed Gear Saw
    group.position.set(node.xCenter + obs.localX, surfaceY, obs.z);

    const bladeGroup = new THREE.Group();
    bladeGroup.position.set(0, 1.35, 0);

    const metalMat = new THREE.MeshStandardMaterial({
      color: '#cbd5e1',
      metalness: 0.85,
      roughness: 0.22,
    });
    const rimMat = new THREE.MeshStandardMaterial({
      color: '#ef4444',
      emissive: '#dc2626',
      emissiveIntensity: 0.35,
      metalness: 0.6,
      roughness: 0.3,
    });

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.15, 0.22, 12, 28),
      metalMat,
    );
    const innerRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.82, 0.1, 8, 24),
      rimMat,
    );
    bladeGroup.add(ring, innerRing);

    const toothGeo = new THREE.ConeGeometry(0.22, 0.48, 4);
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const tooth = new THREE.Mesh(toothGeo, metalMat);
      tooth.position.set(Math.cos(angle) * 1.42, Math.sin(angle) * 1.42, 0);
      tooth.rotation.z = angle - Math.PI / 2;
      bladeGroup.add(tooth);
    }

    group.add(bladeGroup);
    return { group, movingPart: bladeGroup };
  }

  if (obs.type === 'candle') {
    // Screenshot 4: Giant Melted Wax Candle with Glowing Flame
    group.position.set(node.xCenter + obs.localX, surfaceY, obs.z);

    const waxMat = new THREE.MeshStandardMaterial({
      color: '#f5f5dc',
      roughness: 0.55,
      metalness: 0.05,
    });
    const wickMat = new THREE.MeshStandardMaterial({
      color: '#1e293b',
      roughness: 0.9,
    });
    const flameMat = new THREE.MeshBasicMaterial({
      color: '#fbbf24',
    });

    const bodyH = obs.height;
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.55, 0.62, bodyH, 20),
      waxMat,
    );
    body.position.y = bodyH * 0.5;
    body.castShadow = true;

    // Wax drips around the rim
    for (let d = 0; d < 5; d++) {
      const ang = (d / 5) * Math.PI * 2;
      const dripH = 0.6 + (d % 3) * 0.35;
      const drip = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.09, dripH, 6, 8),
        waxMat,
      );
      drip.position.set(
        Math.cos(ang) * 0.54,
        bodyH - dripH * 0.5,
        Math.sin(ang) * 0.54,
      );
      group.add(drip);
    }

    const wick = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 0.35, 8),
      wickMat,
    );
    wick.position.y = bodyH + 0.15;

    const flame = new THREE.Mesh(
      new THREE.ConeGeometry(0.22, 0.72, 12),
      flameMat,
    );
    flame.position.y = bodyH + 0.58;

    group.add(body, wick, flame);
    return { group, movingPart: flame };
  }

  if (obs.type === 'hurdle') {
    // Screenshot 3: Yellow/Black Striped Barricade Hurdle (Jumpable!)
    group.position.set(node.xCenter + obs.localX, surfaceY, obs.z);

    const barMat = new THREE.MeshStandardMaterial({
      map: hazardTex,
      roughness: 0.35,
      metalness: 0.25,
    });
    const footMat = new THREE.MeshStandardMaterial({
      color: '#1e293b',
      metalness: 0.7,
      roughness: 0.3,
    });

    const halfW = obs.width * 0.45;
    [-1, 1].forEach((side) => {
      const foot = new THREE.Mesh(
        new THREE.BoxGeometry(0.35, 0.15, 0.55),
        footMat,
      );
      foot.position.set(side * halfW, 0.075, 0);

      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.12, obs.height, 12),
        barMat,
      );
      post.position.set(side * halfW, obs.height * 0.5, 0);
      group.add(foot, post);
    });

    const topBar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.14, obs.width, 14),
      barMat,
    );
    topBar.rotation.z = Math.PI / 2;
    topBar.position.set(0, obs.height, 0);
    topBar.castShadow = true;
    group.add(topBar);

    return { group };
  }

  if (obs.type === 'jumppad' || obs.type === 'booster') {
    // Glowing Track Jump Pad or Speed Booster Pad
    group.position.set(node.xCenter + obs.localX, surfaceY + 0.04, obs.z);

    const isJump = obs.type === 'jumppad';
    const frameMat = new THREE.MeshStandardMaterial({
      color: '#0f172a',
      metalness: 0.7,
      roughness: 0.3,
    });
    const glowMat = new THREE.MeshStandardMaterial({
      color: isJump ? '#fde047' : '#22c55e',
      emissive: isJump ? '#eab308' : '#16a34a',
      emissiveIntensity: 0.95,
      roughness: 0.2,
    });

    const base = new THREE.Mesh(
      new THREE.BoxGeometry(obs.width, 0.12, 2.4),
      frameMat,
    );
    const core = new THREE.Mesh(
      new THREE.BoxGeometry(obs.width - 0.3, 0.16, 2.1),
      glowMat,
    );
    core.position.y = 0.03;

    group.add(base, core);
    return { group, movingPart: core };
  }

  // 'knockball' — Pushable Bonus Spheres resting on track (Screenshot 5)
  group.position.set(node.xCenter + obs.localX, surfaceY + 0.48, obs.z);
  const knockMat = new THREE.MeshPhysicalMaterial({
    color: obs.phase > 2 ? '#a855f7' : obs.phase > 1 ? '#22c55e' : '#f97316',
    metalness: 0.45,
    roughness: 0.2,
    clearcoat: 0.8,
  });
  const ballMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.48, 24, 24),
    knockMat,
  );
  ballMesh.castShadow = true;

  const stripeRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.485, 0.03, 8, 24),
    new THREE.MeshStandardMaterial({ color: '#fde047', metalness: 0.8, roughness: 0.2 }),
  );
  group.add(ballMesh, stripeRing);

  return { group };
}
