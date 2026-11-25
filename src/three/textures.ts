import * as THREE from 'three';
import { BallSkinId } from '../types/game';

function configureTexture(
  tex: THREE.CanvasTexture,
  maxAnisotropy: number,
  repeatX = 1,
  repeatY = 1,
): THREE.CanvasTexture {
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.needsUpdate = true;
  return tex;
}

export function createTrackSurfaceTexture(
  style: 'wood' | 'walnut' | 'asphalt' | 'copper',
  maxAnisotropy: number,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  if (style === 'wood' || style === 'walnut' || style === 'copper') {
    const baseColors =
      style === 'wood'
        ? ['#d89b5a', '#c98947', '#e0a868', '#be7c3b']
        : style === 'walnut'
          ? ['#6e4124', '#5c341b', '#7d4b2b', '#4d2b15']
          : ['#b87344', '#9c5d34', '#cd8554', '#874d28'];

    const plankCount = 8;
    const plankW = canvas.width / plankCount;

    for (let i = 0; i < plankCount; i++) {
      ctx.fillStyle = baseColors[i % baseColors.length];
      ctx.fillRect(i * plankW, 0, plankW, canvas.height);

      // Wood grain streaks
      ctx.strokeStyle =
        style === 'walnut' ? 'rgba(25, 10, 0, 0.25)' : 'rgba(90, 45, 10, 0.18)';
      ctx.lineWidth = 2;
      for (let g = 0; g < 18; g++) {
        const gx = i * plankW + ((g * 17) % plankW);
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.bezierCurveTo(
          gx + 6,
          canvas.height * 0.33,
          gx - 6,
          canvas.height * 0.66,
          gx,
          canvas.height,
        );
        ctx.stroke();
      }

      // Plank seam
      ctx.fillStyle = 'rgba(20, 10, 4, 0.45)';
      ctx.fillRect(i * plankW, 0, 3, canvas.height);

      // Horizontal board joint
      const jointY = ((i * 137) % 380) + 60;
      ctx.fillRect(i * plankW, jointY, plankW, 3);
    }

    // Subtle side lane guide stripes
    ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.fillRect(22, 0, 6, canvas.height);
    ctx.fillRect(canvas.width - 28, 0, 6, canvas.height);
  } else {
    // Asphalt highway track (Screenshot 5)
    ctx.fillStyle = '#2d3138';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Asphalt noise speckles
    for (let i = 0; i < 3500; i++) {
      const x = (i * 73) % canvas.width;
      const y = (i * 199) % canvas.height;
      ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.12)';
      ctx.fillRect(x, y, 2, 2);
    }

    // Amber shoulder lines
    ctx.fillStyle = '#e5a93b';
    ctx.fillRect(18, 0, 10, canvas.height);
    ctx.fillRect(canvas.width - 28, 0, 10, canvas.height);

    // Dashed white center highway stripe
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(canvas.width / 2 - 7, 30, 14, 170);
    ctx.fillRect(canvas.width / 2 - 7, 280, 14, 170);
  }

  const tex = new THREE.CanvasTexture(canvas);
  return configureTexture(tex, maxAnisotropy, 1, 1);
}

export function createHazardStripeTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#fbbf24';
  ctx.fillRect(0, 0, 256, 256);

  ctx.fillStyle = '#111827';
  const stripeW = 32;
  for (let y = -256; y < 512; y += stripeW * 2) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(256, y + 128);
    ctx.lineTo(256, y + 128 + stripeW);
    ctx.lineTo(0, y + stripeW);
    ctx.closePath();
    ctx.fill();
  }

  return configureTexture(new THREE.CanvasTexture(canvas), maxAnisotropy, 1, 8);
}

export function createFinishCheckeredTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  const cells = 8;
  const size = 256 / cells;
  for (let r = 0; r < cells; r++) {
    for (let c = 0; c < cells; c++) {
      ctx.fillStyle = (r + c) % 2 === 0 ? '#ffffff' : '#0f172a';
      ctx.fillRect(c * size, r * size, size, size);
    }
  }

  return configureTexture(new THREE.CanvasTexture(canvas), maxAnisotropy, 2, 1);
}

