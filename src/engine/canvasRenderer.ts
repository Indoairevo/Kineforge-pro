import { ProceduralSceneId, TimelineClip, Track } from '../types/editor';
import { computeTransitionProgress } from './timelineLogic';

/**
 * Renders a complete multi-track composite frame at `playheadTime` onto an HTML5 Canvas 2D context.
 * Supports procedural 4K scenes, real imported <video>/<img> elements, transforms, crop, PiP,
 * color grading, effects (blur, glow, vignette, grain, glitch, shake), transitions, and animated text.
 */
export function renderCompositeFrame(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  playheadTime: number,
  tracks: Track[],
  clips: TimelineClip[],
  mediaElements: Map<string, HTMLVideoElement | HTMLImageElement>,
  selectedClipId: string | null,
  showSafeGuides: boolean = false,
  canvasBackgroundColor: string = '#050811'
): void {
  ctx.save();
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  // Fill the canvas before compositing clips so transparent or empty regions remain intentional.
  ctx.fillStyle = canvasBackgroundColor;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  const anySolo = tracks.some((t) => t.solo);

  // Render tracks from bottom-most layer (higher order value) to top-most layer (order 0)
  const visibleTracks = [...tracks]
    .filter((t) => !t.hidden && t.type !== 'audio' && (!anySolo || t.solo))
    .sort((a, b) => b.order - a.order);

  for (const track of visibleTracks) {
    const trackClips = clips
      .filter(
        (c) =>
          c.trackId === track.id &&
          playheadTime >= c.startTime &&
          playheadTime <= c.startTime + c.duration
      )
      .sort((a, b) => a.startTime - b.startTime);

    for (const clip of trackClips) {
      renderSingleClipLayer(
        ctx,
        canvasWidth,
        canvasHeight,
        playheadTime,
        clip,
        mediaElements.get(clip.assetId),
        clip.id === selectedClipId
      );
    }
  }

  // Optional broadcast title/action safe guides
  if (showSafeGuides) {
    ctx.save();
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 6]);
    const m1 = 0.05;
    const m2 = 0.1;
    ctx.strokeRect(canvasWidth * m1, canvasHeight * m1, canvasWidth * (1 - 2 * m1), canvasHeight * (1 - 2 * m1));
    ctx.strokeRect(canvasWidth * m2, canvasHeight * m2, canvasWidth * (1 - 2 * m2), canvasHeight * (1 - 2 * m2));
    ctx.restore();
  }

  ctx.restore();
}

