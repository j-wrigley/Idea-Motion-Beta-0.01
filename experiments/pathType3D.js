export function createPathType3DExperiment() {
  const params = {
    baseTextSizeRatio: 0.18,
    letterSpacingEm: 0.02,

    shape: 'helix', // 'helix' | 'torusKnot' | 'lissajous' | 'circle'
    count: 60,
    speed: 0.15,

    // common scale (relative to minDim)
    radiusA: 0.35,
    radiusB: 0.18,
    height: 0.4,
    turns: 3.0,
    knotP: 2,
    knotQ: 3,

    tiltXDeg: 12,
    tiltYDeg: -18,
    spinEnabled: true,
    moveEnabled: true,
    spinDegPerSec: 10,
    fovDeg: 60,

    billboard: true,
    completeText: false,
    reverseZOrder: false,
    reverseLetterOrder: false,

    boxEnabled: false,
    boxStrokePx: 1.0,
    boxRadiusPx: 6,
    boxFillOpacity: 0.0,
    boxStrokeOpacity: 0.5,
    boxFillColor: '#FFFFFF',
    boxStrokeColor: '#000000',
  };

  let g3d = null; // WEBGL
  let lastW = 0, lastH = 0;
  let glyphMap = null; // Map<char, {tex, w, h}>
  let cacheKey = '';

  function ensureBuffers(p) {
    if (p.width !== lastW || p.height !== lastH || !g3d) {
      lastW = p.width; lastH = p.height;
      g3d = p.createGraphics(p.width, p.height, p.WEBGL); g3d.pixelDensity(1);
    }
  }

  function buildGlyphs(p, ctx, sizeRatio) {
    const base = Math.max(10, Math.min(p.width, p.height) * sizeRatio);
    const token = (ctx.text && ctx.text.length > 0 ? ctx.text : 'TYPE') + ' ';
    const uniq = Array.from(new Set(token.split('')));
    // Use current p settings to measure metrics
    const asc = Math.ceil(p.textAscent());
    const des = Math.ceil(p.textDescent());
    // Increase padding to prevent clipping
    const padX = Math.ceil(base * 0.4);
    const padY = Math.ceil(base * 0.4);
    const map = new Map();
    for (const ch of uniq) {
      const charW = Math.ceil(Math.max(8, p.textWidth(ch)));
      const w = charW + padX * 2;
      const h = asc + des + padY * 2;
      const tex = p.createGraphics(w, h); tex.pixelDensity(1);
      tex.clear();
      tex.rectMode(tex.CORNER);
      if (params.boxEnabled) {
        const strokeA = Math.max(0, Math.min(1, params.boxStrokeOpacity));
        const fillA = Math.max(0, Math.min(1, params.boxFillOpacity));
        if (fillA > 0.001) {
          const fc = p.color(params.boxFillColor);
          tex.noStroke();
          tex.fill(p.red(fc), p.green(fc), p.blue(fc), fillA * 255);
          tex.rect(0.5, 0.5, w - 1, h - 1, params.boxRadiusPx);
        }
        if (params.boxStrokePx > 0.01 && strokeA > 0.001) {
          const sc = p.color(params.boxStrokeColor);
          tex.noFill();
          tex.stroke(p.red(sc), p.green(sc), p.blue(sc), strokeA * 255);
          tex.strokeWeight(params.boxStrokePx);
          tex.rect(0.5, 0.5, w - 1, h - 1, params.boxRadiusPx);
        }
      }
      // Use global text positioning if provided, otherwise default to center-center
      const position = ctx.textPosition || 'center-center';
      
      // Set text alignment based on position
      if (position.includes('left')) {
        tex.textAlign(tex.LEFT, tex.CENTER);
      } else if (position.includes('right')) {
        tex.textAlign(tex.RIGHT, tex.CENTER);
      } else {
        tex.textAlign(tex.CENTER, tex.CENTER);
      }
      if (ctx.font) tex.textFont(ctx.font);
      tex.textSize(base);
      
      // Apply font weight if provided
      if (ctx.fontWeight) {
        tex.textStyle(tex.NORMAL);
        if (ctx.fontWeight >= 600) {
          tex.textStyle(tex.BOLD);
        }
      }
      // Draw text in the actual type color so we don't tint the whole quad later
      const tc = p.color(ctx.typeColor || '#111111');
      tex.noStroke(); tex.fill(p.red(tc), p.green(tc), p.blue(tc), 255);
      // Center text in the texture
      const centerX = w / 2;
      const centerY = h / 2;
      tex.text(ch, centerX, centerY);
      map.set(ch, { tex, w, h });
    }
    return { map, size: base, token };
  }

  function getPath(shape, t, p, R, r, H, turns, P, Q) {
    // returns {x,y,z, tangent:[tx,ty,tz]}
    if (shape === 'helix') {
      const a = t * turns * p.TWO_PI;
      const x = R * Math.cos(a);
      const y = R * Math.sin(a);
      const z = (t - 0.5) * H;
      // tangent ~ derivative
      const tx = -R * Math.sin(a);
      const ty = R * Math.cos(a);
      const tz = H;
      return { x, y, z, tx, ty, tz };
    }
    if (shape === 'torusKnot') {
      // (P,Q) torus knot parameterization
      const a = t * p.TWO_PI;
      const pa = P * a, qa = Q * a;
      const x = (R + r * Math.cos(qa)) * Math.cos(pa);
      const y = (R + r * Math.cos(qa)) * Math.sin(pa);
      const z = r * Math.sin(qa);
      // numeric tangent
      const dt = 0.001;
      const b = (t + dt) * p.TWO_PI;
      const pb = P * b, qb = Q * b;
      const x2 = (R + r * Math.cos(qb)) * Math.cos(pb);
      const y2 = (R + r * Math.cos(qb)) * Math.sin(pb);
      const z2 = r * Math.sin(qb);
      return { x, y, z, tx: x2 - x, ty: y2 - y, tz: z2 - z };
    }
    if (shape === 'lissajous') {
      const a = 3, b = 2, c = 4;
      const x = R * Math.sin(a * t * p.TWO_PI);
      const y = R * Math.cos(b * t * p.TWO_PI);
      const z = r * Math.sin(c * t * p.TWO_PI);
      const dt = 0.001;
      const x2 = R * Math.sin(a * (t + dt) * p.TWO_PI);
      const y2 = R * Math.cos(b * (t + dt) * p.TWO_PI);
      const z2 = r * Math.sin(c * (t + dt) * p.TWO_PI);
      return { x, y, z, tx: x2 - x, ty: y2 - y, tz: z2 - z };
    }
    // circle in XY with gentle Z wave
    const a = t * p.TWO_PI;
    const x = R * Math.cos(a);
    const y = R * Math.sin(a);
    const z = r * Math.sin(3 * a);
    return { x, y, z, tx: -R * Math.sin(a), ty: R * Math.cos(a), tz: 3 * r * Math.cos(3 * a) };
  }

  return {
    name: 'Path Type 3D',

    getControlDefinitions() {
      return [
        { id: 'textHeading', type: 'heading', label: 'Text' },
        { id: 'baseTextSizeRatio', type: 'range', label: 'Text size', min: 0.08, max: 0.4, step: 0.005, default: 0.18 },
        { id: 'letterSpacingEm', type: 'range', label: 'Letter spacing (em)', min: -0.1, max: 1.5, step: 0.01, default: 0.02 },

        { id: 'pathHeading', type: 'heading', label: 'Path' },
        { id: 'shape', type: 'select', label: 'Shape', options: [
          { value: 'helix', label: 'Helix' },
          { value: 'torusKnot', label: 'Torus knot' },
          { value: 'lissajous', label: 'Lissajous' },
          { value: 'circle', label: 'Circle' },
        ], default: 'helix' },
        { id: 'count', type: 'range', label: 'Count', min: 40, max: 800, step: 1, default: 220 },
        { id: 'completeText', type: 'checkbox', label: 'Finish full text', default: false },
        { id: 'moveEnabled', type: 'checkbox', label: 'Animate movement', default: true },
        { id: 'speed', type: 'range', label: 'Speed', min: -0.5, max: 0.5, step: 0.05, default: 0.15 },
        { id: 'radiusA', type: 'range', label: 'Radius A', min: 0.08, max: 0.7, step: 0.01, default: 0.35 },
        { id: 'radiusB', type: 'range', label: 'Radius B', min: 0.02, max: 0.6, step: 0.01, default: 0.18 },
        { id: 'height', type: 'range', label: 'Height', min: 0.0, max: 1.2, step: 0.02, default: 0.4 },
        { id: 'turns', type: 'range', label: 'Turns (helix)', min: 1.0, max: 12.0, step: 0.1, default: 3.0 },
        { id: 'knotP', type: 'range', label: 'Knot P', min: 1, max: 6, step: 1, default: 2 },
        { id: 'knotQ', type: 'range', label: 'Knot Q', min: 2, max: 9, step: 1, default: 3 },

        { id: 'viewHeading', type: 'heading', label: 'View' },
        { id: 'tiltXDeg', type: 'range', label: 'Tilt X', min: -80, max: 80, step: 1, default: 12 },
        { id: 'tiltYDeg', type: 'range', label: 'Tilt Y', min: -80, max: 80, step: 1, default: -18 },
        { id: 'spinEnabled', type: 'checkbox', label: 'Spin', default: true },
        { id: 'spinDegPerSec', type: 'range', label: 'Spin speed', min: -60, max: 60, step: 5, default: 10 },
        { id: 'fovDeg', type: 'range', label: 'FOV', min: 30, max: 100, step: 1, default: 60 },
        { id: 'billboard', type: 'checkbox', label: 'Billboard to camera', default: true },
        { id: 'reverseZOrder', type: 'checkbox', label: 'Reverse Z-order', default: false },
        { id: 'reverseLetterOrder', type: 'checkbox', label: 'Reverse letter order', default: false },

        { id: 'styleHeading', type: 'heading', label: 'Boxes' },
        { id: 'boxEnabled', type: 'checkbox', label: 'Show box', default: false },
        { id: 'boxFillColor', type: 'color', label: 'Fill color', default: '#FFFFFF' },
        { id: 'boxFillOpacity', type: 'range', label: 'Fill opacity', min: 0.0, max: 1.0, step: 0.05, default: 0.0 },
        { id: 'boxStrokeColor', type: 'color', label: 'Border color', default: '#000000' },
        { id: 'boxStrokeOpacity', type: 'range', label: 'Border opacity', min: 0.0, max: 1.0, step: 0.05, default: 0.5 },
        { id: 'boxStrokePx', type: 'range', label: 'Border (px)', min: 0.0, max: 4.0, step: 0.1, default: 1.0 },
        { id: 'boxRadiusPx', type: 'range', label: 'Corner radius', min: 0, max: 24, step: 1, default: 6 },
      ];
    },

    getParams() { return { ...params }; },
    setParams(next) { Object.assign(params, next); },

    init(p, ctx) { ensureBuffers(p); },

    draw(p, ctx) {
      ensureBuffers(p);

      // Bind helpers
      const isBound = (id) => Array.isArray(ctx.boundIds) && ctx.boundIds.includes(id);
      const normFromAxis = (id, fallbackAxis) => {
        const mx = p.constrain(p.mouseX / p.width, 0, 1);
        const my = p.constrain(p.mouseY / p.height, 0, 1);
        const axis = ctx.getAxis ? ctx.getAxis(id) : (fallbackAxis || 'x');
        const inv = ctx.getInvert ? ctx.getInvert(id) : false;
        let t = axis === 'y' ? (1 - my) : mx; if (inv) t = 1 - t; return Math.max(0, Math.min(1, t));
      };

      // Use global font size instead of experiment's baseTextSizeRatio
      const effSizeRatio = ctx.fontSize ? ctx.fontSize / Math.min(p.width, p.height) : params.baseTextSizeRatio;
      const effLetterEm = isBound('letterSpacingEm') ? p.lerp(-0.1, 1.5, normFromAxis('letterSpacingEm', 'x')) : params.letterSpacingEm;

      const effShape = params.shape;
      const baseCount = Math.round(isBound('count') ? p.lerp(40, 800, normFromAxis('count', 'x')) : params.count);
      const effMove = !!params.moveEnabled;
      const effSpeedBase = isBound('speed') ? p.lerp(-0.5, 0.5, normFromAxis('speed', 'x')) : params.speed;
      const effSpeed = effMove ? effSpeedBase : 0;
      const effRadiusA = (isBound('radiusA') ? p.lerp(0.08, 0.7, normFromAxis('radiusA', 'x')) : params.radiusA) * Math.min(p.width, p.height);
      const effRadiusB = (isBound('radiusB') ? p.lerp(0.02, 0.6, normFromAxis('radiusB', 'x')) : params.radiusB) * Math.min(p.width, p.height);
      const effHeight = (isBound('height') ? p.lerp(0, 1.2, normFromAxis('height', 'y')) : params.height) * Math.min(p.width, p.height);
      const effTurns = isBound('turns') ? p.lerp(1, 12, normFromAxis('turns', 'x')) : params.turns;
      const effKnotP = Math.round(isBound('knotP') ? p.lerp(1, 6, normFromAxis('knotP', 'x')) : params.knotP);
      const effKnotQ = Math.round(isBound('knotQ') ? p.lerp(2, 9, normFromAxis('knotQ', 'y')) : params.knotQ);

      const effTiltX = (isBound('tiltXDeg') ? p.lerp(-80, 80, normFromAxis('tiltXDeg', 'y')) : params.tiltXDeg) * (p.PI / 180);
      const effTiltY = (isBound('tiltYDeg') ? p.lerp(-80, 80, normFromAxis('tiltYDeg', 'x')) : params.tiltYDeg) * (p.PI / 180);
      const effSpinEnabled = !!params.spinEnabled;
      const effSpinBase = (isBound('spinDegPerSec') ? p.lerp(-60, 60, normFromAxis('spinDegPerSec', 'x')) : params.spinDegPerSec) * (p.PI / 180);
      const effSpin = effSpinEnabled ? effSpinBase : 0;
      const effFov = ((isBound('fovDeg') ? p.lerp(30, 100, normFromAxis('fovDeg', 'y')) : params.fovDeg) * p.PI) / 180;
      const effBillboard = !!params.billboard;

      // Build glyphs only when text/size/font or box settings change
      const key = `${lastW}x${lastH}|${ctx.fontSize || 'default'}|${ctx.text}|${ctx.font ? 'f' : 'n'}|${ctx.fontWeight || 'default'}|${ctx.textPosition || 'center-center'}|${ctx.paddingTop || 20}|${ctx.paddingBottom || 20}|${ctx.paddingLeft || 20}|${ctx.paddingRight || 20}|${ctx.typeColor}|${params.boxEnabled}|${params.boxStrokePx}|${params.boxRadiusPx}|${params.boxFillOpacity}|${params.boxStrokeOpacity}|${params.boxFillColor}|${params.boxStrokeColor}`;
      if (key !== cacheKey || !glyphMap) {
        p.push();
        if (ctx.font) p.textFont(ctx.font);
        p.textSize(ctx.fontSize || Math.max(10, Math.min(p.width, p.height) * effSizeRatio));
        
        // Apply font weight if provided
        if (ctx.fontWeight) {
          p.textStyle(p.NORMAL);
          if (ctx.fontWeight >= 600) {
            p.textStyle(p.BOLD);
          }
        }
        const built = buildGlyphs(p, ctx, ctx.fontSize ? ctx.fontSize / Math.min(p.width, p.height) : effSizeRatio);
        glyphMap = built; cacheKey = key;
        p.pop();
      }

      // 3D setup
      g3d.clear();
      const w = g3d.width, h = g3d.height; const aspect = w / h;
      g3d.perspective(effFov, aspect, 1, 10000);
      g3d.push();
      const tsec = p.millis() * 0.001;
      g3d.rotateX(effTiltX);
      g3d.rotateY(effTiltY + effSpin * tsec);

      const token = glyphMap.token;
      const map = glyphMap.map;
      const baseSize = glyphMap.size;
      const letterSpacePx = effLetterEm * baseSize;
      
      // Calculate effective count based on complete text setting
      const cleanText = ctx.text && ctx.text.length > 0 ? ctx.text.replace(/\s+/g, ' ').trim() : 'TYPE';
      let effCount = baseCount;
      if (params.completeText && cleanText.length > 0) {
        // Ensure we show complete repetitions of the text
        const fullReps = Math.floor(baseCount / cleanText.length);
        const remainder = baseCount % cleanText.length;
        // If there's a remainder, complete the current word or full text
        if (remainder > 0) {
          effCount = (fullReps + 1) * cleanText.length;
        } else {
          effCount = fullReps * cleanText.length;
        }
        // Ensure we don't exceed reasonable limits
        effCount = Math.min(effCount, 800);
      }

      // Glyph textures are already colored; no tinting needed

      // Collect placements so we can sort back-to-front when depth is off
      const placements = [];
      // Calculate cumulative spacing to add space between letters
      let cumulativeSpacing = 0;
      for (let i = 0; i < effCount; i++) {
        // Add letter spacing to the phase progression for each letter after the first
        const basePhase = i / effCount;
        const spacingOffset = cumulativeSpacing / (effCount * Math.max(1, Math.PI * (effRadiusA + effRadiusB))); // Normalize by path circumference
        const phase = (basePhase + spacingOffset + tsec * effSpeed);
        const tt = ((phase % 1) + 1) % 1;
        const path = getPath(effShape, tt, p, effRadiusA, effRadiusB, effHeight, effTurns, effKnotP, effKnotQ);
        
        // Choose character based on letter order setting
        let charIndex = i % token.length;
        if (params.reverseLetterOrder) {
          charIndex = (token.length - 1 - (i % token.length));
        }
        const ch = token[charIndex];
        const entry = map.get(ch);
        if (!entry) continue;
        placements.push({ z: path.z, path, entry });
        
        // Add spacing for next letter
        cumulativeSpacing += letterSpacePx;
      }
      // Sort by z ascending (farther first) or descending based on reverseZOrder
      if (params.reverseZOrder) {
        placements.sort((a, b) => b.z - a.z); // Near to far (reverse)
      } else {
        placements.sort((a, b) => a.z - b.z); // Far to near (normal)
      }

      // Disable depth test while drawing alpha textured quads to avoid triangle seams
      const gl = g3d.drawingContext;
      const prevDepthEnabled = gl.isEnabled ? gl.isEnabled(gl.DEPTH_TEST) : true;
      const prevDepthMask = gl.getParameter ? gl.getParameter(gl.DEPTH_WRITEMASK) : true;
      if (gl.disable) gl.disable(gl.DEPTH_TEST);
      if (gl.depthMask) gl.depthMask(false);

      for (const it of placements) {
        const { path, entry } = it;
        const scale = 1.0; // size already baked in
        g3d.push();
        g3d.translate(path.x, path.y, path.z);
        if (effBillboard) {
          // Face camera: inverse of global rotation around Y/X
          g3d.rotateY(- (effTiltY + effSpin * tsec));
          g3d.rotateX(- effTiltX);
        }
        g3d.tint(255, 255, 255, 255);
        g3d.texture(entry.tex);
        g3d.noStroke();
        g3d.plane(entry.w * scale, entry.h * scale);
        g3d.pop();
      }

      // Restore depth state
      if (gl.depthMask) gl.depthMask(prevDepthMask);
      if (gl.enable && prevDepthEnabled) gl.enable(gl.DEPTH_TEST);

      g3d.pop();
      p.image(g3d, 0, 0);
    },

    onResize(p) { ensureBuffers(p); },
  };
} 