export function createBallSkinTexture(
  skinId: BallSkinId,
  customAccentHex: string,
  maxAnisotropy: number,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  if (skinId === 'cyber-chevron') {
    // Signature Going Balls dark carbon hex + neon green chevrons
    ctx.fillStyle = '#1e2229';
    ctx.fillRect(0, 0, 512, 256);

    // Subtle hex grid lines
    ctx.strokeStyle = '#2e3440';
    ctx.lineWidth = 2;
    for (let x = 0; x < 512; x += 24) {
      for (let y = 0; y < 256; y += 24) {
        ctx.strokeRect(x, y, 22, 22);
      }
    }

    // Metallic silver side bands
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(0, 0, 512, 34);
    ctx.fillRect(0, 222, 512, 34);

    // Neon green/custom accent rims & chevrons
    ctx.fillStyle = customAccentHex || '#4ade80';
    ctx.fillRect(0, 34, 512, 10);
    ctx.fillRect(0, 212, 512, 10);

    // Dotted glowing chevrons around equator
    for (let cx = 40; cx < 490; cx += 95) {
      ctx.fillStyle = customAccentHex || '#4ade80';
      for (let d = -3; d <= 3; d++) {
        const px = cx + Math.abs(d) * 10;
        const py = 128 + d * 14;
        ctx.beginPath();
        ctx.arc(px, py, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(px + 14, py, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (skinId === 'royal-gold') {
    // 24K Brushed Royal Gold Ball
    const grad = ctx.createLinearGradient(0, 0, 512, 256);
    grad.addColorStop(0, '#fef08a');
    grad.addColorStop(0.35, '#eab308');
    grad.addColorStop(0.7, '#ca8a04');
    grad.addColorStop(1, '#fde047');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 256);

    // Engraved royal filigree bands
    ctx.fillStyle = '#fffbeb';
    ctx.fillRect(0, 114, 512, 28);
    ctx.strokeStyle = '#854d0e';
    ctx.lineWidth = 4;
    ctx.strokeRect(0, 112, 512, 32);

    // Diamond studs
    ctx.fillStyle = customAccentHex || '#ffffff';
    for (let x = 32; x < 512; x += 64) {
      ctx.beginPath();
      ctx.moveTo(x, 116);
      ctx.lineTo(x + 12, 128);
      ctx.lineTo(x, 140);
      ctx.lineTo(x - 12, 128);
      ctx.closePath();
      ctx.fill();
    }
  } else if (skinId === 'neon-plasma' || skinId === 'solar-nova') {
    // Glow Ball (야광볼) with intense luminescent circuit bands
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, 512, 256);

    const glowCol =
      customAccentHex || (skinId === 'neon-plasma' ? '#00f5d4' : '#a3e635');
    ctx.strokeStyle = glowCol;
    ctx.lineWidth = 10;

    // Glowing latitude bands
    [54, 128, 202].forEach((y) => {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(512, y);
      ctx.stroke();
    });

    // Glowing meridian pulse nodes
    ctx.fillStyle = '#ffffff';
    for (let x = 32; x < 512; x += 64) {
      ctx.beginPath();
      ctx.arc(x, 128, 14, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (skinId === 'star-striker') {
    // Screenshot 2: Red/White/Blue Star Spangled Ball
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 512, 256);

    // Red & white stripes on top/bottom
    const stripeCount = 8;
    for (let i = 0; i < stripeCount; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#dc2626' : '#f8fafc';
      ctx.fillRect((i * 512) / stripeCount, 0, 512 / stripeCount, 256);
    }

    // Royal blue center star belt
    ctx.fillStyle = '#1d4ed8';
    ctx.fillRect(0, 78, 512, 100);

    // White 5-point stars
    ctx.fillStyle = '#ffffff';
    for (let x = 42; x < 500; x += 84) {
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const outerA = (i * 4 * Math.PI) / 5 - Math.PI / 2;
        const px = x + Math.cos(outerA) * 22;
        const py = 128 + Math.sin(outerA) * 22;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
    }
  } else if (skinId === 'pro-baseball') {
    // Screenshot 5: White leather baseball with red stitches
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, 512, 256);

    ctx.strokeStyle = '#dc2626';
    ctx.lineWidth = 5;
    [82, 174].forEach((yBase, idx) => {
      ctx.beginPath();
      for (let x = 0; x <= 512; x += 8) {
        const wave = Math.sin((x / 512) * Math.PI * 4) * 24 * (idx === 0 ? 1 : -1);
        const y = yBase + wave;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Stitch ticks
      for (let x = 12; x < 504; x += 20) {
        const wave = Math.sin((x / 512) * Math.PI * 4) * 24 * (idx === 0 ? 1 : -1);
        const y = yBase + wave;
        ctx.beginPath();
        ctx.moveTo(x - 5, y - 9);
        ctx.lineTo(x + 5, y + 9);
        ctx.stroke();
      }
    });
  } else {
    // Ruby Core or Galaxy Orb
    const isRuby = skinId === 'ruby-core';
    ctx.fillStyle = isRuby ? '#450a0a' : '#0f172a';
    ctx.fillRect(0, 0, 512, 256);

    ctx.fillStyle = customAccentHex || (isRuby ? '#f97316' : '#38bdf8');
    for (let x = 0; x < 512; x += 64) {
      ctx.fillRect(x, 0, 28, 256);
    }
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 118, 512, 20);
  }

  return configureTexture(new THREE.CanvasTexture(canvas), maxAnisotropy, 1, 1);
}