function renderSingleClipLayer(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  playheadTime: number,
  clip: TimelineClip,
  mediaEl: HTMLVideoElement | HTMLImageElement | undefined,
  isSelected: boolean
): void {
  ctx.save();

  const localTime = Math.max(0, playheadTime - clip.startTime);
  const rawClipMediaTime = clip.freezeFrame
    ? (clip.freezeTime ?? clip.sourceOffset)
    : clip.reversed
      ? clip.sourceOffset + Math.max(0, (clip.duration - localTime) * clip.speed)
      : clip.sourceOffset + localTime * clip.speed;

  // Compute fade-in / fade-out and transition progress
  let alpha = (clip.transform.opacity ?? 100) / 100;
  if (clip.effects.fadeIn > 0 && localTime < clip.effects.fadeIn) {
    alpha *= localTime / clip.effects.fadeIn;
  }
  const remaining = clip.duration - localTime;
  if (clip.effects.fadeOut > 0 && remaining < clip.effects.fadeOut) {
    alpha *= remaining / clip.effects.fadeOut;
  }

  const { inProgress, outProgress } = computeTransitionProgress(clip, playheadTime);
  let transOffsetX = 0;
  let transOffsetY = 0;
  let transScale = 1;
  let transRotation = 0;
  let extraBlur = 0;

  if (inProgress !== null) {
    const t = inProgress; // 0 -> 1
    const ease = 1 - Math.pow(1 - t, 3);
    switch (clip.transition.inType) {
      case 'fade':
      case 'dissolve':
        alpha *= ease;
        break;
      case 'slide':
      case 'push':
        transOffsetX = -(1 - ease) * W * 0.65;
        alpha *= ease;
        break;
      case 'zoom':
        transScale = 0.4 + 0.6 * ease;
        alpha *= ease;
        break;
      case 'spin':
        transRotation = (1 - ease) * -90;
        transScale = ease;
        alpha *= ease;
        break;
      case 'blur':
        extraBlur = (1 - ease) * 18;
        alpha *= ease;
        break;
      case 'wipe':
        ctx.beginPath();
        ctx.rect(0, 0, W * ease, H);
        ctx.clip();
        break;
    }
  }

  if (outProgress !== null) {
    const t = outProgress; // 0 -> 1
    const ease = t * t;
    switch (clip.transition.outType) {
      case 'fade':
      case 'dissolve':
        alpha *= 1 - ease;
        break;
      case 'slide':
      case 'push':
        transOffsetX += ease * W * 0.65;
        alpha *= 1 - ease;
        break;
      case 'zoom':
        transScale *= 1 + ease * 0.5;
        alpha *= 1 - ease;
        break;
      case 'spin':
        transRotation += ease * 90;
        alpha *= 1 - ease;
        break;
      case 'blur':
        extraBlur += ease * 18;
        alpha *= 1 - ease;
        break;
      case 'wipe':
        ctx.beginPath();
        ctx.rect(W * ease, 0, W * (1 - ease), H);
        ctx.clip();
        break;
    }
  }

  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));

  // Camera shake effect
  let shakeX = 0;
  let shakeY = 0;
  if (clip.effects.shake > 0) {
    const mag = (clip.effects.shake / 100) * 18;
    shakeX = Math.sin(playheadTime * 42) * mag;
    shakeY = Math.cos(playheadTime * 37) * mag;
  }

  // Transform center & scale
  const centerX = W / 2 + (clip.transform.x / 100) * (W / 2) + transOffsetX + shakeX;
  const centerY = H / 2 + (clip.transform.y / 100) * (H / 2) + transOffsetY + shakeY;
  const scaleFactor = (clip.transform.scale / 100) * transScale;
  const totalRotationRad = ((clip.transform.rotation + transRotation) * Math.PI) / 180;

  ctx.translate(centerX, centerY);
  ctx.rotate(totalRotationRad);
  ctx.scale(
    scaleFactor * (clip.transform.flipH ? -1 : 1),
    scaleFactor * (clip.transform.flipV ? -1 : 1)
  );

  // CSS Filter string for color grading + blur
  const c = clip.color;
  const brightness = Math.max(0, 100 + c.brightness + c.exposure * 0.6);
  const contrast = Math.max(0, 100 + c.contrast + (c.highlights - c.shadows) * 0.25);
  const saturate = Math.max(0, 100 + c.saturation);
  const hueRotate = c.hue + c.tint * 0.4;
  const totalBlur = (clip.effects.blur || 0) * 0.35 + extraBlur + (clip.effects.motionBlur > 0 ? clip.effects.motionBlur * 0.12 : 0);

  const filterParts: string[] = [];
  if (brightness !== 100) filterParts.push(`brightness(${brightness.toFixed(0)}%)`);
  if (contrast !== 100) filterParts.push(`contrast(${contrast.toFixed(0)}%)`);
  if (saturate !== 100) filterParts.push(`saturate(${saturate.toFixed(0)}%)`);
  if (hueRotate !== 0) filterParts.push(`hue-rotate(${hueRotate.toFixed(0)}deg)`);
  if (totalBlur > 0.2) filterParts.push(`blur(${totalBlur.toFixed(1)}px)`);
  if (filterParts.length > 0) {
    ctx.filter = filterParts.join(' ');
  }

  // Drop shadow / Glow
  if (clip.effects.shadow > 0 || clip.effects.glow > 0) {
    ctx.shadowColor = clip.effects.glow > 0 ? 'rgba(56, 189, 248, 0.75)' : 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = Math.max(clip.effects.shadow * 0.4, clip.effects.glow * 0.5);
    ctx.shadowOffsetY = clip.effects.shadow > 0 ? 8 : 0;
  }

  // Crop region inside local coordinates (-W/2 .. W/2, -H/2 .. H/2)
  const cropL = -W / 2 + (clip.transform.cropLeft / 100) * W;
  const cropT = -H / 2 + (clip.transform.cropTop / 100) * H;
  const cropW = W * (1 - (clip.transform.cropLeft + clip.transform.cropRight) / 100);
  const cropH = H * (1 - (clip.transform.cropTop + clip.transform.cropBottom) / 100);

  if (clip.type === 'text' && clip.textStyle) {
    renderTextClip(ctx, W, H, localTime, clip);
  } else {
    ctx.save();
    ctx.beginPath();
    ctx.rect(cropL, cropT, Math.max(10, cropW), Math.max(10, cropH));
    ctx.clip();

    if (mediaEl) {
      try {
        ctx.drawImage(mediaEl, -W / 2, -H / 2, W, H);
      } catch {
        renderProceduralScene(ctx, W, H, rawClipMediaTime, clip.proceduralScene || 'cyber_city_drive', clip.effects.chromaKeyEnabled);
      }
    } else {
      renderProceduralScene(
        ctx,
        W,
        H,
        rawClipMediaTime,
        clip.proceduralScene || 'cyber_city_drive',
        clip.effects.chromaKeyEnabled
      );
    }

    // Color Temperature overlay (warm amber or cool cyan)
    if (Math.abs(c.temperature) > 2) {
      ctx.fillStyle =
        c.temperature > 0
          ? `rgba(251, 146, 60, ${Math.min(0.35, c.temperature / 260)})`
          : `rgba(56, 189, 248, ${Math.min(0.35, Math.abs(c.temperature) / 260)})`;
      ctx.fillRect(-W / 2, -H / 2, W, H);
    }

    // Glitch RGB shift slice effect
    if (clip.effects.glitch > 0) {
      const intensity = clip.effects.glitch / 100;
      const sliceCount = Math.ceil(intensity * 6);
      for (let i = 0; i < sliceCount; i++) {
        const sy = -H / 2 + ((Math.sin(playheadTime * 19 + i * 7) * 0.5 + 0.5) * H);
        const sh = 8 + (i % 3) * 14;
        const shift = Math.sin(playheadTime * 35 + i) * 28 * intensity;
        ctx.fillStyle = i % 2 === 0 ? 'rgba(244, 63, 94, 0.28)' : 'rgba(34, 211, 238, 0.28)';
        ctx.fillRect(-W / 2 + shift, sy, W, sh);
      }
    }

    // Film grain overlay
    if (clip.effects.filmGrain > 0) {
      const grainCount = Math.min(180, Math.floor(clip.effects.filmGrain * 2));
      ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
      for (let i = 0; i < grainCount; i++) {
        const gx = -W / 2 + (((i * 97 + Math.floor(playheadTime * 60) * 31) % 1000) / 1000) * W;
        const gy = -H / 2 + (((i * 53 + Math.floor(playheadTime * 60) * 17) % 1000) / 1000) * H;
        ctx.fillRect(gx, gy, 2, 2);
      }
    }

    // Vignette radial darkening
    if (clip.effects.vignette > 0) {
      const rad = ctx.createRadialGradient(0, 0, Math.min(W, H) * 0.25, 0, 0, Math.max(W, H) * 0.65);
      rad.addColorStop(0, 'rgba(0,0,0,0)');
      rad.addColorStop(1, `rgba(0,0,0,${Math.min(0.88, clip.effects.vignette / 110)})`);
      ctx.fillStyle = rad;
      ctx.fillRect(-W / 2, -H / 2, W, H);
    }

    ctx.restore();
  }

  // CapCut / InShot style selection bounding box for active clip on canvas
  if (isSelected) {
    ctx.save();
    ctx.filter = 'none';
    const boxX = clip.type === 'text' ? -W * 0.36 : cropL + 4;
    const boxY = clip.type === 'text' ? -H * 0.14 : cropT + 4;
    const boxW = clip.type === 'text' ? W * 0.72 : Math.max(10, cropW - 8);
    const boxH = clip.type === 'text' ? H * 0.28 : Math.max(10, cropH - 8);

    ctx.strokeStyle = '#00E5FF';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(boxX, boxY, boxW, boxH);

    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(boxX, boxY, boxW, boxH);

    // Corner circular CapCut handles
    const corners = [
      [boxX, boxY],
      [boxX + boxW, boxY],
      [boxX, boxY + boxH],
      [boxX + boxW, boxY + boxH],
    ];
    for (const [cx, cy] of corners) {
      ctx.beginPath();
      ctx.arc(cx, cy, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#00E5FF';
      ctx.stroke();
    }
    ctx.restore();
  }

  ctx.restore();
}

