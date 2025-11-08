// Global variable to persist overlay timer across reinitializations
let globalShowPaddingOverlayUntilMs = 0;

export function createHalftoneExperiment() {
  const params = {
    // Typography & layout
    baseTextSizeRatio: 0.24,
    lineHeight: 1.15,

    // Halftone pattern
    dotSpacing: 12,    // grid step in px (canvas space)
    dotScale: 1.0,     // scales dot size relative to spacing
    angleDeg: 0,       // rotation of dot grid
    contrast: 1.0, // gamma-like exponent on brightness (>=0.5 .. 2.5)
    threshold: 0.10, // skip dots below this brightness (0..1)
    shape: "circle", // "circle" | "square"
    invert: false, // invert brightness mapping
    jitter: 0.0, // positional jitter in px
    jitterSpeed: 1.0, // time speed for jitter noise
    preset: "none", // "none" | "gravity" | "orbit" | "ripple"
    gravityPushStrength: 1.0, // strength of gravity push effect (0..3)
    orbitTwistStrength: 1.0, // strength of orbit twist effect (0..3)
    rippleStrength: 1.0, // strength of ripple effect (0..3)
  };

  let pg = null; // offscreen buffer for text brightness sampling
  let lastCacheKey = null; // for caching text mask

  function ensureBuffer(p) {
    // Use reasonable buffer size that matches canvas but prevents memory issues
    const maxWidth = Math.min(p.width, 800);
    const maxHeight = Math.min(p.height, 600);
    
    if (!pg || pg.width !== maxWidth || pg.height !== maxHeight) {
      pg = p.createGraphics(maxWidth, maxHeight);
      pg.pixelDensity(1); // faster for sampling
      console.log(`Halftone: Created buffer ${maxWidth}x${maxHeight} for canvas ${p.width}x${p.height}`);
    }
  }

  function drawTextMask(p, ctx, effBaseTextSizeRatio, effLineHeight) {
    // Create cache key for text mask
    const cacheKey = `${ctx.text}_${ctx.fontSize}_${ctx.fontWeight}_${ctx.textPosition}_${effBaseTextSizeRatio}_${effLineHeight}_${p.width}_${p.height}`;
    
    // Only redraw if parameters have changed
    if (lastCacheKey === cacheKey) {
      return; // Use cached version
    }
    
    pg.clear();
    pg.background(0);
    pg.fill(255);
    pg.noStroke();
    
    console.log(`Halftone: Drawing text mask on buffer ${pg.width}x${pg.height}`);
    // Use global text positioning if provided, otherwise default to center-center
    const position = ctx.textPosition || 'center-center';
    
    // Set text alignment based on position
    if (position.includes('left')) {
      pg.textAlign(pg.LEFT, pg.CENTER);
    } else if (position.includes('right')) {
      pg.textAlign(pg.RIGHT, pg.CENTER);
    } else {
      pg.textAlign(pg.CENTER, pg.CENTER);
    }
    if (ctx.font) pg.textFont(ctx.font);

    const baseTextSize = ctx.fontSize || Math.max(16, Math.min(pg.width, pg.height) * effBaseTextSizeRatio);
    pg.textSize(baseTextSize);
    
    // Apply font weight if provided
    if (ctx.fontWeight) {
      pg.textStyle(pg.NORMAL);
      if (ctx.fontWeight >= 600) {
        pg.textStyle(pg.BOLD);
      }
    }

    const textRaw = ctx.text && ctx.text.length > 0 ? ctx.text : "TYPE";
    const lines = textRaw.split(/\r?\n/);

    // Layout with comprehensive padding
    const paddingTop = ctx.paddingTop !== undefined ? ctx.paddingTop : 20;
    const paddingBottom = ctx.paddingBottom !== undefined ? ctx.paddingBottom : 20;
    const paddingLeft = ctx.paddingLeft !== undefined ? ctx.paddingLeft : 20;
    const paddingRight = ctx.paddingRight !== undefined ? ctx.paddingRight : 20;
    
    const usableW = Math.max(0, pg.width - paddingLeft - paddingRight);
    const usableH = Math.max(0, pg.height - paddingTop - paddingBottom);
    const lineAdvance = baseTextSize * effLineHeight;

    const totalHeight = lineAdvance * lines.length;
    
    // Calculate positioning based on text position
    let startY, centerX;
    
    // Calculate Y position based on vertical alignment
    if (position.includes('top')) {
      startY = paddingTop + lineAdvance / 2;
    } else if (position.includes('bottom')) {
      startY = pg.height - paddingBottom - (totalHeight - lineAdvance / 2);
    } else {
      startY = (pg.height - totalHeight) / 2 + lineAdvance / 2;
    }
    
    // Calculate X position based on horizontal alignment
    if (position.includes('left')) {
      centerX = paddingLeft;
    } else if (position.includes('right')) {
      centerX = pg.width - paddingRight;
    } else {
      centerX = pg.width / 2;
    }

    for (let li = 0; li < lines.length; li++) {
      const txt = lines[li];
      const y = startY + li * lineAdvance;
      const tw = Math.max(1, pg.textWidth(txt));
      const scaleX = Math.min(1, usableW / tw);
      pg.push();
      pg.translate(centerX, y);
      if (scaleX !== 1) pg.scale(scaleX, 1);
      pg.text(txt, 0, 0);
      pg.pop();
    }

    // Prepare pixel data for sampling with error handling
    try {
      pg.loadPixels();
    } catch (error) {
      console.warn('Halftone: loadPixels failed, using fallback:', error);
      // Create a much smaller buffer as fallback
      const fallbackSize = Math.min(pg.width, 200);
      const fallbackHeight = Math.min(pg.height, 200);
      
      try {
        const fallbackPg = p.createGraphics(fallbackSize, fallbackHeight);
        fallbackPg.pixelDensity(1);
        fallbackPg.clear();
        fallbackPg.textAlign(fallbackPg.CENTER, fallbackPg.BASELINE);
        if (ctx.font) fallbackPg.textFont(ctx.font);
        fallbackPg.textSize(Math.min(baseTextSize, 24));
        fallbackPg.noStroke();
        fallbackPg.fill(255);
        fallbackPg.text(textRaw, fallbackSize / 2, fallbackHeight / 2);
        fallbackPg.loadPixels();
        pg = fallbackPg;
      } catch (fallbackError) {
        console.warn('Halftone: Fallback buffer also failed, disabling halftone:', fallbackError);
        // Create a minimal buffer that won't cause memory issues
        pg = p.createGraphics(100, 100);
        pg.pixelDensity(1);
        pg.clear();
        pg.fill(255);
        pg.rect(0, 0, 100, 100);
        pg.loadPixels();
      }
    }
    
    // Update cache key
    lastCacheKey = cacheKey;
  }

  function sampleBrightnessAt(x, y, contrastValue, invertValue) {
    const xi = x | 0; const yi = y | 0;
    if (xi < 0 || yi < 0 || xi >= pg.width || yi >= pg.height) return 0;
    const idx = 4 * (yi * pg.width + xi);
    const r = pg.pixels[idx];
    let n = r / 255;
    if (invertValue) n = 1 - n;
    n = Math.pow(Math.max(0, Math.min(1, n)), contrastValue);
    return n;
  }

  return {
    name: "Halftone",
    prefersInternalMouseBinding: true,

    getControlDefinitions() {
      return [
        { id: "preset", type: "select", label: "Preset", options: [
          { label: "None", value: "none" },
          { label: "Gravity Push", value: "gravity" },
          { label: "Orbit Twist", value: "orbit" },
          { label: "Ripple", value: "ripple" },
        ], default: "none" },

        { id: "baseTextSizeRatio", type: "range", label: "Text size", min: 0.12, max: 0.5, step: 0.01, default: 0.24 },
        { id: "lineHeight", type: "range", label: "Line height", min: 0.8, max: 2.0, step: 0.05, default: 1.15 },

        { id: "dotSpacing", type: "range", label: "Spacing", min: 4, max: 40, step: 1, default: 12 },
        { id: "dotScale", type: "range", label: "Scale", min: 0.2, max: 2.0, step: 0.05, default: 1.0 },
        { id: "angleDeg", type: "range", label: "Angle", min: -60, max: 60, step: 1, default: 0 },
        { id: "contrast", type: "range", label: "Contrast", min: 0.1, max: 6.0, step: 0.05, default: 1.0 },
        { id: "threshold", type: "range", label: "Threshold", min: 0.0, max: 1.0, step: 0.01, default: 0.10 },
        { id: "shape", type: "select", label: "Shape", options: [
          { label: "Circle", value: "circle" },
          { label: "Square", value: "square" },
        ], default: "circle" },
        { id: "invert", type: "checkbox", label: "Invert", default: false },
        { id: "jitter", type: "range", label: "Jitter", min: 0.0, max: 6.0, step: 0.1, default: 0.0 },
        { id: "jitterSpeed", type: "range", label: "Jitter speed", min: 0.2, max: 3.0, step: 0.1, default: 1.0 },
        { id: "gravityPushStrength", type: "range", label: "Push strength", min: 0.0, max: 3.0, step: 0.1, default: 1.0 },
        { id: "orbitTwistStrength", type: "range", label: "Orbit strength", min: 0.0, max: 3.0, step: 0.1, default: 1.0 },
        { id: "rippleStrength", type: "range", label: "Ripple strength", min: 0.0, max: 3.0, step: 0.1, default: 1.0 },
      ];
    },

    getParams() { return { ...params }; },

    setParams(next) {
      Object.assign(params, next);
    },

    showPaddingOverlay() {
      // Show overlay for ~600ms when global side padding changes
      console.log('Halftone: Setting padding overlay timer');
      globalShowPaddingOverlayUntilMs = performance.now() + 600;
    },

    init(p, ctx) {
      p.noStroke();
      p.rectMode(p.CENTER);
      ensureBuffer(p);
    },

    draw(p, ctx) {
      ensureBuffer(p);

      // Build effective values from cursor bindings (do not mutate params)
      const isBound = (id) => Array.isArray(ctx.boundIds) && ctx.boundIds.includes(id);
      const normFromAxis = (id, fallbackAxis) => {
        const mx = p.constrain(p.mouseX / p.width, 0, 1);
        const my = p.constrain(p.mouseY / p.height, 0, 1);
        const axis = ctx.getAxis ? ctx.getAxis(id) : (fallbackAxis || 'x');
        const inv = ctx.getInvert ? ctx.getInvert(id) : false;
        let t = axis === 'y' ? (1 - my) : mx;
        if (inv) t = 1 - t;
        return Math.max(0, Math.min(1, t));
      };

      const effBaseTextSizeRatio = isBound('baseTextSizeRatio')
        ? p.lerp(0.12, 0.5, normFromAxis('baseTextSizeRatio', 'y'))
        : params.baseTextSizeRatio;
      const effLineHeight = isBound('lineHeight')
        ? p.lerp(0.8, 2.0, normFromAxis('lineHeight', 'y'))
        : (ctx.lineHeight || params.lineHeight);
      const effDotSpacing = isBound('dotSpacing')
        ? p.lerp(4, 40, normFromAxis('dotSpacing', 'x'))
        : params.dotSpacing;
      const effContrast = isBound('contrast')
        ? p.lerp(0.1, 6.0, normFromAxis('contrast', 'x'))
        : params.contrast;
      const effThreshold = isBound('threshold')
        ? p.lerp(0.0, 1.0, normFromAxis('threshold', 'x'))
        : params.threshold;
      const effDotScale = isBound('dotScale')
        ? p.lerp(0.3, 2.0, normFromAxis('dotScale', 'y'))
        : params.dotScale;
      const effAngleDeg = isBound('angleDeg')
        ? p.lerp(-60, 60, normFromAxis('angleDeg', 'x'))
        : params.angleDeg;
      const effJitter = isBound('jitter')
        ? p.lerp(0.0, 6.0, normFromAxis('jitter', 'y'))
        : params.jitter;
      const effJitterSpeed = isBound('jitterSpeed')
        ? p.lerp(0.2, 3.0, normFromAxis('jitterSpeed', 'x'))
        : params.jitterSpeed;
      const effGravityPushStrength = isBound('gravityPushStrength')
        ? p.lerp(0.0, 3.0, normFromAxis('gravityPushStrength', 'x'))
        : params.gravityPushStrength;
      const effOrbitTwistStrength = isBound('orbitTwistStrength')
        ? p.lerp(0.0, 3.0, normFromAxis('orbitTwistStrength', 'x'))
        : params.orbitTwistStrength;
      const effRippleStrength = isBound('rippleStrength')
        ? p.lerp(0.0, 3.0, normFromAxis('rippleStrength', 'x'))
        : params.rippleStrength;

      drawTextMask(p, ctx, effBaseTextSizeRatio, effLineHeight);

      // Global effective values
      let angleDeg = effAngleDeg;
      let dotScale = effDotScale;

      // Preset behaviors (do not reset angle so it remains functional)
      const preset = params.preset || 'none';
      
      // Debug preset and mouse state (only log once per frame)
      if (preset !== 'none' && Math.random() < 0.01) {
        console.log(`Halftone preset: ${preset}, isPointerOverCanvas: ${ctx.isPointerOverCanvas}`);
      }

      const step = Math.max(2, effDotSpacing);
      const cx = p.width / 2, cy = p.height / 2;
      const rad = (angleDeg * Math.PI) / 180;
      const cosA = Math.cos(rad), sinA = Math.sin(rad);
      const halfDiag = 0.5 * Math.hypot(p.width, p.height);

      const jitterAmt = effJitter;
      const t = (p.millis() / 1000) * effJitterSpeed;

      p.fill(ctx.typeColor);
      p.noStroke();

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

      for (let yR = -halfDiag; yR <= halfDiag; yR += step) {
        for (let xR = -halfDiag; xR <= halfDiag; xR += step) {
          const sx = cx + cosA * xR - sinA * yR;
          const sy = cy + sinA * xR + cosA * yR;
          if (sx < 0 || sy < 0 || sx >= p.width || sy >= p.height) continue;

          // Scale coordinates to match buffer size
          const scaleX = pg.width / p.width;
          const scaleY = pg.height / p.height;
          const b = sampleBrightnessAt(sx * scaleX, sy * scaleY, effContrast, params.invert);
          
          // Debug first few samples
          if (xR === -halfDiag && yR === -halfDiag) {
            console.log(`Halftone: Canvas ${p.width}x${p.height}, Buffer ${pg.width}x${pg.height}, Scale ${scaleX.toFixed(2)}x${scaleY.toFixed(2)}`);
          }
          if (b < effThreshold) continue;

          let size = Math.max(0, dotScale * step * b);
          if (size <= 0.3) continue;

          let ox = 0, oy = 0;
          if (jitterAmt > 0) {
            const nx = p.noise(sx * 0.02, sy * 0.02, t);
            const ny = p.noise(sx * 0.02 + 1000, sy * 0.02 - 500, t);
            ox = (nx - 0.5) * 2 * jitterAmt;
            oy = (ny - 0.5) * 2 * jitterAmt;
          }

          // Apply preset transforms
          if (preset === 'gravity') {
            // Use mouse position if over canvas, otherwise use center
            const mouseX = ctx.isPointerOverCanvas ? p.mouseX : p.width / 2;
            const mouseY = ctx.isPointerOverCanvas ? p.mouseY : p.height / 2;
            const dx = sx - mouseX; const dy = sy - mouseY;
            const dist = Math.hypot(dx, dy) + 0.0001;
            const force = Math.min(1.0, 180 / dist); // push strength near cursor
            const pushMultiplier = effGravityPushStrength;
            // Apply both displacement and scaling
            ox += (dx / dist) * force * step * 2.0 * pushMultiplier;
            oy += (dy / dist) * force * step * 2.0 * pushMultiplier;
            size = Math.max(0.2, size * (1 - force * 0.3 * pushMultiplier));
          } else if (preset === 'orbit') {
            // Use mouse position if over canvas, otherwise use center
            const mouseX = ctx.isPointerOverCanvas ? p.mouseX : p.width / 2;
            const mouseY = ctx.isPointerOverCanvas ? p.mouseY : p.height / 2;
            const dx = sx - mouseX; const dy = sy - mouseY;
            const theta = Math.atan2(dy, dx) + Math.sin(t + (sx + sy) * 0.01) * 0.6;
            const r = Math.hypot(dx, dy);
            const orbitMultiplier = effOrbitTwistStrength;
            ox += Math.cos(theta) * Math.min(24, r * 0.05) * orbitMultiplier;
            oy += Math.sin(theta) * Math.min(24, r * 0.05) * orbitMultiplier;
          } else if (preset === 'ripple') {
            // Use mouse position if over canvas, otherwise use center
            const mouseX = ctx.isPointerOverCanvas ? p.mouseX : p.width / 2;
            const mouseY = ctx.isPointerOverCanvas ? p.mouseY : p.height / 2;
            const dx = sx - mouseX; const dy = sy - mouseY;
            const d = Math.hypot(dx, dy);
            const wave = Math.sin(d * 0.12 - t * 3.0) * 0.5 + 0.5;
            const rippleMultiplier = effRippleStrength;
            const sizeEffect = (0.5 + wave * rippleMultiplier);
            size = Math.max(0.2, size * sizeEffect);
          }

          if (params.shape === "square") {
            p.push();
            p.translate(sx + ox, sy + oy);
            p.rotate((angleDeg * Math.PI) / 180);
            p.rect(0, 0, size, size, 2);
            p.pop();
          } else {
            p.circle(sx + ox, sy + oy, size);
          }
        }
      }
    },

    getHudLabels() { return { primary: 'Size', secondary: 'Angle' }; },
    getHudValues(p, ctx) {
      // Map current mouse-derived targets to 0..1 for meters
      let mx = p.constrain(p.mouseX / p.width, 0, 1);
      let my = p.constrain(p.mouseY / p.height, 0, 1);
      if (params.invertMouseY) my = 1 - my;
      const targetScaleNorm = 1 - my; // corresponds to size mapping
      const targetAngleNorm = mx; // -45..45 mapped to 0..1
      return { primary: targetScaleNorm, secondary: targetAngleNorm };
    },

    onResize(p) {
      ensureBuffer(p);
    },
  };
} 