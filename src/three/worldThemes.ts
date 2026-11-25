import * as THREE from 'three';
import { BallSkinSpec, WorldThemeId, WorldThemeSpec } from '../types/game';

export const BALL_SKINS: BallSkinSpec[] = [
  {
    id: 'cyber-chevron',
    name: 'Cyber Chevron',
    category: 'Standard',
    price: 0,
    description: 'Signature carbon hex shell with neon speed arrows and brushed alloy rims.',
    baseColor: '#1e2229',
    accentColor: '#4ade80',
    emissiveColor: '#22c55e',
    emissiveIntensity: 0.45,
    metalness: 0.55,
    roughness: 0.28,
    clearcoat: 0.6,
  },
  {
    id: 'pro-baseball',
    name: 'Grand Slam Leather',
    category: 'Special',
    price: 60,
    description: 'Authentic stitched white leather baseball built for knocking track targets.',
    baseColor: '#f8fafc',
    accentColor: '#ef4444',
    emissiveColor: '#000000',
    emissiveIntensity: 0.0,
    metalness: 0.1,
    roughness: 0.45,
    clearcoat: 0.3,
  },
  {
    id: 'star-striker',
    name: 'Star Striker',
    category: 'Special',
    price: 120,
    description: 'Classic arcade red, white, and royal blue star-spangled stunt sphere.',
    baseColor: '#ffffff',
    accentColor: '#3b82f6',
    emissiveColor: '#1d4ed8',
    emissiveIntensity: 0.15,
    metalness: 0.3,
    roughness: 0.25,
    clearcoat: 0.8,
  },
  {
    id: 'neon-plasma',
    name: 'Cyan Plasma Glow',
    category: 'Glow',
    price: 200,
    description: 'High-voltage bioluminescent glow ball that radiates an electric cyan aura.',
    baseColor: '#090d16',
    accentColor: '#00f5d4',
    emissiveColor: '#00f5d4',
    emissiveIntensity: 1.35,
    metalness: 0.4,
    roughness: 0.18,
    clearcoat: 0.9,
  },
  {
    id: 'solar-nova',
    name: 'Hyper Lime Glow',
    category: 'Glow',
    price: 260,
    description: 'Radioactive neon lime glow core with intense night-canyon illumination.',
    baseColor: '#09140a',
    accentColor: '#a3e635',
    emissiveColor: '#84cc16',
    emissiveIntensity: 1.4,
    metalness: 0.35,
    roughness: 0.2,
    clearcoat: 0.85,
  },
  {
    id: 'ruby-core',
    name: 'Crimson Overdrive',
    category: 'Glow',
    price: 340,
    description: 'Anodized ruby metallic shell with blazing magma glow veins.',
    baseColor: '#450a0a',
    accentColor: '#f97316',
    emissiveColor: '#ef4444',
    emissiveIntensity: 1.15,
    metalness: 0.8,
    roughness: 0.16,
    clearcoat: 0.95,
  },
  {
    id: 'galaxy-orb',
    name: 'Nebula Chrome',
    category: 'Gold',
    price: 450,
    description: 'Deep cosmic sapphire chrome sphere with platinum orbital rings.',
    baseColor: '#0f172a',
    accentColor: '#38bdf8',
    emissiveColor: '#0284c7',
    emissiveIntensity: 0.65,
    metalness: 0.92,
    roughness: 0.14,
    clearcoat: 1.0,
  },
  {
    id: 'royal-gold',
    name: '24K Royal Gold',
    category: 'Gold',
    price: 600,
    description: 'Mirror-polished 24-karat solid gold sphere with diamond-cut equatorial crown.',
    baseColor: '#facc15',
    accentColor: '#fef08a',
    emissiveColor: '#ca8a04',
    emissiveIntensity: 0.25,
    metalness: 0.96,
    roughness: 0.12,
    clearcoat: 1.0,
  },
];

