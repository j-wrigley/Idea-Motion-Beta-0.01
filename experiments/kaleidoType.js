export function createKaleidoTypeExperiment() {
  const params = {
    baseTextSizeRatio: 0.14,
    letterSpacingEm: 0.02,
    spiralStepPx: 3.0,
    charsPerRev: 72,

    segments: 12,
    mirror: true,

    rotationDeg: 0,
    spinSpeedDeg: 12,

    offsetX: 0.0, // -0.4..0.4 of minDim
    offsetY: 0.0,

    scale: 1.0,
    opacity: 1.0,
  };

  let pgCrisp = null;   // crisp spiral
  let pgMask = null;    // wedge mask (alpha)
  let pgWedge = null;   // masked wedge (combined)
  let lastW = 0, lastH = 0;
  let maskKey = '';

  function ensureBuffers(p) {
    if (p.width !== lastW || p.height !== lastH || !pgCrisp || !pgMask || !pgWedge) {
      lastW = p.width; lastH = p.height;
      pgCrisp = p.createGraphics(p.width, p.height); pgCrisp.pixelDensity(1);
      pgMask = p.createGraphics(p.width, p.height); pgMask.pixelDensity(1);
      pgWedge = p.createGraphics(p.width, p.height); pgWedge.pixelDensity(1);
      maskKey = '';
    }
  }

  function buildMaskIfNeeded(p, segs, mirror) {
    const key = `${lastW}x${lastH}|${segs}|${mirror ? 1 : 0}`;
    if (key === maskKey) return;
    pgMask.clear();
    const cx = pgMask.width / 2, cy = pgMask.height / 2;
    const factor = mirror ? 2 : 1;
    const phi = (p.TWO_PI / (segs * factor));
    const a0 = -phi * 0.5;
    const a1 = +phi * 0.5;
    const R = Math.hypot(pgMask.width, pgMask.height);
    pgMask.push();
    pgMask.translate(cx, cy);
    pgMask.noStroke();
    pgMask.fill(255);
    pgMask.beginShape();
    pgMask.vertex(0, 0);
    pgMask.vertex(Math.cos(a0) * R, Math.sin(a0) * R);
    pgMask.vertex(Math.cos(a1) * R, Math.sin(a1) * R);
    pgMask.endShape(p.CLOSE);
    pgMask.pop();
    maskKey = key;
  }

  function hexToRgb(hex) {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(String(hex || '#000000'));
    return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : { r: 0, g: 0, b: 0 };
  }
  function luminance({ r, g, b }) {
    const a = [r, g, b].map(v => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
  }
  function contrastColor(bgHex, typeHex) {
    const bLum = luminance(hexToRgb(bgHex));
    const tLum = luminance(hexToRgb(typeHex));
    // Pick the color (black/white) that contrasts more with fill
    const whiteContrast = (1.05) / (tLum + 0.05);
    const blackContrast = (tLum + 0.05) / 0.05;
    return whiteContrast > blackContrast ? '#FFFFFF' : '#000000';
  }

  return {
    name: 'Kaleido Type',

    getControlDefinitions() {
      return [
        { id: 'textHeading', type: 'heading', label: 'Text' },
        { id: 'baseTextSizeRatio', type: 'range', label: 'Text size', min: 0.06, max: 0.4, step: 0.005, default: 0.14 },
        { id: 'letterSpacingEm', type: 'range', label: 'Letter spacing (em)', min: 0, max: 0.5, step: 0.01, default: 0.02 },
        { id: 'spiralStepPx', type: 'range', label: 'Spiral step (px)', min: 0.5, max: 12, step: 0.5, default: 3.0 },
        { id: 'charsPerRev', type: 'range', label: 'Chars per rev', min: 6, max: 200, step: 1, default: 72 },

        { id: 'symHeading', type: 'heading', label: 'Symmetry' },
        { id: 'segments', type: 'range', label: 'Segments', min: 3, max: 40, step: 1, default: 12 },
        { id: 'mirror', type: 'checkbox', label: 'Mirror', default: true },

        { id: 'styleHeading', type: 'heading', label: 'Style' },
        { id: 'scale', type: 'range', label: 'Scale', min: 0.5, max: 1.8, step: 0.02, default: 1.0 },
        { id: 'opacity', type: 'range', label: 'Opacity', min: 0.2, max: 1.0, step: 0.02, default: 1.0 },

        { id: 'motionHeading', type: 'heading', label: 'Motion' },
        { id: 'rotationDeg', type: 'range', label: 'Rotation', min: -180, max: 180, step: 1, default: 0 },
        { id: 'spinSpeedDeg', type: 'range', label: 'Spin speed', min: -180, max: 180, step: 1, default: 12 },

        { id: 'offsetHeading', type: 'heading', label: 'Center offset' },
        { id: 'offsetX', type: 'range', label: 'Offset X', min: -0.4, max: 0.4, step: 0.01, default: 0.0 },
        { id: 'offsetY', type: 'range', label: 'Offset Y', min: -0.4, max: 0.4, step: 0.01, default: 0.0 },
      ];
    },

    getParams() { return { ...params }; },

    setParams(next) { Object.assign(params, next); },

    init(p) { ensureBuffers(p); },

    draw(p, ctx) {
      ensureBuffers(p);

      // Mouse binding helpers
      const isBound = (id) => Array.isArray(ctx.boundIds) && ctx.boundIds.includes(id);
      const normFromAxis = (id, fallbackAxis) => {
        const mx = p.constrain(p.mouseX / p.width, 0, 1);
        const my = p.constrain(p.mouseY / p.height, 0, 1);
        const axis = ctx.getAxis ? ctx.getAxis(id) : (fallbackAxis || 'x');
        const inv = ctx.getInvert ? ctx.getInvert(id) : false;
        let t = axis === 'y' ? (1 - my) : mx; if (inv) t = 1 - t; return Math.max(0, Math.min(1, t));
      };

      const effSizeRatio = isBound('baseTextSizeRatio') ? p.lerp(0.06, 0.4, normFromAxis('baseTextSizeRatio', 'y')) : params.baseTextSizeRatio;
      const effLetterEm = isBound('letterSpacingEm') ? p.lerp(0, 0.5, normFromAxis('letterSpacingEm', 'x')) : params.letterSpacingEm;
      const effStepPx = isBound('spiralStepPx') ? p.lerp(0.5, 12, normFromAxis('spiralStepPx', 'y')) : params.spiralStepPx;
      const effCharsPerRev = Math.max(6, Math.round(isBound('charsPerRev') ? p.lerp(6, 200, normFromAxis('charsPerRev', 'x')) : params.charsPerRev));

      const effSegments = Math.max(3, Math.round(isBound('segments') ? p.lerp(3, 40, normFromAxis('segments', 'x')) : params.segments));
      const effMirror = !!params.mirror;

      const effRot = (isBound('rotationDeg') ? p.lerp(-180, 180, normFromAxis('rotationDeg', 'x')) : params.rotationDeg) * (p.PI / 180);
      const effSpin = (isBound('spinSpeedDeg') ? p.lerp(-180, 180, normFromAxis('spinSpeedDeg', 'x')) : params.spinSpeedDeg) * (p.PI / 180);

      const effOffX = (isBound('offsetX') ? p.lerp(-0.4, 0.4, normFromAxis('offsetX', 'x')) : params.offsetX);
      const effOffY = (isBound('offsetY') ? p.lerp(-0.4, 0.4, normFromAxis('offsetY', 'y')) : params.offsetY);

      const effScale = isBound('scale') ? p.lerp(0.5, 1.8, normFromAxis('scale', 'y')) : params.scale;
      const effOpacity = isBound('opacity') ? p.lerp(0.2, 1.0, normFromAxis('opacity', 'y')) : params.opacity;

      buildMaskIfNeeded(p, effSegments, effMirror);

      // Build crisp spiral into pgCrisp
      pgCrisp.clear();
      if (ctx.font) pgCrisp.textFont(ctx.font);
      const baseTextSize = ctx.fontSize || Math.max(8, Math.min(pgCrisp.width, pgCrisp.height) * effSizeRatio);
      pgCrisp.textSize(baseTextSize);
      
      // Use global text positioning if provided, otherwise default to center-center
      const position = ctx.textPosition || 'center-center';
      
      // Set text alignment based on position
      if (position.includes('left')) {
        pgCrisp.textAlign(pgCrisp.LEFT, pgCrisp.CENTER);
      } else if (position.includes('right')) {
        pgCrisp.textAlign(pgCrisp.RIGHT, pgCrisp.CENTER);
      } else {
        pgCrisp.textAlign(pgCrisp.CENTER, pgCrisp.CENTER);
      }
      
      // Apply font weight if provided
      if (ctx.fontWeight) {
        pgCrisp.textStyle(pgCrisp.NORMAL);
        if (ctx.fontWeight >= 600) {
          pgCrisp.textStyle(pgCrisp.BOLD);
        }
      }

      const minDim = Math.min(pgCrisp.width, pgCrisp.height);
      
      // Calculate positioning based on text position (like Radial Rings)
      let cx, cy;
      
      // Calculate X position based on horizontal alignment
      if (position.includes('left')) {
        cx = pgCrisp.width * 0.25 + effOffX * minDim;
      } else if (position.includes('right')) {
        cx = pgCrisp.width * 0.75 + effOffX * minDim;
      } else {
        cx = pgCrisp.width / 2 + effOffX * minDim; // Center
      }
      
      // Calculate Y position based on vertical alignment
      if (position.includes('top')) {
        cy = pgCrisp.height * 0.25 + effOffY * minDim;
      } else if (position.includes('bottom')) {
        cy = pgCrisp.height * 0.75 + effOffY * minDim;
      } else {
        cy = pgCrisp.height / 2 + effOffY * minDim; // Center
      }

      const token = (ctx.text && ctx.text.length > 0 ? ctx.text : 'TYPE');
      const glyphs = (token + ' ');
      const letterSpacePx = effLetterEm * baseTextSize;
      const thetaStep = p.TWO_PI / effCharsPerRev;

      let theta = 0; let r = Math.max(4, baseTextSize * 0.4); const R = Math.hypot(pgCrisp.width, pgCrisp.height) * 0.75; let idx = 0;
      pgCrisp.noStroke(); pgCrisp.fill(ctx.typeColor);
      while (r < R && idx < 20000) {
        const ch = glyphs[idx % glyphs.length];
        const x = cx + Math.cos(theta) * r;
        const y = cy + Math.sin(theta) * r;
        pgCrisp.push();
        pgCrisp.translate(x, y);
        pgCrisp.rotate(theta + p.HALF_PI);
        pgCrisp.text(ch, 0, 0);
        pgCrisp.pop();
        r += effStepPx;
        theta += thetaStep * (1 + letterSpacePx / Math.max(1, baseTextSize));
        idx++;
      }

      // Compose wedge: crisp, then mask
      pgWedge.clear();
      pgWedge.image(pgCrisp, 0, 0);
      const dcw2 = pgWedge.drawingContext; const prev = dcw2.globalCompositeOperation; dcw2.globalCompositeOperation = 'destination-in';
      pgWedge.image(pgMask, 0, 0);
      dcw2.globalCompositeOperation = prev;

      // Draw kaleidoscope to screen
      p.push();
      p.translate(p.width / 2, p.height / 2);
      p.scale(effScale);
      const time = p.millis() * 0.001; const spin = effRot + effSpin * time;
      for (let i = 0; i < effSegments; i++) {
        p.push();
        p.rotate(i * (p.TWO_PI / effSegments) + spin);
        if (effMirror && (i % 2 === 1)) p.scale(-1, 1);
        p.tint(255, effOpacity * 255);
        p.image(pgWedge, -p.width / 2, -p.height / 2);
        p.noTint();
        p.pop();
      }
      p.pop();
    },

    onResize(p) { ensureBuffers(p); buildMaskIfNeeded(p, params.segments, params.mirror); },
  };
} 