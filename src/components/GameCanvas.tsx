import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  BallSkinId,
  GameStatus,
  GeneratedCourse,
  WorldThemeId,
} from '../types/game';
import { BALL_SKINS, buildWorldBackdrop, WORLD_THEMES } from '../three/worldThemes';
import {
  buildCourseMeshes,
  buildPlayerBallGroup,
  BuiltCourseMeshes,
  getSurfaceHeightAndNormal,
  sampleTrackAtZ,
} from '../three/trackBuilder';
import { soundEngine } from '../utils/sound';

// Pre-allocated math helpers at module scope (Zero GC in render loop)
const _forwardAxis = new THREE.Vector3(1, 0, 0);
const _sideAxis = new THREE.Vector3(0, 0, -1);
const _spinQuatX = new THREE.Quaternion();
const _spinQuatZ = new THREE.Quaternion();
const _targetCamPos = new THREE.Vector3();
const _lookAtPos = new THREE.Vector3();

export interface TelemetryData {
  speedKmh: number;
  progressPct: number;
  segmentLabel: string;
  isAirborne: boolean;
  elapsedSec: number;
  runCoinsCollected: number;
}

interface GameCanvasProps {
  course: GeneratedCourse;
  skinId: BallSkinId;
  customAccentHex: string;
  glowBoost: number;
  themeOverride: WorldThemeId | 'auto';
  cameraPreset: 'chase' | 'far' | 'low';
  gameStatus: GameStatus;
  jumpTriggerCount: number;
  restartTriggerCount: number;
  onStatusChange: (status: GameStatus) => void;
  onCourseComplete: (stats: { elapsedSec: number; coinsCollected: number }) => void;
  onCoinCollected: () => void;
  onTelemetryUpdate: (data: TelemetryData) => void;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({
  course,
  skinId,
  customAccentHex,
  glowBoost,
  themeOverride,
  cameraPreset,
  gameStatus,
  jumpTriggerCount,
  restartTriggerCount,
  onStatusChange,
  onCourseComplete,
  onCoinCollected,
  onTelemetryUpdate,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);

  // Mutable refs for game loop access without tearing down WebGL canvas
  const statusRef = useRef<GameStatus>(gameStatus);
  statusRef.current = gameStatus;

  const camPresetRef = useRef(cameraPreset);
  camPresetRef.current = cameraPreset;

  const callbacksRef = useRef({
    onStatusChange,
    onCourseComplete,
    onCoinCollected,
    onTelemetryUpdate,
  });
  callbacksRef.current = {
    onStatusChange,
    onCourseComplete,
    onCoinCollected,
    onTelemetryUpdate,
  };

  // Physics state ref
  const physRef = useRef({
    x: 0,
    y: 0.55,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    grounded: true,
    fallingInAbyss: false,
    camLookX: 0,
    camLookY: 0.8,
    camLookZ: -6,
    camRoll: 0,
    boostTimer: 0,
    cameraShake: 0,
    hitBlinkTimer: 0,
    hitCooldown: 0,
    knockbackTimer: 0,
    runTimeSec: 0,
    runCoinsCollected: 0,
    lastJumpCount: 0,
    lastRestartCount: 0,
    swipeImpulseZ: 0,
    pendingDragX: 0,
    pointerDown: false,
    pointerStartX: 0,
    pointerStartY: 0,
    pointerLastX: 0,
    pointerLastY: 0,
    pointerDownTime: 0,
  });

  const keysRef = useRef<{ [key: string]: boolean }>({});

  // Request jump helper
  const triggerJump = () => {
    const p = physRef.current;
    if (statusRef.current === 'ready') {
      callbacksRef.current.onStatusChange('playing');
    }
    if (statusRef.current !== 'playing' && statusRef.current !== 'ready') return;

    if (p.grounded && !p.fallingInAbyss) {
      p.vy = 10.8;
      p.grounded = false;
      // Add a slight forward kick if nearly stationary
      if (p.vz > -6) {
        p.vz -= 4.5;
      }
      soundEngine.playJump(false);
    }
  };

  useEffect(() => {
    if (jumpTriggerCount !== physRef.current.lastJumpCount) {
      physRef.current.lastJumpCount = jumpTriggerCount;
      triggerJump();
    }
  }, [jumpTriggerCount]);

  // Scene object refs so course/ball updates don't recreate WebGLRenderer
  const sceneRefs = useRef<{
    renderer?: THREE.WebGLRenderer;
    scene?: THREE.Scene;
    camera?: THREE.PerspectiveCamera;
    keyLight?: THREE.DirectionalLight;
    hemiLight?: THREE.HemisphereLight;
    courseBuilt?: BuiltCourseMeshes;
    backdropGroup?: THREE.Group;
    ballRoot?: THREE.Group;
    spinGroup?: THREE.Group;
    shadowMesh?: THREE.Mesh;
    maxAnisotropy: number;
    isSoftwareGl: boolean;
    courseData: GeneratedCourse;
  }>({
    maxAnisotropy: 1,
    isSoftwareGl: false,
    courseData: course,
  });

  // Reset ball and course collectibles to start of current course
  const resetBallPosition = (targetCourse: GeneratedCourse) => {
    const p = physRef.current;
    const startNode = targetCourse.nodes[0];
    p.x = startNode ? startNode.xCenter : 0;
    p.y = (startNode ? startNode.yCenter : 0) + 0.55;
    p.z = -1.5;
    p.vx = 0;
    p.vy = 0;
    p.vz = 0;
    p.grounded = true;
    p.fallingInAbyss = false;
    p.boostTimer = 0;
    p.cameraShake = 0;
    p.hitBlinkTimer = 0;
    p.hitCooldown = 0;
    p.knockbackTimer = 0;
    p.runTimeSec = 0;
    p.runCoinsCollected = 0;
    p.pendingDragX = 0;
    p.swipeImpulseZ = 0;
    p.camLookX = p.x;
    p.camLookY = p.y + 0.5;
    p.camLookZ = p.z - 6;
    p.camRoll = 0;

    if (sceneRefs.current.spinGroup) {
      sceneRefs.current.spinGroup.visible = true;
    }

    // Restore coin visuals and knockball positions on restart
    if (sceneRefs.current.courseBuilt) {
      targetCourse.coins.forEach((c) => {
        c.collected = false;
      });
      sceneRefs.current.courseBuilt.coinMeshes.forEach((mesh) => {
        mesh.visible = true;
      });
      sceneRefs.current.courseBuilt.animatedObstacles.forEach((item) => {
        if (item.data.type === 'knockball') {
          item.data.hit = false;
          item.data.vx = 0;
          item.data.vy = 0;
          item.data.vz = 0;
          item.group.position.set(
            item.xCenter + item.data.localX,
            item.baseY + 0.48,
            item.data.z,
          );
          item.group.rotation.set(0, 0, 0);
        }
      });
    }

    if (sceneRefs.current.camera) {
      sceneRefs.current.camera.position.set(p.x, p.y + 4.2, p.z + 6.8);
      sceneRefs.current.camera.lookAt(p.camLookX, p.camLookY, p.camLookZ);
    }
  };

  useEffect(() => {
    if (restartTriggerCount !== physRef.current.lastRestartCount) {
      physRef.current.lastRestartCount = restartTriggerCount;
      resetBallPosition(sceneRefs.current.courseData);
    }
  }, [restartTriggerCount]);

  // 1. Initialize WebGLRenderer & Scene once
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = (() => {
      try {
        const gl = document.createElement('canvas').getContext('webgl2');
        if (!gl) return true;
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
        const gpu = String(gl.getParameter(param));
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return false;
      }
    })();

    const initW = container.clientWidth || window.innerWidth || 1024;
    const initH = container.clientHeight || window.innerHeight || 768;

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.setPixelRatio(
      isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2),
    );
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setSize(initW, initH);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();

