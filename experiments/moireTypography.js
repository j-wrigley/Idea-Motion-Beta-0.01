let globalShowPaddingOverlayUntilMs = 0;

export function createMoireTypographyExperiment() {
  const params = {
    baseTextSizeRatio: 0.28,
    lineHeight: 1.1,

    pattern: 'lines', // 'lines' | 'grid' | 'circles' | 'radial'
    spacing1: 10,
    spacing2: 11,
    angle1: 0,
    angle2: 5,
    lineWeight: 1.2,
    opacity: 0.6,

    animate: true,
    speed: 0.4,

    renderOutside: false,
    outsideAlpha: 0.25,
  };

  let pgText = null;      // text mask (white on transparent)
  let pgMoire = null;     // moire lines (transparent background)
  let pgInside = null;    // moire masked inside text
  let pgOutside = null;   // moire masked outside text
  let lastW = 0, lastH = 0;
  let cachedKey = null;   // cache key for text mask

  function ensureBuffers(p) {
    if (p.width !== lastW || p.height !== lastH || !pgText || !pgMoire || !pgInside || !pgOutside) {
      lastW = p.width; lastH = p.height;
      pgText = p.createGraphics(p.width, p.height); pgText.pixelDensity(1);
      pgMoire = p.createGraphics(p.width, p.height); pgMoire.pixelDensity(1);
      pgInside = p.createGraphics(p.width, p.height); pgInside.pixelDensity(1);
      pgOutside = p.createGraphics(p.width, p.height); pgOutside.pixelDensity(1);
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
      const scaleX = Math.min(1, usableW / tw);
      pgText.push(); 
      pgText.translate(centerX, y); 
      if (scaleX !== 1) pgText.scale(scaleX, 1); 
      pgText.text(txt, 0, 0); 
      pgText.pop();
    }
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

  function colorWithAlpha(p, hex, alpha01) {
    const c = p.color(hex);
    c.setAlpha(p.constrain(alpha01, 0, 1) * 255);
    return c;
  }

  function drawParallelLines(p, g, spacing, angleDeg, phasePx, weight, strokeColor) {
    if (spacing < 1) spacing = 1;
    g.push();
    g.translate(g.width / 2, g.height / 2);
    g.rotate(p.radians(angleDeg));
    g.stroke(strokeColor);
    g.strokeWeight(weight);
    g.noFill();
    const diag = Math.sqrt(g.width * g.width + g.height * g.height);
    const half = diag * 0.6; // overdraw a bit
    // normalize phase within [0, spacing)
    const offset = ((phasePx % spacing) + spacing) % spacing;
    for (let y = -half; y <= half; y += spacing) {
      const yy = y + offset - spacing; // so phase scrolls smoothly
      g.line(-half, yy, half, yy);
    }
    g.pop();
  }

  function drawGrid(p, g, spacing, angleDeg, phasePx, weight, strokeColor) {
    drawParallelLines(p, g, spacing, angleDeg, phasePx, weight, strokeColor);
    drawParallelLines(p, g, spacing, angleDeg + 90, phasePx, weight, strokeColor);
  }

  function drawCircles(p, g, spacing, angleDeg, phasePx, weight, strokeColor) {
    // angleDeg not used; keep signature consistent
    g.push();
    g.translate(g.width / 2, g.height / 2);
    g.stroke(strokeColor);
    g.strokeWeight(weight);
    g.noFill();
    const maxR = Math.hypot(g.width, g.height) * 0.6;
    const offset = ((phasePx % spacing) + spacing) % spacing;
    for (let r = offset; r <= maxR; r += spacing) {
      const d = Math.max(0.5, r * 2);
      g.ellipse(0, 0, d, d);
    }
    g.pop();
  }

  function drawRadial(p, g, spacingDeg, angleDeg, phasePx, weight, strokeColor) {
    // spacing treated as angular step in degrees
    const step = Math.max(2, spacingDeg);
    g.push();
    g.translate(g.width / 2, g.height / 2);
    g.rotate(p.radians(angleDeg));
    g.stroke(strokeColor);
    g.strokeWeight(weight);
    g.noFill();
    const R = Math.hypot(g.width, g.height);
    const rotOffset = (phasePx * 0.05) % 360; // translate phase to slow rotation
    for (let a = 0; a < 360; a += step) {
      const A = p.radians(a + rotOffset);
      g.line(0, 0, Math.cos(A) * R, Math.sin(A) * R);
    }
    g.pop();
  }

  function drawPattern(p, g, kind, spacing, angle, phasePx, weight, strokeColor) {
    if (kind === 'grid') return drawGrid(p, g, spacing, angle, phasePx, weight, strokeColor);
    if (kind === 'circles') return drawCircles(p, g, spacing, angle, phasePx, weight, strokeColor);
    if (kind === 'radial') return drawRadial(p, g, spacing, angle, phasePx, weight, strokeColor);
    return drawParallelLines(p, g, spacing, angle, phasePx, weight, strokeColor);
  }

  return {
    name: 'Moire Type',

    getControlDefinitions() {
      return [
        { id: 'textHeading', type: 'heading', label: 'Text' },
        { id: 'baseTextSizeRatio', type: 'range', label: 'Text size', min: 0.12, max: 0.6, step: 0.01, default: 0.28 },
        { id: 'lineHeight', type: 'range', label: 'Line height', min: 0.8, max: 2.0, step: 0.05, default: 1.1 },

        { id: 'moireHeading', type: 'heading', label: 'Moire' },
        { id: 'pattern', type: 'select', label: 'Pattern', options: [
          { value: 'lines', label: 'Lines' },
          { value: 'grid', label: 'Grid' },
          { value: 'circles', label: 'Circles' },
          { value: 'radial', label: 'Radial' },
        ], default: 'lines' },
        { id: 'spacing1', type: 'range', label: 'Spacing 1 (px)', min: 4, max: 60, step: 1, default: 10 },
        { id: 'spacing2', type: 'range', label: 'Spacing 2 (px)', min: 4, max: 60, step: 1, default: 11 },
        { id: 'angle1', type: 'range', label: 'Angle 1 (deg)', min: -90, max: 90, step: 1, default: 0 },
        { id: 'angle2', type: 'range', label: 'Angle 2 (deg)', min: -90, max: 90, step: 1, default: 5 },
        { id: 'lineWeight', type: 'range', label: 'Line weight', min: 0.5, max: 3.0, step: 0.1, default: 1.2 },
        { id: 'opacity', type: 'range', label: 'Opacity', min: 0.1, max: 1.0, step: 0.05, default: 0.6 },

        { id: 'motionHeading', type: 'heading', label: 'Motion' },
        { id: 'animate', type: 'checkbox', label: 'Animate', default: true },
        { id: 'speed', type: 'range', label: 'Speed', min: 0.0, max: 2.0, step: 0.02, default: 0.4 },

        { id: 'maskHeading', type: 'heading', label: 'Masking' },
        { id: 'renderOutside', type: 'checkbox', label: 'Show outside', default: false },
        { id: 'outsideAlpha', type: 'range', label: 'Outside opacity', min: 0.0, max: 1.0, step: 0.05, default: 0.25 },
      ];
    },

    getParams() { return { ...params }; },

    setParams(next) { Object.assign(params, next); },

    init(p, ctx) { ensureBuffers(p); },
    
    showPaddingOverlay() {
      // Use performance.now() to match draw-time checks
      globalShowPaddingOverlayUntilMs = performance.now() + 600; // ~0.6s
    },

    draw(p, ctx) {
      ensureBuffers(p);

      // Mouse bindings
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

      const effPattern = params.pattern;
      const effSpacing1 = Math.max(1, isBound('spacing1') ? Math.round(p.lerp(4, 60, normFromAxis('spacing1', 'x'))) : params.spacing1);
      const effSpacing2 = Math.max(1, isBound('spacing2') ? Math.round(p.lerp(4, 60, normFromAxis('spacing2', 'x'))) : params.spacing2);
      const effAngle1 = isBound('angle1') ? p.lerp(-90, 90, normFromAxis('angle1', 'x')) : params.angle1;
      const effAngle2 = isBound('angle2') ? p.lerp(-90, 90, normFromAxis('angle2', 'x')) : params.angle2;
      const effWeight = isBound('lineWeight') ? p.lerp(0.5, 3.0, normFromAxis('lineWeight', 'y')) : params.lineWeight;
      const effOpacity = isBound('opacity') ? p.lerp(0.1, 1.0, normFromAxis('opacity', 'y')) : params.opacity;
      const effAnimate = !!params.animate;
      const effSpeed = isBound('speed') ? p.lerp(0, 2, normFromAxis('speed', 'x')) : params.speed;
      const effRenderOutside = !!params.renderOutside;
      const effOutsideAlpha = isBound('outsideAlpha') ? p.lerp(0, 1, normFromAxis('outsideAlpha', 'y')) : params.outsideAlpha;

      // Rebuild text mask only if needed
      const key = `${lastW}x${lastH}|${effSizeRatio.toFixed(4)}|${effLineHeight.toFixed(4)}|${ctx.text}|${ctx.font ? 'f' : 'n'}|${ctx.fontSize || 'default'}|${ctx.fontWeight || 'default'}|${ctx.textPosition || 'center-center'}|${ctx.paddingTop || 20}|${ctx.paddingBottom || 20}|${ctx.paddingLeft || 20}|${ctx.paddingRight || 20}`;
      if (cachedKey !== key) {
        drawTextMask(p, ctx, effSizeRatio, effLineHeight);
        cachedKey = key;
      }

      // Draw moire lines to offscreen buffer
      pgMoire.clear();
      const col = colorWithAlpha(p, ctx.typeColor, effOpacity);
      const t = p.millis() * 0.001;
      const phasePx = effAnimate ? (t * 60 * effSpeed) : 0;
      const phasePx2 = effAnimate ? (t * 60 * (effSpeed * 1.07)) : 0;

      drawPattern(p, pgMoire, effPattern, effSpacing1, effAngle1, phasePx, effWeight, col);
      drawPattern(p, pgMoire, effPattern, effSpacing2, effAngle2, phasePx2, effWeight, col);

      // Inside composite: moire masked by text
      pgInside.clear();
      pgInside.image(pgMoire, 0, 0);
      {
        const dc = pgInside.drawingContext;
        const prev = dc.globalCompositeOperation;
        dc.globalCompositeOperation = 'destination-in';
        pgInside.image(pgText, 0, 0);
        dc.globalCompositeOperation = prev;
      }

      // Outside composite: moire with text punched out
      pgOutside.clear();
      if (effRenderOutside) {
        pgOutside.image(pgMoire, 0, 0);
        const dc = pgOutside.drawingContext;
        const prev = dc.globalCompositeOperation;
        dc.globalCompositeOperation = 'destination-out';
        pgOutside.image(pgText, 0, 0);
        dc.globalCompositeOperation = prev;
      }

      // Draw to screen
      p.image(pgInside, 0, 0);
      if (effRenderOutside) {
        p.push();
        const a = p.constrain(effOutsideAlpha, 0, 1);
        p.tint(255, a * 255);
        p.image(pgOutside, 0, 0);
        p.pop();
      }
      
      // Show padding overlay if needed (compare with performance.now clock)
      if (performance.now() < globalShowPaddingOverlayUntilMs) {
        showPaddingOverlay(p, ctx);
      }
    },

    onResize(p) { ensureBuffers(p); },
  };
} 