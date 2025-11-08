let globalShowPaddingOverlayUntilMs = 0;

export function createContourTypographyExperiment() {
  const params = {
    baseTextSizeRatio: 0.28,
    lineHeight: 1.1,
    layers: 28,
    blurRangePx: 22,
    spacing: 0.03, // threshold spacing (0..1)
    gridSize: 6, // sampling grid in px
    strokeWeight: 1.2,
    warpAmount: 6.0,
    warpScale: 0.008,
    warpSpeed: 0.4,
    jitter: 0.015,
    insideOnly: false,
  };

  let pgText = null;   // sharp text (white on black)
  let pgBlur = null;   // blurred copy for outside falloff
  let lastW = 0, lastH = 0;
  let cachedKey = null; // cache key for blur/text

  function ensureBuffers(p) {
    if (p.width !== lastW || p.height !== lastH || !pgText || !pgBlur) {
      lastW = p.width; lastH = p.height;
      pgText = p.createGraphics(p.width, p.height); pgText.pixelDensity(1);
      pgBlur = p.createGraphics(p.width, p.height); pgBlur.pixelDensity(1);
      cachedKey = null;
    }
  }

  function drawTextMask(p, ctx, sizeRatio, lineHeight) {
    pgText.clear();
    
    // Get padding values
    const paddingTop = ctx.paddingTop || 20;
    const paddingBottom = ctx.paddingBottom || 20;
    const paddingLeft = ctx.paddingLeft || 20;
    const paddingRight = ctx.paddingRight || 20;
    
    // Calculate usable area
    const usableW = pgText.width - paddingLeft - paddingRight;
    const usableH = pgText.height - paddingTop - paddingBottom;
    
    // Use global text positioning if provided, otherwise default to center-center
    const position = ctx.textPosition || 'center-center';
    
    // Set text alignment based on position
    if (position.includes('left')) {
      pgText.textAlign(pgText.LEFT, pgText.BASELINE);
    } else if (position.includes('right')) {
      pgText.textAlign(pgText.RIGHT, pgText.BASELINE);
    } else {
      pgText.textAlign(pgText.CENTER, pgText.BASELINE);
    }
    
    if (ctx.font) pgText.textFont(ctx.font);
    const baseTextSize = ctx.fontSize || Math.max(12, Math.min(usableW, usableH) * sizeRatio);
    pgText.textSize(baseTextSize);
    
    // Apply font weight if provided
    if (ctx.fontWeight) {
      pgText.textStyle(pgText.NORMAL);
      if (ctx.fontWeight >= 600) {
        pgText.textStyle(pgText.BOLD);
      }
    }
    pgText.noStroke(); pgText.fill(255);
    const textRaw = ctx.text && ctx.text.length > 0 ? ctx.text : 'TYPE';
    const lines = textRaw.split(/\r?\n/);
    const lineAdvance = baseTextSize * lineHeight;
    const totalHeight = lineAdvance * lines.length;
    
    // Calculate text position based on alignment and padding
    let startY, centerX;
    
    if (position.includes('top')) {
      startY = paddingTop + lineAdvance;
    } else if (position.includes('bottom')) {
      startY = pgText.height - paddingBottom - (totalHeight - lineAdvance);
    } else {
      // Center vertically
      startY = paddingTop + (usableH - totalHeight) / 2 + lineAdvance;
    }
    
    if (position.includes('left')) {
      centerX = paddingLeft;
    } else if (position.includes('right')) {
      centerX = pgText.width - paddingRight;
    } else {
      // Center horizontally
      centerX = paddingLeft + usableW / 2;
    }
    
    for (let li = 0; li < lines.length; li++) {
      const txt = lines[li]; 
      const y = startY + li * lineAdvance;
      const tw = Math.max(1, pgText.textWidth(txt));
      const sx = Math.min(1, usableW / tw);
      pgText.push(); 
      pgText.translate(centerX, y); 
      if (sx !== 1) pgText.scale(sx, 1); 
      pgText.text(txt, 0, 0); 
      pgText.pop();
    }
  }

  function applyBlurTo(dst, amountPx, src) {
    dst.clear();
    const ctx2 = dst.drawingContext; const prev = ctx2.filter;
    ctx2.filter = amountPx > 0 ? `blur(${Math.max(0, amountPx).toFixed(1)}px)` : 'none';
    dst.image(src, 0, 0);
    ctx2.filter = prev;
  }

  function showPaddingOverlay(p, ctx) {
    const paddingTop = ctx.paddingTop || 20;
    const paddingBottom = ctx.paddingBottom || 20;
    const paddingLeft = ctx.paddingLeft || 20;
    const paddingRight = ctx.paddingRight || 20;
    
    p.push();
    p.noFill();
    
    // Red padding boundary lines
    p.stroke(255, 59, 48, 200); // red with slight transparency
    p.strokeWeight(1.25);
    const ctx2d = p.drawingContext;
    
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
    
    // Draw all four boundary lines
    p.line(x1, y1, x2, y1); // top
    p.line(x1, y2, x2, y2); // bottom
    p.line(x1, y1, x1, y2); // left
    p.line(x2, y1, x2, y2); // right
    
    // Restore previous line style
    ctx2d.setLineDash(prevDash);
    ctx2d.lineCap = prevCap;
    p.pop();
  }

  function sampleNormFromBlur(x, y) {
    const xi = Math.max(0, Math.min(pgBlur.width - 1, x | 0));
    const yi = Math.max(0, Math.min(pgBlur.height - 1, y | 0));
    const idx = 4 * (yi * pgBlur.width + xi);
    // Use alpha channel for scalar field so blur produces a proper falloff (white text on transparent bg)
    return pgBlur.pixels[idx + 3] / 255;
  }

  function sampleInsideMask(x, y) {
    const xi = Math.max(0, Math.min(pgText.width - 1, x | 0));
    const yi = Math.max(0, Math.min(pgText.height - 1, y | 0));
    const idx = 4 * (yi * pgText.width + xi);
    return pgText.pixels[idx] > 128; // true if inside white text
  }

  function buildField(p, effGrid, warp) {
    const cols = Math.floor(pgBlur.width / effGrid) + 1;
    const rows = Math.floor(pgBlur.height / effGrid) + 1;
    const norms = Array(rows);
    for (let j = 0; j < rows; j++) {
      norms[j] = new Float32Array(cols);
    }
    for (let j = 0; j < rows; j++) {
      const y = Math.min(pgBlur.height - 1, j * effGrid);
      for (let i = 0; i < cols; i++) {
        const x = Math.min(pgBlur.width - 1, i * effGrid);
        const w = warp(x, y);
        norms[j][i] = sampleNormFromBlur(x + w.x, y + w.y);
      }
    }
    return { norms, cols, rows };
  }

  function marchingSquaresOnField(field, threshold, effGrid) {
    const { norms, cols, rows } = field;
    const lines = [];
    const interp = (xa, ya, va, xb, yb, vb) => {
      const t = va - vb === 0 ? 0.5 : (threshold - va) / (vb - va);
      return { x: xa + (xb - xa) * t, y: ya + (yb - ya) * t };
    };
    for (let j = 0; j < rows - 1; j++) {
      const y0 = j * effGrid, y1 = (j + 1) * effGrid;
      for (let i = 0; i < cols - 1; i++) {
        const x0 = i * effGrid, x1 = (i + 1) * effGrid;
        const v0 = norms[j][i];
        const v1 = norms[j][i + 1];
        const v2 = norms[j + 1][i + 1];
        const v3 = norms[j + 1][i];
        const c0 = v0 > threshold ? 1 : 0;
        const c1 = v1 > threshold ? 2 : 0;
        const c2 = v2 > threshold ? 4 : 0;
        const c3 = v3 > threshold ? 8 : 0;
        const idx = c0 | c1 | c2 | c3;
        if (idx === 0 || idx === 15) continue;
        let segs = null;
        switch (idx) {
          case 1: case 14: segs = [[interp(x0, y0, v0, x1, y0, v1), interp(x0, y0, v0, x0, y1, v3)]]; break;
          case 2: case 13: segs = [[interp(x1, y0, v1, x1, y1, v2), interp(x0, y0, v0, x1, y0, v1)]]; break;
          case 3: case 12: segs = [[interp(x1, y0, v1, x1, y1, v2), interp(x0, y0, v0, x0, y1, v3)]]; break;
          case 4: case 11: segs = [[interp(x1, y0, v1, x1, y1, v2), interp(x0, y1, v3, x1, y1, v2)]]; break;
          case 5: segs = [[interp(x0, y0, v0, x1, y0, v1), interp(x0, y1, v3, x1, y1, v2)]]; break;
          case 6: case 9: segs = [[interp(x0, y0, v0, x1, y0, v1), interp(x0, y1, v3, x1, y1, v2)]]; break;
          case 7: case 8: segs = [[interp(x0, y1, v3, x1, y1, v2), interp(x0, y0, v0, x0, y1, v3)]]; break;
          case 10: segs = [ [interp(x0, y0, v0, x1, y0, v1), interp(x0, y1, v3, x1, y1, v2)] ]; break;
          default: break;
        }
        if (!segs) continue;
        for (const [a, b] of segs) {
          if (params.insideOnly) {
            const mx = (a.x + b.x) * 0.5, my = (a.y + b.y) * 0.5;
            if (!sampleInsideMask(mx, my)) continue;
          }
          lines.push([a, b]);
        }
      }
    }
    return lines;
  }

  return {
    name: 'Contour Lines',

    getControlDefinitions() {
      return [
        { id: 'textHeading', type: 'heading', label: 'Text' },
        { id: 'baseTextSizeRatio', type: 'range', label: 'Text size', min: 0.12, max: 0.6, step: 0.01, default: 0.28 },
        { id: 'lineHeight', type: 'range', label: 'Line height', min: 0.8, max: 2.0, step: 0.05, default: 1.1 },

        { id: 'contourHeading', type: 'heading', label: 'Contours' },
        { id: 'layers', type: 'range', label: 'Layers', min: 6, max: 120, step: 2, default: 28 },
        { id: 'spacing', type: 'range', label: 'Spacing', min: 0.008, max: 0.12, step: 0.002, default: 0.03 },
        { id: 'blurRangePx', type: 'range', label: 'Outer range', min: 0, max: 64, step: 1, default: 22 },
        { id: 'gridSize', type: 'range', label: 'Grid size', min: 3, max: 14, step: 1, default: 6 },
        { id: 'strokeWeight', type: 'range', label: 'Line weight', min: 0.4, max: 4.0, step: 0.1, default: 1.2 },
        { id: 'insideOnly', type: 'checkbox', label: 'Inside only', default: false },

        { id: 'warpHeading', type: 'heading', label: 'Warp' },
        { id: 'warpAmount', type: 'range', label: 'Amount', min: 0.0, max: 14.0, step: 0.2, default: 6.0 },
        { id: 'warpScale', type: 'range', label: 'Scale', min: 0.002, max: 0.04, step: 0.001, default: 0.008 },
        { id: 'warpSpeed', type: 'range', label: 'Speed', min: 0.0, max: 2.0, step: 0.02, default: 0.4 },
        { id: 'jitter', type: 'range', label: 'Threshold jitter', min: 0.0, max: 0.08, step: 0.002, default: 0.015 },
      ];
    },

    getParams() { return { ...params }; },

    setParams(next) { Object.assign(params, next); },

    init(p, ctx) { ensureBuffers(p); },
    
    showPaddingOverlay() {
      // Use performance.now() for consistency with other experiments
      globalShowPaddingOverlayUntilMs = performance.now() + 600; // ~0.6s
    },

    draw(p, ctx) {
      ensureBuffers(p);

      // Effective bindings
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
      const effLayers = Math.round(params.layers);
      const effSpacing = params.spacing;
      
      const effBlur = params.blurRangePx;
      // use grid exactly as set (no adaptive scaling here so Spacing/Layers remain visible)
      const effGrid = Math.max(3, Math.round(params.gridSize));
      const effStroke = params.strokeWeight;
      const effWarpAmt = params.warpAmount;
      const effWarpScale = params.warpScale;
      const effWarpSpeed = params.warpSpeed;
      const effJitter = params.jitter;
      

      // Rebuild field only if dirty
      const key = `${lastW}x${lastH}|${effSizeRatio.toFixed(4)}|${effLineHeight.toFixed(4)}|${effBlur.toFixed(2)}|${effLayers}|${effSpacing.toFixed(4)}|${effGrid}|${effStroke.toFixed(2)}|${ctx.text}|${ctx.font ? 'f' : 'n'}|${ctx.fontSize || 'default'}|${ctx.fontWeight || 'default'}|${ctx.textPosition || 'center-center'}|${ctx.paddingTop || 20}|${ctx.paddingBottom || 20}|${ctx.paddingLeft || 20}|${ctx.paddingRight || 20}`;
      
      
      if (cachedKey !== key) {
        drawTextMask(p, ctx, effSizeRatio, effLineHeight);
        applyBlurTo(pgBlur, effBlur, pgText);
        pgBlur.loadPixels();
        pgText.loadPixels();
        cachedKey = key;
      }

      const time = p.millis() * 0.001;
      const warpFn = (sx, sy) => {
        if (effWarpAmt <= 0) return { x: 0, y: 0 };
        const nx = p.noise(sx * effWarpScale, sy * effWarpScale, time * effWarpSpeed);
        const ny = p.noise(100 + sx * effWarpScale, 100 + sy * effWarpScale, time * effWarpSpeed);
        const ax = (nx - 0.5) * 2 * effWarpAmt; const ay = (ny - 0.5) * 2 * effWarpAmt;
        return { x: ax, y: ay };
      };

      // Build warped scalar field once per frame
      const field = buildField(p, effGrid, warpFn);

      // Draw contours
      p.stroke(ctx.typeColor);
      p.noFill();
      p.strokeWeight(effStroke);

      // Build threshold list based on spacing across [0.05..0.95]
      const thresholds = [];
      const start = Math.max(0.05, effSpacing);
      for (let t = start; t <= 0.95; t += effSpacing) thresholds.push(t);
      const count = Math.min(effLayers, thresholds.length);
      

      
      for (let i = 0; i < count; i++) {
        const baseT = thresholds[i];
        const tJ = baseT + (p.noise(17 + i * 0.37, time * 0.7) - 0.5) * effJitter;
        const threshold = Math.max(0.01, Math.min(0.99, tJ));
        const segs = marchingSquaresOnField(field, threshold, effGrid);
        for (const [a, b] of segs) {
          p.line(a.x, a.y, b.x, b.y);
        }
      }
      
      // Show padding overlay if needed (performance.now clock)
      if (performance.now() < globalShowPaddingOverlayUntilMs) {
        showPaddingOverlay(p, ctx);
      }
    },

    onResize(p) { ensureBuffers(p); },
  };
} 