export const WORLD_THEMES: Record<WorldThemeId, WorldThemeSpec> = {
  skyline: {
    id: 'skyline',
    name: 'Skyline Metropolis',
    subtitle: 'High-altitude timber track suspended above gleaming city skyscrapers',
    skyTopColor: '#38bdf8',
    skyBottomColor: '#bae6fd',
    fogColor: '#bae6fd',
    fogDensity: 0.0045,
    sunColor: '#fffbeb',
    hemiSkyColor: '#7dd3fc',
    hemiGroundColor: '#64748b',
    trackSurface: 'wood',
    railTrimColor: '#0ea5e9',
  },
  harbor: {
    id: 'harbor',
    name: 'Emerald Harbor Bay',
    subtitle: 'Floating island bridges & half-pipes high over deep coastal waters',
    skyTopColor: '#0284c7',
    skyBottomColor: '#7dd3fc',
    fogColor: '#7dd3fc',
    fogDensity: 0.0042,
    sunColor: '#fef9c3',
    hemiSkyColor: '#38bdf8',
    hemiGroundColor: '#0f766e',
    trackSurface: 'wood',
    railTrimColor: '#22c55e',
  },
  canyon: {
    id: 'canyon',
    name: 'Twilight Glow Canyon',
    subtitle: 'Mystical night valley with glowing rivers and candlelit walnut tracks',
    skyTopColor: '#091526',
    skyBottomColor: '#164e63',
    fogColor: '#133b4f',
    fogDensity: 0.0052,
    sunColor: '#bae6fd',
    hemiSkyColor: '#22d3ee',
    hemiGroundColor: '#0f172a',
    trackSurface: 'walnut',
    railTrimColor: '#f59e0b',
  },
  overpass: {
    id: 'overpass',
    name: 'Urban Asphalt Overpass',
    subtitle: 'Expressway sky-bridge through dense downtown towers',
    skyTopColor: '#64748b',
    skyBottomColor: '#cbd5e1',
    fogColor: '#cbd5e1',
    fogDensity: 0.0048,
    sunColor: '#fff7ed',
    hemiSkyColor: '#94a3b8',
    hemiGroundColor: '#334155',
    trackSurface: 'asphalt',
    railTrimColor: '#eab308',
  },
  sunset: {
    id: 'sunset',
    name: 'Solar Sunset Dunes',
    subtitle: 'Golden-hour canyon ridges with copper-trimmed speed chutes',
    skyTopColor: '#7c2d12',
    skyBottomColor: '#fdba74',
    fogColor: '#fdba74',
    fogDensity: 0.0046,
    sunColor: '#ffedd5',
    hemiSkyColor: '#fb923c',
    hemiGroundColor: '#431407',
    trackSurface: 'copper',
    railTrimColor: '#f97316',
  },
};

export const THEME_ORDER: WorldThemeId[] = [
  'skyline',
  'harbor',
  'canyon',
  'overpass',
  'sunset',
];

export function buildWorldBackdrop(
  theme: WorldThemeSpec,
  courseLength: number,
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'WorldBackdrop';

  // Abyss floor far below (-85m) so looking down gives dramatic height vertigo
  const abyssGeo = new THREE.PlaneGeometry(900, courseLength + 800);
  const abyssColor =
    theme.id === 'harbor'
      ? '#0d5c75'
      : theme.id === 'canyon'
        ? '#082032'
        : theme.id === 'sunset'
          ? '#451a03'
          : '#94a3b8';

  const abyssMat = new THREE.MeshStandardMaterial({
    color: abyssColor,
    roughness: theme.id === 'harbor' ? 0.2 : 0.85,
    metalness: theme.id === 'harbor' ? 0.35 : 0.05,
  });
  const abyssPlane = new THREE.Mesh(abyssGeo, abyssMat);
  abyssPlane.rotation.x = -Math.PI / 2;
  abyssPlane.position.set(0, -85, -courseLength / 2);
  group.add(abyssPlane);

  // If Twilight Canyon or Harbor, add a glowing river/shipping lane ribbon below
  if (theme.id === 'canyon' || theme.id === 'harbor') {
    const riverGeo = new THREE.PlaneGeometry(36, courseLength + 600);
    const riverMat = new THREE.MeshBasicMaterial({
      color: theme.id === 'canyon' ? '#00f5d4' : '#38bdf8',
      transparent: true,
      opacity: theme.id === 'canyon' ? 0.45 : 0.3,
    });
    const river = new THREE.Mesh(riverGeo, riverMat);
    river.rotation.x = -Math.PI / 2;
    river.position.set(15, -84.5, -courseLength / 2);
    group.add(river);
  }

  // Instanced distant architectural towers / canyon monoliths flanking the abyss
  const count = 90;
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const towerMat = new THREE.MeshStandardMaterial({
    color:
      theme.id === 'skyline'
        ? '#e2e8f0'
        : theme.id === 'overpass'
          ? '#94a3b8'
          : theme.id === 'canyon'
            ? '#1e293b'
            : theme.id === 'sunset'
              ? '#9a3412'
              : '#cbd5e1',
    roughness: 0.65,
    metalness: 0.2,
  });

  const towers = new THREE.InstancedMesh(boxGeo, towerMat, count);
  const dummy = new THREE.Object3D();
  const tint = new THREE.Color();

  for (let i = 0; i < count; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const xDist = 38 + ((i * 29) % 110);
    const zPos = 40 - (i / count) * (courseLength + 240);
    const w = 12 + ((i * 13) % 18);
    const d = 12 + ((i * 17) % 18);
    const h = 40 + ((i * 37) % 75);

    dummy.position.set(side * xDist, -85 + h / 2, zPos);
    dummy.scale.set(w, h, d);
    dummy.rotation.y = ((i * 7) % 4) * (Math.PI / 2);
    dummy.updateMatrix();
    towers.setMatrixAt(i, dummy.matrix);

    const shade = 0.85 + ((i * 19) % 30) / 100;
    tint.setScalar(shade);
    towers.setColorAt(i, tint);
  }
  towers.instanceMatrix.needsUpdate = true;
  if (towers.instanceColor) towers.instanceColor.needsUpdate = true;
  towers.computeBoundingSphere();
  group.add(towers);

  return group;
}
