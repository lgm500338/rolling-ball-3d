import {
  CourseCoin,
  CourseObstacle,
  GeneratedCourse,
  SegmentProfile,
  TrackNode,
} from '../types/game';
import { THEME_ORDER } from './worldThemes';

class SeededRandom {
  private seed: number;
  constructor(seed: number) {
    this.seed = (seed * 9301 + 49297) % 233280;
  }
  next(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }
  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }
}

const COURSE_TITLES = [
  'Timber Skyway',
  'Half-Pipe Rush',
  'Pendulum Alley',
  'Harbor Island Leap',
  'Candlelight Ridge',
  'Vertigo S-Curve',
  'Sawblade Overpass',
  'Spiral U-Chute',
  'Abyssal Narrow',
  'Grand Velocity Run',
];

export const SLICE_STEP = 2.5; // 2.5 meters per longitudinal track node

export function generateCourse(courseNumber: number): GeneratedCourse {
  const safeCourse = Math.max(1, Math.min(9999, Math.floor(courseNumber)));
  const rng = new SeededRandom(safeCourse * 1337 + 7);

  // Cycle theme every 2 courses so players experience diverse worlds quickly
  const themeId =
    THEME_ORDER[Math.floor((safeCourse - 1) / 2) % THEME_ORDER.length];

  // Progressive difficulty curve (scales noticeably from Course 1 -> 20 -> 50 -> 100+)
  const diff = Math.min(1, 1 - Math.exp(-(safeCourse - 1) / 28));
  // Speed multiplier rises smoothly from 1.0x (Course 1) up to 1.6x (high courses)
  const speedMultiplier = 1 + Math.min(0.6, (safeCourse - 1) * 0.018);

  // Total slices grows with course number (Course 1 = ~92 slices = 230m, higher courses up to 580m+)
  const totalSlices = Math.floor(92 + Math.min(145, (safeCourse - 1) * 4.5));
  const totalLength = totalSlices * SLICE_STEP;

  const nodes: TrackNode[] = [];
  const obstacles: CourseObstacle[] = [];
  const coins: CourseCoin[] = [];

  let curX = 0;
  let curY = 0;
  let dx = 0;
  let dy = 0;

  // Build modular sections along the course
  let sliceIdx = 0;
  let coinId = 1;

  // Dynamic segment weights: narrow cliff ratio grows from 12% on Course 1 up to 42% on hard courses
  const narrowWeight = 0.12 + diff * 0.3;
  const upipeWeight = 0.25 - diff * 0.05;
  const rampWeight = 0.2;
  const islandWeight = safeCourse >= 2 ? 0.12 + diff * 0.08 : 0;

  // Section planner
  while (sliceIdx <= totalSlices) {
    const isStartSafe = sliceIdx < 12;
    const isEndSafe = sliceIdx > totalSlices - 14;

    let profile: SegmentProfile = 'flat';
    let segLen = rng.int(12, 20);
    let curveTargetDx = 0;
    let slopeTargetDy = 0;

    if (isStartSafe || isEndSafe) {
      profile = 'flat';
      segLen = isStartSafe ? 12 : totalSlices - sliceIdx + 1;
      curveTargetDx = 0;
      slopeTargetDy = 0;
    } else {
      const roll = rng.next();
      const tNarrow = narrowWeight;
      const tUpipe = tNarrow + upipeWeight;
      const tRamp = tUpipe + rampWeight;
      const tIsland = tRamp + islandWeight;

      if (roll < tNarrow) {
        // Narrow Cliff Bridge without guardrails (grows more frequent & tighter with course number)
        profile = 'narrow';
        segLen = rng.int(12, 18 + Math.round(diff * 6));
        curveTargetDx = rng.range(-0.26, 0.26) * (0.35 + diff * 0.85);
        slopeTargetDy = rng.range(-0.12, 0.1);
      } else if (roll < tUpipe) {
        // U-Shaped Half-Pipe section (U자 보드 구간)
        profile = 'upipe';
        segLen = rng.int(16, 24);
        curveTargetDx = rng.range(-0.34, 0.34) * (0.7 + diff * 0.45);
        slopeTargetDy = rng.range(-0.24, -0.06);
      } else if (roll < tRamp) {
        // Steep Ramp / Rollercoaster Drop + Abyss Jump
        profile = 'ramp';
        segLen = rng.int(14, 18);
        curveTargetDx = rng.range(-0.1, 0.1) * diff;
        slopeTargetDy = rng.next() < 0.58 ? -0.38 : 0.22;
      } else if (roll < tIsland) {
        // Floating Island Hopping over the abyss
        profile = 'island';
        segLen = rng.int(14, 20);
        curveTargetDx = rng.range(-0.24, 0.24) * (0.6 + diff * 0.6);
        slopeTargetDy = 0;
      } else {
        // Winding S-Curve Road
        profile = 'flat';
        segLen = rng.int(14, 22);
        curveTargetDx = rng.range(-0.44, 0.44) * (0.65 + diff * 0.55);
        slopeTargetDy = rng.range(-0.16, 0.12);
      }
    }

    const actualLen = Math.min(segLen, totalSlices - sliceIdx + 1);
    const segStartIdx = sliceIdx;

    for (let s = 0; s < actualLen; s++) {
      const z = -sliceIdx * SLICE_STEP;
      const t = s / Math.max(1, actualLen - 1);

      // Smoothly interpolate lateral curve & vertical slope
      dx += (curveTargetDx - dx) * 0.14;
      dy += (slopeTargetDy - dy) * 0.14;

      if (isStartSafe || isEndSafe) {
        dx *= 0.7;
        dy *= 0.7;
      }

      curX += dx * SLICE_STEP;
      curY += dy * SLICE_STEP;

      let width = 7.4 - diff * 0.7;
      let uPipeDepth = 0;
      let hasLeftRail = true;
      let hasRightRail = true;
      let isGap = false;

      if (profile === 'upipe') {
        width = 8.4 - diff * 0.5;
        const edgeFade = Math.sin(t * Math.PI);
        uPipeDepth = 2.35 * Math.min(1, edgeFade * 2.2);
        hasLeftRail = false;
        hasRightRail = false;
      } else if (profile === 'narrow') {
        // Tightens progressively from 5.3m (Course 1) down to 3.2m (high courses)
        width = Math.max(3.2, 5.3 - diff * 2.1);
        hasLeftRail = false;
        hasRightRail = false;
      } else if (profile === 'ramp') {
        width = 6.8 - diff * 0.6;
        hasLeftRail = s < actualLen - 4 && diff < 0.7;
        hasRightRail = s < actualLen - 4 && diff < 0.7;
        if (s >= actualLen - 2 && !isEndSafe && sliceIdx < totalSlices - 16) {
          isGap = true;
        }
      } else if (profile === 'island') {
        width = Math.max(4.8, 6.4 - diff * 1.4);
        hasLeftRail = false;
        hasRightRail = false;
        if (
          s === Math.floor(actualLen / 2) ||
          s === Math.floor(actualLen / 2) + 1
        ) {
          isGap = true;
        }
      } else {
        // Open rail drop chance rises steeply with course number
        const railDropChance = 0.1 + diff * 0.55;
        if (!isStartSafe && !isEndSafe && rng.next() < railDropChance) {
          if (diff > 0.45 && rng.next() < 0.45) {
            hasLeftRail = false;
            hasRightRail = false;
          } else {
            hasLeftRail = rng.next() > 0.5;
            hasRightRail = !hasLeftRail;
          }
        }
      }

      const bankAngle = THREE.MathClamp(-dx * 0.45, -0.28, 0.28);

      nodes.push({
        z,
        xCenter: curX,
        yCenter: curY,
        width,
        profile,
        hasLeftRail: isGap ? false : hasLeftRail,
        hasRightRail: isGap ? false : hasRightRail,
        uPipeDepth: isGap ? 0 : uPipeDepth,
        isGap,
        bankAngle,
      });

      // Place Jump Pad right before any gap so player can use Jump Pad OR direct jump
      if (isGap && nodes.length >= 3) {
        const preNode = nodes[nodes.length - 3];
        const alreadyHasPad = obstacles.some(
          (o) => Math.abs(o.z - preNode.z) < 4 && o.type === 'jumppad',
        );
        if (!alreadyHasPad) {
          obstacles.push({
            id: `pad-${sliceIdx}`,
            type: 'jumppad',
            z: preNode.z,
            localX: 0,
            width: 2.6,
            height: 0.25,
            speed: 0,
            phase: 0,
          });
        }
      }

      sliceIdx++;
      if (sliceIdx > totalSlices) break;
    }

    // Populate coins and obstacles with progressive density
    if (!isStartSafe && !isEndSafe && sliceIdx < totalSlices - 12) {
      const midSlice = Math.max(10, segStartIdx + Math.floor(actualLen / 2));
      const midNode = nodes[midSlice];

      if (midNode && !midNode.isGap) {
        // Coins trail
        const coinLineCount = rng.int(4, 7);
        const coinSide =
          midNode.profile === 'upipe'
            ? rng.next() < 0.5
              ? -2.2
              : 2.2
            : rng.range(-midNode.width * 0.26, midNode.width * 0.26);

        for (let c = 0; c < coinLineCount; c++) {
          const cSlice = midSlice - Math.floor(coinLineCount / 2) + c;
          const cNode = nodes[cSlice];
          if (cNode && !cNode.isGap) {
            coins.push({
              id: coinId++,
              z: cNode.z,
              localX:
                cNode.profile === 'upipe'
                  ? Math.sin(c * 0.65) * (cNode.width * 0.34)
                  : coinSide,
              heightOffset: 0.65,
              collected: false,
            });
          }
        }
      }

      // Obstacle slots per segment scale with course difficulty:
      // Course 1-2: 1 slot (75% spawn), Course 3-12: 1-2 slots, Course 13+: 2-3 slots
      const desiredSlots =
        safeCourse <= 2
          ? rng.next() < 0.78
            ? 1
            : 0
          : diff < 0.35
            ? rng.next() < 0.55 + diff
              ? 2
              : 1
            : diff < 0.72
              ? 2
              : rng.next() < 0.5
                ? 3
                : 2;

      for (let slot = 0; slot < desiredSlots; slot++) {
        const frac =
          desiredSlots === 1
            ? 0.5
            : desiredSlots === 2
              ? slot === 0
                ? 0.32
                : 0.72
              : 0.24 + slot * 0.27;
        const obsSlice = Math.max(
          12,
          Math.min(
            nodes.length - 1,
            segStartIdx + Math.floor(actualLen * frac),
          ),
        );
        const obsNode = nodes[obsSlice];
        if (!obsNode || obsNode.isGap) continue;

        // Avoid crowding right on top of a jump pad or another obstacle
        const tooClose = obstacles.some(
          (o) => Math.abs(o.z - obsNode.z) < 6.5,
        );
        if (tooClose) continue;

        const obsRoll = rng.next();
        const hazardSpeedScale = 1 + diff * 0.95;

        if (obsNode.profile === 'upipe') {
          if (obsRoll < 0.45 - diff * 0.15) {
            obstacles.push({
              id: `boost-${obsSlice}-${slot}`,
              type: 'booster',
              z: obsNode.z,
              localX: 0,
              width: 2.4,
              height: 0.15,
              speed: 0,
              phase: 0,
            });
          } else {
            obstacles.push({
              id: `hammer-${obsSlice}-${slot}`,
              type: 'hammer',
              z: obsNode.z,
              localX: 0,
              width: 1.5,
              height: 4.5,
              speed: 1.85 * hazardSpeedScale,
              phase: rng.range(0, Math.PI * 2),
            });
          }
        } else if (obsRoll < 0.25 + diff * 0.08) {
          // Swinging Pendulum Hammer
          obstacles.push({
            id: `hammer-${obsSlice}-${slot}`,
            type: 'hammer',
            z: obsNode.z,
            localX: 0,
            width: 1.4,
            height: 4.4,
            speed: 1.8 * hazardSpeedScale,
            phase: rng.range(0, Math.PI * 2),
          });
        } else if (obsRoll < 0.45 + diff * 0.1) {
          // Spinning Saw Wheel Gate
          obstacles.push({
            id: `saw-${obsSlice}-${slot}`,
            type: 'saw',
            z: obsNode.z,
            localX: rng.range(-1.3, 1.3),
            width: 2.6,
            height: 2.6,
            speed: 2.1 * hazardSpeedScale,
            phase: rng.range(0, Math.PI * 2),
          });
        } else if (obsRoll < 0.68) {
          // Giant Wax Candles
          const pair = rng.next() < 0.55 + diff * 0.25 && obsNode.width >= 4.2;
          if (pair) {
            obstacles.push({
              id: `candle-L-${obsSlice}-${slot}`,
              type: 'candle',
              z: obsNode.z,
              localX: -obsNode.width * 0.24,
              width: 1.15,
              height: 2.6,
              speed: 0,
              phase: 0,
            });
            obstacles.push({
              id: `candle-R-${obsSlice}-${slot}`,
              type: 'candle',
              z: obsNode.z - 3.5,
              localX: obsNode.width * 0.24,
              width: 1.15,
              height: 2.8,
              speed: 0,
              phase: 1.5,
            });
          } else {
            obstacles.push({
              id: `candle-C-${obsSlice}-${slot}`,
              type: 'candle',
              z: obsNode.z,
              localX: rng.range(-obsNode.width * 0.22, obsNode.width * 0.22),
              width: 1.2,
              height: 2.7,
              speed: 0,
              phase: 0,
            });
          }
        } else if (obsRoll < 0.86) {
          // Low Yellow/Black Barricade Hurdle
          obstacles.push({
            id: `hurdle-${obsSlice}-${slot}`,
            type: 'hurdle',
            z: obsNode.z,
            localX: rng.range(-obsNode.width * 0.18, obsNode.width * 0.18),
            width: Math.min(2.5, obsNode.width * 0.55),
            height: 0.95,
            speed: 0,
            phase: 0,
          });
        } else {
          // Pushable Bonus Knock-Balls + Booster Pad
          obstacles.push({
            id: `boost-${obsSlice}-${slot}`,
            type: 'booster',
            z: obsNode.z + 3,
            localX: 0,
            width: 2.2,
            height: 0.15,
            speed: 0,
            phase: 0,
          });
          for (let b = -1; b <= 1; b++) {
            obstacles.push({
              id: `knock-${obsSlice}-${slot}-${b}`,
              type: 'knockball',
              z: obsNode.z - 2,
              localX: b * 1.25,
              width: 0.95,
              height: 0.95,
              speed: 0,
              phase: (b + 2) * 1.1,
              hit: false,
              vx: 0,
              vy: 0,
              vz: 0,
            });
          }
        }
      }
    }
  }

  const titleIndex = (safeCourse - 1) % COURSE_TITLES.length;
  // Par time tuned to auto-cruise speed * speedMultiplier (achievable with clean driving)
  const expectedCruiseSpeed = 14.8 * speedMultiplier;
  const parTimeSec = Math.max(
    10,
    Math.round((totalLength / expectedCruiseSpeed) * 1.12),
  );
  const coinTarget = Math.max(3, Math.ceil(coins.length * 0.45));

  return {
    courseNumber: safeCourse,
    themeId,
    totalLength,
    difficulty: diff,
    speedMultiplier,
    parTimeSec,
    coinTarget,
    nodes,
    obstacles,
    coins,
    courseTitle: COURSE_TITLES[titleIndex],
  };
}

const THREE = {
  MathClamp(v: number, min: number, max: number) {
    return Math.max(min, Math.min(max, v));
  },
};