    // Studio Environment Map (RoomEnvironment) for realistic 24K Gold & Metallic reflections
    try {
      const pmremGenerator = new THREE.PMREMGenerator(renderer);
      scene.environment = pmremGenerator.fromScene(
        new RoomEnvironment(),
        0.04,
      ).texture;
      pmremGenerator.dispose();
    } catch {
      // Fallback if PMREM fails on restricted WebGL context
    }

    const camera = new THREE.PerspectiveCamera(
      60,
      initW / Math.max(1, initH),
      0.1,
      450,
    );

    // 3-Point / Outdoor Balanced Lighting Rig
    const hemiLight = new THREE.HemisphereLight('#7dd3fc', '#64748b', 0.85);
    hemiLight.position.set(0, 60, 0);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight('#fffbeb', 1.65);
    keyLight.position.set(18, 35, 22);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.set(1024, 1024);
    const d = 24;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 95;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);
    scene.add(keyLight.target);

    const rimLight = new THREE.DirectionalLight('#38bdf8', 0.55);
    rimLight.position.set(-16, 18, -25);
    scene.add(rimLight);

    sceneRefs.current.renderer = renderer;
    sceneRefs.current.scene = scene;
    sceneRefs.current.camera = camera;
    sceneRefs.current.keyLight = keyLight;
    sceneRefs.current.hemiLight = hemiLight;
    sceneRefs.current.maxAnisotropy =
      renderer.capabilities.getMaxAnisotropy() || 1;
    sceneRefs.current.isSoftwareGl = isSoftwareGl;

    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth || 1024;
      const h = container.clientHeight || window.innerHeight || 768;
      camera.aspect = w / Math.max(1, h);
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);
    const resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(container);

    // Keyboard controls
    const onKeyDown = (e: KeyboardEvent) => {
      keysRef.current[e.code] = true;
      if (e.code === 'Space') {
        e.preventDefault();
        triggerJump();
      }
      if (
        ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(
          e.code,
        ) &&
        statusRef.current === 'ready'
      ) {
        callbacksRef.current.onStatusChange('playing');
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.code] = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    // Animation & Physics Loop with Software-WebGL guard
    let frameId = 0;
    let lastTime = performance.now();
    let telemetryTimer = 0;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (!gl || typeof gl.fenceSync !== 'function') {
        frameId = window.setTimeout(cb, 80);
        return;
      }
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function stepPhysics(dt: number, elapsedSec: number) {
      const sRefs = sceneRefs.current;
      const curCourse = sRefs.courseData;
      const p = physRef.current;
      const keys = keysRef.current;
      const radius = 0.55;

      // Animate obstacles & coins even in ready state
      if (sRefs.courseBuilt) {
        for (const item of sRefs.courseBuilt.animatedObstacles) {
          const obs = item.data;
          if (obs.type === 'hammer' && item.movingPart) {
            const swingAngle =
              Math.sin(elapsedSec * obs.speed + obs.phase) * 0.95;
            item.movingPart.rotation.z = swingAngle;
          } else if (obs.type === 'saw' && item.movingPart) {
            item.movingPart.rotation.z = elapsedSec * obs.speed * 2.2;
            const slideX =
              Math.sin(elapsedSec * obs.speed + obs.phase) * 1.65;
            item.group.position.x = item.xCenter + slideX;
          } else if (obs.type === 'candle' && item.movingPart) {
            item.movingPart.scale.y =
              0.92 + Math.sin(elapsedSec * 9 + obs.phase) * 0.14;
          } else if (obs.type === 'knockball' && obs.hit) {
            obs.vy = (obs.vy || 0) - 24 * dt;
            item.group.position.x += (obs.vx || 0) * dt;
            item.group.position.y += (obs.vy || 0) * dt;
            item.group.position.z += (obs.vz || 0) * dt;
            item.group.rotation.x += 5 * dt;
          }
        }

        sRefs.courseBuilt.coinMeshes.forEach((mesh) => {
          if (mesh.visible) {
            mesh.rotation.y = elapsedSec * 2.6;
          }
        });
      }

      if (statusRef.current !== 'playing' && statusRef.current !== 'ready') {
        // Decay remaining camera shake smoothly even after fall/complete
        if (p.cameraShake > 0) {
          p.cameraShake = Math.max(0, p.cameraShake - dt * 2.4);
        }
        return;
      }

      const isPlaying = statusRef.current === 'playing';
      if (isPlaying && !p.fallingInAbyss) {
        p.runTimeSec += dt;
      }

      // Decay impact timers
      if (p.cameraShake > 0) {
        p.cameraShake = Math.max(0, p.cameraShake - dt * 2.2);
      }
      if (p.hitBlinkTimer > 0) {
        p.hitBlinkTimer = Math.max(0, p.hitBlinkTimer - dt);
      }
      if (p.hitCooldown > 0) {
        p.hitCooldown = Math.max(0, p.hitCooldown - dt);
      }
      if (p.knockbackTimer > 0) {
        p.knockbackTimer = Math.max(0, p.knockbackTimer - dt);
      }

      // Gather player forward/backward & lateral inputs
      let forwardInput = 0;
      let keySideInput = 0;

      if (keys['KeyW'] || keys['ArrowUp']) forwardInput += 1;
      if (keys['KeyS'] || keys['ArrowDown']) forwardInput -= 1.0;
      if (keys['KeyA'] || keys['ArrowLeft']) keySideInput -= 1;
      if (keys['KeyD'] || keys['ArrowRight']) keySideInput += 1;

      // Blend vertical swipe modulation (up = surge, down = brake)
      forwardInput += p.swipeImpulseZ;
      p.swipeImpulseZ *= Math.pow(0.06, dt);

      const node = sampleTrackAtZ(curCourse.nodes, p.z);
      const nextNode = sampleTrackAtZ(curCourse.nodes, p.z - 1.5);
      const trackSlopeDz = (nextNode.yCenter - node.yCenter) / 1.5;

      const localX = p.x - node.xCenter;
      const surf = getSurfaceHeightAndNormal(node, localX);

      // Boost pad timer
      if (p.boostTimer > 0) {
        p.boostTimer = Math.max(0, p.boostTimer - dt);
      }

      const speedMult = curCourse.speedMultiplier || 1;
      const controlAuthority = p.knockbackTimer > 0 ? 0.22 : 1.0;

      if (!p.fallingInAbyss) {
        // Auto-Acceleration once playing (Going Balls feel!), scaled by course difficulty
        const baseCruiseSpeed = 14.2 * speedMult;
        const maxSpeed = (p.boostTimer > 0 ? 34 : 23.5) * speedMult;

        if (isPlaying) {
          // Automatic forward drive toward target cruise speed; player can boost (up/W) or brake (down/S)
          const targetSpeed = THREE.MathUtils.clamp(
            baseCruiseSpeed + forwardInput * 7.5 * speedMult,
            4.5,
            maxSpeed,
          );
          const targetVz = -targetSpeed;
          if (p.knockbackTimer <= 0) {
            const accelRate = forwardInput < -0.15 ? 7.5 : 3.8;
            p.vz = THREE.MathUtils.damp(p.vz, targetVz, accelRate, dt);
          }
          // Downhill slopes naturally add thrilling extra momentum
          const slopeGravityZ = trackSlopeDz * 18.0;
          p.vz += slopeGravityZ * dt;
        } else {
          p.vz *= Math.pow(0.2, dt);
        }

        if (p.boostTimer > 0) {
          p.vz = Math.min(p.vz, -28 * speedMult);
        }
        p.vz = THREE.MathUtils.clamp(p.vz, -maxSpeed, 14);

        // Responsive Finger-Following Lateral Control + U-Pipe Half-Pipe Physics
        // Convert accumulated horizontal drag distance directly into smooth, responsive lateral velocity
        const dragStepX = p.pendingDragX * Math.min(1, dt * 18);
        p.pendingDragX -= dragStepX;
        const dragTargetVx = (dragStepX / Math.max(0.008, dt)) * controlAuthority;

        // Keyboard lateral steering
        const keySteerAccel = keySideInput * 25.0 * controlAuthority;

        // U-pipe / banked curve restoring gravity
        const uPipeRestoreAccel =
          node.profile === 'upipe' ? surf.nx * 36.0 : surf.nx * 18.0;

        if (Math.abs(dragStepX) > 0.0005 && p.knockbackTimer <= 0) {
          // Direct crisp finger-follow steering while dragging
          p.vx = THREE.MathUtils.lerp(
            p.vx,
            THREE.MathUtils.clamp(dragTargetVx, -19, 19),
            0.78,
          );
          p.vx += uPipeRestoreAccel * dt * 0.55;
        } else {
          p.vx += (keySteerAccel + uPipeRestoreAccel) * dt;
          // Lower damping during knockback (so heavy hits launch you off!) or inside U-pipes
          const lateralDrag =
            p.knockbackTimer > 0
              ? 0.88
              : node.profile === 'upipe'
                ? 0.62
                : 0.16;
          p.vx *= Math.pow(lateralDrag, dt);
        }

        const maxVx = p.knockbackTimer > 0 ? 28 : 18.5;
        p.vx = THREE.MathUtils.clamp(p.vx, -maxVx, maxVx);
      }

      // Advance X and Z
      p.x += p.vx * dt;
      p.z += p.vz * dt;

      // Re-sample at updated X, Z
      const curNode = sampleTrackAtZ(curCourse.nodes, p.z);
      const curLocalX = p.x - curNode.xCenter;
      const curHalfW = curNode.width * 0.5;
      const curSurf = getSurfaceHeightAndNormal(curNode, curLocalX);

      // Check guardrail collisions or cliff drop-off (heavy knockback launches ball OVER guardrails!)
      if (!p.fallingInAbyss) {
        const margin = curHalfW - radius * 0.85;
        const clearsRail = p.y - curSurf.y >= 1.15 || (p.knockbackTimer > 0.12 && Math.abs(p.vx) > 15);
        if (curLocalX < -margin) {
          if (curNode.hasLeftRail && !clearsRail) {
            p.x = curNode.xCenter - margin;
            if (p.vx < -1.5) {
              soundEngine.playRailBump(Math.min(1, Math.abs(p.vx) / 10));
            }
            p.vx = Math.abs(p.vx) * 0.55;
          } else if (curLocalX < -(curHalfW + 0.25)) {
            if (p.grounded || p.y <= curSurf.y + radius + 0.2 || p.knockbackTimer > 0) {
              p.fallingInAbyss = true;
              p.grounded = false;
              soundEngine.playFall();
            }
          }
        } else if (curLocalX > margin) {
          if (curNode.hasRightRail && !clearsRail) {
            p.x = curNode.xCenter + margin;
            if (p.vx > 1.5) {
              soundEngine.playRailBump(Math.min(1, Math.abs(p.vx) / 10));
            }
            p.vx = -Math.abs(p.vx) * 0.55;
          } else if (curLocalX > curHalfW + 0.25) {
            if (p.grounded || p.y <= curSurf.y + radius + 0.2 || p.knockbackTimer > 0) {
              p.fallingInAbyss = true;
              p.grounded = false;
              soundEngine.playFall();
            }
          }
        }
      }

      // Vertical physics (gravity, jumping, ramp launches, and abyss gaps)
      const gravity = 28.0;
      p.vy -= gravity * dt;
      p.y += p.vy * dt;

      if (!p.fallingInAbyss) {
        if (curNode.isGap) {
          // Over an abyss gap between islands!
          p.grounded = false;
          if (p.y < curNode.yCenter - 1.2) {
            p.fallingInAbyss = true;
            soundEngine.playFall();
          }
        } else {
          const floorY = curSurf.y + radius;
          if (p.y <= floorY) {
            p.y = floorY;
            if (p.vy < -6) {
              // Slight bounce on heavy landing
              p.vy = -p.vy * 0.22;
            } else {
              p.vy = 0;
            }
            p.grounded = true;
          } else if (p.y > floorY + 0.18) {
            p.grounded = false;
          }
        }
      } else {
        // Plunging into the abyss -> trigger restart when below -14m
        if (p.y < curNode.yCenter - 14) {
          callbacksRef.current.onStatusChange('fell');
          return;
        }
      }

      // Check Finish Line!
      const finishZ = -curCourse.totalLength + 12;
      if (!p.fallingInAbyss && p.z <= finishZ) {
        soundEngine.playCourseComplete();
        callbacksRef.current.onCourseComplete({
          elapsedSec: p.runTimeSec,
          coinsCollected: p.runCoinsCollected,
        });
        return;
      }

      // Check Coins Collection
      if (sRefs.courseBuilt && !p.fallingInAbyss) {
        for (const coin of curCourse.coins) {
          if (!coin.collected && Math.abs(coin.z - p.z) < 1.35) {
            const cNode = sampleTrackAtZ(curCourse.nodes, coin.z);
            const cSurf = getSurfaceHeightAndNormal(cNode, coin.localX);
            const cx = cNode.xCenter + coin.localX;
            const cy = cSurf.y + coin.heightOffset;
            const distSq =
              (cx - p.x) * (cx - p.x) +
              (cy - p.y) * (cy - p.y) +
              (coin.z - p.z) * (coin.z - p.z);
            if (distSq < 1.25) {
              coin.collected = true;
              p.runCoinsCollected += 1;
              const mesh = sRefs.courseBuilt.coinMeshes.get(coin.id);
              if (mesh) mesh.visible = false;
              soundEngine.playCoin();
              callbacksRef.current.onCoinCollected();
            }
          }
        }

        // Check Obstacle Interactions (Jump Pads, Boosters, Hammers, Saws, Candles, Hurdles, Knockballs)
        for (const item of sRefs.courseBuilt.animatedObstacles) {
          const obs = item.data;
          const dz = Math.abs(obs.z - p.z);
          if (dz > 2.2) continue;

          if (obs.type === 'jumppad') {
            const ox = item.xCenter + obs.localX;
            if (
              Math.abs(p.x - ox) < obs.width * 0.55 &&
              dz < 1.35 &&
              p.y - item.baseY < 1.25
            ) {
              p.vy = 14.5; // High spring launch over island gap!
              p.vz = Math.min(p.vz, -19.5 * speedMult);
              p.grounded = false;
              soundEngine.playJump(true);
            }
          } else if (obs.type === 'booster') {
            const ox = item.xCenter + obs.localX;
            if (
              Math.abs(p.x - ox) < obs.width * 0.55 &&
              dz < 1.35 &&
              p.y - item.baseY < 1.2
            ) {
              if (p.boostTimer <= 0.1) {
                soundEngine.playBoost();
              }
              p.boostTimer = 1.35;
              p.vz = Math.min(p.vz, -29 * speedMult);
            }
          } else if (obs.type === 'knockball' && !obs.hit) {
            const ox = item.xCenter + obs.localX;
            const dist = Math.hypot(p.x - ox, p.z - obs.z);
            if (dist < 1.05 && p.y - item.baseY < 1.3) {
              obs.hit = true;
              obs.vx = (ox - p.x) * 12 + (Math.random() - 0.5) * 6;
              obs.vy = 8.5;
              obs.vz = p.vz * 1.35 - 8;
              soundEngine.playRailBump(0.8);
            }
          } else if (obs.type === 'hurdle' && p.hitCooldown <= 0) {
            const ox = item.xCenter + obs.localX;
            if (
              Math.abs(p.x - ox) < obs.width * 0.5 + 0.35 &&
              dz < 0.65 &&
              p.y - item.baseY < obs.height + 0.25
            ) {
              p.vz = 9.5;
              p.vy = 5.0;
              p.cameraShake = Math.max(p.cameraShake, 0.38);
              p.hitBlinkTimer = Math.max(p.hitBlinkTimer, 0.55);
              p.hitCooldown = 0.22;
              soundEngine.playObstacleHit();
            }
          } else if (obs.type === 'candle' && p.hitCooldown <= 0) {
            const ox = item.xCenter + obs.localX;
            const dist = Math.hypot(p.x - ox, p.z - obs.z);
            if (dist < 0.62 + radius && p.y - item.baseY < obs.height + 0.4) {
              const pushX = (p.x - ox) / Math.max(0.01, dist);
              const pushZ = (p.z - obs.z) / Math.max(0.01, dist);
              p.vx = pushX * 12;
              p.vz = Math.max(6, pushZ * 10);
              p.cameraShake = Math.max(p.cameraShake, 0.32);
              p.hitBlinkTimer = Math.max(p.hitBlinkTimer, 0.5);
              p.hitCooldown = 0.2;
              soundEngine.playObstacleHit();
            }
          } else if (obs.type === 'hammer' && item.movingPart && p.hitCooldown <= 0) {
            // Compute world position & instantaneous swing velocity of pendulum hammer head
            const swingAngle = item.movingPart.rotation.z;
            const armLen = 4.25;
            const hx = item.xCenter + Math.sin(swingAngle) * armLen;
            const hy = item.baseY + 5.8 - Math.cos(swingAngle) * armLen;
            const dist = Math.hypot(p.x - hx, p.y - hy, p.z - obs.z);
            if (dist < 1.32) {
              const swingVel = Math.cos(elapsedSec * obs.speed + obs.phase);
              const launchDir =
                Math.abs(swingVel) > 0.15
                  ? Math.sign(swingVel)
                  : p.x >= hx
                    ? 1
                    : -1;
              // Heavy impact: strong lateral launch + upward arc so direct hits can send ball off-track!
              const power = 20 + curCourse.difficulty * 6;
              p.vx = launchDir * power;
              p.vy = 9.8;
              p.vz = 7.5;
              p.grounded = false;
              p.cameraShake = 0.9;
              p.hitBlinkTimer = 1.0;
              p.hitCooldown = 0.3;
              p.knockbackTimer = 0.48;
              soundEngine.playObstacleHit();
            }
          } else if (obs.type === 'saw' && p.hitCooldown <= 0) {
            const sx = item.group.position.x;
            const sy = item.baseY + 1.35;
            const dist = Math.hypot(p.x - sx, p.y - sy, p.z - obs.z);
            if (dist < 1.58) {
              const slideVel = Math.cos(elapsedSec * obs.speed + obs.phase);
              const launchDir =
                Math.abs(p.x - sx) > 0.25
                  ? Math.sign(p.x - sx)
                  : Math.sign(slideVel || 1);
              // Violent saw knockback + screen shake + ball blink!
              const power = 19.5 + curCourse.difficulty * 5.5;
              p.vx = launchDir * power;
              p.vy = 9.0;
              p.vz = 8.5;
              p.grounded = false;
              p.cameraShake = 0.85;
              p.hitBlinkTimer = 1.0;
              p.hitCooldown = 0.3;
              p.knockbackTimer = 0.45;
              soundEngine.playObstacleHit();
            }
          }
        }
      }

      // Update 3D Ball Position, Rolling Spin & Hit-Blink Feedback
      if (sRefs.ballRoot && sRefs.spinGroup && sRefs.shadowMesh) {
        sRefs.ballRoot.position.set(p.x, p.y, p.z);

        // Rapid blink on obstacle impact so damage/knockback reads viscerally
        if (p.hitBlinkTimer > 0) {
          sRefs.spinGroup.visible = Math.floor(p.hitBlinkTimer * 22) % 2 === 0;
        } else {
          sRefs.spinGroup.visible = true;
        }

        // Rotate ball mesh proportional to linear travel distance (ds / r)
        const dThetaX = (p.vz * dt) / radius;
        const dThetaZ = (-p.vx * dt) / radius;
        _spinQuatX.setFromAxisAngle(_forwardAxis, dThetaX);
        _spinQuatZ.setFromAxisAngle(_sideAxis, dThetaZ);
        sRefs.spinGroup.quaternion.premultiply(_spinQuatX).premultiply(_spinQuatZ);

        // Position contact shadow directly on the track surface beneath the ball
        const heightAboveTrack = Math.max(0, p.y - radius - curSurf.y);
        sRefs.shadowMesh.visible = !p.fallingInAbyss && !curNode.isGap;
        sRefs.shadowMesh.position.set(0, -radius - heightAboveTrack + 0.03, 0);
        const shadowScale = Math.max(0.35, 1 - heightAboveTrack * 0.18);
        sRefs.shadowMesh.scale.setScalar(shadowScale);
      }

      // Update 3D Chase Camera with Speed FOV & U-Pipe Banking Immersion
      const cam = sRefs.camera;
      if (cam) {
        const preset = camPresetRef.current;
        const distBack = preset === 'far' ? 8.8 : preset === 'low' ? 5.4 : 6.6;
        const heightUp = preset === 'far' ? 5.4 : preset === 'low' ? 2.7 : 3.9;

        if (!p.fallingInAbyss) {
          _targetCamPos.set(
            p.x * 0.85 + curNode.xCenter * 0.15,
            p.y + heightUp,
            p.z + distBack,
          );
          cam.position.x = THREE.MathUtils.damp(
            cam.position.x,
            _targetCamPos.x,
            7.5,
            dt,
          );
          cam.position.y = THREE.MathUtils.damp(
            cam.position.y,
            _targetCamPos.y,
            6.5,
            dt,
          );
          cam.position.z = THREE.MathUtils.damp(
            cam.position.z,
            _targetCamPos.z,
            10.0,
            dt,
          );

          p.camLookX = THREE.MathUtils.damp(p.camLookX, p.x, 9.0, dt);
          p.camLookY = THREE.MathUtils.damp(p.camLookY, p.y + 0.35, 7.5, dt);
          p.camLookZ = THREE.MathUtils.damp(p.camLookZ, p.z - 6.5, 11.0, dt);
        } else {
          // Dramatic look-down when falling into the abyss
          p.camLookX = THREE.MathUtils.damp(p.camLookX, p.x, 8.0, dt);
          p.camLookY = THREE.MathUtils.damp(p.camLookY, p.y, 8.0, dt);
          p.camLookZ = THREE.MathUtils.damp(p.camLookZ, p.z, 8.0, dt);
        }

        _lookAtPos.set(p.camLookX, p.camLookY, p.camLookZ);
        if (p.cameraShake > 0.005) {
          const shakeAmp = p.cameraShake * p.cameraShake * 0.72;
          cam.position.x += (Math.random() - 0.5) * shakeAmp;
          cam.position.y += (Math.random() - 0.5) * shakeAmp;
          _lookAtPos.x += (Math.random() - 0.5) * shakeAmp * 0.6;
          _lookAtPos.y += (Math.random() - 0.5) * shakeAmp * 0.6;
        }
        cam.lookAt(_lookAtPos);

        // Subtle camera roll (banking tilt) when riding U-pipe walls + shake roll kick
        const targetRoll =
          curNode.profile === 'upipe'
            ? THREE.MathUtils.clamp(-curSurf.nx * 0.24, -0.22, 0.22)
            : curNode.bankAngle * 0.5;
        p.camRoll = THREE.MathUtils.damp(p.camRoll, targetRoll, 5.5, dt);
        const shakeRoll =
          p.cameraShake > 0.005
            ? (Math.random() - 0.5) * p.cameraShake * 0.14
            : 0;
        cam.rotation.z += p.camRoll + shakeRoll;

        // Dynamic Speed FOV Widening
        const speedMag = Math.hypot(p.vx, p.vz);
        const targetFov = THREE.MathUtils.clamp(
          58 + (speedMag / 30) * 16 + (p.boostTimer > 0 ? 5 : 0),
          58,
          76,
        );
        if (Math.abs(cam.fov - targetFov) > 0.05) {
          cam.fov = THREE.MathUtils.damp(cam.fov, targetFov, 5.0, dt);
          cam.updateProjectionMatrix();
        }
      }

      // Move directional shadow light along with the ball
      if (sRefs.keyLight) {
        sRefs.keyLight.position.set(p.x + 16, p.y + 32, p.z + 18);
        sRefs.keyLight.target.position.set(p.x, p.y, p.z - 8);
        sRefs.keyLight.target.updateMatrixWorld();
      }

      // Update HUD Telemetry (~10 times/sec to avoid React state spam)
      telemetryTimer += dt;
      if (telemetryTimer >= 0.09) {
        telemetryTimer = 0;
        const speedKmh = Math.round(Math.hypot(p.vx, p.vz) * 3.8);
        const finishDist = Math.max(1, curCourse.totalLength - 12);
        const progressPct = THREE.MathUtils.clamp(
          Math.round((Math.abs(p.z) / finishDist) * 100),
          0,
          100,
        );
        const segmentLabel =
          curNode.profile === 'upipe'
            ? 'U-Pipe Half-Pipe'
            : curNode.profile === 'narrow'
              ? 'Abyss Cliff Bridge'
              : curNode.profile === 'island'
                ? 'Floating Islands'
                : curNode.profile === 'ramp'
                  ? 'Velocity Ramp'
                  : 'Skyway Track';

        callbacksRef.current.onTelemetryUpdate({
          speedKmh,
          progressPct,
          segmentLabel,
          isAirborne: !p.grounded,
          elapsedSec: p.runTimeSec,
          runCoinsCollected: p.runCoinsCollected,
        });
      }
    }

    function tick() {
      const now = performance.now();
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      stepPhysics(dt, now / 1000);
      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    frameId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver.disconnect();
      window.removeEventListener('resize', onResize);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // 2. Rebuild Course & World Theme when course or themeOverride changes
  useEffect(() => {
    const sRefs = sceneRefs.current;
    const scene = sRefs.scene;
    if (!scene) return;

    sRefs.courseData = course;

    const activeThemeId =
      themeOverride === 'auto' ? course.themeId : themeOverride;
    const theme = WORLD_THEMES[activeThemeId];

    // Update sky background, fog, and lighting colors
    scene.background = new THREE.Color(theme.skyBottomColor);
    scene.fog = new THREE.FogExp2(theme.fogColor, theme.fogDensity);

    if (sRefs.hemiLight) {
      sRefs.hemiLight.color.set(theme.hemiSkyColor);
      sRefs.hemiLight.groundColor.set(theme.hemiGroundColor);
    }
    if (sRefs.keyLight) {
      sRefs.keyLight.color.set(theme.sunColor);
    }

    // Remove previous course & backdrop
    if (sRefs.courseBuilt) {
      scene.remove(sRefs.courseBuilt.root);
    }
    if (sRefs.backdropGroup) {
      scene.remove(sRefs.backdropGroup);
    }

    const built = buildCourseMeshes(course, theme, sRefs.maxAnisotropy);
    scene.add(built.root);
    sRefs.courseBuilt = built;

    const backdrop = buildWorldBackdrop(theme, course.totalLength);
    scene.add(backdrop);
    sRefs.backdropGroup = backdrop;

    resetBallPosition(course);
  }, [course, themeOverride]);

  // 3. Rebuild Player Ball when skinId, customAccentHex, or glowBoost changes
  useEffect(() => {
    const sRefs = sceneRefs.current;
    const scene = sRefs.scene;
    if (!scene) return;

    if (sRefs.ballRoot) {
      scene.remove(sRefs.ballRoot);
    }

    const skin =
      BALL_SKINS.find((s) => s.id === skinId) || BALL_SKINS[0];
    const builtBall = buildPlayerBallGroup(
      skin,
      customAccentHex,
      glowBoost,
      sRefs.maxAnisotropy,
      sRefs.isSoftwareGl,
    );

    const p = physRef.current;
    builtBall.ballRoot.position.set(p.x, p.y, p.z);
    scene.add(builtBall.ballRoot);

    sRefs.ballRoot = builtBall.ballRoot;
    sRefs.spinGroup = builtBall.spinGroup;
    sRefs.shadowMesh = builtBall.shadowMesh;
  }, [skinId, customAccentHex, glowBoost]);

  // Pointer (Touch & Mouse Drag-to-Follow + Auto-Acceleration) Handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const p = physRef.current;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    p.pointerDown = true;
    p.pointerStartX = e.clientX;
    p.pointerStartY = e.clientY;
    p.pointerLastX = e.clientX;
    p.pointerLastY = e.clientY;
    p.pointerDownTime = performance.now();

    if (statusRef.current === 'ready') {
      callbacksRef.current.onStatusChange('playing');
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const p = physRef.current;
    if (!p.pointerDown) return;

    const dx = e.clientX - p.pointerLastX;
    const dy = e.clientY - p.pointerLastY;
    p.pointerLastX = e.clientX;
    p.pointerLastY = e.clientY;

    // Direct 1:1 finger-follow lateral mapping scaled to viewport width
    const viewportRefWidth = Math.min(window.innerWidth || 420, 520);
    const curNode = sampleTrackAtZ(sceneRefs.current.courseData.nodes, p.z);
    const worldUnitsPerPx = (curNode.width * 1.25) / Math.max(260, viewportRefWidth);
    p.pendingDragX = THREE.MathUtils.clamp(
      p.pendingDragX + dx * worldUnitsPerPx,
      -5.0,
      5.0,
    );

    // Optional speed modulation: pull down to brake, push up to surge faster than auto-cruise
    if (Math.abs(dy) > 1.5) {
      p.swipeImpulseZ = THREE.MathUtils.clamp(
        p.swipeImpulseZ + (-dy / 26) * 0.75,
        -1.35,
        1.25,
      );
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const p = physRef.current;
    if (!p.pointerDown) return;
    p.pointerDown = false;
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }

    const totalDist = Math.hypot(
      e.clientX - p.pointerStartX,
      e.clientY - p.pointerStartY,
    );
    const elapsed = performance.now() - p.pointerDownTime;

    // Quick tap while rolling triggers jump!
    if (totalDist < 12 && elapsed < 220 && statusRef.current === 'playing') {
      if (Math.abs(p.vz) > 4.0) {
        triggerJump();
      }
    }
  };

  return (
    <div
      ref={mountRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className="relative w-full h-full cursor-grab active:cursor-grabbing select-none"
    />
  );
};
