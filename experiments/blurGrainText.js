// Global variable to persist overlay timer across reinitializations
let globalShowPaddingOverlayUntilMs = 0;

export function createBlurGrainExperiment() {
  const params = {
    baseTextSizeRatio: 0.28,
    lineHeight: 1.1,
    blurPx: 12,
    lensRadius: 140,
    lensExtraPx: 16,
    lensFeatherPx: 60,
    bleedStrength: 0.5,
    grainIntensity: 0.2,
    grainScale: 1.0,
    grainBlend: 'overlay',
    grainAnimated: true,
    trailEnabled: true,
    trailDuration: 0.9, // seconds
    trailIntensity: 0.6,
    trailWobble: 6.0,
    maskDecayPerSec: 1.4,
    brushElongation: 0.8,
    dragAmount: 0.6,
  };

  let pgText = null;   // sharp text
  let pgBlur = null;   // base blur
  let pgBlurStrong = null; // extra-strong blur for lens
  let pgOverlay = null; // overlay buffer for masked lens
  let pgMask = null; // persistent mask (alpha)
  let lastW = 0, lastH = 0;
  let trail = []; // [{x,y,t0}]
  let pgGrainTile = null; // small noise tile for film grain
  let grainTileKey = null; // cache key for static grain
  let pgBase = null; // base layer buffer (sharp or base blur, tinted)

  function ensureBuffers(p) {
    if (p.width !== lastW || p.height !== lastH || !pgText || !pgBlur || !pgBlurStrong || !pgOverlay || !pgMask || !pgBase) {
      lastW = p.width; lastH = p.height;
      pgText = p.createGraphics(p.width, p.height); pgText.pixelDensity(1);
      pgBlur = p.createGraphics(p.width, p.height); pgBlur.pixelDensity(1);
      pgBlurStrong = p.createGraphics(p.width, p.height); pgBlurStrong.pixelDensity(1);
      pgOverlay = p.createGraphics(p.width, p.height); pgOverlay.pixelDensity(1);
      pgMask = p.createGraphics(p.width, p.height); pgMask.pixelDensity(1); pgMask.clear();
      pgBase = p.createGraphics(p.width, p.height); pgBase.pixelDensity(1);
      trail = [];
      if (!pgGrainTile) {
        const s = 256;
        pgGrainTile = p.createGraphics(s, s);
        pgGrainTile.pixelDensity(1);
      }
    }
  }

  function drawTextToBuffer(p, ctx, g, sizeRatio, lineHeight) {
    g.clear();
    // Use global text positioning if provided, otherwise default to center-center
    const position = ctx.textPosition || 'center-center';
    
    // Set text alignment based on position
    if (position.includes('left')) {
      g.textAlign(g.LEFT, g.BASELINE);
    } else if (position.includes('right')) {
      g.textAlign(g.RIGHT, g.BASELINE);
    } else {
      g.textAlign(g.CENTER, g.BASELINE);
    }
    if (ctx.font) g.textFont(ctx.font);
    const baseTextSize = ctx.fontSize || Math.max(12, Math.min(g.width, g.height) * sizeRatio);
    g.textSize(baseTextSize);
    
    // Apply font weight if provided
    if (ctx.fontWeight) {
      g.textStyle(g.NORMAL);
      if (ctx.fontWeight >= 600) {
        g.textStyle(g.BOLD);
      }
    }
    g.noStroke(); g.fill(255);
    const textRaw = ctx.text && ctx.text.length > 0 ? ctx.text : 'TYPE';
    const lines = textRaw.split(/\r?\n/);

    // Layout with comprehensive padding
    const paddingTop = ctx.paddingTop !== undefined ? ctx.paddingTop : 20;
    const paddingBottom = ctx.paddingBottom !== undefined ? ctx.paddingBottom : 20;
    const paddingLeft = ctx.paddingLeft !== undefined ? ctx.paddingLeft : 20;
    const paddingRight = ctx.paddingRight !== undefined ? ctx.paddingRight : 20;
    
    const usableW = Math.max(0, g.width - paddingLeft - paddingRight);
    const usableH = Math.max(0, g.height - paddingTop - paddingBottom);
    const lineAdvance = baseTextSize * lineHeight;
    const totalHeight = lineAdvance * lines.length;
    
    // Calculate positioning based on text position
    let startY, centerX;
    
    // Calculate Y position based on vertical alignment
    if (position.includes('top')) {
      startY = paddingTop + lineAdvance;
    } else if (position.includes('bottom')) {
      startY = g.height - paddingBottom - (totalHeight - lineAdvance);
    } else {
      startY = (g.height - totalHeight) / 2 + lineAdvance;
    }
    
    // Calculate X position based on horizontal alignment
    if (position.includes('left')) {
      centerX = paddingLeft; // Left edge with padding
    } else if (position.includes('right')) {
      centerX = g.width - paddingRight; // Right edge with padding
    } else {
      centerX = g.width / 2; // Center
    }
    for (let li = 0; li < lines.length; li++) {
      const txt = lines[li];
      const y = startY + li * lineAdvance;
      const tw = Math.max(1, g.textWidth(txt));
      const scaleX = Math.min(1, usableW / tw);
      g.push(); g.translate(centerX, y); if (scaleX !== 1) g.scale(scaleX, 1); g.text(txt, 0, 0); g.pop();
    }
  }

  function applyBlurTo(dst, amountPx, src) {
    dst.clear();
    const ctx2 = dst.drawingContext; const prevFilter = ctx2.filter;
    ctx2.filter = amountPx > 0 ? `blur(${Math.max(0, amountPx).toFixed(1)}px)` : 'none';
    dst.image(src, 0, 0);
    ctx2.filter = prevFilter;
  }

  function setBlend(p, mode) {
    const m = String(mode || 'overlay').toLowerCase();
    if (m === 'multiply') p.blendMode(p.MULTIPLY);
    else if (m === 'screen') p.blendMode(p.SCREEN);
    else if (m === 'overlay') p.blendMode(p.OVERLAY);
    else p.blendMode(p.BLEND);
  }

  function drawGrain(p, intensity, scale, blend) {
    if (intensity <= 0.0001) return;
    const animated = !!params.grainAnimated;
    const t = p.millis() * 0.001;
    const tile = pgGrainTile;
    const a = p.constrain(intensity, 0, 1);
    const alpha = Math.floor(p.constrain(16 + a * 160, 8, 180));
    // Populate tile: per-frame if animated; otherwise only when key changes
    const key = animated ? null : `${alpha}|${Math.round(scale * 100)}|${blend}`;
    if (animated || grainTileKey !== key) {
      tile.loadPixels();
      const arr = tile.pixels;
      // Center around 127 (neutral for overlay/soft-light) to avoid overall cast
      const amp = Math.floor(20 + a * 80); // luminance swing
      for (let i = 0; i < arr.length; i += 4) {
        const v = Math.max(0, Math.min(255, 127 + Math.floor(p.random(-amp, amp))));
        arr[i] = v; arr[i + 1] = v; arr[i + 2] = v; arr[i + 3] = alpha;
      }
      tile.updatePixels();
      grainTileKey = key;
    }

    // Choose pixel scale from grainScale (smaller scale -> finer grain)
    const sNorm = p.constrain((scale - 0.25) / (3.0 - 0.25), 0, 1);
    const pixScale = p.lerp(0.8, 2.2, sNorm);

    p.push();
    setBlend(p, blend);
    // Random offset per frame to avoid static tiling (only when animated)
    const offX = animated ? Math.floor((t * 37) % tile.width) : 0;
    const offY = animated ? Math.floor((t * 23) % tile.height) : 0;
    const drawW = tile.width * pixScale;
    const drawH = tile.height * pixScale;
    for (let y = -drawH; y < p.height + drawH; y += drawH) {
      for (let x = -drawW; x < p.width + drawW; x += drawW) {
        p.image(tile, x + offX, y + offY, drawW, drawH);
      }
    }
    p.pop();
    p.blendMode(p.BLEND);
  }

  return {
    name: 'Blur & Grain',

    getControlDefinitions() {
      return [
        { id: 'textHeading', type: 'heading', label: 'Text' },
        { id: 'baseTextSizeRatio', type: 'range', label: 'Text size', min: 0.12, max: 0.6, step: 0.01, default: 0.28 },
        { id: 'lineHeight', type: 'range', label: 'Line height', min: 0.8, max: 2.0, step: 0.05, default: 1.1 },

        { id: 'blurHeading', type: 'heading', label: 'Blur' },
        { id: 'blurPx', type: 'range', label: 'Base blur', min: 0, max: 32, step: 0.5, default: 12 },
        { id: 'lensRadius', type: 'range', label: 'Lens radius', min: 30, max: 380, step: 2, default: 140 },
        { id: 'lensFeatherPx', type: 'range', label: 'Lens feather', min: 0, max: 200, step: 2, default: 60 },
        { id: 'lensExtraPx', type: 'range', label: 'Lens extra blur', min: 0, max: 64, step: 1, default: 16 },
        { id: 'bleedStrength', type: 'range', label: 'Bleed strength', min: 0.0, max: 1.0, step: 0.02, default: 0.5 },

        { id: 'trailHeading', type: 'heading', label: 'Trail' },
        { id: 'trailEnabled', type: 'checkbox', label: 'Enable trail', default: true },
        { id: 'trailDuration', type: 'range', label: 'Duration', min: 0.1, max: 2.0, step: 0.05, default: 0.9 },
        { id: 'trailIntensity', type: 'range', label: 'Intensity', min: 0.0, max: 1.0, step: 0.02, default: 0.6 },
        { id: 'trailWobble', type: 'range', label: 'Wobble', min: 0, max: 12, step: 0.5, default: 6.0 },
        { id: 'maskDecayPerSec', type: 'range', label: 'Decay', min: 0.2, max: 4.0, step: 0.05, default: 1.4 },
        { id: 'brushElongation', type: 'range', label: 'Elongation', min: 0.0, max: 2.0, step: 0.05, default: 0.8 },
        { id: 'dragAmount', type: 'range', label: 'Drag amount', min: 0.0, max: 2.0, step: 0.05, default: 0.6 },

        { id: 'grainHeading', type: 'heading', label: 'Grain' },
        { id: 'grainIntensity', type: 'range', label: 'Intensity', min: 0.0, max: 0.6, step: 0.01, default: 0.2 },
        { id: 'grainScale', type: 'range', label: 'Scale', min: 0.25, max: 3.0, step: 0.05, default: 1.0 },
        { id: 'grainBlend', type: 'select', label: 'Blend', options: [
          { label: 'Overlay', value: 'overlay' },
          { label: 'Multiply', value: 'multiply' },
          { label: 'Screen', value: 'screen' },
          { label: 'Normal', value: 'normal' },
        ], default: 'overlay' },
        { id: 'grainAnimated', type: 'checkbox', label: 'Animated', default: true },
      ];
    },

    getParams() { return { ...params }; },

    setParams(next) { Object.assign(params, next); },

    showPaddingOverlay() {
      // Show overlay for ~600ms when global side padding changes
      console.log('Blur & Grain: Setting padding overlay timer');
      globalShowPaddingOverlayUntilMs = performance.now() + 600;
    },

    init(p, ctx) { ensureBuffers(p); },

    draw(p, ctx) {
      ensureBuffers(p);

      const nowMs = p.millis();
      const dt = Math.max(0.001, p.deltaTime / 1000);

      // Effective values via cursor bindings
      const isBound = (id) => Array.isArray(ctx.boundIds) && ctx.boundIds.includes(id);
      const normFromAxis = (id, fallbackAxis) => {
        const mx = p.constrain(p.mouseX / p.width, 0, 1);
        const my = p.constrain(p.mouseY / p.height, 0, 1);
        const axis = ctx.getAxis ? ctx.getAxis(id) : (fallbackAxis || 'x');
        const inv = ctx.getInvert ? ctx.getInvert(id) : false;
        let t = axis === 'y' ? (1 - my) : mx; if (inv) t = 1 - t; return Math.max(0, Math.min(1, t));
      };

      const effSizeRatio = isBound('baseTextSizeRatio') ? p.lerp(0.12, 0.6, normFromAxis('baseTextSizeRatio', 'y')) : params.baseTextSizeRatio;
      const effLineHeight = isBound('lineHeight') ? p.lerp(0.8, 2.0, normFromAxis('lineHeight', 'y')) : (ctx.lineHeight || params.lineHeight);
      const effBlurPx = isBound('blurPx') ? p.lerp(0, 32, normFromAxis('blurPx', 'y')) : params.blurPx;
      const effLensRadius = isBound('lensRadius') ? p.lerp(30, 380, normFromAxis('lensRadius', 'y')) : params.lensRadius;
      const effLensFeather = isBound('lensFeatherPx') ? p.lerp(0, 200, normFromAxis('lensFeatherPx', 'y')) : params.lensFeatherPx;
      const effLensExtra = isBound('lensExtraPx') ? p.lerp(0, 64, normFromAxis('lensExtraPx', 'y')) : params.lensExtraPx;
      const effBleed = isBound('bleedStrength') ? p.lerp(0, 1, normFromAxis('bleedStrength', 'x')) : params.bleedStrength;
      const effTrailEnabled = params.trailEnabled;
      const effTrailDuration = params.trailDuration;
      const effTrailIntensity = params.trailIntensity;
      const effTrailWobble = params.trailWobble;
      const effMaskDecay = params.maskDecayPerSec;
      const effElong = params.brushElongation;
      const effDrag = params.dragAmount;

      // Render text and blur variants
      drawTextToBuffer(p, ctx, pgText, effSizeRatio, effLineHeight);
      applyBlurTo(pgBlur, effBlurPx, pgText);
      applyBlurTo(pgBlurStrong, Math.max(0, effBlurPx + effLensExtra), pgText);

      const baseImg = (effBlurPx > 0.5 ? pgBlur : pgText);
      const typeCol = ctx.typeColor || '#111';
      // Prepare base buffer (tinted), we will punch it with the mask, then draw to main
      pgBase.clear();
      pgBase.push(); pgBase.tint(typeCol); pgBase.image(baseImg, 0, 0); pgBase.noTint(); pgBase.pop();

      // Decay mask
      const mctxFade = pgMask.drawingContext;
      mctxFade.save();
      mctxFade.globalCompositeOperation = 'destination-out';
      mctxFade.globalAlpha = Math.min(0.9, Math.max(0, effMaskDecay * dt));
      mctxFade.fillStyle = 'rgba(255,255,255,1)';
      mctxFade.fillRect(0, 0, pgMask.width, pgMask.height);
      mctxFade.restore();

      // Trail update
      const useLens = ctx.isPointerOverCanvas;
      if (useLens && effTrailEnabled) {
        if (trail.length === 0) trail.push({ x: p.mouseX, y: p.mouseY, t0: nowMs * 0.001 });
        const last = trail[trail.length - 1];
        const dx = p.mouseX - last.x, dy = p.mouseY - last.y;
        const dist = Math.hypot(dx, dy);
        if (dist > Math.max(6, effLensRadius * 0.15) || ((nowMs * 0.001) - last.t0) > 0.05) {
          trail.push({ x: p.mouseX, y: p.mouseY, t0: nowMs * 0.001 });
          if (trail.length > 24) trail.shift();
        }
      }
      if (trail.length > 0) {
        trail = trail.filter(n => ((nowMs * 0.001) - n.t0) < Math.max(0.1, effTrailDuration));
      }

      // Helper to stamp into mask with elongated/irregular brush
      const stampIntoMask = (cx, cy, strength, vx, vy, jitterSeed) => {
        const mctx = pgMask.drawingContext;
        const r = Math.max(1, effLensRadius);
        const feather = Math.max(0, Math.min(r - 0.001, effLensFeather));
        const vmag = Math.hypot(vx, vy);
        const speed = Math.min(1.0, vmag / Math.max(1, r));
        const ang = (vmag > 0.001) ? Math.atan2(vy, vx) : 0;
        const sx = 1 + effElong * (0.3 + 0.7 * speed); // elongation grows with speed
        const drag = effDrag * r * (0.2 + 0.8 * speed); // offset amount
        // Base elliptical soft stamp (offset backward along motion)
        mctx.save();
        mctx.translate(cx, cy);
        mctx.rotate(ang);
        mctx.scale(sx, 1);
        const inner = Math.max(0, r - feather);
        const grad = mctx.createRadialGradient(-drag, 0, Math.max(0, inner * 0.9), 0, 0, r);
        grad.addColorStop(0, 'rgba(255,255,255,1)');
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        mctx.globalCompositeOperation = 'source-over';
        mctx.globalAlpha = Math.max(0, Math.min(1, strength));
        mctx.fillStyle = grad;
        mctx.beginPath(); mctx.arc(0, 0, r, 0, Math.PI * 2); mctx.closePath(); mctx.fill();
        // Directional edge irregularity: biased behind the motion
        const count = 12;
        const spread = Math.PI * 1.2; // spread around the back
        for (let i = 0; i < count; i++) {
          const u = (i + 0.5) / count;
          const aLocal = Math.PI + (u - 0.5) * spread + (p.noise(jitterSeed + i * 0.41, nowMs * 0.0006) - 0.5) * 0.6;
          const baseRR = r * (0.6 + 0.35 * p.noise(jitterSeed + i * 0.17, nowMs * 0.0008));
          const ex = baseRR * Math.cos(aLocal) - drag * 0.5;
          const ey = baseRR * Math.sin(aLocal);
          const rr = Math.max(2, baseRR * 0.6);
          const g2 = mctx.createRadialGradient(ex, ey, Math.max(0, rr - feather * 0.5), ex, ey, rr);
          g2.addColorStop(0, 'rgba(255,255,255,0.5)');
          g2.addColorStop(1, 'rgba(255,255,255,0)');
          mctx.fillStyle = g2;
          mctx.beginPath(); mctx.arc(ex, ey, rr, 0, Math.PI * 2); mctx.closePath(); mctx.fill();
        }
        mctx.restore();
      };

      // Paint current lens and trail nodes into mask
      const vx = (p.mouseX - p.pmouseX) || 0;
      const vy = (p.mouseY - p.pmouseY) || 0;
      if (useLens) stampIntoMask(p.mouseX, p.mouseY, 1.0, vx, vy, 11.3);
      if (effTrailEnabled && trail.length > 0) {
        for (let i = 0; i < trail.length; i++) {
          const n = trail[i];
          const life = 1 - (((nowMs * 0.001) - n.t0) / Math.max(0.001, effTrailDuration));
          if (life <= 0) continue;
          const t = Math.pow(Math.max(0, Math.min(1, life)), 1.4);
          const w = effTrailWobble;
          const ox = (p.noise(17 + i * 0.23, nowMs * 0.0007) - 0.5) * 2 * w;
          const oy = (p.noise(93 + i * 0.31, nowMs * 0.0007) - 0.5) * 2 * w;
          // direction towards current cursor for drag
          const dvx = p.mouseX - n.x;
          const dvy = p.mouseY - n.y;
          stampIntoMask(n.x + ox, n.y + oy, effTrailIntensity * t, dvx, dvy, 37.7 + i * 0.13);
        }
      }

      // Compose using mask: punch base, then draw blurred/inside overlay masked
      const insideImg = pgBlurStrong;

      // Punch base buffer with mask (do not punch main canvas)
      const baseCtx = pgBase.drawingContext;
      baseCtx.save();
      baseCtx.globalCompositeOperation = 'destination-out';
      baseCtx.globalAlpha = 1.0;
      baseCtx.drawImage(pgMask.elt, 0, 0);
      baseCtx.restore();
      // Draw punched base to main
      p.image(pgBase, 0, 0);

      // Build overlay = insideImg masked by mask
      pgOverlay.clear();
      pgOverlay.image(insideImg, 0, 0);
      const octx = pgOverlay.drawingContext;
      octx.save(); octx.globalCompositeOperation = 'destination-in';
      octx.drawImage(pgMask.elt, 0, 0);
      octx.restore();

      // Draw overlay tinted
      p.push(); p.tint(typeCol); p.image(pgOverlay, 0, 0); p.noTint(); p.pop();

      // Grain overlay
      drawGrain(p, params.grainIntensity, params.grainScale, params.grainBlend);

      // Transient padding overlay (comprehensive)
      const currentTime = performance.now();
      if (currentTime < globalShowPaddingOverlayUntilMs) {
        p.push();
        p.noFill();
        
        // Red padding boundary lines
        p.stroke(255, 59, 48, 200); // red with slight transparency
        p.strokeWeight(1.25);
        const ctx2d = p.drawingContext;
        
        // Get padding values from context
        const paddingTop = ctx.paddingTop !== undefined ? ctx.paddingTop : 20;
        const paddingBottom = ctx.paddingBottom !== undefined ? ctx.paddingBottom : 20;
        const paddingLeft = ctx.paddingLeft !== undefined ? ctx.paddingLeft : 20;
        const paddingRight = ctx.paddingRight !== undefined ? ctx.paddingRight : 20;
        
        // Calculate padding boundaries with bounds checking
        const x1 = Math.max(0, paddingLeft);
        const x2 = Math.min(p.width, p.width - paddingRight);
        const y1 = Math.max(0, paddingTop);
        const y2 = Math.min(p.height, p.height - paddingBottom);
        
        // Set up dotted line style
        const prevDash = ctx2d.getLineDash();
        const prevCap = ctx2d.lineCap;
        ctx2d.setLineDash([3, 6]);
        ctx2d.lineCap = 'butt';
        
        // Draw all four padding boundaries
        p.line(x1, y1, x2, y1); // Top line
        p.line(x1, y2, x2, y2); // Bottom line
        p.line(x1, y1, x1, y2); // Left line
        p.line(x2, y1, x2, y2); // Right line
        
        // Reset dash style
        ctx2d.setLineDash(prevDash);
        ctx2d.lineCap = prevCap;

        p.pop();
      }
    },

    onResize(p) { ensureBuffers(p); },
  };
} 