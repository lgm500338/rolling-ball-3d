export type BallSkinId =
  | 'cyber-chevron'
  | 'royal-gold'
  | 'neon-plasma'
  | 'solar-nova'
  | 'star-striker'
  | 'pro-baseball'
  | 'ruby-core'
  | 'galaxy-orb';

export interface BallSkinSpec {
  id: BallSkinId;
  name: string;
  category: 'Standard' | 'Glow' | 'Gold' | 'Special';
  price: number;
  description: string;
  baseColor: string;
  accentColor: string;
  emissiveColor: string;
  emissiveIntensity: number;
  metalness: number;
  roughness: number;
  clearcoat: number;
}

export type TrackFinish = 'lacquer' | 'wood' | 'piano';

export type WorldThemeId = 'skyline' | 'harbor' | 'canyon' | 'overpass' | 'sunset';

export interface WorldThemeSpec {
  id: WorldThemeId;
  name: string;
  nameKo?: string;
  subtitle: string;
  hemiIntensity?: number;
  sunIntensity?: number;
  skyTopColor: string;
  skyBottomColor: string;
  fogColor: string;
  fogDensity: number;
  sunColor: string;
  hemiSkyColor: string;
  hemiGroundColor: string;
  trackSurface: 'wood' | 'walnut' | 'asphalt' | 'copper';
  railTrimColor: string;
}

export type SegmentProfile = 'flat' | 'upipe' | 'narrow' | 'ramp' | 'island';

export interface TrackNode {
  z: number;
  xCenter: number;
  yCenter: number;
  width: number;
  profile: SegmentProfile;
  hasLeftRail: boolean;
  hasRightRail: boolean;
  uPipeDepth: number; // > 0 when profile is 'upipe'
  isGap: boolean;     // true when there is an abyss gap under this slice
  bankAngle: number;  // banking tilt in radians
}

export type ObstacleType =
  | 'hammer'
  | 'saw'
  | 'candle'
  | 'hurdle'
  | 'jumppad'
  | 'booster'
  | 'knockball';

export interface CourseObstacle {
  id: string;
  type: ObstacleType;
  z: number;
  localX: number; // offset from track center
  width: number;
  height: number;
  speed: number;
  phase: number;
  hit?: boolean;
  vx?: number;
  vy?: number;
  vz?: number;
}

export interface CourseCoin {
  id: number;
  z: number;
  localX: number;
  heightOffset: number;
  collected: boolean;
}

export interface GeneratedCourse {
  courseNumber: number;
  themeId: WorldThemeId;
  totalLength: number;
  difficulty: number;
  speedMultiplier: number;
  parTimeSec: number;
  coinTarget: number;
  nodes: TrackNode[];
  obstacles: CourseObstacle[];
  coins: CourseCoin[];
  courseTitle: string;
}

export interface CourseClearResult {
  stars: number;
  elapsedSec: number;
  parTimeSec: number;
  coinsCollected: number;
  totalCoins: number;
  coinTarget: number;
  bonusCoins: number;
  beatParTime: boolean;
  hitCoinTarget: boolean;
}

export type GameStatus = 'ready' | 'playing' | 'complete' | 'fell';