function renderProceduralScene(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  t: number,
  scene: ProceduralSceneId,
  chromaCutout: boolean
): void {
  const left = -W / 2;
  const top = -H / 2;

  if (scene === 'cyber_city_drive') {
    if (!chromaCutout) {
      const sky = ctx.createLinearGradient(0, top, 0, top + H * 0.58);
      sky.addColorStop(0, '#090D16');
      sky.addColorStop(0.45, '#1E1B4B');
      sky.addColorStop(0.82, '#9A3412');
      sky.addColorStop(1, '#F59E0B');
      ctx.fillStyle = sky;
      ctx.fillRect(left, top, W, H * 0.58);

      // Sunset horizon glow disc
      const sunGrad = ctx.createRadialGradient(0, top + H * 0.55, 10, 0, top + H * 0.55, W * 0.35);
      sunGrad.addColorStop(0, 'rgba(254, 240, 138, 0.75)');
      sunGrad.addColorStop(0.5, 'rgba(249, 115, 22, 0.3)');
      sunGrad.addColorStop(1, 'rgba(15, 23, 42, 0)');
      ctx.fillStyle = sunGrad;
      ctx.fillRect(left, top, W, H * 0.6);

      // City skyline silhouette with glowing windows
      const buildings = 16;
      for (let i = 0; i < buildings; i++) {
        const bw = W / buildings;
        const bh = H * (0.16 + ((i * 37) % 10) * 0.025);
        const bx = left + i * bw;
        const by = top + H * 0.56 - bh;
        ctx.fillStyle = '#0F172A';
        ctx.fillRect(bx, by, bw - 3, bh);
        ctx.fillStyle = i % 2 === 0 ? 'rgba(251, 191, 36, 0.6)' : 'rgba(56, 189, 248, 0.5)';
        for (let wy = by + 8; wy < top + H * 0.54; wy += 14) {
          ctx.fillRect(bx + 6, wy, Math.max(4, bw - 14), 3);
        }
      }

      // Wet highway perspective deck
      const road = ctx.createLinearGradient(0, top + H * 0.56, 0, top + H);
      road.addColorStop(0, '#1E293B');
      road.addColorStop(0.3, '#0F172A');
      road.addColorStop(1, '#020617');
      ctx.fillStyle = road;
      ctx.fillRect(left, top + H * 0.56, W, H * 0.44);

      // Perspective highway lines
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.28)';
      ctx.lineWidth = 2;
      for (const angle of [-0.65, -0.32, 0.32, 0.65]) {
        ctx.beginPath();
        ctx.moveTo(angle * W * 0.1, top + H * 0.56);
        ctx.lineTo(angle * W * 0.75, top + H);
        ctx.stroke();
      }

      // Moving center lane markers
      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 4;
      const offset = (t * 240) % 80;
      for (let z = 0; z < 6; z++) {
        const y1 = top + H * 0.58 + z * 45 + offset * 0.4;
        if (y1 < top + H) {
          ctx.beginPath();
          ctx.moveTo(0, y1);
          ctx.lineTo(0, Math.min(top + H, y1 + 24));
          ctx.stroke();
        }
      }
    }

    // Hero autonomous electric sports car rear-3/4 silhouette & lights
    const carBob = Math.sin(t * 6) * 2.5;
    ctx.save();
    ctx.translate(0, H * 0.21 + carBob);

    // Asphalt red taillight reflection glow
    const glow = ctx.createRadialGradient(0, H * 0.08, 4, 0, H * 0.08, W * 0.24);
    glow.addColorStop(0, 'rgba(244, 63, 94, 0.55)');
    glow.addColorStop(1, 'rgba(244, 63, 94, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(-W * 0.26, 0, W * 0.52, H * 0.18);

    // Upper cabin canopy
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.roundRect(-W * 0.12, -H * 0.14, W * 0.24, H * 0.08, 18);
    ctx.fill();

    // Lower wide body chassis
    ctx.fillStyle = '#0F172A';
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-W * 0.19, -H * 0.08, W * 0.38, H * 0.11, 14);
    ctx.fill();
    ctx.stroke();

    // Continuous LED cyber taillight bar
    ctx.fillStyle = '#FB7185';
    ctx.fillRect(-W * 0.17, -H * 0.04, W * 0.34, 7);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(-W * 0.04, -H * 0.04, W * 0.08, 7);
    ctx.restore();
    return;
  }

  if (scene === 'alpine_drone_sunrise') {
    if (!chromaCutout) {
      const sky = ctx.createLinearGradient(0, top, 0, top + H);
      sky.addColorStop(0, '#0C4A6E');
      sky.addColorStop(0.45, '#F59E0B');
      sky.addColorStop(1, '#0F172A');
      ctx.fillStyle = sky;
      ctx.fillRect(left, top, W, H);

      // Rising sun disc
      const sunY = top + H * 0.34 - Math.sin(t * 0.4) * 18;
      ctx.fillStyle = 'rgba(254, 243, 199, 0.88)';
      ctx.beginPath();
      ctx.arc(W * 0.14, sunY, Math.min(W, H) * 0.09, 0, Math.PI * 2);
      ctx.fill();
    }

    // Parallax mountain ridges
    const layers = [
      { yBase: 0.55, color: '#1E293B', speed: 18, amp: 65 },
      { yBase: 0.68, color: '#0F172A', speed: 35, amp: 50 },
      { yBase: 0.82, color: '#020617', speed: 55, amp: 35 },
    ];
    for (const layer of layers) {
      ctx.fillStyle = layer.color;
      ctx.beginPath();
      ctx.moveTo(left, top + H);
      for (let x = 0; x <= W; x += 40) {
        const ridge =
          Math.sin((x + t * layer.speed) * 0.008) * layer.amp +
          Math.cos((x + t * layer.speed * 0.7) * 0.019) * (layer.amp * 0.45);
        ctx.lineTo(left + x, top + H * layer.yBase - ridge);
      }
      ctx.lineTo(left + W, top + H);
      ctx.closePath();
      ctx.fill();
    }
    return;
  }

  if (scene === 'studio_director_interview') {
    if (!chromaCutout) {
      const studio = ctx.createLinearGradient(left, top, left + W, top + H);
      studio.addColorStop(0, '#1E293B');
      studio.addColorStop(1, '#0F172A');
      ctx.fillStyle = studio;
      ctx.fillRect(left, top, W, H);

      // Architectural daylight window slats
      ctx.fillStyle = 'rgba(248, 250, 252, 0.06)';
      for (let i = 0; i < 5; i++) {
        ctx.fillRect(left + W * 0.08 + i * 70, top + H * 0.1, 42, H * 0.65);
      }
    }

    // Animated subject silhouette speaking on camera
    const gesture = Math.sin(t * 4.5) * 6;
    ctx.save();
    ctx.translate(0, H * 0.12);
    // Shoulders / blazer
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.roundRect(-W * 0.16, 20, W * 0.32, H * 0.36, 48);
    ctx.fill();
    // Head
    ctx.fillStyle = '#E2E8F0';
    ctx.beginPath();
    ctx.arc(0, -H * 0.06 + gesture * 0.3, H * 0.1, 0, Math.PI * 2);
    ctx.fill();
    // Audio wave indicator badge on lapel
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(W * 0.05, H * 0.1, 10 + Math.abs(gesture), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    return;
  }

  if (scene === 'roastery_vertical_reel') {
    const bg = ctx.createLinearGradient(0, top, 0, top + H);
    bg.addColorStop(0, '#27170E');
    bg.addColorStop(0.5, '#451A03');
    bg.addColorStop(1, '#1C1917');
    ctx.fillStyle = bg;
    ctx.fillRect(left, top, W, H);

    // Espresso cup & latte art swirl
    const r = Math.min(W, H) * 0.28;
    ctx.fillStyle = '#F5F5F4';
    ctx.beginPath();
    ctx.arc(0, 0, r + 14, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#78350F';
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();

    // Animated Rosetta crema pour
    ctx.strokeStyle = '#FEF3C7';
    ctx.lineWidth = 6;
    ctx.beginPath();
    for (let a = 0; a < Math.PI * 4; a += 0.15) {
      const rad = (a / (Math.PI * 4)) * (r * 0.75);
      const px = Math.cos(a + t * 2.2) * rad;
      const py = Math.sin(a + t * 2.2) * rad;
      if (a === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    return;
  }

  if (scene === 'bg_gradient_aurora' || scene === 'intro_neon_kinetic' || scene === 'outro_minimal_subscribe') {
    const grad = ctx.createLinearGradient(left, top, left + W, top + H);
    grad.addColorStop(0, '#0F172A');
    grad.addColorStop(0.5, '#0369A1');
    grad.addColorStop(1, '#1E1B4B');
    ctx.fillStyle = grad;
    ctx.fillRect(left, top, W, H);

    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 2;
    const radius = Math.min(W, H) * (0.25 + Math.sin(t * 2) * 0.04);
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.stroke();
    return;
  }

  if (scene === 'bg_cinematic_grid') {
    ctx.fillStyle = '#090D16';
    ctx.fillRect(left, top, W, H);
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.2)';
    ctx.lineWidth = 1;
    const step = 48;
    const shift = (t * 24) % step;
    for (let x = left + shift; x < left + W; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x, top + H);
      ctx.stroke();
    }
    for (let y = top + shift; y < top + H; y += step) {
      ctx.beginPath();
      ctx.moveTo(left, y);
      ctx.lineTo(left + W, y);
      ctx.stroke();
    }
    return;
  }

  if (scene === 'shape_callout_frame' || scene === 'sticker_rec_indicator' || scene === 'sticker_4k_badge') {
    const boxW = Math.min(W, H) * 0.36;
    const boxH = boxW * 0.6;
    ctx.strokeStyle = scene === 'sticker_rec_indicator' ? '#EF4444' : '#38BDF8';
    ctx.lineWidth = 4;
    ctx.strokeRect(-boxW / 2, -boxH / 2, boxW, boxH);
    ctx.fillStyle = '#F8FAFC';
    ctx.font = '600 22px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(
      scene === 'sticker_rec_indicator' ? 'REC · 4K RAW' : scene === 'sticker_4k_badge' ? 'UHD 4K MASTER' : 'FOCUS TARGET',
      0,
      8
    );
  }
}

function renderTextClip(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  localTime: number,
  clip: TimelineClip
): void {
  const ts = clip.textStyle!;
  ctx.save();

  // Entrance / Exit animation transforms
  let animY = 0;
  let animScale = 1;
  let visibleChars = ts.text.length;

  if (localTime < 0.6 && ts.entranceAnim !== 'none') {
    const p = Math.min(1, localTime / 0.6);
    const ease = 1 - Math.pow(1 - p, 3);
    if (ts.entranceAnim === 'fade-up' || ts.entranceAnim === 'slide-lower-third') {
      animY = (1 - ease) * 42;
    } else if (ts.entranceAnim === 'pop-bounce') {
      animScale = 0.5 + ease * 0.5;
    } else if (ts.entranceAnim === 'typewriter') {
      visibleChars = Math.max(1, Math.floor(ts.text.length * p));
    }
  }

  ctx.translate(0, animY);
  ctx.scale(animScale, animScale);

  const fontWeight = ts.bold ? '700' : '500';
  const fontStyle = ts.italic ? 'italic' : 'normal';
  const scaledFontSize = Math.max(14, Math.round((ts.fontSize / 1080) * H));
  ctx.font = `${fontStyle} ${fontWeight} ${scaledFontSize}px "${ts.fontFamily}", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const displayStr = ts.text.slice(0, visibleChars);
  const primaryMetrics = ctx.measureText(displayStr);

  const subSize = Math.max(10, Math.round(scaledFontSize * 0.44));
  let subWidth = 0;
  if (ts.subtext) {
    ctx.save();
    ctx.font = `500 ${subSize}px "DM Sans", sans-serif`;
    subWidth = ctx.measureText(ts.subtext).width;
    ctx.restore();
  }

  const contentW = Math.max(primaryMetrics.width, subWidth);
  const padX = Math.max(24, scaledFontSize * 0.8);
  const textW = Math.max(140, contentW + padX * 2);
  const textH = Math.max(40, scaledFontSize * (ts.subtext ? 2.45 : 1.65));

  if (ts.bgOpacity > 0) {
    ctx.save();
    ctx.fillStyle = ts.bgColor || '#0F172A';
    ctx.globalAlpha *= ts.bgOpacity / 100;
    ctx.beginPath();
    ctx.roundRect(-textW / 2, -textH / 2, textW, textH, 8);
    ctx.fill();
    ctx.restore();
  }

  if (ts.shadowBlur > 0) {
    ctx.shadowColor = ts.shadowColor || '#000000';
    ctx.shadowBlur = ts.shadowBlur;
    ctx.shadowOffsetY = 3;
  }

  const textY = ts.subtext ? -scaledFontSize * 0.32 : 0;
  if (ts.outlineWidth > 0) {
    ctx.strokeStyle = ts.outlineColor || '#000000';
    ctx.lineWidth = ts.outlineWidth;
    ctx.strokeText(displayStr, 0, textY);
  }

  ctx.fillStyle = ts.color || '#FFFFFF';
  ctx.fillText(displayStr, 0, textY);

  if (ts.subtext) {
    ctx.font = `600 ${subSize}px "DM Sans", sans-serif`;
    ctx.fillStyle = 'rgba(241, 245, 249, 0.92)';
    ctx.fillText(ts.subtext, 0, scaledFontSize * 0.48);
  }

  ctx.restore();
}
